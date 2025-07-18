export interface Database {
  public: {
    Tables: {
      chapters: {
        Row: {
          id: string;
          series_id: string;
          chapter_number: string;
          title: string | null;
          summary: string | null;
          memory_summary: string | null;
          created_by: string | null;
          extracted_text: string | null;
          translated_text: string | null;
          translated_history: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          series_id: string;
          chapter_number: string;
          title?: string | null;
          summary?: string | null;
          memory_summary?: string | null;
          created_by?: string | null;
          extracted_text?: string | null;
          translated_text?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          series_id?: string;
          chapter_number?: string;
          title?: string | null;
          summary?: string | null;
          memory_summary?: string | null;
          created_by?: string | null;
          extracted_text?: string | null;
          translated_text?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      translation_history: {
        Row: {
          id: string;
          series_id: string;
          chapter: string | null;
          source_text: string;
          translated_text: string;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          series_id: string;
          chapter?: string | null;
          source_text: string;
          translated_text: string;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          series_id?: string;
          chapter?: string | null;
          source_text?: string;
          translated_text?: string;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      // ... other tables ...
    };
    // ... other schema definitions ...
  };
}
