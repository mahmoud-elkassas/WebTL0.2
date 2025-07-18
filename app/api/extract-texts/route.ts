import { getGeminiModel } from "@/utils/gemini-client";
import { NextResponse } from "next/server";

interface ImageResult {
  pageNumber: number;
  fileName: string;
  extractedText: string;
  rawResponse: string;
  success: boolean;
  error?: string;
}

export async function POST(request: Request) {
  try {
    // Check content length early to avoid processing large payloads
    const contentLength = request.headers.get("content-length");
    if (contentLength && parseInt(contentLength) > 50 * 1024 * 1024) {
      // 50MB limit
      return NextResponse.json(
        { error: "Request payload too large. Maximum 50MB allowed." },
        { status: 413 }
      );
    }

    const formData = await request.formData();
    const sourceLanguage =
      (formData.get("sourceLanguage") as string) || "Korean";

    // Get all images from formData
    const images: { file: File; pageNumber: number; fileName: string }[] = [];

    // Check if we have multiple images or a single image
    const singleImage = formData.get("image") as File;
    if (singleImage) {
      // Single image mode (backward compatibility)
      images.push({
        file: singleImage,
        pageNumber: 1,
        fileName: singleImage.name,
      });
    } else {
      // Multiple images mode
      let index = 0;
      while (true) {
        const image = formData.get(`image_${index}`) as File;
        const pageNumber = parseInt(
          formData.get(`pageNumber_${index}`) as string
        );
        const fileName = formData.get(`fileName_${index}`) as string;

        if (!image) break;

        images.push({
          file: image,
          pageNumber: pageNumber || index + 1,
          fileName: fileName || image.name,
        });
        index++;
      }
    }

    if (images.length === 0) {
      return NextResponse.json(
        { error: "No image files provided" },
        { status: 400 }
      );
    }

    // Validate maximum 3 images per request
    if (images.length > 3) {
      return NextResponse.json(
        {
          error:
            "Maximum 3 images allowed per request. Please split into smaller batches.",
        },
        { status: 400 }
      );
    }

    // Initialize Gemini model
    const model = await getGeminiModel();

    // Prepare the prompt for OCR
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


    **Japanese Manga/Manhwa Text Direction:**  
    - For Japanese manga with vertical text, process from **right-to-left** and **top-to-bottom**, following traditional Japanese reading order.  
    - Apply the same classification prefixes to vertical text as horizontal text.  
    - For panels containing both vertical and horizontal text, maintain their natural reading order within the Japanese context: vertical elements are read first (right-to-left), followed by horizontal elements.
    
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
    10. *DO NOT* include any additional commentary, headers, or footers in your output.`;

    // Process all images
    const results: ImageResult[] = [];

    for (const imageInfo of images) {
      try {
        const imageData = await imageInfo.file.arrayBuffer();
        const base64Image = Buffer.from(imageData).toString("base64");

        const result = await model.generateContent([
          {
            inlineData: {
              data: base64Image,
              mimeType: imageInfo.file.type,
            },
          },
          { text: prompt },
        ]);

        const response = await result.response;
        const responseText = response.text();

        // Clean up the response text
        const cleanedText = responseText
          .replace(/^Original Text:\s*/i, "")
          .replace(/^Translation:\s*/i, "")
          .trim();

        results.push({
          pageNumber: imageInfo.pageNumber,
          fileName: imageInfo.fileName,
          extractedText: cleanedText,
          rawResponse: responseText,
          success: true,
        });
      } catch (error) {
        console.error(`Error processing image ${imageInfo.fileName}:`, error);
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";

        results.push({
          pageNumber: imageInfo.pageNumber,
          fileName: imageInfo.fileName,
          extractedText: "",
          rawResponse: "",
          success: false,
          error: errorMessage,
        });
      }
    }

    // For backward compatibility, if single image, return the old format
    if (images.length === 1 && results.length === 1) {
      const result = results[0];
      if (result.success) {
        return NextResponse.json({
          text: result.extractedText,
          extractedText: result.extractedText,
          rawResponse: result.rawResponse,
          isLastImage: true,
        });
      } else {
        return NextResponse.json(
          { error: `Failed to process image: ${result.error}` },
          { status: 500 }
        );
      }
    }

    // For multiple images, return the new format
    return NextResponse.json({
      results: results,
      totalImages: images.length,
      successCount: results.filter((r) => r.success).length,
      failureCount: results.filter((r) => !r.success).length,
    });
  } catch (error) {
    console.error("Error processing images:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to process images: ${errorMessage}` },
      { status: 500 }
    );
  }
}
