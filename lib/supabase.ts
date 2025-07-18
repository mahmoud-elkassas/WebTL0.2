import { createClient } from "@supabase/supabase-js";
import { Database } from "@/types/database.types";
import { Chapter, TranslationHistory } from "@/types/supabase";
import { DatabaseGlossaryEntry } from "@/types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

// Reusable Supabase functions for better code organization

export const supabaseHelpers = {
  // Chapter operations
  async getChapter(chapterId: string): Promise<Chapter | null> {
    try {
      const { data, error } = await supabase
        .from("chapters")
        .select(
          `
          id,
          series_id,
          chapter_number,
          title,
          summary,
          memory_summary,
          created_by,
          extracted_text,
          translated_text,
          created_at,
          updated_at
        `
        )
        .eq("id", chapterId)
        .single();

      if (error) throw error;
      return data as Chapter;
    } catch (error) {
      console.error("Error fetching chapter:", error);
      return null;
    }
  },

  async getChaptersBySeriesId(seriesId: string): Promise<Chapter[]> {
    try {
      const { data, error } = await supabase
        .from("chapters")
        .select("id, chapter_number, title")
        .eq("series_id", seriesId)
        .order("chapter_number");

      if (error) throw error;
      return data as Chapter[];
    } catch (error) {
      console.error("Error fetching chapters:", error);
      return [];
    }
  },

  async saveChapterData(
    chapterId: string,
    data: {
      extractedText?: string;
      translatedText?: string;
      memorySummary?: string;
      chapterMemory?: string;
    }
  ): Promise<boolean> {
    try {
      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      if (data.extractedText) updateData.extracted_text = data.extractedText;
      if (data.translatedText) updateData.translated_text = data.translatedText;

      // Handle memory summary - prefer chapterMemory over memorySummary
      if (data.chapterMemory) {
        updateData.memory_summary = data.chapterMemory;
        console.log(
          "💾 Saving chapterMemory to memory_summary:",
          data.chapterMemory.substring(0, 100) + "..."
        );
      } else if (data.memorySummary) {
        updateData.memory_summary = data.memorySummary;
        console.log(
          "💾 Saving memorySummary to memory_summary:",
          data.memorySummary.substring(0, 100) + "..."
        );
      }

      const { error } = await supabase
        .from("chapters")
        .update(updateData)
        .eq("id", chapterId);

      if (error) throw error;
      console.log("✅ Chapter data saved successfully");
      return true;
    } catch (error) {
      console.error("Error saving chapter data:", error);
      return false;
    }
  },

  // Translation history operations
  async saveTranslationHistory(data: {
    seriesId: string;
    chapterId: string;
    sourceText: string;
    translatedText: string;
    userId?: string;
  }): Promise<boolean> {
    try {
      const { error } = await supabase.from("translation_history").insert({
        series_id: data.seriesId,
        chapter: data.chapterId,
        source_text: data.sourceText,
        translated_text: data.translatedText,
        created_by: data.userId || null,
        created_at: new Date().toISOString(),
      });

      if (error) throw error;
      console.log("✅ Translation history saved successfully");
      return true;
    } catch (error) {
      console.error("Error saving translation history:", error);
      return false;
    }
  },

  async getTranslationHistory(
    chapterId: string
  ): Promise<TranslationHistory[]> {
    try {
      const { data, error } = await supabase
        .from("translation_history")
        .select(
          `
          *,
          series:series_id (
            name
          )
        `
        )
        .eq("chapter", chapterId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as TranslationHistory[];
    } catch (error) {
      console.error("Error loading translation history:", error);
      return [];
    }
  },

  // Glossary operations
  async getSeriesGlossary(seriesId: string): Promise<DatabaseGlossaryEntry[]> {
    try {
      const { data, error } = await supabase
        .from("glossaries")
        .select("*")
        .eq("series_id", seriesId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("Error loading glossary:", error);
      return [];
    }
  },

  async saveGlossaryTerms(
    seriesId: string,
    terms: DatabaseGlossaryEntry[]
  ): Promise<boolean> {
    if (terms.length === 0) return true;

    try {
      const glossaryPromises = terms
        .filter((entry) => entry.source_term && entry.translated_term)
        .map((entry) =>
          supabase
            .from("glossaries")
            .insert({
              series_id: seriesId,
              source_term: entry.source_term,
              translated_term: entry.translated_term,
              gender: entry.gender || null,
              role: entry.role || null,
              term_type: entry.term_type || null,
              notes: entry.notes || null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .select()
            .single()
        );

      await Promise.all(glossaryPromises);
      console.log(`✅ ${terms.length} glossary terms saved`);
      return true;
    } catch (error) {
      console.error("Error saving glossary terms:", error);
      return false;
    }
  },

  // Utility functions
  async getCurrentUser() {
    try {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();
      if (error) throw error;
      return user;
    } catch (error) {
      console.error("Error getting current user:", error);
      return null;
    }
  },

  // Broadcast functions for real-time updates
  async broadcastGlossaryUpdate() {
    try {
      await supabase.channel("custom-update-channel").send({
        type: "broadcast",
        event: "glossary-updated",
        payload: { timestamp: new Date().toISOString() },
      });
    } catch (error) {
      console.error("Error broadcasting glossary update:", error);
    }
  },
};

export default supabase;
