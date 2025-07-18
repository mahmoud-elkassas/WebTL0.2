-- This migration populates memory_summary for existing chapters that have translations
-- This is a one-time migration to backfill data

-- Create a temporary function to aggregate translations for each chapter
CREATE OR REPLACE FUNCTION temp_aggregate_chapter_translations()
RETURNS VOID AS $$
DECLARE
  chapter_rec RECORD;
  translation_text TEXT;
BEGIN
  -- Loop through each chapter
  FOR chapter_rec IN 
    SELECT c.id, c.series_id, c.chapter_number
    FROM chapters c
    WHERE c.memory_summary IS NULL 
  LOOP
    -- Find the most recent translation for this chapter
    SELECT t.translated_text INTO translation_text
    FROM translations t
    WHERE t.series_id = chapter_rec.series_id
      AND t.chapter = chapter_rec.chapter_number
    ORDER BY t.created_at DESC
    LIMIT 1;
    
    -- If we found a translation, create a simple summary
    IF translation_text IS NOT NULL THEN
      -- Create a basic summary from the first 300 characters
      IF length(translation_text) > 300 THEN
        UPDATE chapters
        SET memory_summary = substring(translation_text from 1 for 300) || '...'
        WHERE id = chapter_rec.id;
      ELSE
        UPDATE chapters
        SET memory_summary = translation_text
        WHERE id = chapter_rec.id;
      END IF;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Run the function to populate memory summaries
SELECT temp_aggregate_chapter_translations();

-- Drop the temporary function
DROP FUNCTION temp_aggregate_chapter_translations();

-- Add comment to explain what this migration does
COMMENT ON COLUMN chapters.memory_summary IS 
  'Automatically generated summary of chapter events, updated with each translation';

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'Memory summary population complete';
END $$; 