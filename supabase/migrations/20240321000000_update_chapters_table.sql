-- Add extracted_text and translated_text columns to chapters table
ALTER TABLE chapters
ADD COLUMN IF NOT EXISTS extracted_text TEXT,
ADD COLUMN IF NOT EXISTS translated_text TEXT;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_chapters_series_id ON chapters(series_id);
CREATE INDEX IF NOT EXISTS idx_chapters_chapter_number ON chapters(chapter_number); 