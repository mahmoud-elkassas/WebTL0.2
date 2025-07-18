import type { Database as DatabaseType } from "./database.types";
import { createClient } from "@supabase/supabase-js";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Tables = DatabaseType["public"]["Tables"];

export type Chapter = Tables["chapters"]["Row"];
export type TranslationHistory = Tables["translation_history"]["Row"];

export const supabase = createClient<DatabaseType>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          role: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          role?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          role?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey";
            columns: ["id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      series: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          source_language: string;
          genre: string[] | null;
          tone_notes: string | null;
          memory_summary: string | null;
          glossary_json: Json;
          chapter_count: number;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          source_language: string;
          genre?: string[] | null;
          tone_notes?: string | null;
          memory_summary?: string | null;
          glossary_json?: Json;
          chapter_count?: number;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          source_language?: string;
          genre?: string[] | null;
          tone_notes?: string | null;
          memory_summary?: string | null;
          glossary_json?: Json;
          chapter_count?: number;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "series_created_by_fkey";
            columns: ["created_by"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      chapters: {
        Row: {
          id: string;
          series_id: string;
          chapter_number: string;
          title: string | null;
          memory_summary: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          series_id: string;
          chapter_number: string;
          title?: string | null;
          memory_summary?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          series_id?: string;
          chapter_number?: string;
          title?: string | null;
          memory_summary?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "chapters_series_id_fkey";
            columns: ["series_id"];
            referencedRelation: "series";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "chapters_created_by_fkey";
            columns: ["created_by"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      glossaries: {
        Row: {
          id: string;
          series_id: string;
          source_term: string;
          translated_term: string;
          term_type: string | null;
          character_tone: string | null;
          notes: string | null;
          auto_translated: boolean;
          approved: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          series_id: string;
          source_term: string;
          translated_term: string;
          term_type?: string | null;
          character_tone?: string | null;
          notes?: string | null;
          auto_translated?: boolean;
          approved?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          series_id?: string;
          source_term?: string;
          translated_term?: string;
          term_type?: string | null;
          character_tone?: string | null;
          notes?: string | null;
          auto_translated?: boolean;
          approved?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "glossaries_series_id_fkey";
            columns: ["series_id"];
            referencedRelation: "series";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "glossaries_created_by_fkey";
            columns: ["created_by"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      access_requests: {
        Row: {
          id: string;
          user_id: string;
          status: string;
          reason: string | null;
          decided_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          status?: string;
          reason?: string | null;
          decided_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          status?: string;
          reason?: string | null;
          decided_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "access_requests_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "access_requests_decided_by_fkey";
            columns: ["decided_by"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      translations: {
        Row: {
          id: string;
          series_id: string;
          chapter: string | null;
          source_text: string;
          translated_text: string;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          series_id: string;
          chapter?: string | null;
          source_text: string;
          translated_text: string;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          series_id?: string;
          chapter?: string | null;
          source_text?: string;
          translated_text?: string;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "translations_series_id_fkey";
            columns: ["series_id"];
            referencedRelation: "series";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "translations_created_by_fkey";
            columns: ["created_by"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      memory_entries: {
        Row: {
          id: string;
          series_id: string;
          chapter_id: string;
          content: string;
          tags: string[];
          key_events: string[] | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          series_id: string;
          chapter_id?: string;
          content: string;
          tags: string[];
          key_events?: string[] | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          series_id?: string;
          chapter_id?: string;
          content?: string;
          tags?: string[];
          key_events?: string[] | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "memory_entries_series_id_fkey";
            columns: ["series_id"];
            referencedRelation: "series";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "memory_entries_chapter_id_fkey";
            columns: ["chapter_id"];
            referencedRelation: "chapters";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "memory_entries_created_by_fkey";
            columns: ["created_by"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: {};
    Functions: {
      create_admin_user: {
        Args: {
          email: string;
          password: string;
        };
        Returns: string;
      };
      update_series_glossary_json: {
        Args: {
          series_id: string;
        };
        Returns: boolean;
      };
    };
    Enums: {};
  };
}
