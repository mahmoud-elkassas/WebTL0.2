import supabase from "./supabase";
import { TranslationInput, SourceLanguage } from "@/types";
import { translateText } from "./api/gemini";

/**
 * Get a specific translation by ID
 */
export async function getTranslation(translationId: string) {
  try {
    const { data, error } = await supabase
      .from("translations")
      .select("*")
      .eq("id", translationId)
      .single();

    if (error) {
      throw error;
    }

    return data;
  } catch (error) {
    console.error("Error getting translation:", error);
    throw error;
  }
}

/**
 * Get all versions of a translation
 */
export async function getTranslationVersions(translationId: string) {
  try {
    // Use a direct fetch with a custom function name that
    // isn't typed in the Database types yet
    const { data, error } = await supabase.rpc(
      "get_translation_versions" as any,
      {
        p_translation_id: translationId,
      }
    );

    if (error) {
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error("Error getting translation versions:", error);
    return [];
  }
}

/**
 * Replace an existing translation with new content
 */
export async function replaceTranslation(
  translationId: string,
  newSourceText: string,
  userId: string
) {
  try {
    // Get the existing translation to access its properties
    const existingTranslation = await getTranslation(translationId);

    if (!existingTranslation) {
      throw new Error(`Translation with ID ${translationId} not found`);
    }

    // Get the series to access source_language
    const { data: seriesData } = await supabase
      .from("series")
      .select("source_language")
      .eq("id", existingTranslation.series_id)
      .single();

    if (!seriesData) {
      throw new Error(
        `Series with ID ${existingTranslation.series_id} not found`
      );
    }

    // Create the translation input
    const input: TranslationInput = {
      text: newSourceText,
      sourceLanguage: seriesData.source_language as SourceLanguage,
      seriesId: existingTranslation.series_id,
      chapter: existingTranslation.chapter || undefined,
    };

    // Generate the new translation using Gemini
    const newTranslatedText = await translateText(input);

    // Call the DB function to replace translation
    const { data, error } = await supabase.rpc("replace_translation" as any, {
      p_translation_id: translationId,
      p_new_source: newSourceText,
      p_new_translation: newTranslatedText,
      p_user_id: userId,
    });

    if (error) {
      throw error;
    }

    return {
      translationId: data,
      sourceText: newSourceText,
      translatedText: newTranslatedText,
    };
  } catch (error) {
    console.error("Error replacing translation:", error);
    throw error;
  }
}

/**
 * Merge an existing translation with new content
 */
export async function mergeTranslation(
  translationId: string,
  newSourceText: string,
  userId: string,
  mergeStrategy: "append" | "prepend" | "smart" = "append"
) {
  try {
    // Get the existing translation to access its properties
    const existingTranslation = await getTranslation(translationId);

    if (!existingTranslation) {
      throw new Error(`Translation with ID ${translationId} not found`);
    }

    // Get the series to access source_language
    const { data: seriesData } = await supabase
      .from("series")
      .select("source_language")
      .eq("id", existingTranslation.series_id)
      .single();

    if (!seriesData) {
      throw new Error(
        `Series with ID ${existingTranslation.series_id} not found`
      );
    }

    // Create the translation input
    const input: TranslationInput = {
      text: newSourceText,
      sourceLanguage: seriesData.source_language as SourceLanguage,
      seriesId: existingTranslation.series_id,
      chapter: existingTranslation.chapter || undefined,
    };

    // Generate the new translation using Gemini
    const newTranslatedText = await translateText(input);

    // Call the DB function to merge translation
    const { data, error } = await supabase.rpc("merge_translation" as any, {
      p_translation_id: translationId,
      p_new_source: newSourceText,
      p_new_translation: newTranslatedText,
      p_user_id: userId,
      p_merge_strategy: mergeStrategy,
    });

    if (error) {
      throw error;
    }

    return {
      translationId: data,
      sourceText: newSourceText,
      translatedText: newTranslatedText,
      mergeStrategy,
    };
  } catch (error) {
    console.error("Error merging translation:", error);
    throw error;
  }
}

/**
 * Get recent translations for a series
 */
export async function getRecentTranslations(
  seriesId: string,
  limit: number = 5
) {
  try {
    const { data, error } = await supabase
      .from("translations")
      .select("*")
      .eq("series_id", seriesId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error("Error getting recent translations:", error);
    return [];
  }
}

/**
 * Find translations by chapter
 */
export async function findTranslationsByChapter(
  seriesId: string,
  chapter: string
) {
  try {
    const { data, error } = await supabase
      .from("translations")
      .select("*")
      .eq("series_id", seriesId)
      .eq("chapter", chapter)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error("Error finding translations by chapter:", error);
    return [];
  }
}
