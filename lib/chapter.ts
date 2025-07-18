import supabase from "./supabase";
import { toast } from "sonner";

/**
 * Delete a chapter and all its associated data
 * This uses the database triggers to handle cascade deletes properly
 */
export async function deleteChapter(chapterId: string): Promise<boolean> {
  try {
    console.log(`🗑️ Deleting chapter with ID: ${chapterId}`);

    // First, get the chapter to keep a record of what was deleted
    const { data: chapter, error: fetchError } = await supabase
      .from("chapters")
      .select("*")
      .eq("id", chapterId)
      .single();

    if (fetchError) {
      console.error("❌ Error fetching chapter for deletion:", fetchError);
      return false;
    }

    // Perform the deletion - database triggers will handle cascade deletes
    const { error: deleteError } = await supabase
      .from("chapters")
      .delete()
      .eq("id", chapterId);

    if (deleteError) {
      console.error("❌ Error deleting chapter:", deleteError);
      return false;
    }

    console.log(
      `✅ Successfully deleted chapter: ${chapter.series_id}/${chapter.chapter_number}`
    );
    return true;
  } catch (error) {
    console.error("❌ Unexpected error deleting chapter:", error);
    return false;
  }
}

/**
 * Update a chapter with new details
 * This triggers database functions to update related data
 */
export async function updateChapter(
  chapterId: string,
  updatedData: { title?: string; chapter_number?: string }
): Promise<boolean> {
  try {
    console.log(`🔄 Updating chapter with ID: ${chapterId}`, updatedData);

    // Only update fields that are actually provided
    const updateData: Record<string, any> = {};
    if (updatedData.title !== undefined) updateData.title = updatedData.title;
    if (updatedData.chapter_number !== undefined)
      updateData.chapter_number = updatedData.chapter_number;

    // Don't proceed if there's nothing to update
    if (Object.keys(updateData).length === 0) {
      console.log("⚠️ No changes to update for chapter");
      return true;
    }

    // Update the chapter
    const { error } = await supabase
      .from("chapters")
      .update(updateData)
      .eq("id", chapterId);

    if (error) {
      console.error("❌ Error updating chapter:", error);
      return false;
    }

    console.log(`✅ Successfully updated chapter: ${chapterId}`);
    return true;
  } catch (error) {
    console.error("❌ Unexpected error updating chapter:", error);
    return false;
  }
}

/**
 * Verify that a chapter can be safely deleted
 * Checks if there are any dependencies that might not be handled by cascade deletes
 */
export async function verifyChapterDeletion(chapterId: string): Promise<{
  canDelete: boolean;
  issues: string[];
}> {
  try {
    console.log(`🔍 Verifying chapter deletion for ID: ${chapterId}`);

    // First, get basic chapter info
    const { data: chapter, error: fetchError } = await supabase
      .from("chapters")
      .select("*")
      .eq("id", chapterId)
      .single();

    if (fetchError) {
      console.error("❌ Error fetching chapter for verification:", fetchError);
      return { canDelete: false, issues: ["Error fetching chapter"] };
    }

    // Initialize results
    const issues: string[] = [];

    // Check for existing translations
    const { data: translations, error: translationsError } = await supabase
      .from("translations")
      .select("count", { count: "exact" })
      .eq("series_id", chapter.series_id)
      .eq("chapter", chapter.chapter_number);

    if (translationsError) {
      console.error("❌ Error checking translations:", translationsError);
      issues.push("Error checking associated translations");
    } else if (translations && translations.length > 0) {
      issues.push(
        `Chapter has ${translations.length} translations that will be deleted`
      );
    }

    // Check for memory entries
    const { data: memories, error: memoriesError } = await supabase
      .from("memory_entries")
      .select("count", { count: "exact" })
      .eq("chapter_id", chapterId);

    if (memoriesError) {
      console.error("❌ Error checking memory entries:", memoriesError);
      issues.push("Error checking associated memory entries");
    } else if (memories && memories.length > 0) {
      issues.push(
        `Chapter has ${memories.length} memory entries that will be deleted`
      );
    }

    // If there are no blocking issues, allow deletion
    return {
      canDelete: true,
      issues,
    };
  } catch (error) {
    console.error("❌ Unexpected error verifying chapter deletion:", error);
    return {
      canDelete: false,
      issues: ["Unexpected error while verifying deletion"],
    };
  }
}

/**
 * Create a new chapter
 */
export async function createChapter(
  seriesId: string,
  chapterNumber: string,
  title: string = "",
  userId: string
): Promise<{ id: string } | null> {
  try {
    console.log(`📝 Creating new chapter for series: ${seriesId}`);

    const { data, error } = await supabase
      .from("chapters")
      .insert({
        series_id: seriesId,
        chapter_number: chapterNumber,
        title: title || null,
        created_by: userId,
      })
      .select()
      .single();

    if (error) {
      console.error("❌ Error creating chapter:", error);
      return null;
    }

    console.log(`✅ Successfully created chapter: ${data.id}`);
    return { id: data.id };
  } catch (error) {
    console.error("❌ Unexpected error creating chapter:", error);
    return null;
  }
}
