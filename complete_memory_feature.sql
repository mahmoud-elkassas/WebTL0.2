/*
  Complete SQL file for implementing Chapter Memory Summary Feature
  
  This script adds:
  1. A memory_summary column to the chapters table
  2. A trigger function to update memory summaries when translations are added
  3. A backfill function to populate memory for existing chapters
  
  Run this in your Supabase SQL editor to implement the full feature.
*/

-- Step 1: Add memory_summary column to chapters table if it doesn't exist
ALTER TABLE public.chapters ADD COLUMN IF NOT EXISTS memory_summary TEXT;

-- Step 2: Create function to update memory summaries when translations are added
CREATE OR REPLACE FUNCTION update_chapter_memory_summary() 
RETURNS TRIGGER AS $$
DECLARE
  chapter_id UUID;
  current_summary TEXT;
BEGIN
  -- Only process if it's an INSERT operation
  IF TG_OP = 'INSERT' THEN
    -- Find the chapter ID for the given series_id and chapter number
    SELECT id, memory_summary 
    INTO chapter_id, current_summary
    FROM public.chapters 
    WHERE series_id = NEW.series_id AND chapter_number = NEW.chapter;
    
    -- If chapter found, update the memory summary
    IF chapter_id IS NOT NULL THEN
      -- For simple database-only implementation without API call
      -- Create a basic summary from the translation
      IF current_summary IS NULL OR current_summary = '' THEN
        -- Create new summary (first 300 chars if text is long)
        IF length(NEW.translated_text) > 500 THEN
          UPDATE public.chapters
          SET memory_summary = substring(NEW.translated_text from 1 for 300) || '...'
          WHERE id = chapter_id;
        ELSE
          UPDATE public.chapters
          SET memory_summary = NEW.translated_text
          WHERE id = chapter_id;
        END IF;
      ELSE
        -- Append to existing summary (keeping it reasonable length)
        IF length(current_summary) > 500 THEN
          -- If summary is already long, replace with newer content
          UPDATE public.chapters
          SET memory_summary = substring(NEW.translated_text from 1 for 300) || '...'
          WHERE id = chapter_id;
        ELSE
          -- Otherwise append new content
          UPDATE public.chapters
          SET memory_summary = current_summary || ' | ' || 
                            substring(NEW.translated_text from 1 for 200) || '...'
          WHERE id = chapter_id;
        END IF;
      END IF;
    END IF;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Create trigger to update memory summary when a translation is added
DROP TRIGGER IF EXISTS update_memory_summary_on_translation ON public.translations;
CREATE TRIGGER update_memory_summary_on_translation
  AFTER INSERT ON public.translations
  FOR EACH ROW
  EXECUTE FUNCTION update_chapter_memory_summary();

-- Step 4: Populate memory summaries for existing chapters
-- This is a one-time function that runs and then is dropped
CREATE OR REPLACE FUNCTION populate_chapter_memory_summaries()
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
      -- Create a basic summary from the first part of the text
      IF length(translation_text) > 500 THEN
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
  
  RAISE NOTICE 'Memory summary population complete for % chapters', 
    (SELECT count(*) FROM chapters WHERE memory_summary IS NOT NULL);
END;
$$ LANGUAGE plpgsql;

-- Run the one-time population function
SELECT populate_chapter_memory_summaries();

-- Clean up the one-time function
DROP FUNCTION populate_chapter_memory_summaries();

-- Add documentation comment to the column
COMMENT ON COLUMN chapters.memory_summary IS 
  'Automatically generated summary of chapter events, updated with each translation';

-- Create a function that can be called from the application to manually update a memory summary
CREATE OR REPLACE FUNCTION manually_update_chapter_memory(
  p_chapter_id UUID,
  p_memory_summary TEXT
) RETURNS VOID AS $$
BEGIN
  UPDATE chapters
  SET memory_summary = p_memory_summary
  WHERE id = p_chapter_id;
END;
$$ LANGUAGE plpgsql;

-- Grant access to the function for authenticated users
GRANT EXECUTE ON FUNCTION manually_update_chapter_memory TO authenticated;

-- Add sample query to retrieve memory summary
/* Example usage:

-- Get memory summary for a specific chapter
SELECT c.chapter_number, c.title, c.memory_summary 
FROM chapters c
WHERE c.series_id = '00000000-0000-0000-0000-000000000000'
AND c.chapter_number = '1';

-- To manually update a memory summary from your application:
SELECT manually_update_chapter_memory(
  '00000000-0000-0000-0000-000000000000', -- chapter_id
  'This is a manually set memory summary.'
);

*/ 