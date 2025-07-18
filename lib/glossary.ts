import { GlossaryTerm, GlossaryObject, Series } from "@/types";
import supabase from "./supabase";
import { glossaryManagementAssistant } from "./assistants";

/**
 * Converts glossary terms to a JSON object
 * @param terms Array of glossary terms
 * @returns JSON object with source terms as keys and translated terms as values
 */
export function convertGlossaryTermsToJson(
  terms: GlossaryTerm[]
): GlossaryObject {
  return terms.reduce((acc, term) => {
    acc[term.source_term] = {
      translation: term.translated_term || term.source_term,
      gender: term.gender,
      role: term.role,
      alias: term.alias,
    };
    return acc;
  }, {} as GlossaryObject);
}

/**
 * Detects potential new glossary terms from source text
 * @param sourceText The source text to analyze
 * @param existingGlossary Existing glossary terms
 * @returns Array of potential new terms
 */
export function detectPotentialGlossaryTerms(
  sourceText: string,
  existingGlossary: GlossaryObject
): string[] {
  // This is a simple implementation that could be enhanced
  // Currently detects capitalized words, proper nouns, etc.

  // Split text into words and clean them
  const words = sourceText
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, " ")
    .split(/\s+/);

  // Find potential terms (capitalized words not in glossary)
  const potentialTerms = words.filter((word) => {
    // Skip empty words and small words
    if (!word || word.length < 2) return false;

    // Check if it starts with a capital letter (likely a proper noun)
    const isCapitalized = /^[A-Z\u3131-\u318E\uAC00-\uD7A3]/.test(word);

    // Check if it's already in the glossary
    const isInGlossary = Object.keys(existingGlossary).some(
      (term) => term.toLowerCase() === word.toLowerCase()
    );

    return isCapitalized && !isInGlossary;
  });

  // Remove duplicates and convert to array
  return Array.from(new Set(potentialTerms));
}

/**
 * Fetches glossary terms for a series
 * @param seriesId The series ID
 * @returns Array of glossary terms
 */
export async function fetchGlossaryTerms(
  seriesId: string
): Promise<GlossaryTerm[]> {
  console.log("📋 Fetching glossary terms for series:", seriesId);
  const { data, error } = await supabase
    .from("glossaries")
    .select("*")
    .eq("series_id", seriesId)
    .order("source_term");

  if (error) {
    console.error("❌ Error fetching glossary terms:", error);
    return [];
  }

  console.log(`✅ Fetched ${data?.length || 0} glossary terms`);
  return data as GlossaryTerm[];
}

/**
 * Fetches glossary JSON directly from series table (if available)
 * @param seriesId The series ID
 * @returns JSON object with source terms as keys and translated terms as values
 */
export async function getSeriesGlossaryJson(
  seriesId: string
): Promise<GlossaryObject> {
  console.log("📖 Fetching glossary JSON for series:", seriesId);

  try {
    const { data, error } = await supabase
      .from("series")
      .select("*")
      .eq("id", seriesId)
      .single();

    if (error) {
      console.error("❌ Error fetching series:", error);
      return {};
    }

    console.log("✅ Fetched series data");
    // Handle both cases - whether the column exists or not
    return ((data as any)?.glossary_json || {}) as GlossaryObject;
  } catch (error) {
    console.error("❌ Error in getSeriesGlossaryJson:", error);
    return {};
  }
}

/**
 * Fetches enhanced glossary JSON directly from series table (if available)
 * This includes all metadata for each term
 * @param seriesId The series ID
 * @returns Enhanced JSON object with all term metadata
 */
export async function getEnhancedGlossaryJson(
  seriesId: string
): Promise<Record<string, any>> {
  console.log("📖 Fetching enhanced glossary JSON for series:", seriesId);

  try {
    const { data, error } = await supabase
      .from("series")
      .select("*")
      .eq("id", seriesId)
      .single();

    if (error) {
      console.error("❌ Error fetching series:", error);
      return {};
    }

    console.log("✅ Fetched series data with enhanced glossary");

    // Safely handle the enhanced_glossary_json
    let enhancedGlossary = {};

    try {
      // If it's already a parsed object, use it directly
      if (data && typeof (data as any).enhanced_glossary_json === "object") {
        enhancedGlossary = (data as any).enhanced_glossary_json || {};
      }
      // If it's a string, try to parse it
      else if (
        data &&
        typeof (data as any).enhanced_glossary_json === "string"
      ) {
        enhancedGlossary = JSON.parse((data as any).enhanced_glossary_json);
      }
    } catch (parseError) {
      console.error("❌ Error parsing enhanced glossary JSON:", parseError);
      // Return empty object on parse error
    }

    return enhancedGlossary;
  } catch (error) {
    console.error("❌ Error in getEnhancedGlossaryJson:", error);
    return {};
  }
}

/**
 * Gets the glossary as a JSON object for a series
 * @param seriesId The series ID
 * @returns JSON object with source terms as keys and translated terms as values
 */
export async function getGlossaryJson(
  seriesId: string
): Promise<GlossaryObject> {
  console.log("📋 Getting glossary as JSON for series:", seriesId);

  // First try to get from the optimized series.glossary_json column if it exists
  const jsonGlossary = await getSeriesGlossaryJson(seriesId);

  // If there are entries in the JSON glossary, use that
  if (Object.keys(jsonGlossary).length > 0) {
    return jsonGlossary;
  }

  // Otherwise, fall back to fetching and converting individual terms
  const terms = await fetchGlossaryTerms(seriesId);
  return convertGlossaryTermsToJson(terms);
}

/**
 * Auto-detects term type/category based on patterns
 */
function detectTermType(sourceTerm: string, translatedTerm: string): string {
  // Simple heuristic for term categorization
  if (/^[A-Z][a-z]+ [A-Z][a-z]+$/.test(translatedTerm)) {
    return "character"; // Likely a full name
  } else if (
    /guild|clan|kingdom|empire|village|city|mountain|forest|sea|river|lake/i.test(
      translatedTerm
    )
  ) {
    return "place";
  } else if (
    /technique|spell|skill|arts|magic|attack|strike|formation/i.test(
      translatedTerm
    )
  ) {
    return "ability";
  } else if (
    /sword|staff|wand|bow|arrow|shield|armor|robe|potion|scroll/i.test(
      translatedTerm
    )
  ) {
    return "item";
  }
  return "general";
}

/**
 * Updates the glossary for a series with new entries
 * @param seriesId The series ID
 * @param existingGlossary The existing glossary
 * @param newEntries The new glossary entries
 * @param sourceText Optional source text for context
 * @returns The updated glossary
 */
export async function updateGlossary(
  seriesId: string,
  existingGlossary: GlossaryObject,
  newEntries: GlossaryObject,
  sourceText: string = ""
): Promise<GlossaryObject> {
  console.log("📝 Updating glossary for series:", seriesId);

  // Extract source terms from new entries
  const sourceTerms = Object.keys(newEntries);
  if (sourceTerms.length === 0) {
    console.log("ℹ️ No new glossary entries to add");
    return existingGlossary;
  }

  try {
    // Use the Glossary Management Assistant for improved suggestions
    const assistantResult = await glossaryManagementAssistant(
      sourceTerms,
      existingGlossary,
      sourceText
    );

    // Add each term to the database
    for (const suggestion of assistantResult.suggestedTerms) {
      const {
        sourceTerm,
        translatedTerm,
        suggestedCategory,
        entityType,
        gender,
        characterRole,
        language,
      } = suggestion;

      // Skip if source term is empty
      if (!sourceTerm.trim()) continue;

      // Determine term type based on category or detection
      let termType = "Other";

      // Check if it's a character
      if (suggestedCategory?.toLowerCase().includes("character")) {
        termType = "Character Name";
      }
      // Check if it's a place/location
      else if (
        suggestedCategory?.toLowerCase().includes("place") ||
        suggestedCategory?.toLowerCase().includes("location")
      ) {
        termType = "Location";
      }
      // Check if it's a technique or skill
      else if (
        suggestedCategory?.toLowerCase().includes("technique") ||
        suggestedCategory?.toLowerCase().includes("skill") ||
        suggestedCategory?.toLowerCase().includes("ability")
      ) {
        termType = "Skill/Technique";
      }
      // Check if it's an organization
      else if (
        suggestedCategory?.toLowerCase().includes("organization") ||
        suggestedCategory?.toLowerCase().includes("group")
      ) {
        termType = "Organization";
      }
      // Check if it's a sound effect
      else if (suggestedCategory?.toLowerCase().includes("sound")) {
        termType = "Sound Effect";
      }
      // Check if it's an honorific/title
      else if (
        suggestedCategory?.toLowerCase().includes("honorific") ||
        suggestedCategory?.toLowerCase().includes("title")
      ) {
        // Determine the language-specific honorific type
        if (language === "Korean") {
          termType = "Honorific - Korean";
        } else if (language === "Chinese") {
          termType = "Honorific - Chinese";
        } else if (language === "Japanese") {
          termType = "Honorific - Japanese";
        } else {
          termType = "Formal Title";
        }
      }
      // Check if it's a family relation
      else if (
        suggestedCategory?.toLowerCase().includes("family") ||
        suggestedCategory?.toLowerCase().includes("relation")
      ) {
        termType = "Family Relation";
      }
      // Check if it's a cultural term
      else if (suggestedCategory?.toLowerCase().includes("cultural")) {
        termType = "Cultural Term";
      }

      // Add the term to the database
      const { error } = await supabase.from("glossaries").insert({
        series_id: seriesId,
        source_term: sourceTerm,
        translated_term: translatedTerm,
        term_type: termType,
        entity_type: entityType,
        gender: gender,
        character_role: characterRole,
        auto_suggested: true,
        source_context: sourceText.substring(0, 500), // Limit context length
      });

      if (error) {
        console.error(`❌ Error adding term "${sourceTerm}":`, error);
      } else {
        console.log(`✅ Added term: ${sourceTerm} -> ${translatedTerm}`);
      }
    }

    // Try to update the glossary JSON using the database function
    try {
      // Call the database function to update the glossary JSON
      const { error } = await supabase.rpc("update_series_glossary_json", {
        series_id: seriesId,
      });

      if (error) {
        console.error(
          "❌ Error calling update_series_glossary_json RPC:",
          error
        );
        console.log("🔄 Falling back to manual glossary JSON update");
        await manuallyUpdateGlossaryJson(seriesId);
      }
    } catch (rpcError) {
      console.error("❌ Failed to call RPC function:", rpcError);
      console.log("🔄 Falling back to manual glossary JSON update");
      await manuallyUpdateGlossaryJson(seriesId);
    }

    // Notify clients about the glossary update
    try {
      const channel = supabase.channel("custom-update-channel");
      await channel.send({
        type: "broadcast",
        event: "glossary-updated",
        payload: { series_id: seriesId },
      });
    } catch (broadcastError) {
      console.error("❌ Error broadcasting glossary update:", broadcastError);
    }

    // Return the updated glossary
    return await getGlossaryJson(seriesId);
  } catch (error) {
    console.error("❌ Error in updateGlossary:", error);
    return existingGlossary;
  }
}

/**
 * Manually updates the glossary JSON for a series
 * This is a workaround for when the database function is not available
 * @param seriesId The series ID
 * @returns True if successful, false otherwise
 */
export async function manuallyUpdateGlossaryJson(
  seriesId: string
): Promise<boolean> {
  console.log("🔧 Manually updating glossary JSON for series:", seriesId);

  try {
    // Step 1: Fetch all glossary terms for this series
    const { data: glossaryTerms, error: fetchError } = await supabase
      .from("glossaries")
      .select("*")
      .eq("series_id", seriesId);

    if (fetchError) {
      console.error("❌ Error fetching glossary terms:", fetchError);
      return false;
    }

    // Step 2: Convert to enhanced glossary JSON format
    const enhancedGlossaryJson = (glossaryTerms as GlossaryTerm[]).reduce(
      (acc, term) => {
        acc[term.source_term] = {
          translation: term.translated_term,
          gender: term.gender || undefined,
          role: term.role || undefined,
          alias: term.alias || undefined,
        };
        return acc;
      },
      {} as Record<string, any>
    );

    console.log(
      `📊 Built glossary JSON with ${
        Object.keys(enhancedGlossaryJson).length
      } terms`
    );

    // Step 3: Update the series record
    const { error: updateError } = await supabase
      .from("series")
      .update({
        glossary_json: enhancedGlossaryJson,
      })
      .eq("id", seriesId);

    if (updateError) {
      console.error("❌ Error updating series glossary_json:", updateError);
      return false;
    }

    console.log("✅ Successfully updated glossary JSON");
    return true;
  } catch (error) {
    console.error("❌ Error in manuallyUpdateGlossaryJson:", error);
    return false;
  }
}

/**
 * Utility function to fix corrupted glossary JSON in the database
 * @param seriesId The series ID to fix
 * @returns True if successful, false otherwise
 */
export async function fixCorruptedGlossaryJson(
  seriesId: string
): Promise<boolean> {
  console.log("🔧 Fixing corrupted glossary JSON for series:", seriesId);

  try {
    // First, get the current glossary JSON to check if it's corrupted
    const { data: seriesData, error: seriesError } = await supabase
      .from("series")
      .select("glossary_json")
      .eq("id", seriesId)
      .single();

    if (seriesError) {
      console.error("❌ Error fetching series:", seriesError);
      return false;
    }

    let isCorrupted = false;
    try {
      // Try to access some properties to check if JSON is valid
      const glossaryJson = seriesData?.glossary_json || {};
      const keys = Object.keys(glossaryJson);
      console.log(`📊 Current glossary has ${keys.length} keys`);
    } catch (error) {
      console.error("❌ Corrupted glossary JSON detected:", error);
      isCorrupted = true;
    }

    // If the glossary JSON is corrupted or empty, rebuild it
    if (
      isCorrupted ||
      !seriesData?.glossary_json ||
      Object.keys(seriesData.glossary_json).length === 0
    ) {
      console.log("🔄 Rebuilding glossary JSON from scratch");
      return await manuallyUpdateGlossaryJson(seriesId);
    }

    console.log("✅ Glossary JSON appears to be valid");
    return true;
  } catch (error) {
    console.error("❌ Error in fixCorruptedGlossaryJson:", error);
    return false;
  }
}
