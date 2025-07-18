import supabase from "./supabase";
import { toast } from "sonner";

/**
 * Delete a series and all its associated data
 * This handles CASCADE deletes for glossaries, chapters, and translations
 */
export async function deleteSeries(seriesId: string): Promise<boolean> {
  try {
    console.log(`🗑️ Deleting series with ID: ${seriesId}`);

    // First, get the series to keep a record of what was deleted
    const { data: series, error: fetchError } = await supabase
      .from("series")
      .select("*")
      .eq("id", seriesId)
      .single();

    if (fetchError) {
      console.error("❌ Error fetching series for deletion:", fetchError);
      return false;
    }

    // Delete glossaries first (although CASCADE should handle this)
    const { error: glossaryError } = await supabase
      .from("glossaries")
      .delete()
      .eq("series_id", seriesId);

    if (glossaryError) {
      console.error("❌ Error deleting series glossaries:", glossaryError);
      // Continue anyway - it might be that there are no glossaries
    }

    // Delete chapters (CASCADE should handle translations)
    const { error: chapterError } = await supabase
      .from("chapters")
      .delete()
      .eq("series_id", seriesId);

    if (chapterError) {
      console.error("❌ Error deleting series chapters:", chapterError);
      // Continue anyway - it might be that there are no chapters
    }

    // Delete translations directly (in case they're not properly cascaded)
    const { error: translationError } = await supabase
      .from("translations")
      .delete()
      .eq("series_id", seriesId);

    if (translationError) {
      console.error("❌ Error deleting series translations:", translationError);
      // Continue anyway - it might be that there are no translations
    }

    // Finally delete the series itself
    const { error: deleteError } = await supabase
      .from("series")
      .delete()
      .eq("id", seriesId);

    if (deleteError) {
      console.error("❌ Error deleting series:", deleteError);
      return false;
    }

    console.log(`✅ Successfully deleted series: ${series.name}`);
    return true;
  } catch (error) {
    console.error("❌ Unexpected error deleting series:", error);
    return false;
  }
}

/**
 * Verify that a series can be safely deleted
 * Checks if there are dependencies that should be noted to the user
 */
export async function verifySeriesDeletion(seriesId: string): Promise<{
  canDelete: boolean;
  issues: string[];
}> {
  try {
    console.log(`🔍 Verifying series deletion for ID: ${seriesId}`);

    // Initialize results
    const issues: string[] = [];

    // Check for existing chapters
    const { count: chapterCount, error: chaptersError } = await supabase
      .from("chapters")
      .select("*", { count: "exact", head: true })
      .eq("series_id", seriesId);

    if (chaptersError) {
      console.error("❌ Error checking chapters:", chaptersError);
      issues.push("Error checking associated chapters");
    } else if (chapterCount && chapterCount > 0) {
      issues.push(`Series has ${chapterCount} chapters that will be deleted`);
    }

    // Check for glossary entries
    const { count: glossaryCount, error: glossariesError } = await supabase
      .from("glossaries")
      .select("*", { count: "exact", head: true })
      .eq("series_id", seriesId);

    if (glossariesError) {
      console.error("❌ Error checking glossaries:", glossariesError);
      issues.push("Error checking associated glossary entries");
    } else if (glossaryCount && glossaryCount > 0) {
      issues.push(
        `Series has ${glossaryCount} glossary entries that will be deleted`
      );
    }

    // Check for translations
    const { count: translationCount, error: translationsError } = await supabase
      .from("translations")
      .select("*", { count: "exact", head: true })
      .eq("series_id", seriesId);

    if (translationsError) {
      console.error("❌ Error checking translations:", translationsError);
      issues.push("Error checking associated translations");
    } else if (translationCount && translationCount > 0) {
      issues.push(
        `Series has ${translationCount} translations that will be deleted`
      );
    }

    // If there are issues to warn about but not prevent deletion
    return {
      canDelete: true, // We always allow deletion but report potential data loss
      issues,
    };
  } catch (error) {
    console.error("❌ Unexpected error verifying series deletion:", error);
    return {
      canDelete: false,
      issues: ["Unexpected error while verifying deletion"],
    };
  }
}
