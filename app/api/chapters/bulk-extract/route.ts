import { google } from "googleapis";
import { NextResponse } from "next/server";
import { getGeminiModel } from "@/utils/gemini-client";

interface DriveImage {
  id: string;
  name: string;
  mimeType: string;
}

interface ChapterToExtract {
  chapterId: string;
  chapterNumber: string;
  images: DriveImage[];
}

// Function to download image from Google Drive
async function downloadImageFromDrive(
  drive: any,
  fileId: string
): Promise<Buffer> {
  const response = await drive.files.get(
    {
      fileId: fileId,
      alt: "media",
    },
    {
      responseType: "stream",
    }
  );

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    response.data.on("data", (chunk: any) => chunks.push(chunk));
    response.data.on("end", () => resolve(Buffer.concat(chunks)));
    response.data.on("error", reject);
  });
}

// Function to extract text from images using Gemini
async function extractTextFromImages(
  drive: any,
  images: DriveImage[],
  sourceLanguage: string = "Korean"
): Promise<string> {
  const model = await getGeminiModel();
  let combinedText = "";

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

  // Process images in smaller batches to avoid timeouts
  const batchSize = 3;
  for (let i = 0; i < images.length; i += batchSize) {
    const batch = images.slice(i, i + batchSize);

    for (const image of batch) {
      try {
        console.log(`Processing image: ${image.name}`);

        // Download image from Google Drive
        const imageBuffer = await downloadImageFromDrive(drive, image.id);
        const base64Image = imageBuffer.toString("base64");

        const result = await model.generateContent([
          {
            inlineData: {
              data: base64Image,
              mimeType: image.mimeType,
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

        if (cleanedText && cleanedText !== "[NO_TEXT_CHUNK]") {
          combinedText += `=== Page ${i + 1} (${
            image.name
          }) ===\n\n${cleanedText}\n\n`;
        }
      } catch (error) {
        console.error(`Error processing image ${image.name}:`, error);
        combinedText += `=== Page ${i + 1} (${
          image.name
        }) ===\n\n[ERROR_PROCESSING_IMAGE]\n\n`;
      }
    }
  }

  return combinedText.trim();
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { chapters, sourceLanguage = "Korean" } = body;

    if (!chapters || !Array.isArray(chapters) || chapters.length === 0) {
      return NextResponse.json(
        { error: "Chapters array is required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Google API key not configured" },
        { status: 500 }
      );
    }

    const drive = google.drive({ version: "v3", auth: apiKey });

    // Process chapters one by one
    const results = [];

    for (const chapter of chapters) {
      try {
        console.log(
          `Processing chapter ${chapter.chapterNumber} with ${chapter.images.length} images`
        );

        if (chapter.images.length === 0) {
          results.push({
            chapterId: chapter.chapterId,
            chapterNumber: chapter.chapterNumber,
            success: true,
            extractedText: "",
            processedImages: 0,
            message: "No images to process",
          });
          continue;
        }

        const extractedText = await extractTextFromImages(
          drive,
          chapter.images,
          sourceLanguage
        );

        results.push({
          chapterId: chapter.chapterId,
          chapterNumber: chapter.chapterNumber,
          success: true,
          extractedText,
          processedImages: chapter.images.length,
        });
      } catch (error) {
        console.error(
          `Error processing chapter ${chapter.chapterNumber}:`,
          error
        );
        results.push({
          chapterId: chapter.chapterId,
          chapterNumber: chapter.chapterNumber,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
          processedImages: 0,
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    return NextResponse.json({
      success: true,
      message: `Processed ${chapters.length} chapters`,
      totalChapters: chapters.length,
      successCount,
      failureCount,
      results,
    });
  } catch (error) {
    console.error("Error in bulk text extraction:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to extract text: ${errorMessage}` },
      { status: 500 }
    );
  }
}
