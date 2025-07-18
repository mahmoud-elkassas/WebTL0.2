import { NextResponse } from "next/server";
import { GlossaryObject, Series } from "@/types";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const GEMINI_MODEL = "gemini-2.0-flash-lite-001"; // Using consistent model

interface QualityCheckRequest {
  originalText: string;
  glossary?: GlossaryObject;
  series?: Series | null;
  chapterData?: {
    seriesId: string | null;
    chapterId: string | null;
    sourceLanguage: string;
  };
  rawResponse?: string;
}

interface QualityReport {
  issues: string[];
  suggestions: string[];
  culturalNotes: string[];
  glossarySuggestions: GlossaryEntry[];
  chapterMemory: string;
  chapterSummary: string;
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

const defaultQualityReport: QualityReport = {
  issues: [],
  suggestions: [],
  culturalNotes: [],
  glossarySuggestions: [],
  chapterMemory: "",
  chapterSummary: "",
};

interface QualityCheckResponse {
  improvedText: string;
  qualityReport: QualityReport;
  formattingReport: {
    tagConsistency: boolean;
    pageHeadersPresent: boolean;
    missingTags: string[];
  };
  taggingSuggestions: {
    tag: string;
    original: string;
    suggested: string;
  }[];
  readabilityScore: number;
  glossarySuggestions: Record<string, string>;
}

/**
 * Analyze the formatting of the translated text
 */
function analyzeFormatting(text: string): {
  tagConsistency: boolean;
  pageHeadersPresent: boolean;
  missingTags: string[];
} {
  // Check for page headers (=== Page X ===)
  const pageHeadersPresent = /===\s*Page\s+\d+\s*===/.test(text);

  // Check tag consistency
  const speechBubbles = (text.match(/""\s*:/g) || []).length;
  const thoughtBubbles = (text.match(/\(\)\s*:/g) || []).length;
  const narrationBoxes = (text.match(/\[\]\s*:/g) || []).length;

  // Identify potentially missing tags
  const missingTags: string[] = [];
  if (speechBubbles === 0) missingTags.push('""');
  if (thoughtBubbles === 0) missingTags.push("()");
  if (narrationBoxes === 0) missingTags.push("[]");

  // Determine tag consistency
  const tagConsistency = missingTags.length === 0;

  return {
    tagConsistency,
    pageHeadersPresent,
    missingTags,
  };
}

/**
 * Calculate a basic readability score for the translated text
 */
function calculateReadabilityScore(text: string): number {
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const words = text.split(/\s+/).filter((w) => w.trim().length > 0);

  if (sentences.length === 0 || words.length === 0) {
    return 0;
  }

  const avgWordsPerSentence = words.length / sentences.length;
  const complexWords = words.filter((w) => w.length > 7).length;
  const percentComplexWords = (complexWords / words.length) * 100;

  const rawScore = avgWordsPerSentence * 0.5 + percentComplexWords * 0.5;
  const readabilityScore = Math.min(100, Math.max(0, 100 - rawScore));

  return Math.round(readabilityScore);
}

/**
 * Extract structured data from AI response with robust error handling
 */
function extractStructuredResponse(responseText: string): {
  improvedText: string;
  qualityReport: QualityReport;
} {
  try {
    console.log("🔍 Extracting structured response from AI");

    // Extract IMPROVED TEXT section
    const improvedTextMatch = responseText.match(
      /1\.\s*\*\*IMPROVED TEXT:\*\*\s*([\s\S]*?)(?=2\.\s*\*\*ISSUES:|$)/i
    );

    let improvedText = "";
    if (improvedTextMatch && improvedTextMatch[1]) {
      improvedText = improvedTextMatch[1]
        .trim()
        .replace(/```/g, "") // Remove code blocks
        .replace(/(=== Page \d+ ===)/g, "\n\n$1\n\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
    } else {
      // Fallback: use the whole response if it looks like a translation block
      if (responseText.trim().startsWith("===")) {
        improvedText = responseText.trim();
      }
    }

    // Extract ISSUES section
    const issuesMatch = responseText.match(
      /2\.\s*\*\*ISSUES:\*\*\s*([\s\S]*?)(?=3\.\s*\*\*SUGGESTIONS:|$)/i
    );
    const issues: string[] = [];
    if (issuesMatch && issuesMatch[1]) {
      const issueLines = issuesMatch[1]
        .split(/\n-\s*/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && !line.match(/^\*\*/));
      issues.push(...issueLines);
    }

    // Extract SUGGESTIONS section
    const suggestionsMatch = responseText.match(
      /3\.\s*\*\*SUGGESTIONS:\*\*\s*([\s\S]*?)(?=4\.\s*\*\*CULTURAL NOTES:|$)/i
    );
    const suggestions: string[] = [];
    if (suggestionsMatch && suggestionsMatch[1]) {
      const suggestionLines = suggestionsMatch[1]
        .split(/\n-\s*/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && !line.match(/^\*\*/));
      suggestions.push(...suggestionLines);
    }

    // Extract CULTURAL NOTES section
    const culturalNotesMatch = responseText.match(
      /4\.\s*\*\*CULTURAL NOTES:\*\*\s*([\s\S]*?)(?=5\.\s*\*\*GLOSSARY ENTRIES:|$)/i
    );
    const culturalNotes: string[] = [];
    if (culturalNotesMatch && culturalNotesMatch[1]) {
      const notesLines = culturalNotesMatch[1]
        .split(/\n-\s*/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && !line.match(/^\*\*/));
      culturalNotes.push(...notesLines);
    }

    // Extract GLOSSARY ENTRIES section
    const glossaryMatch = responseText.match(
      /5\.\s*\*\*GLOSSARY ENTRIES:\*\*\s*([\s\S]*?)(?=6\.\s*\*\*CHAPTER MEMORY:|$)/i
    );
    let glossarySuggestions: GlossaryEntry[] = [];
    if (glossaryMatch && glossaryMatch[1]) {
      const jsonMatch = glossaryMatch[1].match(/```json\s*([\s\S]*?)```/);
      if (jsonMatch && jsonMatch[1]) {
        try {
          const jsonContent = jsonMatch[1].trim();
          const parsedGlossary = JSON.parse(jsonContent);
          if (Array.isArray(parsedGlossary)) {
            glossarySuggestions = parsedGlossary;
          }
        } catch (error) {
          console.error("Error parsing glossary JSON:", error);
        }
      }
    }

    // Extract CHAPTER MEMORY section
    const chapterMemoryMatch = responseText.match(
      /6\.\s*\*\*CHAPTER MEMORY:\*\*\s*([\s\S]*?)(?=7\.\s*\*\*CHAPTER SUMMARY:|$)/i
    );
    let chapterMemory = "";
    if (chapterMemoryMatch && chapterMemoryMatch[1]) {
      chapterMemory = chapterMemoryMatch[1].trim();
    }

    // Extract CHAPTER SUMMARY section
    const chapterSummaryMatch = responseText.match(
      /7\.\s*\*\*CHAPTER SUMMARY:\*\*\s*([\s\S]*?)(?=$)/i
    );
    let chapterSummary = "";
    if (chapterSummaryMatch && chapterSummaryMatch[1]) {
      chapterSummary = chapterSummaryMatch[1].trim();
    }

    const qualityReport: QualityReport = {
      issues,
      suggestions,
      culturalNotes,
      glossarySuggestions,
      chapterMemory,
      chapterSummary,
    };

    console.log("✅ Successfully extracted structured response:", {
      hasImprovedText: !!improvedText,
      improvedTextLength: improvedText.length,
      issuesCount: issues.length,
      suggestionsCount: suggestions.length,
      culturalNotesCount: culturalNotes.length,
      glossaryCount: glossarySuggestions.length,
      chapterMemoryLength: chapterMemory.length,
      chapterSummaryLength: chapterSummary.length,
    });

    return { improvedText, qualityReport };
  } catch (error) {
    console.error("Error extracting structured response:", error);
    return {
      improvedText: "",
      qualityReport: defaultQualityReport,
    };
  }
}

/**
 * Run the quality check through Gemini API with consistent prompt
 */
async function runQualityCheck(
  originalText: string,
  glossary: GlossaryObject,
  series?: Series | null,
  chapterData?: {
    seriesId: string | null;
    chapterId: string | null;
    sourceLanguage: string;
  }
): Promise<{
  improvedText: string;
  qualityReport: QualityReport;
}> {
  console.log("🔍 Running translation and quality inspection");

  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

  const prompt = `
You are an expert translator and proofreader for webtoons. Your task is to translate the text from ${
    chapterData?.sourceLanguage || "Korean"
  } to English and provide detailed quality analysis.

Original Text:
${originalText}
    
Current Glossary:
${JSON.stringify(glossary, null, 2)}
  
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

1. **IMPROVED TEXT:**
[Complete English translation with proper formatting and tags]

2. **ISSUES:**
- [List any translation issues found]
- [List any formatting problems]
- [List any consistency problems]

3. **SUGGESTIONS:**
- [List specific improvement suggestions]
- [List style enhancement suggestions]  
- [List readability improvements]

4. **CULTURAL NOTES:**
- [List cultural context explanations]
- [List cultural adaptation notes]
- [List cultural reference explanations]

5. **GLOSSARY ENTRIES:**
Return a JSON array of NEW terms that should be added to glossary:
\`\`\`json
[
  {
    "sourceTerm": "Original term in source language",
    "translatedTerm": "English translation",
    "entityType": "Person/Place/Technique/Organization/Item/Term",
    "gender": "Male/Female/Unknown",
    "role": "Protagonist/Antagonist/Supporting/Minor/Mentor/Family/Other",
    "notes": "Additional context or usage notes"
  }
]
\`\`\`

6. **CHAPTER MEMORY:**
Write a detailed summary of this chapter including character actions, plot developments, relationships, and key events for future reference.

7. **CHAPTER SUMMARY:**
Write a concise summary of this chapter's main events and character interactions.

IMPORTANT: 
- Follow the exact section structure above
- Ensure all JSON is properly formatted
- Use consistent terminology throughout
- Do NOT save anything to database - this is analysis only
`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const responseText = response.text();

    console.log(
      "📥 Quality check response received, length:",
      responseText.length
    );
    console.log("📥 Full AI response:", responseText.slice(0, 1000)); // Log first 1000 chars for debugging

    // Extract structured data from response
    const extractedData = extractStructuredResponse(responseText);

    if (
      !extractedData.improvedText ||
      extractedData.improvedText.trim() === ""
    ) {
      console.error("❌ No translation text extracted. AI response snippet:", responseText.slice(0, 1000));
      throw new Error("No translation text extracted from AI response. See server logs for AI response snippet.");
    }

    return extractedData;
  } catch (error) {
    console.error("Error processing quality check:", error);
    throw error;
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      originalText,
      glossary = {},
      series = null,
      chapterData,
      rawResponse,
    } = body as QualityCheckRequest;

    if (!originalText || originalText.trim() === "") {
      return NextResponse.json(
        { error: "Original text is required and cannot be empty" },
        { status: 400 }
      );
    }

    console.log("🔧 Quality-checker API called with:", {
      hasOriginalText: !!originalText,
      originalTextLength: originalText.length,
      hasGlossary: Object.keys(glossary).length > 0,
      hasSeries: !!series,
      hasChapterData: !!chapterData,
      hasRawResponse: !!rawResponse,
    });

    let improvedText = "";
    let qualityReport = defaultQualityReport;

    // If raw response is provided, extract data directly from it
    if (rawResponse && rawResponse.trim()) {
      console.log("📄 Extracting data from provided raw response");
      const extractedData = extractStructuredResponse(rawResponse);
      improvedText = extractedData.improvedText;
      qualityReport = extractedData.qualityReport;
    } else {
      // No raw response, call Gemini for fresh analysis
      console.log("🤖 Calling Gemini for fresh quality analysis");
      const qualityCheck = await runQualityCheck(
        originalText,
        glossary,
        series,
        chapterData
      );
      improvedText = qualityCheck.improvedText;
      qualityReport = qualityCheck.qualityReport;
    }

    // Validate that we have a translation
    if (!improvedText || improvedText.trim() === "") {
      console.error("❌ No translation generated or extracted");
      return NextResponse.json(
        { error: "Failed to generate or extract translation" },
        { status: 500 }
      );
    }

    // Analyze formatting and calculate readability
    const formattingReport = analyzeFormatting(improvedText);
    const readabilityScore = calculateReadabilityScore(improvedText);

    console.log("✅ Quality-checker API response prepared:", {
      hasImprovedText: !!improvedText,
      improvedTextLength: improvedText.length,
      issuesCount: qualityReport.issues.length,
      suggestionsCount: qualityReport.suggestions.length,
      glossaryCount: qualityReport.glossarySuggestions.length,
      chapterMemoryLength: qualityReport.chapterMemory.length,
      readabilityScore,
    });

    // Return complete quality check result - NO DATABASE OPERATIONS
    return NextResponse.json({
      success: true,
      improvedText,
      qualityReport: {
        issues: qualityReport.issues || [],
        suggestions: qualityReport.suggestions || [],
        culturalNotes: qualityReport.culturalNotes || [],
        glossarySuggestions: qualityReport.glossarySuggestions || [],
        chapterMemory: qualityReport.chapterMemory || "",
        chapterSummary: qualityReport.chapterSummary || "",
      },
      formattingReport,
      taggingSuggestions: [], // Legacy field for compatibility
      readabilityScore,
      glossarySuggestions: qualityReport.glossarySuggestions || [],
    });
  } catch (error: any) {
    console.error("❌ Quality check error:", error);
    return NextResponse.json(
      {
        error: `Quality check failed: ${error.message}`,
        details: error.stack,
      },
      { status: 500 }
    );
  }
}
