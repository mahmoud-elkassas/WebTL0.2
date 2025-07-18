import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GlossaryObject, Series } from "@/types";

// Define the required types
type EntityType =
  | "Person"
  | "Place"
  | "Technique"
  | "Organization"
  | "Item"
  | "Term";
type Gender = "Male" | "Female" | "Unknown";
type Role =
  | "Protagonist"
  | "Antagonist"
  | "Supporting"
  | "Minor"
  | "Mentor"
  | "Family"
  | "Other";

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const GEMINI_MODEL = "gemini-2.0-flash-lite-001";

interface ApplyQualityRequest {
  originalText: string;
  approvedSuggestions: string[];
  rejectedSuggestions: string[];
  approvedGlossaryTerms: GlossaryEntry[];
  customTranslation?: string;
  series?: Series | null;
  chapterData?: {
    seriesId: string | null;
    chapterId: string | null;
    sourceLanguage: string;
  };
}

interface GlossaryEntry {
  sourceTerm: string;
  translatedTerm: string;
  entityType:
    | "Person"
    | "Place"
    | "Technique"
    | "Organization"
    | "Item"
    | "Term";
  gender?: "Male" | "Female" | "Unknown";
  role?:
    | "Protagonist"
    | "Antagonist"
    | "Supporting"
    | "Minor"
    | "Mentor"
    | "Family"
    | "Other";
  notes?: string;
}

interface QualityReport {
  issues: string[];
  suggestions: string[];
  culturalNotes: string[];
  glossarySuggestions: Array<{
    sourceTerm: string;
    translatedTerm: string;
    entityType?: EntityType;
    gender?: Gender;
    role?: Role;
    notes?: string;
  }>;
  chapterMemory: string;
  chapterSummary: string;
}

/**
 * Extract structured data from AI response with robust error handling
 */
function extractStructuredResponse(responseText: string): {
  finalText: string;
  qualityReport: QualityReport;
  formattingReport: {
    tagConsistency: boolean;
    pageHeadersPresent: boolean;
    missingTags: string[];
  };
  readabilityScore: number;
} {
  try {
    console.log("🔍 Extracting structured response from apply-quality AI");

    // Extract FINAL TEXT section
    const finalTextMatch = responseText.match(
      /1\.\s*\*\*FINAL TEXT:\*\*\s*([\s\S]*?)(?=2\.\s*\*\*QUALITY REPORT:|$)/i
    );

    let finalText = "";
    if (finalTextMatch && finalTextMatch[1]) {
      finalText = finalTextMatch[1]
        .trim()
        .replace(/```/g, "") // Remove code blocks
        .replace(/(=== Page \d+ ===)/g, "\n\n$1\n\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
    } else {
      // Fallback: use the whole response if it looks like a translation block
      if (responseText.trim().startsWith("===")) {
        finalText = responseText.trim();
      } else {
        console.error("❌ AI response did not contain FINAL TEXT or translation block. Full response:", responseText);
      }
    }

    if (!finalText) {
      // As a last resort, use the whole response if it's not empty
      if (responseText && responseText.trim().length > 0) {
        finalText = responseText.trim();
        console.warn("Fallback: using entire AI response as finalText.");
      }
    }

    // Extract QUALITY REPORT section
    const qualityReportMatch = responseText.match(
      /2\.\s*\*\*QUALITY REPORT:\*\*\s*({[\s\S]*?})(?=3\.\s*\*\*FORMATTING REPORT:|$)/i
    );

    let qualityReport: QualityReport = {
      issues: [],
      suggestions: [],
      culturalNotes: [],
      glossarySuggestions: [],
      chapterMemory: "",
      chapterSummary: "",
    };

    if (qualityReportMatch && qualityReportMatch[1]) {
      try {
        const cleanedJson = qualityReportMatch[1]
          .replace(/\n/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        qualityReport = JSON.parse(cleanedJson);
      } catch (parseError) {
        console.error("Error parsing quality report JSON:", parseError);
        // Try to extract individual fields if JSON parsing fails
        const reportText = qualityReportMatch[1];

        // Extract chapterMemory
        const memoryMatch = reportText.match(/"chapterMemory":\s*"([^"]*?)"/);
        if (memoryMatch) {
          qualityReport.chapterMemory = memoryMatch[1];
        }

        // Extract chapterSummary
        const summaryMatch = reportText.match(/"chapterSummary":\s*"([^"]*?)"/);
        if (summaryMatch) {
          qualityReport.chapterSummary = summaryMatch[1];
        }
      }
    }

    // Extract FORMATTING REPORT section
    const formattingReportMatch = responseText.match(
      /3\.\s*\*\*FORMATTING REPORT:\*\*\s*({[\s\S]*?})(?=4\.\s*\*\*READABILITY SCORE:|$)/i
    );

    let formattingReport = {
      tagConsistency: true,
      pageHeadersPresent: true,
      missingTags: [],
    };

    if (formattingReportMatch && formattingReportMatch[1]) {
      try {
        const cleanedJson = formattingReportMatch[1]
          .replace(/\n/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        formattingReport = JSON.parse(cleanedJson);
      } catch (parseError) {
        console.error("Error parsing formatting report JSON:", parseError);
      }
    }

    // Extract READABILITY SCORE section
    const readabilityMatch = responseText.match(
      /4\.\s*\*\*READABILITY SCORE:\*\*\s*(\d+)/i
    );
    const readabilityScore = readabilityMatch
      ? parseInt(readabilityMatch[1])
      : 85;

    console.log("✅ Successfully extracted apply-quality response:", {
      hasFinalText: !!finalText,
      finalTextLength: finalText.length,
      chapterMemoryLength: qualityReport.chapterMemory.length,
      chapterSummaryLength: qualityReport.chapterSummary.length,
      readabilityScore,
    });

    return {
      finalText,
      qualityReport,
      formattingReport,
      readabilityScore,
    };
  } catch (error) {
    console.error("Error extracting apply-quality structured response:", error);
    return {
      finalText: "",
      qualityReport: {
        issues: [],
        suggestions: [],
        culturalNotes: [],
        glossarySuggestions: [],
        chapterMemory: "",
        chapterSummary: "",
      },
      formattingReport: {
        tagConsistency: true,
        pageHeadersPresent: true,
        missingTags: [],
      },
      readabilityScore: 85,
    };
  }
}

/**
 * Process the final translation with user-approved suggestions and glossary terms
 */
async function processFinalTranslation(
  originalText: string,
  approvedSuggestions: string[],
  approvedGlossaryTerms: GlossaryEntry[],
  customTranslation: string | undefined,
  series?: Series | null,
  chapterData?: {
    seriesId: string | null;
    chapterId: string | null;
    sourceLanguage: string;
  }
): Promise<{
  finalText: string;
  qualityReport: QualityReport;
  formattingReport: {
    tagConsistency: boolean;
    pageHeadersPresent: boolean;
    missingTags: string[];
  };
  readabilityScore: number;
}> {
  // If user provided a custom translation, use that instead of generating a new one
  if (customTranslation && customTranslation.trim()) {
    console.log("📝 Using custom translation provided by user");
    return {
      finalText: customTranslation.trim(),
      qualityReport: {
        issues: [],
        suggestions: [],
        culturalNotes: [],
        glossarySuggestions: [],
        chapterMemory: "Custom translation provided by user",
        chapterSummary:
          "Custom translation - no AI-generated summary available",
      },
      formattingReport: {
        tagConsistency: true,
        pageHeadersPresent: true,
        missingTags: [],
      },
      readabilityScore: 100,
    };
  }

  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

  // Build glossary instructions for the AI
  const glossaryInstructions =
    approvedGlossaryTerms.length > 0
      ? `
=============================
APPROVED GLOSSARY TERMS (MUST USE THESE EXACT TRANSLATIONS):
=============================
${approvedGlossaryTerms
  .map((term) => {
    let termInfo = `"${term.sourceTerm}" → "${term.translatedTerm}"`;
    if (term.entityType) termInfo += ` (${term.entityType})`;
    if (term.gender) termInfo += ` [${term.gender}]`;
    if (term.role) termInfo += ` [${term.role}]`;
    if (term.notes) termInfo += ` - ${term.notes}`;
    return `  - ${termInfo}`;
  })
  .join("\n")}

CRITICAL: When you encounter ANY of these source terms in the original text, you MUST use the exact translated term provided above. This includes:
- Character names and pronouns
- Place names  
- Technique names
- Organization names
- Special terms

These glossary terms should also be reflected in your chapter summary and memory.
`
      : "";

  // Build suggestions instructions
  const suggestionsInstructions =
    approvedSuggestions.length > 0
      ? `
=============================
APPROVED SUGGESTIONS TO INCORPORATE:
=============================
${approvedSuggestions.map((s) => `- ${s}`).join("\n")}

CRITICAL: You MUST incorporate these approved suggestions into your final translation.
`
      : "";

  const prompt = `
You are an expert translator and proofreader for webtoons. Your task is to create the FINAL translation from ${
    chapterData?.sourceLanguage || "Korean"
  } to English incorporating ONLY the approved suggestions and using the approved glossary terms.

Original Text:
${originalText}

${glossaryInstructions}

${suggestionsInstructions}

${series?.tone_notes ? `Series Notes: ${series.tone_notes}` : ""}
${series?.description ? `Series Description: ${series.description}` : ""}

${chapterData ? `Chapter Info: Chapter ${chapterData.chapterId}` : ""}

=============================
CRITICAL FORMATTING RULES:
=============================
1. MAINTAIN EXACT TAG FORMATTING:
   - Normal dialogue: Use "": prefix
   - Thought bubbles: Use (): prefix
   - Narration boxes: Use []: prefix
   - Shouting: Use :: prefix
   - Small text: Use ST: prefix
   - Outer text: Use OT: prefix
   - Connected speech: Use //: prefix

2. DO NOT USE HTML TAGS like <center>, <br>, etc.

3. PAGE FORMATTING:
   - Start each page with "=== Page X ==="
   - Add two newlines after page header
   - Add one newline between different text elements
   - Add two newlines between pages

4. EXAMPLE FORMAT:
   === Page 1 ===
   
   []: Narration text here
   "": Character dialogue here
   (): Character thoughts here
   
   === Page 2 ===
   
   "": More dialogue here
   //: Continued dialogue here

=============================
CRITICAL INSTRUCTIONS:
=============================
Structure your response in these EXACT sections:

1. **FINAL TEXT:**
[Complete English translation with proper formatting and tags. MUST use approved glossary terms where applicable and incorporate approved suggestions.]

2. **QUALITY REPORT:**
{
  "issues": [],
  "suggestions": [],
  "culturalNotes": [],
  "glossarySuggestions": [],
  "chapterMemory": "Write a detailed summary of this chapter including character actions, plot developments, relationships, and key events. Use the approved glossary terms for character names and important terms.",
  "chapterSummary": "Write a concise summary of this chapter's content, focusing on key events, character interactions, and plot developments. Use the approved glossary terms for character names and important terms."
}

3. **FORMATTING REPORT:**
{
  "tagConsistency": true,
  "pageHeadersPresent": true,
  "missingTags": []
}

4. **READABILITY SCORE:**
85

IMPORTANT: 
- Follow the exact section structure above
- Ensure all JSON is properly formatted with double quotes and valid syntax
- Use the exact glossary terms provided throughout the translation, chapter memory, and chapter summary
- The chapter memory should be comprehensive and use proper character names from the glossary
- Do NOT save anything to database - this is processing only
`;

  try {
    console.log("🤖 Calling Gemini for final translation processing");
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const responseText = response.text();

    console.log(
      "📥 Apply-quality response received, length:",
      responseText.length
    );

    // Extract structured data from response
    const extractedData = extractStructuredResponse(responseText);

    if (!extractedData.finalText || extractedData.finalText.trim() === "") {
      throw new Error("No final text extracted from AI response");
    }

    return extractedData;
  } catch (error) {
    console.error("Error processing final translation:", error);
    throw error;
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      originalText,
      approvedSuggestions = [],
      rejectedSuggestions = [],
      approvedGlossaryTerms = [],
      customTranslation,
      series = null,
      chapterData,
    } = body as ApplyQualityRequest;

    if (!originalText || originalText.trim() === "") {
      return NextResponse.json(
        { error: "Original text is required and cannot be empty" },
        { status: 400 }
      );
    }

    console.log("🔧 Apply-quality API called with:", {
      hasOriginalText: !!originalText,
      originalTextLength: originalText.length,
      approvedSuggestionsCount: approvedSuggestions.length,
      rejectedSuggestionsCount: rejectedSuggestions.length,
      approvedGlossaryTermsCount: approvedGlossaryTerms.length,
      glossaryTerms: approvedGlossaryTerms.map(
        (term) =>
          `${term.sourceTerm} → ${term.translatedTerm} (${term.entityType})`
      ),
      hasCustomTranslation: !!customTranslation,
      seriesId: chapterData?.seriesId,
      chapterId: chapterData?.chapterId,
    });

    // Process the final translation with glossary terms and suggestions
    const result = await processFinalTranslation(
      originalText,
      approvedSuggestions,
      approvedGlossaryTerms,
      customTranslation,
      series,
      chapterData
    );

    // Validate that we have a final translation
    if (!result.finalText || result.finalText.trim() === "") {
      console.error("❌ No final text generated or extracted");
      return NextResponse.json(
        { error: "Failed to generate or extract final translation" },
        { status: 500 }
      );
    }

    // Format the final text for better readability
    const formattedFinalText = result.finalText
      .replace(/```/g, "") // Remove backticks
      .replace(/(=== Page \d+ ===)/g, "\n\n$1\n\n")
      .replace(/\n{4,}/g, "\n\n\n")
      .trim(); // Trim extra whitespace

    console.log("✅ Apply-quality completed successfully:", {
      finalTextLength: formattedFinalText.length,
      chapterMemoryLength: result.qualityReport.chapterMemory.length,
      chapterSummaryLength: result.qualityReport.chapterSummary.length,
      readabilityScore: result.readabilityScore,
      appliedGlossaryTerms: approvedGlossaryTerms.length,
      appliedSuggestions: approvedSuggestions.length,
    });

    // Return the complete result - NO DATABASE OPERATIONS
    return NextResponse.json({
      success: true,
      improvedText: formattedFinalText,
      qualityReport: result.qualityReport,
      formattingReport: result.formattingReport,
      readabilityScore: result.readabilityScore,
      approvedSuggestions: approvedSuggestions,
      approvedGlossaryTerms: approvedGlossaryTerms,
    });
  } catch (error: any) {
    console.error("❌ Apply-quality error:", error);
    return NextResponse.json(
      {
        error: `Apply quality failed: ${error.message}`,
        details: error.stack,
      },
      { status: 500 }
    );
  }
}
