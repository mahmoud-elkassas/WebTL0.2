import {
  TranslationInput,
  GlossaryObject,
  Series,
  GlossaryTerm,
  MemoryEntry,
  SourceLanguage,
} from "@/types";
import { detectPotentialGlossaryTerms } from "@/lib/glossary";
import { fetchMemoryEntries } from "@/lib/memory";
import { memoryFilteringAssistant } from "@/lib/assistants";

const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent";

/**
 * Main translation function that coordinates the translation workflow with AI assistants
 */
export async function translateText(
  input: TranslationInput,
  glossary: GlossaryObject = {},
  series?: Series | null,
  updateGlossaryCallback?: (
    newGlossaryEntries: GlossaryObject,
    sourceText: string
  ) => Promise<void>
) {
  console.log("📖 Translation request with glossary:", glossary);

  const apiKey =
    process.env.GEMINI_API_KEY || "AIzaSyBNrFIwDBrhIxNXriWZqY1h6eeQFZKP-KM";

  if (!apiKey) {
    throw new Error("Gemini API key is not configured");
  }

  // Get relevant memory entries if we have a series
  let selectedMemories: MemoryEntry[] = [];
  if (input.seriesId) {
    // Fetch all memory entries for this series
    const allMemories = await fetchMemoryEntries(input.seriesId);

    // Use the Memory Filtering Assistant to select the most relevant ones
    if (allMemories.length > 0) {
      selectedMemories = await memoryFilteringAssistant(
        input.text,
        allMemories
      );
      console.log(
        `🧠 Selected ${selectedMemories.length} relevant memory entries`
      );
    }
  }

  // Prepare genre-specific prompt and series notes
  const genreSpecificTone =
    series?.genre && series.genre.length > 0
      ? getGenreSpecificPrompt(
          Array.isArray(series.genre) ? series.genre : [series.genre]
        )
      : "";

  const seriesNotes = series?.tone_notes || "";

  // Convert glossary to structured format
  const structuredGlossary = Object.entries(glossary).reduce(
    (acc, [term, data]) => {
      acc[term] = {
        translation: typeof data === "string" ? data : data.translation,
        gender: typeof data === "string" ? undefined : data.gender,
        role: typeof data === "string" ? undefined : data.role,
        alias: typeof data === "string" ? undefined : data.alias,
      };
      return acc;
    },
    {} as GlossaryObject
  );

  // Construct the system prompt
  const systemPrompt = `
You are a professional ${
    input.sourceLanguage
  }-to-English webtoon translator Your task is to:

1.⁠ ⁠Translate and format the text with proper tags as they appear in the input - ALWAYS USE THIS EXACT FORMAT:

2.⁠ ⁠Maintain consistent character names and relationships using the glossary.
   - Infer gendered pronouns (he/she/they/her/him/his, etc) based on glossary or story context.
   - Honor honorifics, social formality, and tone.


Translation:
[Your properly formatted translation here, with all tags followed by colons and a space, e.g:

=== Page 1 ===

[]: Text here

[]: More text here

"": Dialogue here

(): Thought here

=== Page 2 ===

[]: More text
]

Glossary:
{
  "CharacterName": {
    "translation": "English name",
    "gender": "male/female",
    "role": "main/supporting/etc",
    "alias": "Ms. Im / Im-seonsaengnim / Teacher Im"
  },
  "AnotherCharacter": {
    "translation": "English name",
    "gender": "male/female",
    "role": "main/supporting/etc",
    "alias": "ManagerKwon / Kwon-seonsaeng"
  }
}

Chapter Memory:
{
  "chapter_${input.chapter || "01"}": "[Brief chapter summary]"
}

Quality Report:
{
  "issues": ["List any translation issues"],
  "suggestions": ["List any improvement suggestions"],
  "culturalNotes": ["Cultural context for terms like Oppa, Sunbae, etc."]
}

Current Glossary:
${JSON.stringify(structuredGlossary, null, 2)}

${
  selectedMemories.length > 0
    ? `
Previous Context:
${selectedMemories
  .map((memory, i) => `[${i + 1}] ${memory.content}`)
  .join("\n")}
`
    : ""
}

${genreSpecificTone}

${seriesNotes ? `Series Notes: ${seriesNotes}` : ""}

Example:

=== Page 1 ===

[]: A dream that once fluttered crimson in the wind,

[]: blooming on campus.

[]: It was a cherished moment.

[]: Thirty-one.

[]: Until I met him again.

[]: Bed Partner


=== Page 2 ===

[]: 5 days ago. Sangjae High School 

[]: Faculty Office

"": Lastly, there's an announcement.

"": The chairman will be away due to personal reasons,

"": so starting today, someone will be acting as chairman for three months.

[]: 1st year head teacher Yang Daesung (53)

"": There will be a welcome dinner after school, so all 1st year teachers are expected to attend.

"": Yes~

"": Oh, Ms. Im, please make a reservation for the dinner venue.

"": Somewhere not worse than other grades' dinners.

"": Yes, I understand.

St: Ugh, so annoying!! why is it always me who has to do this~

[]: 1st year Korean language teacher Im Sejin (31)

"": Then, the meeting is adjourned.

"": isn't Manager Yang too much?


=== Page 3 ===


"": We've been here for 5 years now, and it's always Ms. Im who gets asked to do this.

[]: 1st-year math teacher Choi Yeonjoo (32)

"": Exactly!

"": That's because you've always picked such great places for our team dinners.

"": Wow. You even made a separate list of restaurants for team dinners?

"": That's why it's always Ms. Im. Do things in moderation!

"": If you do it half-heartedly, you'll get in trouble.

"": It's just more work for you.  Let me know if there's anything I can help with, Ms. Im.

"": Yes-

"": Manager! Should I make a reservation at the pork ribs place we went to in early March?

"": That place is great! As expected, Ms. Im's sense is the best!

(): This darn social life. My cheeks are going to cramp up from all this smiling...

`;
  const promptParts = [
    { text: systemPrompt },
    { text: "Text to translate:\n" + input.text },
  ];

  try {
    console.log(input.text);
    console.log("🌐 Sending request to Gemini API...");
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: promptParts,
          },
        ],
        generationConfig: {
          temperature: 0.2,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 8192,
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("❌ Gemini API error:", errorData);
      throw new Error(`Gemini API error: ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    console.log("✅ Got Gemini API response");
    const translationText = data.candidates[0].content.parts[0].text;

    // Debug log the raw response
    console.log("📝 Raw Gemini response:", translationText);
    console.log("📏 Raw response length:", translationText.length);

    // Store the complete raw response without any processing
    const rawResponseText = translationText;

    // Split the response into sections using double newlines
    const sections = translationText.split(/\n\n+/);
    console.log("📋 Found sections:", sections.length);

    let translation = "";
    let newGlossary: GlossaryObject = {};
    let chapterMemory: Record<string, string> = {};
    let qualityReport = {
      issues: [] as string[],
      suggestions: [] as string[],
      culturalNotes: [] as string[],
    };

    // Process each section
    for (const section of sections) {
      const trimmedSection = section.trim();

      if (trimmedSection.startsWith("Translation:")) {
        // Get everything after "Translation:" including all newlines
        const translationContent = trimmedSection.substring(
          trimmedSection.indexOf("Translation:") + "Translation:".length
        );
        translation = cleanPageHeaders(translationContent.trim());
        console.log("📚 Found translation length:", translation.length);
      } else if (trimmedSection.startsWith("Glossary:")) {
        try {
          const glossaryText = trimmedSection.replace("Glossary:", "").trim();

          if (glossaryText) {
            try {
              // Clean up the JSON string before parsing
              let cleanedGlossaryText = glossaryText;

              // Remove comments
              cleanedGlossaryText = cleanedGlossaryText.replace(
                /\/\/.*$/gm,
                ""
              );

              // Fix trailing commas in objects
              cleanedGlossaryText = cleanedGlossaryText.replace(
                /,(\s*[}\]])/g,
                "$1"
              );

              // Fix missing spaces between key-value pairs
              cleanedGlossaryText = cleanedGlossaryText.replace(
                /("[^"]+"):("?[^",}]+)([,}])/g,
                '$1:"$2"$3'
              );

              // Fix merged words (like "term":"translation" with no spaces)
              cleanedGlossaryText = cleanedGlossaryText.replace(
                /"([^"]+)":"([^"]+)"/g,
                '"$1": "$2"'
              );

              // Handle potential line breaks inside the keys or values
              cleanedGlossaryText = cleanedGlossaryText.replace(
                /(["\w])[\s\n\r]+(["\w])/g,
                "$1$2"
              );

              // Fix missing quotes around property values
              cleanedGlossaryText = cleanedGlossaryText.replace(
                /:\s*([^",\{\}\[\]]+)([,\}])/g,
                ':"$1"$2'
              );

              // Fix missing quotes around keys
              cleanedGlossaryText = cleanedGlossaryText.replace(
                /(\{|\,)\s*([^"\{\}\[\],]+):\s*/g,
                '$1"$2":'
              );

              // Fix mismatched brackets
              let openBraces = (cleanedGlossaryText.match(/\{/g) || []).length;
              let closeBraces = (cleanedGlossaryText.match(/\}/g) || []).length;
              if (openBraces > closeBraces) {
                cleanedGlossaryText += "}".repeat(openBraces - closeBraces);
              }

              console.log("🧹 Cleaned glossary JSON:", cleanedGlossaryText);

              try {
                const parsedGlossary = JSON.parse(cleanedGlossaryText);
                newGlossary = Object.entries(parsedGlossary).reduce(
                  (acc, [term, data]) => {
                    if (typeof data === "string") {
                      acc[term] = { translation: data };
                    } else if (typeof data === "object" && data !== null) {
                      acc[term] = {
                        translation: (data as any).translation || term,
                        gender: (data as any).gender,
                        role: (data as any).role,
                        alias: (data as any).alias,
                      };
                    }
                    return acc;
                  },
                  {} as GlossaryObject
                );
                console.log(
                  "📚 Processed glossary entries:",
                  Object.keys(newGlossary).length
                );
              } catch (jsonError) {
                console.error("❌ Failed to parse glossary JSON:", jsonError);

                // Additional repair attempt for common JSON issues
                try {
                  // Add missing quotes around keys
                  cleanedGlossaryText = cleanedGlossaryText.replace(
                    /{\s*([^"}\s][^:}]*?):/g,
                    '{"$1":'
                  );

                  // Add missing quotes around values
                  cleanedGlossaryText = cleanedGlossaryText.replace(
                    /:\s*([^"{}\s][^,}]*?)([,}])/g,
                    ':"$1"$2'
                  );

                  // Fix keys and values that are merged without spaces
                  cleanedGlossaryText = cleanedGlossaryText.replace(
                    /(\w+):(\w+)/g,
                    '"$1":"$2"'
                  );

                  // Replace invalid unicode characters and control characters
                  cleanedGlossaryText = cleanedGlossaryText.replace(
                    /[\u0000-\u001F\u007F-\u009F]/g,
                    ""
                  );

                  // Try to find and fix common JSON syntax errors
                  cleanedGlossaryText = cleanedGlossaryText
                    // Remove any dangling commas at the end of objects
                    .replace(/,\s*}/g, "}")
                    // Ensure property names are quoted
                    .replace(/([{,]\s*)([^"\s][^:]*?):/g, '$1"$2":')
                    // Ensure property values are quoted when they're text
                    .replace(
                      /:(\s*)([^",\{\}\[\]\s][^,\}\]]*?)(\s*[,\}\]])/g,
                      ':"$2"$3'
                    );

                  // Try to repair broken nested objects
                  const fixNestedObjects = (text: string) => {
                    let stack = [];
                    let result = "";
                    let i = 0;
                    while (i < text.length) {
                      if (text[i] === "{") {
                        stack.push("{");
                        result += "{";
                      } else if (text[i] === "}") {
                        if (stack.length > 0) {
                          stack.pop();
                        } else {
                          // Found a closing brace without matching opening brace
                          // Skip this character
                        }
                        result += "}";
                      } else {
                        result += text[i];
                      }
                      i++;
                    }

                    // Add missing closing braces
                    while (stack.length > 0) {
                      result += "}";
                      stack.pop();
                    }

                    return result;
                  };

                  cleanedGlossaryText = fixNestedObjects(cleanedGlossaryText);

                  console.log("🔧 Repaired JSON attempt:", cleanedGlossaryText);

                  const reparsedGlossary = JSON.parse(cleanedGlossaryText);
                  newGlossary = Object.entries(reparsedGlossary).reduce(
                    (acc, [term, data]) => {
                      if (typeof data === "string") {
                        acc[term] = { translation: data };
                      } else if (typeof data === "object" && data !== null) {
                        acc[term] = {
                          translation: (data as any).translation || term,
                          gender: (data as any).gender,
                          role: (data as any).role,
                          alias: (data as any).alias,
                        };
                      }
                      return acc;
                    },
                    {} as GlossaryObject
                  );
                  console.log(
                    "📚 Repaired and processed glossary entries:",
                    Object.keys(newGlossary).length
                  );
                } catch (repairError) {
                  console.error(
                    "❌ Failed to repair glossary JSON:",
                    repairError
                  );

                  // Last resort: try to extract individual entries line by line
                  const lines = glossaryText.split("\n");
                  let inEntry = false;
                  let currentTerm = "";
                  let currentData: any = {};

                  for (const line of lines) {
                    const trimmedLine = line.trim();

                    // Check for term start
                    const termMatch = trimmedLine.match(
                      /^\s*"([^"]+)"\s*:\s*\{/
                    );
                    if (termMatch) {
                      if (inEntry && currentTerm) {
                        // Save previous entry
                        newGlossary[currentTerm] = {
                          translation: currentData.translation || currentTerm,
                          gender: currentData.gender,
                          role: currentData.role,
                          alias: currentData.alias,
                        };
                      }

                      // Start new entry
                      currentTerm = termMatch[1];
                      currentData = {};
                      inEntry = true;
                      continue;
                    }

                    // Check for properties
                    if (inEntry) {
                      const propMatch = trimmedLine.match(
                        /^\s*"([^"]+)"\s*:\s*"([^"]+)"/
                      );
                      if (propMatch) {
                        const [_, prop, value] = propMatch;
                        currentData[prop] = value;
                      } else if (trimmedLine.includes("}")) {
                        // End of entry
                        if (currentTerm) {
                          newGlossary[currentTerm] = {
                            translation: currentData.translation || currentTerm,
                            gender: currentData.gender,
                            role: currentData.role,
                            alias: currentData.alias,
                          };
                        }
                        inEntry = false;
                        currentTerm = "";
                        currentData = {};
                      }
                    }
                  }

                  // Add final entry if needed
                  if (inEntry && currentTerm) {
                    newGlossary[currentTerm] = {
                      translation: currentData.translation || currentTerm,
                      gender: currentData.gender,
                      role: currentData.role,
                      alias: currentData.alias,
                    };
                  }

                  console.log(
                    "📚 Line-by-line processed glossary entries:",
                    Object.keys(newGlossary).length
                  );
                }
              }
            } catch (jsonError) {
              console.error("❌ Failed to process glossary JSON:", jsonError);
            }
          }
        } catch (e) {
          console.error("❌ Failed to process glossary:", e);
        }
      } else if (trimmedSection.startsWith("Chapter Memory:")) {
        try {
          const memoryText = trimmedSection
            .replace("Chapter Memory:", "")
            .trim();

          if (memoryText) {
            try {
              chapterMemory = JSON.parse(memoryText);
              console.log("✅ Successfully parsed chapter memory JSON");
            } catch (jsonError) {
              console.error(
                "❌ Failed to parse chapter memory JSON:",
                jsonError
              );
            }
          }
        } catch (e) {
          console.error("❌ Failed to process chapter memory:", e);
          chapterMemory = {};
        }
      } else if (trimmedSection.startsWith("Quality Report:")) {
        try {
          const reportText = trimmedSection
            .replace("Quality Report:", "")
            .trim();

          if (reportText) {
            try {
              qualityReport = JSON.parse(reportText);
              console.log("✅ Successfully parsed quality report JSON");
            } catch (jsonError) {
              console.error(
                "❌ Failed to parse quality report JSON:",
                jsonError
              );
            }
          }
        } catch (e) {
          console.error("❌ Failed to process quality report:", e);
          qualityReport = {
            issues: [],
            suggestions: [],
            culturalNotes: [],
          };
        }
      }
    }

    // Debug log the final parsed result
    console.log("📦 Final parsed result:", {
      translationLength: translation.length,
      rawResponseLength: rawResponseText.length,
      glossaryEntries: Object.keys(newGlossary).length,
      chapterMemoryEntries: Object.keys(chapterMemory).length,
      qualityReportEntries: {
        issues: qualityReport.issues.length,
        suggestions: qualityReport.suggestions.length,
        culturalNotes: qualityReport.culturalNotes.length,
      },
    });

    // Update glossary if needed
    if (input.seriesId && updateGlossaryCallback) {
      const glossaryAdditions = Object.entries(newGlossary).reduce(
        (acc, [term, data]) => {
          acc[term] = {
            translation: data.translation,
            gender: data.gender,
            role: data.role,
            alias: data.alias,
          };
          return acc;
        },
        {} as GlossaryObject
      );

      if (Object.keys(glossaryAdditions).length > 0) {
        await updateGlossaryCallback(glossaryAdditions, input.text);
      }
    }

    // Return both the raw response and the processed data
    return {
      text: translation,
      rawResponse: cleanPageHeaders(rawResponseText), // Apply cleaning to raw response
      fullText: cleanPageHeaders(rawResponseText), // Apply cleaning to full text too
      glossary: newGlossary,
      chapterMemory,
      qualityReport,
    };
  } catch (error) {
    console.error("❌ Translation error:", error);
    throw new Error("Failed to translate text");
  }
}

/**
 * Cleans page headers by removing square brackets around them
 * @param text Translation text that may have incorrectly formatted page headers
 * @returns Text with properly formatted page headers
 */
function cleanPageHeaders(text: string): string {
  // Replace [=== Page X ===] with === Page X ===
  return text.replace(/\[(\s*===\s*Page\s+\d+\s*===\s*)\]/g, "$1");
}

/**
 * Extracts glossary additions from the translated text
 * @param text The translated text possibly containing glossary additions
 * @returns Object containing the translated text and any glossary additions
 */
function extractGlossaryAdditions(text: string): {
  translatedText: string;
  glossaryAdditions: GlossaryObject | null;
} {
  // More flexible regex patterns to detect glossary sections
  const patterns = [
    // Standard format with GLOSSARY_ADDITIONS label
    /GLOSSARY_ADDITIONS:[\s\n]*({[\s\S]*?})\s*$/i,
    // Alternative format with just "Glossary" heading
    /GLOSSARY:[\s\n]*({[\s\S]*?})\s*$/i,
    // More relaxed pattern that looks for any JSON object at the end of the text
    /[\n\r][\s\n\r]*({[\s\S]*?"[^"]*"[\s\n\r]*:[\s\n\r]*"[^"]*"[\s\S]*?})\s*$/,
  ];

  let match = null;
  // Try each pattern until we find a match
  for (const pattern of patterns) {
    match = text.match(pattern);
    if (match) break;
  }

  console.log("🔍 Regex match:", match ? "found" : "not found");

  if (!match) {
    // Try to extract a raw key-value list if we can't find a JSON object
    const rawGlossaryPattern = /{([^{}]+)}/;
    const rawMatch = text.match(rawGlossaryPattern);

    if (rawMatch) {
      console.log("📜 Found raw glossary format");
      try {
        // Process raw key-value pairs
        const rawGlossary = rawMatch[1];
        // Split by commas and process each line
        const pairs = rawGlossary.split(",").map((pair) => pair.trim());
        const glossaryObj: GlossaryObject = {};

        for (const pair of pairs) {
          // Extract key and value with regex that handles merged words
          const keyValueMatch = pair.match(/"([^"]+)":\s*"([^"]+)"/);
          if (keyValueMatch) {
            const [_, key, value] = keyValueMatch;
            glossaryObj[key] = {
              translation: value,
              gender: undefined,
              role: undefined,
              alias: undefined,
            };
          }
        }

        if (Object.keys(glossaryObj).length > 0) {
          console.log("🔄 Created glossary from raw format:", glossaryObj);
          // Remove the glossary section from the text
          const translatedText = text.replace(rawGlossaryPattern, "").trim();
          return { translatedText, glossaryAdditions: glossaryObj };
        }
      } catch (error) {
        console.error("❌ Error processing raw glossary format:", error);
      }
    }

    // Try to find any content that looks like a glossary list (lines with "word": "translation")
    const lines = text.split("\n");
    const glossaryObj: GlossaryObject = {};
    let foundGlossary = false;
    let glossaryStartIndex = -1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      // Look for patterns like "word": "translation" or "word":"t
      const keyValueMatch = line.match(/"([^"]+)":\s*"([^"]+)"/);

      if (keyValueMatch) {
        foundGlossary = true;
        if (glossaryStartIndex === -1) glossaryStartIndex = i;

        const [_, key, value] = keyValueMatch;
        glossaryObj[key] = {
          translation: value,
          gender: undefined,
          role: undefined,
          alias: undefined,
        };
      } else if (foundGlossary) {
        // Try to fix malformed entries (terms with no spaces between key and value)
        const alternativeMatch = line.match(/"([^"]+)":"([^"]+)"/);
        if (alternativeMatch) {
          const [_, key, value] = alternativeMatch;
          glossaryObj[key] = {
            translation: value,
            gender: undefined,
            role: undefined,
            alias: undefined,
          };
        }
      }
    }

    if (Object.keys(glossaryObj).length > 0) {
      console.log(
        "🔄 Created glossary from line-by-line parsing:",
        glossaryObj
      );
      // Remove the glossary lines from the text
      const translationLines = lines.slice(0, glossaryStartIndex);
      const translatedText = translationLines.join("\n").trim();
      return { translatedText, glossaryAdditions: glossaryObj };
    }

    return { translatedText: text, glossaryAdditions: null };
  }

  try {
    // Extract the JSON glossary additions
    let glossaryJson = match[1];
    console.log("📜 Extracted glossary JSON:", glossaryJson);

    // Remove comments (anything after // on each line)
    glossaryJson = glossaryJson.replace(/\/\/.*$/gm, "");
    // Strip any trailing commas
    glossaryJson = glossaryJson.replace(/,(\s*[}\]])/g, "$1");
    // Handle potential line breaks inside the keys or values
    glossaryJson = glossaryJson.replace(/(["\w])[\s\n\r]+(["\w])/g, "$1$2");
    // Fix missing spaces between key-value pairs
    glossaryJson = glossaryJson.replace(
      /("[^"]+"):("?[^",}]+)([,}])/g,
      '$1:"$2"$3'
    );
    // Fix merged words (like "term":"translation" with no spaces)
    glossaryJson = glossaryJson.replace(/"([^"]+)":"([^"]+)"/g, '"$1": "$2"');

    console.log("🧹 Cleaned glossary JSON:", glossaryJson);

    // Try to parse the JSON, handling potential errors
    let glossaryAdditions: GlossaryObject;
    try {
      glossaryAdditions = JSON.parse(glossaryJson) as GlossaryObject;
    } catch (parseError) {
      console.error("❌ Error parsing JSON, attempting repair:", parseError);

      // Manual repair attempt for simple JSON issues
      // Add missing quotes around keys
      glossaryJson = glossaryJson.replace(/{\s*([^"}\s][^:}]*?):/g, '{"$1":');
      // Add missing quotes around values
      glossaryJson = glossaryJson.replace(
        /:\s*([^"{}\s][^,}]*?)([,}])/g,
        ':"$1"$2'
      );
      // Fix keys and values that are merged without spaces
      glossaryJson = glossaryJson.replace(/(\w+):(\w+)/g, '"$1":"$2"');

      console.log("🔧 Repaired JSON attempt:", glossaryJson);
      try {
        glossaryAdditions = JSON.parse(glossaryJson) as GlossaryObject;
      } catch (secondError) {
        console.error("❌ Second parse error:", secondError);
        return { translatedText: text, glossaryAdditions: null };
      }
    }

    // Remove the glossary section from the text
    const translatedText = text.replace(match[0], "").trim();

    return { translatedText, glossaryAdditions };
  } catch (error) {
    console.error("❌ Error extracting glossary additions:", error);
    return { translatedText: text, glossaryAdditions: null };
  }
}

function getGenreSpecificPrompt(genres: string | string[]): string {
  const genrePrompts: Record<string, string> = {
    "Murim/Wuxia":
      "Respect Genre Tone: Use elegant, formal, grand phrasing appropriate for martial arts and cultivation stories.",
    Shounen:
      "Respect Genre Tone: Use energetic, action-oriented language with appropriate battle terminology.",
    Shoujo:
      "Respect Genre Tone: Emphasize emotional nuances and relationships with softer, more expressive language.",
    Seinen:
      "Respect Genre Tone: Adopt a mature, sometimes cynical tone with complex vocabulary and themes.",
    Josei:
      "Respect Genre Tone: Use sophisticated, emotionally intelligent language focused on adult relationships.",
    Fantasy:
      "Respect Genre Tone: Incorporate fantasy terminology and magical concepts naturally.",
    Isekai:
      "Respect Genre Tone: Use precise, mechanical, gamified language for system elements and skills.",
    Cyberpunk:
      "Respect Genre Tone: Incorporate futuristic slang, technical terminology, and dystopian elements.",
    "Slice of Life":
      "Respect Genre Tone: Maintain casual, warm, everyday language that feels authentic.",
    Romance:
      "Respect Genre Tone: Focus on emotional language that captures the nuances of romantic relationships.",
    Comedy:
      "Respect Genre Tone: Preserve humor through appropriate word choice and cultural adaptation.",
    Horror:
      "Respect Genre Tone: Use language that builds tension and conveys dread effectively.",
    Thriller:
      "Respect Genre Tone: Maintain suspenseful pacing and urgent tone in the translation.",
  };

  // If genres is an array, get prompts for all genres and join them
  if (Array.isArray(genres)) {
    const prompts = genres
      .map((genre) => genrePrompts[genre] || "")
      .filter((prompt) => prompt !== "");

    if (prompts.length === 0) {
      return "Respect Genre Tone: Adapt the translation to match the series tone and style.";
    }

    return prompts.join("\n");
  }

  // Handle single genre (for backward compatibility)
  return (
    genrePrompts[genres] ||
    "Respect Genre Tone: Adapt the translation to match the series tone and style."
  );
}

/**
 * Quality inspection function that verifies and improves translations
 */
async function inspectTranslationQuality(
  originalText: string,
  translatedText: string,
  glossary: GlossaryObject,
  series?: Series | null
): Promise<{
  improvedText: string;
  qualityReport: {
    issues: string[];
    suggestions: string[];
    culturalNotes: string[];
  };
}> {
  console.log("🔍 Running quality inspection");

  const prompt = `
  As a professional translation quality inspector, analyze this translation for accuracy and naturalness.
  
  Original Text:
  ${originalText}
  
  Translated Text:
  ${translatedText}
  
  Current Glossary:
  ${JSON.stringify(glossary, null, 2)}
  
  ${series?.tone_notes ? `Series Notes: ${series.tone_notes}` : ""}
  
  Check for:
  1. Incorrect pronouns (he/she/his/her)
  2. Missing or mistranslated cultural terms (Oppa, Hyung, etc.)
  3. Incorrect tone or emotional flow
  4. Broken or awkward English structure
  5. Inaccurate bubble type tagging (speech, thought, narration, etc.)
  6. Missed emphasis (screaming, whispering, etc.)
  7. Tag preservation ("":, ():, []:, //:, St:, Ot:, ::)
  
  Provide your analysis and improvements in this JSON format:
  {
    "improvedText": "Your improved translation here",
    "qualityReport": {
      "issues": ["List of issues found"],
      "suggestions": ["List of improvement suggestions"],
      "culturalNotes": ["List of cultural context notes"]
    }
  }
  `;

  try {
    const response = await fetch(
      `${GEMINI_API_URL}?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 8192,
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error("Failed to get quality inspection");
    }

    const data = await response.json();
    const result = JSON.parse(data.candidates[0].content.parts[0].text);

    return {
      improvedText: result.improvedText,
      qualityReport: result.qualityReport,
    };
  } catch (error) {
    console.error("❌ Quality inspection error:", error);
    // Return original translation if inspection fails
    return {
      improvedText: translatedText,
      qualityReport: {
        issues: ["Quality inspection failed"],
        suggestions: [],
        culturalNotes: [],
      },
    };
  }
}
