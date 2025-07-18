import { NextResponse } from "next/server";
import { getGeminiModel, getGeminiModelByIndex } from "@/utils/gemini-client";
import sharp from "sharp";
import pLimit from "p-limit";

// Constants for configuration
const CONFIG = {
  CHUNK_SIZE: 3, // Process 3 images at a time
  MAX_RETRIES: 2,
  TIMEOUTS: {
    IMAGE_DOWNLOAD: 15000, // 15 seconds
    IMAGE_PROCESSING: 20000, // 20 seconds
    MODEL_INFERENCE: 30000, // 30 seconds
  },
  LIMITS: {
    MAX_FILE_SIZE: 15 * 1024 * 1024, // 15MB
    MAX_IMAGE_DIMENSION: 4096,
    MIN_IMAGE_DIMENSION: 10,
    MAX_BATCH_SIZE: 20, // Maximum images to process in one request
  },
  RETRY_DELAY: 1000, // 1 second between retries
};

// Types
interface ImageResult {
  pageNumber: number;
  fileName: string;
  driveImageId: string;
  extractedText: string;
  rawResponse: string;
  success: boolean;
  error?: string;
}

interface ImageInput {
  id?: string;
  name: string;
  url?: string;
  mimeType?: string;
  pageNumber: number;
}

// Utility function to implement timeout
const withTimeout = async (
  promise: Promise<any>,
  ms: number,
  operation: string
) => {
  let timeoutId: NodeJS.Timeout | undefined;

  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${operation} operation timed out after ${ms}ms`));
    }, ms);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    if (timeoutId) clearTimeout(timeoutId);
    return result;
  } catch (error) {
    if (timeoutId) clearTimeout(timeoutId);
    throw error;
  }
};

// Function to download image with fallback methods
async function downloadImageWithFallback(
  image: ImageInput,
  accessToken: string | null
): Promise<Buffer> {
  // For regular URLs
  if (image.url && !image.url.includes("drive.google.com")) {
    const response = await fetch(image.url);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  // For Google Drive images
  if (!accessToken) {
    throw new Error("Access token required for Google Drive images");
  }

  try {
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${image.id}?alt=media`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(
        `Failed to download from Google Drive: ${response.statusText}`
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    throw new Error(
      `Failed to download image: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

// Function to process a single image with retries
async function processImage(
  image: any,
  accessToken: string | null,
  model: any,
  prompt: string,
  retryCount = 0
): Promise<ImageResult> {
  try {
    // Download image with timeout
    const imageBuffer = await withTimeout(
      downloadImageWithFallback(image, accessToken),
      CONFIG.TIMEOUTS.IMAGE_DOWNLOAD,
      "Image download"
    );

    // Process image with timeout
    const processedBuffer = await withTimeout(
      optimizeImage(imageBuffer, image.name),
      CONFIG.TIMEOUTS.IMAGE_PROCESSING,
      "Image processing"
    );

    // Generate text with timeout
    const result = await withTimeout(
      generateText(processedBuffer, model, prompt),
      CONFIG.TIMEOUTS.MODEL_INFERENCE,
      "Text generation"
    );

    return {
      pageNumber: image.pageNumber,
      fileName: image.name,
      driveImageId: image.id || "url-image",
      extractedText: result.text,
      rawResponse: result.raw,
      success: true,
    };
  } catch (error: any) {
    // Handle retries
    if (retryCount < CONFIG.MAX_RETRIES) {
      await new Promise((resolve) => setTimeout(resolve, CONFIG.RETRY_DELAY));
      return processImage(image, accessToken, model, prompt, retryCount + 1);
    }

    return {
      pageNumber: image.pageNumber,
      fileName: image.name,
      driveImageId: image.id || "url-image",
      extractedText: "",
      rawResponse: "",
      success: false,
      error: error.message,
    };
  }
}

// Function to optimize image
async function optimizeImage(
  buffer: Buffer,
  fileName: string
): Promise<Buffer> {
  const metadata = await sharp(buffer).metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error("Invalid image dimensions");
  }

  if (
    metadata.width < CONFIG.LIMITS.MIN_IMAGE_DIMENSION ||
    metadata.height < CONFIG.LIMITS.MIN_IMAGE_DIMENSION
  ) {
    throw new Error("Image dimensions too small");
  }

  let needsResize = false;
  let targetWidth = metadata.width;
  let targetHeight = metadata.height;

  if (buffer.length > CONFIG.LIMITS.MAX_FILE_SIZE) {
    needsResize = true;
  }

  if (metadata.width > CONFIG.LIMITS.MAX_IMAGE_DIMENSION) {
    needsResize = true;
    const ratio = CONFIG.LIMITS.MAX_IMAGE_DIMENSION / metadata.width;
    targetWidth = CONFIG.LIMITS.MAX_IMAGE_DIMENSION;
    targetHeight = Math.round(metadata.height * ratio);
  }

  if (metadata.height > CONFIG.LIMITS.MAX_IMAGE_DIMENSION) {
    needsResize = true;
    const ratio = CONFIG.LIMITS.MAX_IMAGE_DIMENSION / metadata.height;
    targetHeight = CONFIG.LIMITS.MAX_IMAGE_DIMENSION;
    targetWidth = Math.round(metadata.width * ratio);
  }

  if (!needsResize) {
    return buffer;
  }

  return sharp(buffer)
    .resize(targetWidth, targetHeight, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 85 })
    .toBuffer();
}

// Function to generate text from image
async function generateText(buffer: Buffer, model: any, prompt: string) {
  const base64Image = buffer.toString("base64");

  const requestPayload = {
    inlineData: {
      data: base64Image,
      mimeType: "image/jpeg",
    },
  };

  const result = await model.generateContent([
    requestPayload,
    { text: prompt },
  ]);
  const response = await result.response;

  return {
    text: response.text().trim(),
    raw: response.text(),
  };
}

// Main route handler
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      images,
      sourceLanguage = "Korean",
      apiKeyIndex,
      accessToken,
    } = body;

    // Validate input
    if (!images?.length) {
      return NextResponse.json(
        { error: "Images array is required" },
        { status: 400 }
      );
    }

    if (images.length > CONFIG.LIMITS.MAX_BATCH_SIZE) {
      return NextResponse.json(
        {
          error: `Maximum batch size is ${CONFIG.LIMITS.MAX_BATCH_SIZE} images`,
        },
        { status: 400 }
      );
    }

    // Initialize model
    const model =
      typeof apiKeyIndex === "number"
        ? await getGeminiModelByIndex(apiKeyIndex)
        : await getGeminiModel();

    // Sort images by filename before chunking
    const sortedImages = [...images].sort((a, b) => {
      // Extract numbers from filenames (e.g., "01.jpg" -> 1)
      const getNumber = (filename: string) => {
        const match = filename.match(/\d+/);
        return match ? parseInt(match[0]) : 0;
      };
      return getNumber(a.name) - getNumber(b.name);
    });

    // Process images in chunks
    const limit = pLimit(CONFIG.CHUNK_SIZE);
    const chunks = [];

    for (let i = 0; i < images.length; i += CONFIG.CHUNK_SIZE) {
      chunks.push(sortedImages.slice(i, i + CONFIG.CHUNK_SIZE));
    }

    const results = [];

    let globalPageNumber = 1;
    for (const chunk of chunks) {
      const chunkPromises = chunk.map((image: ImageInput, idx: number) => {
        return limit(() =>
          processImage(
            { ...image, pageNumber: globalPageNumber++ },
            accessToken,
            model,
            prompt
          )
        );
      });

      const chunkResults = await Promise.all(chunkPromises);
      results.push(...chunkResults);
    }

    // Sort final results by page number to ensure correct order
    results.sort((a, b) => a.pageNumber - b.pageNumber);

    // Prepare response
    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.length - successCount;

    const validResults = results.filter(
      (r) =>
        r.success && r.extractedText && r.extractedText !== "[NO_TEXT_CHUNK]"
    );

    const combinedText = validResults
      .map(
        (r) =>
          `=== Page ${r.pageNumber} (${r.fileName}) ===\n\n${r.extractedText}`
      )
      .join("\n\n");

    return NextResponse.json({
      success: true,
      extractedText: combinedText,
      processedImages: images.length,
      results: results,
      totalImages: images.length,
      successCount,
      failureCount,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: `Failed to extract text: ${error.message}`,
        details: error.stack,
      },
      { status: 500 }
    );
  }
}

// Prompt template
const prompt = `
You are an expert OCR assistant for Korean Manhwa/Manhua and Japanese Manga/Manhwa. Your mission is to extract *all relevant text* from the provided image segment and rigorously classify each text element based solely on its visual container, according to the classification schema detailed below. *Ignore any stylized text that appears to be sound effects (SFX).*

**Classification Schema and Prefixes:**

1. Normal Dialogue Bubble  
  - Prefix: "":  
  - Visual Cues: Rounded, smooth-edged bubble with a subtle pointer tail, conveying clean, neutral dialogue.  
  - Note: For multi-part dialogue across connected bubbles, use the subsequent prefix ⁠ //: ⁠ to denote continuation.

2. Thought Bubble  
  - Prefix: ():  
  - Visual Cues: Cloud-like, irregular, or softly spiked outline (often without a tail) representing internal monologue or private reflections.

3. Shouting Bubble  
  - Prefix: ::  
  - Visual Cues: Bold, enlarged text within a jagged, spiky bubble designed for emphatic or shouted dialogue.

4. Boxed/Caption Bubble  
  - Prefix: []:  
  - Visual Cues: Rectangular or square box with defined borders, used for narration, structured inner dialogue, system panels, or chat UI elements.  
  - Note: Apply this prefix for any panel that is not a traditional speech bubble.

5. Ambient/Free-Floating Small Text  
  - Prefix: ST:  
  - Visual Cues: Compact, offshoot text usually adjacent to a primary bubble, used for whispers, side-comments, or subtle background expressions.

6. Outer Text / Narration  
  - Prefix: OT:  
  - Visual Cues: Plain text directly rendered on the background outside any defined bubble; ideal for scene-setting or descriptive narrative.

7. Sound Effects  
  - Prefix: SFX:  
  - Visual Cues: Dynamic, stylized, and often oversized text representing onomatopoeia such as "BAM" or "WHOOSH".

**Instructions:**  
1. Analyze the provided image segment for every text element.  
2. Classify each text element based solely on its visual container and the schema above.  
3. *Do NOT include sound effects (SFX) or onomatopoeia in the output.*  
4. Consolidate multi-line text from a single visual container into one line; do not merge separate containers.  
5. Output each classified text element on its own line, *with exactly one blank line separating each entry.*  
6. Preserve the natural reading order (top-to-bottom, left-to-right for manhwa/manhua; right-to-left, top-to-bottom for Japanese manga).  
7. Use the exact prefixes (including trailing space) as specified: "", //:, (), ::, []:, ST:, OT:.  
8. For text elements that do not perfectly align with a category, select the nearest matching classification.  
9. If the image segment contains no valid text (excluding SFX), output exactly: [NO_TEXT_CHUNK]  
10. *DO NOT* include any additional commentary, headers, or footers in your output.
`;
