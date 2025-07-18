-- Fix memory entry generation to include more contextual information
-- This migration improves how memory entries are generated from translations

-- Drop the existing trigger first
DROP TRIGGER IF EXISTS generate_memory_entry_on_translation ON public.translations;

-- Update the function to generate better memory entries
CREATE OR REPLACE FUNCTION generate_memory_entry_from_translation() 
RETURNS TRIGGER AS $$
DECLARE
  chapter_id UUID;
  memory_content TEXT;
  chapter_info TEXT;
BEGIN
  -- Find the chapter ID for the given series_id and chapter number
  SELECT id INTO chapter_id
  FROM public.chapters 
  WHERE series_id = NEW.series_id AND chapter_number = NEW.chapter;
  
  -- If chapter found, create a memory entry with meaningful content
  IF chapter_id IS NOT NULL THEN
    -- Get chapter info for context
    SELECT COALESCE(title, 'Untitled Chapter') INTO chapter_info
    FROM public.chapters
    WHERE id = chapter_id;
    
    -- Create a more meaningful memory entry
    -- Extract actual content instead of just applying "Translated" prefix
    IF length(NEW.translated_text) > 1000 THEN
      -- For longer texts, include the beginning and a key section from middle
      memory_content := 
        'Chapter ' || NEW.chapter || ': ' || chapter_info || E'\n\n' ||
        'Beginning: ' || substring(NEW.translated_text from 1 for 200) || E'...\n\n' ||
        'Key section: ' || substring(NEW.translated_text from 500 for 300);
    ELSE
      -- For shorter texts, include the full translation
      memory_content := 
        'Chapter ' || NEW.chapter || ': ' || chapter_info || E'\n\n' ||
        NEW.translated_text;
    END IF;
    
    -- Create memory entry with improved content
    INSERT INTO public.memory_entries (
      series_id,
      chapter_id,
      content,
      tags,
      created_by
    ) VALUES (
      NEW.series_id,
      chapter_id,
      memory_content,
      ARRAY['auto-generated', 'chapter-' || NEW.chapter],
      NEW.created_by
    );
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger with the improved function
CREATE TRIGGER generate_memory_entry_on_translation
  AFTER INSERT ON public.translations
  FOR EACH ROW
  EXECUTE FUNCTION generate_memory_entry_from_translation();

-- Add a comment to explain the purpose of this migration
COMMENT ON FUNCTION generate_memory_entry_from_translation() IS 
  'Generates meaningful memory entries from translations with proper context'; 