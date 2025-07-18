export type UserRole = "user" | "translator" | "admin";

export type AccessRequestStatus = "pending" | "approved" | "rejected";

export type PermissionType = "read" | "write" | "admin";

export interface UserWithRole {
  id: string;
  email: string;
  created_at: string;
  updated_at: string;
  role: UserRole;
}

export interface SeriesPermission {
  id: string;
  series_id: string;
  user_id: string;
  permission_type: PermissionType;
  granted_by: string;
  created_at: string;
  updated_at: string;
  user?: {
    id: string;
    email: string;
  };
}

export interface SeriesWithPermissions extends Series {
  permissions?: SeriesPermission[];
  user_permission?: PermissionType;
}

export type SourceLanguage = "Korean" | "Japanese" | "Chinese";

export type Genre =
  | "Shounen"
  | "Shoujo"
  | "Seinen"
  | "Josei"
  | "Action"
  | "Comedy"
  | "Drama"
  | "Fantasy"
  | "Horror"
  | "Mystery"
  | "Romance"
  | "Sci-Fi"
  | "Slice of Life"
  | "Sports"
  | "Supernatural"
  | "Thriller"
  | "Murim/Wuxia"
  | "Isekai"
  | "Cyberpunk"
  | "Other";

export type TermType =
  | "Character Name"
  | "Location"
  | "Technique"
  | "Skill"
  | "Organization"
  | "System Term"
  | "Sound Effect"
  | "Honorific - Korean"
  | "Honorific - Chinese"
  | "Honorific - Japanese"
  | "Family Relation"
  | "Formal Title"
  | "Cultural Term"
  | "Item"
  | "Skill/Technique"
  | "Other";

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface Series {
  id: string;
  name: string;
  description: string | null;
  source_language: SourceLanguage;
  genre: string[] | null;
  tone_notes: string | null;
  memory_summary: string | null;
  glossary_json: any;
  chapter_count: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Chapter {
  id: string;
  series_id: string;
  chapter_number: string;
  title: string | null;
  summary: string | null;
  memory_summary: string | null;
  created_by: string | null;
  extracted_text: string | null;
  translated_text: string | null;
  images?: DriveImage[];
  drive_folder_id?: string | null;
  drive_folder_url?: string | null;
  created_at: string;
  updated_at: string;
}

export interface MemoryEntry {
  id: string;
  series_id: string;
  chapter_id?: string;
  content: string;
  tags: string[];
  key_events?: string[];
  created_at: string;
  updated_at: string;
}

export interface GlossaryTerm {
  id: string;
  series_id: string;
  source_term: string;
  translated_term: string;
  gender?: string;
  role?: string;
  alias?: string;
  term_type?: TermType;
  character_tone?: string;
  notes?: string;
  auto_translated?: boolean;
  approved?: boolean;
  entity_type?: EntityType;
  language?: SourceLanguage;
  character_role?: CharacterRole;
  created_at: string;
  updated_at: string;
}

export interface AccessRequest {
  id: string;
  user_id: string;
  status: AccessRequestStatus;
  reason: string | null;
  decided_by: string | null;
  created_at: string;
  updated_at: string;
  user?: Profile;
}

export interface TranslationHistory {
  id: string;
  series_id: string;
  chapter: string | null;
  source_text: string;
  translated_text: string;
  created_by: string | null;
  created_at: string;
  series?: Series;
}

export interface TranslationInput {
  text: string;
  sourceLanguage: SourceLanguage;
  seriesId?: string;
  chapter?: string;
}

export interface GlossaryObject {
  [key: string]: {
    translation: string;
    gender?: string;
    role?: string;
    alias?: string;
  };
}

export type EntityType =
  | "Person"
  | "Place"
  | "Technique"
  | "Organization"
  | "Item"
  | "Term";

export type Gender = "Male" | "Female" | "Unknown";

export type CharacterRole =
  | "Protagonist"
  | "Antagonist"
  | "Supporting Character"
  | "Minor Character"
  | "Villain"
  | "Mentor"
  | "Family Member"
  | "Love Interest"
  | "Other";

export interface EnhancedGlossaryTerm {
  sourceTerm: string;
  translatedTerm: string;
  language?: SourceLanguage;
  entityType?: EntityType;
  gender?: Gender;
  role?: CharacterRole;
  suggestedCategory?: string;
}

export interface TranslationResult {
  text: string;
  rawResponse?: string;
  fullText?: string;
  glossary: Record<
    string,
    {
      translation: string;
      gender?: string;
      role?: string;
      alias?: string;
    }
  >;
  chapterMemory: string;
  qualityReport: QualityReport;
}

export type Role =
  | "Protagonist"
  | "Antagonist"
  | "Supporting"
  | "Minor"
  | "Mentor"
  | "Family"
  | "Other";

export interface QualityReport {
  issues: string[];
  suggestions: string[];
  culturalNotes: string[];
  glossarySuggestions: Array<{
    sourceTerm: string;
    translatedTerm: string;
    entityType?: EntityType;
    gender?: Gender;
    role?: Role;
    notes?: string;
  }>;
  chapterMemory: string;
  chapterSummary?: string;
}

export interface FormattingReport {
  tagConsistency: boolean;
  pageHeadersPresent: boolean;
  missingTags: string[];
}

export interface TaggingSuggestion {
  tag: string;
  original: string;
  suggested: string;
}

export interface GlossarySuggestion {
  sourceTerm: string;
  translatedTerm: string;
  entityType?: string;
  gender?: string;
  role?: string;
  notes?: string;
}

export interface ChapterMemoryData {
  summary: string;
}

export interface ChapterData {
  pages: PageData[];
  seriesId: string | null;
  chapterId: string | null;
  sourceLanguage: string;
}

export interface ChapterMemory {
  plotPoints: string[];
  characterDevelopments: string[];
  relationships: string[];
  worldBuilding: string[];
  foreshadowing: string[];
}

export interface EnhancedQualityReport {
  issues: string[];
  suggestions: string[];
  culturalNotes: string[];
  formattingReport?: FormattingReport;
  taggingSuggestions?: TaggingSuggestion[];
  readabilityScore?: number;
  glossarySuggestions?: GlossarySuggestion[];
  chapterMemory?: string;
}

export interface PageData {
  pageNumber: number;
  translatedText: string;
  extractedText: string;
  glossary: Record<string, string>;
  overview: string;
}

export interface ReviewWorkflowState {
  showSuggestionReview: boolean;
  showGlossaryReview: boolean;
  showPreview: boolean;
  approvedSuggestions: string[];
  rejectedSuggestions: string[];
  approvedGlossaryTerms: DatabaseGlossaryEntry[];
  finalTranslation: string;
}

export interface TranslationResultType {
  text: string;
  fullText: string;
  rawResponse: string;
  qualityReport: {
    issues: string[];
    suggestions: string[];
    culturalNotes: string[];
    glossarySuggestions: Array<{
      sourceTerm: string;
      translatedTerm: string;
      entityType?: EntityType;
      gender?: Gender;
      role?: Role;
      notes?: string;
    }>;
    chapterMemory: string;
    chapterSummary?: string;
  };
  glossary: Record<string, string>;
  chapterMemory: string;
}

export interface ExtendedTranslationResult
  extends Omit<TranslationResultType, "chapterMemory"> {
  formattingReport?: FormattingReport;
  readabilityScore?: number;
  chapterMemory?: string;
}

export interface DatabaseGlossaryEntry {
  id?: string;
  series_id?: string;
  source_term: string;
  translated_term: string;
  term_type?: string | null;
  gender?: string | null;
  role?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ApplyQualityRequest {
  originalText: string;
  approvedSuggestions: string[];
  rejectedSuggestions: string[];
  approvedGlossaryTerms: DatabaseGlossaryEntry[];
  customTranslation?: string;
  series?: Series | null;
  chapterData?: {
    seriesId: string | null;
    chapterId: string | null;
    sourceLanguage: string;
  };
}

export interface QualitySuggestion {
  sourceTerm: string;
  translatedTerm: string;
  entityType?: string;
  gender?: string;
  role?: string;
  notes?: string;
}

export interface DriveImage {
  id: string;
  name: string;
  mimeType: string;
  downloadUrl?: string;
}

export interface ApiKeysConfig {
  gemini_keys: string[];
  google_keys: string[];
}

export interface ApiKeysRecord {
  id: string;
  keys_json: ApiKeysConfig;
  updated_by?: string;
  created_at: string;
  updated_at: string;
}
