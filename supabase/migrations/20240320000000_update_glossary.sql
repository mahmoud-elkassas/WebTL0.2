-- Update glossary table to include new fields
ALTER TABLE glossaries
ADD COLUMN IF NOT EXISTS gender text,
ADD COLUMN IF NOT EXISTS role text,
ADD COLUMN IF NOT EXISTS alias text;

-- Update chapters table to include summary
ALTER TABLE chapters
ADD COLUMN IF NOT EXISTS summary text;

-- Create index for faster glossary lookups
CREATE INDEX IF NOT EXISTS idx_glossaries_series_id ON glossaries(series_id);
CREATE INDEX IF NOT EXISTS idx_chapters_series_id ON chapters(series_id); 