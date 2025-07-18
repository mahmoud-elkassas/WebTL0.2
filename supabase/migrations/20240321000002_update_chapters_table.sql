-- Add missing columns to chapters table
ALTER TABLE chapters
ADD COLUMN IF NOT EXISTS summary TEXT,
ADD COLUMN IF NOT EXISTS extracted_text TEXT,
ADD COLUMN IF NOT EXISTS translated_text TEXT;

-- Update existing rows to have default values
UPDATE chapters
SET summary = NULL,
    extracted_text = NULL,
    translated_text = NULL
WHERE summary IS NULL
   OR extracted_text IS NULL
   OR translated_text IS NULL; 