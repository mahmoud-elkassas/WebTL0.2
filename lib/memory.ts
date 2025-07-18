import supabase from "./supabase";
import { Chapter, MemoryEntry } from "@/types";
import {
  storyContextMemoryAssistant,
  chapterSummaryGenerator,
} from "./assistants";

const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent";

/**
 * Generate a memory summary for a chapter based on new translation content
 * @param translationText The translated text to summarize
 * @param existingSummary Optional existing summary to update
 * @returns Generated memory summary
 */
export async function generateMemorySummary(
  translationText: string,
  existingSummary?: string | null
): Promise<string> {
  console.log("🧠 Generating memory summary");

  try {
    // Use the Chapter Summary Generator assistant
    const summary = await chapterSummaryGenerator(translationText);

    console.log("🧠 Generated memory summary:", summary);
    return summary;
  } catch (error) {
    console.error("❌ Error generating memory summary:", error);
    return existingSummary || "Summary generation failed.";
  }
}

/**
 * Update a chapter's memory summary after a new translation
 * @param seriesId The series ID
 * @param chapterNumber The chapter number
 * @param translationText The new translated text
 * @returns Success status
 */
export async function updateChapterMemorySummary(
  seriesId: string,
  chapterNumber: string,
  translationText: string
): Promise<boolean> {
  try {
    console.log(`🔄 Updating memory summary for chapter ${chapterNumber}`);

    // Find the chapter
    const { data: chapterData, error: chapterError } = await supabase
      .from("chapters")
      .select("*")
      .eq("series_id", seriesId)
      .eq("chapter_number", chapterNumber)
      .single();

    if (chapterError || !chapterData) {
      console.error("❌ Error finding chapter:", chapterError);
      return false;
    }

    const chapter = chapterData as unknown as Chapter & {
      memory_summary: string | null; 
    };

    // Generate the updated summary
    const updatedSummary = await generateMemorySummary(
      translationText,
      chapter.memory_summary
    );

    // Update the chapter with the new summary
    const { error: updateError } = await supabase
      .from("chapters")
      .update({ memory_summary: updatedSummary })
      .eq("id", chapter.id);

    if (updateError) {
      console.error("❌ Error updating chapter memory summary:", updateError);
      return false;
    }

    // Also create a richer memory entry using Story Context Memory Assistant
    await createEnhancedMemoryEntry(
      seriesId,
      chapter.id,
      translationText,
      chapter.memory_summary
    );

    console.log(
      "✅ Chapter memory summary and memory entries updated successfully"
    );
    return true;
  } catch (error) {
    console.error("❌ Error in updateChapterMemorySummary:", error);
    return false;
  }
}

/**
 * Create a more detailed memory entry with tags and key events
 */
async function createEnhancedMemoryEntry(
  seriesId: string,
  chapterId: string,
  translationText: string,
  existingSummary: string | null
): Promise<boolean> {
  try {
    console.log("🧠 Creating enhanced memory entry");

    // Use the Story Context Memory Assistant to get rich memory data
    const memoryData = await storyContextMemoryAssistant(
      translationText,
      existingSummary
    );

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Insert the enhanced memory entry with explicit user ID
    const { error } = await supabase.from("memory_entries").insert({
      series_id: seriesId,
      chapter_id: chapterId,
      content: memoryData.summary,
      tags: memoryData.tags,
      key_events: memoryData.keyEvents,
      created_by: user?.id, // Explicitly set the user ID
    });

    if (error) {
      console.error("❌ Error creating enhanced memory entry:", error);
      return false;
    }

    console.log("✅ Enhanced memory entry created successfully");
    return true;
  } catch (error) {
    console.error("❌ Error in createEnhancedMemoryEntry:", error);
    return false;
  }
}

/**
 * Fetch memory entries for a series
 */
export async function fetchMemoryEntries(
  seriesId: string
): Promise<MemoryEntry[]> {
  try {
    console.log("🧠 Fetching memory entries for series:", seriesId);

    const { data, error } = await supabase
      .from("memory_entries")
      .select("*")
      .eq("series_id", seriesId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("❌ Error fetching memory entries:", error);
      return [];
    }

    console.log(`✅ Fetched ${data.length} memory entries`);
    return data as MemoryEntry[];
  } catch (error) {
    console.error("❌ Error in fetchMemoryEntries:", error);
    return [];
  }
}
