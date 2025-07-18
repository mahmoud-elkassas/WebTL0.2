import { GlossaryTerm, GlossaryObject, MemoryEntry } from "@/types";

const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent";

/**
 * Base function to call Gemini API with a specific prompt and role
 */
async function callGeminiAssistant(
  prompt: string,
  role: string,
  maxTokens: number = 500
): Promise<string> {
  const apiKey =
    process.env.GEMINI_API_KEY || "AIzaSyCoNNHEWBkonUZDF9i7jzpDgzsrltiAqrg";

  if (!apiKey) {
    throw new Error("Gemini API key is not configured");
  }

  const systemPrompt = `You are an AI assistant specializing in ${role}. ${prompt}`;

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: systemPrompt }],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: maxTokens,
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error(`❌ ${role} API error:`, errorData);
      throw new Error(`Gemini API error: ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    console.log(`✅ Received ${role} response`);
    return data.candidates[0].content.parts[0].text.trim();
  } catch (error) {
    console.error(`❌ Error in ${role}:`, error);
    throw error;
  }
}

/**
 * Glossary Management Assistant
 * Helps with translating and categorizing new terms
 */
export async function glossaryManagementAssistant(
  sourceTerms: string[],
  existingGlossary: GlossaryObject,
  context: string
): Promise<{
  suggestedTerms: {
    sourceTerm: string;
    translatedTerm: string;
    suggestedCategory: string;
    entityType?: string;
    gender?: string;
    characterRole?: string;
    language?: string;
  }[];
}> {
  console.log("🔍 Running Glossary Management Assistant");

  if (sourceTerms.length === 0) {
    return { suggestedTerms: [] };
  }

  const prompt = `
    As a Glossary Management Assistant specialized in Asian language honorifics and cultural terms, analyze these new terms detected in a translation.
    
    Existing glossary contains ${Object.keys(existingGlossary).length} terms.
    
    For each term, provide:
    1. An accurate English translation or preservation of the term if it's an honorific
    2. A detailed category classification
    3. For character terms, identify their likely gender (Male, Female, Unknown)
    4. For character terms, suggest their role in the story if possible
    5. Identify the source language (Korean, Japanese, Chinese) if possible
    6. Determine the entity type (Person, Place, Technique, Organization, Item, Term)
    
    IMPORTANT RULES:
    - NEVER directly translate honorifics like "Oppa", "Hyung", "Gege" into English words like "brother". 
      Instead, preserve these cultural terms in their original form.
    - For location/place names, keep their original form if they're proper nouns
    - Be as specific and accurate as possible in the translations
    - If a term has special cultural significance, note this in the suggested category
    - For food and cultural items, provide both the transliteration and a brief explanation
    - Carefully distinguish between common nouns (which should be translated) and proper nouns/names (which should be preserved)
    
    For honorifics and relationship terms, here are some examples:
    
    Korean:
    - 형 (Hyung): Used by males to address older brother or male friend
    - 오빠 (Oppa): Used by females to address older brother or male friend (often romantic)
    - 누나 (Noona): Used by males to address older sister or female friend
    - 언니 (Unnie): Used by females to address older sister or female friend
    - 아저씨 (Ajeossi): Middle-aged man (uncle, stranger)
    - 선배 (Sunbae): Senior in school/workplace
    - 동생 (Dongsaeng): Younger sibling or friend
    - 사장님 (Sajangnim): Boss, business owner
    
    Chinese:
    - 哥哥 (Gege): Older brother
    - 姐姐 (Jiejie): Older sister
    - 弟弟 (Didi): Younger brother
    - 妹妹 (Meimei): Younger sister
    - 师傅 (Shifu): Master (skills/martial arts)
    - 老板 (Laoban): Boss
    - 大人 (Daren): Sir/Lord (respectful)
    
    Japanese:
    - 兄/お兄ちゃん (Oniichan): Older brother
    - 姉/お姉ちゃん (Oneechan): Older sister
    - 先生 (Sensei): Teacher/doctor/master
    - 先輩 (Senpai): Senior in hierarchy
    - 後輩 (Kouhai): Junior in hierarchy
    - お嬢様 (Ojousama): Young lady (respectful)
    - 様 (-sama): Highly respectful honorific suffix
    
    Try to be as specific as possible with the translations. For example:
    - 김치 should be "Kimchi" (Korean fermented vegetable dish)
    - 한복 should be "Hanbok" (Korean traditional clothing)
    - 용 should be "Dragon" if it's a common noun, or kept as "Yong" if it's a name
    - 서울 should be "Seoul" (city name)
    
    Format your response as a JSON object:
    
    {
      "suggestedTerms": [
        {
          "sourceTerm": "term1",
          "translatedTerm": "translation1",
          "suggestedCategory": "category1",
          "entityType": "Person/Place/etc",
          "gender": "Male/Female/Unknown",
          "characterRole": "role if applicable",
          "language": "Korean/Japanese/Chinese if detectable"
        },
        {
          "sourceTerm": "term2",
          "translatedTerm": "translation2",
          "suggestedCategory": "category2",
          "entityType": "Person/Place/etc",
          "gender": "Male/Female/Unknown",
          "characterRole": "role if applicable",
          "language": "Korean/Japanese/Chinese if detectable"
        }
      ]
    }
    
    Source terms to analyze: ${JSON.stringify(sourceTerms)}
    
    Additional context: ${context}
  `;

  try {
    const response = await callGeminiAssistant(
      prompt,
      "Glossary Management",
      1500
    );

    // Extract JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Could not extract JSON from response");
    }

    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error("❌ Error in glossary management assistant:", error);
    // Return a better fallback with clear indication translation is needed
    return {
      suggestedTerms: sourceTerms.map((term) => {
        // Detect language to provide more context
        let language = "Unknown";
        // Korean: AC00-D7A3
        if (/[\uAC00-\uD7A3]/.test(term)) language = "Korean";
        // Japanese: 3040-309F (hiragana), 30A0-30FF (katakana), 4E00-9FAF (kanji)
        else if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(term))
          language = "Japanese";
        // Chinese: 4E00-9FFF
        else if (/[\u4E00-\u9FFF]/.test(term)) language = "Chinese";

        return {
          sourceTerm: term,
          translatedTerm: `[Translation needed: ${language} term]`, // Clear marker for translation needed
          suggestedCategory: "Other",
          language: language,
          entityType: "Term",
        };
      }),
    };
  }
}

/**
 * Story Context Memory Assistant
 * Helps summarize and tag key events for memory
 */
export async function storyContextMemoryAssistant(
  translatedText: string,
  existingSummary: string | null
): Promise<{
  summary: string;
  tags: string[];
  keyEvents: string[];
}> {
  console.log("📝 Running Story Context Memory Assistant");

  const prompt = `
    As a Story Context Memory Assistant, analyze this translated chapter content and create:
    
    1. A concise, well-written summary (max 2-3 sentences)
    2. 2-4 tags that categorize key elements (emotion, relationship, plot point, etc.)
    3. 1-3 key events worth remembering for future chapters
    
    ${
      existingSummary
        ? `Previous summary: ${existingSummary}`
        : "No previous summary exists."
    }
    
    Format your response as JSON:
    
    {
      "summary": "Concise chapter summary here",
      "tags": ["tag1", "tag2", "tag3"],
      "keyEvents": ["event1", "event2"]
    }
    
    Translated text to analyze:
    ${translatedText.substring(0, 2000)}${
    translatedText.length > 2000 ? "..." : ""
  }
  `;

  try {
    const response = await callGeminiAssistant(
      prompt,
      "Story Context Memory",
      800
    );

    // Extract JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Could not extract JSON from response");
    }

    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error("❌ Error in story context memory assistant:", error);
    // Return a simple fallback
    return {
      summary: existingSummary || "Summary generation failed.",
      tags: [],
      keyEvents: [],
    };
  }
}

/**
 * Memory Filtering Assistant
 * Selects the most relevant memory entries for the current chapter
 */
export async function memoryFilteringAssistant(
  chapterText: string,
  memories: MemoryEntry[],
  maxEntries: number = 5
): Promise<MemoryEntry[]> {
  console.log("🧠 Running Memory Filtering Assistant");

  if (memories.length <= maxEntries) {
    return memories; // Return all if we have fewer than max
  }

  const prompt = `
    As a Memory Filtering Assistant, analyze this chapter text and select the ${maxEntries} most relevant memory entries.
    
    Consider:
    - Character appearances
    - Plot continuity
    - Key relationships
    - Recent events
    
    Available memories: ${JSON.stringify(
      memories.map((m) => ({ id: m.id, content: m.content, tags: m.tags }))
    )}
    
    Return only the IDs of the most relevant memories in JSON format:
    
    {
      "relevantMemoryIds": ["id1", "id2", "id3", "id4", "id5"]
    }
    
    Chapter text to analyze (excerpt):
    ${chapterText.substring(0, 1500)}${chapterText.length > 1500 ? "..." : ""}
  `;

  try {
    const response = await callGeminiAssistant(prompt, "Memory Filtering", 500);

    // Extract JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Could not extract JSON from response");
    }

    const result = JSON.parse(jsonMatch[0]);
    const relevantIds = result.relevantMemoryIds || [];

    // Filter memories by the relevant IDs
    return memories.filter((memory) => relevantIds.includes(memory.id));
  } catch (error) {
    console.error("❌ Error in memory filtering assistant:", error);
    // Return first maxEntries as fallback
    return memories.slice(0, maxEntries);
  }
}

/**
 * Prompt Inspector Assistant
 * Shows and allows editing of the full prompt before sending to Gemini
 */
export function createPromptPreview(
  systemPrompt: string,
  glossaryTerms: GlossaryTerm[],
  selectedMemories: MemoryEntry[],
  sourceText: string
): string {
  // Format the preview in a readable way
  return `
SYSTEM PROMPT:
${systemPrompt.substring(0, 300)}...

GLOSSARY TERMS (${glossaryTerms.length} total):
${glossaryTerms
  .slice(0, 5)
  .map((term) => `- ${term.source_term}: ${term.translated_term}`)
  .join("\n")}
${
  glossaryTerms.length > 5
    ? `... and ${glossaryTerms.length - 5} more terms`
    : ""
}

MEMORY ENTRIES (${selectedMemories.length} selected):
${selectedMemories
  .map((memory) => `- ${memory.content.substring(0, 100)}...`)
  .join("\n")}

SOURCE TEXT:
${sourceText.substring(0, 200)}...
(${sourceText.split("\n").length} lines total)
  `;
}

/**
 * AI Help Chat Assistant
 * General purpose translation assistant
 */
export async function aiHelpChatAssistant(
  query: string,
  seriesContext: string,
  recentTranslations: string[] = []
): Promise<string> {
  console.log("💬 Running AI Help Chat Assistant");

  const prompt = `
    As an AI Help Chat Assistant for translators, answer this query about the series.
    
    Series context: ${seriesContext}
    
    ${
      recentTranslations.length > 0
        ? `Recent translations (excerpts):
      ${recentTranslations
        .map((t, i) => `Translation ${i + 1}: ${t.substring(0, 200)}...`)
        .join("\n")}
    `
        : ""
    }
    
    User query: ${query}
    
    Provide a helpful, concise response focused on translation quality and consistency.
  `;

  try {
    return await callGeminiAssistant(prompt, "AI Help Chat", 800);
  } catch (error) {
    console.error("❌ Error in AI help chat assistant:", error);
    return "I'm sorry, I couldn't process your request. Please try again.";
  }
}

/**
 * Chapter Summary Generator
 * Generates a concise summary of a chapter
 */
export async function chapterSummaryGenerator(
  translatedText: string
): Promise<string> {
  console.log("📚 Running Chapter Summary Generator");

  const prompt = `
    As a Chapter Summary Generator, create a concise 1-2 sentence summary of this translated chapter.
    
    Focus on:
    - Key plot developments
    - Character actions and interactions
    - Important revelations
    
    Your summary should be clear, direct, and capture the essence of what happened.
    
    Translated text to summarize:
    ${translatedText.substring(0, 2000)}${
    translatedText.length > 2000 ? "..." : ""
  }
  `;

  try {
    return await callGeminiAssistant(prompt, "Chapter Summary Generator", 200);
  } catch (error) {
    console.error("❌ Error in chapter summary generator:", error);
    // Return simple fallback
    return "Chapter summary generation failed.";
  }
}
