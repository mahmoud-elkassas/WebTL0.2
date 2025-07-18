-- Update existing memory entries with better content
-- This migration fixes existing memory entries to have more meaningful content

-- Create a function to update existing memory entries
CREATE OR REPLACE FUNCTION update_existing_memory_entries() 
RETURNS void AS $$
DECLARE
  memory_rec RECORD;
  translation_rec RECORD;
  chapter_info TEXT;
  new_content TEXT;
BEGIN
  -- Loop through each memory entry
  FOR memory_rec IN SELECT * FROM public.memory_entries WHERE tags @> ARRAY['auto-generated']
  LOOP
    -- Find the related translation for this memory entry
    SELECT t.* INTO translation_rec
    FROM public.translations t
    JOIN public.chapters c ON t.series_id = c.series_id AND t.chapter = c.chapter_number
    WHERE c.id = memory_rec.chapter_id
    ORDER BY t.created_at DESC
    LIMIT 1;
    
    -- Only proceed if we found a translation
    IF translation_rec.id IS NOT NULL THEN
      -- Get chapter info
      SELECT COALESCE(title, 'Untitled Chapter') INTO chapter_info
      FROM public.chapters
      WHERE id = memory_rec.chapter_id;
      
      -- Create better content
      IF length(translation_rec.translated_text) > 1000 THEN
        -- For longer texts
        new_content := 
          'Chapter ' || translation_rec.chapter || ': ' || chapter_info || E'\n\n' ||
          'Beginning: ' || substring(translation_rec.translated_text from 1 for 200) || E'...\n\n' ||
          'Key section: ' || substring(translation_rec.translated_text from 500 for 300);
      ELSE
        -- For shorter texts
        new_content := 
          'Chapter ' || translation_rec.chapter || ': ' || chapter_info || E'\n\n' ||
          translation_rec.translated_text;
      END IF;
      
      -- Update the memory entry
      UPDATE public.memory_entries
      SET 
        content = new_content,
        tags = array_append(memory_rec.tags, 'updated-content'),
        updated_at = now()
      WHERE id = memory_rec.id;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Execute the function to update existing memory entries
SELECT update_existing_memory_entries();

-- Drop the function after we're done with it
DROP FUNCTION update_existing_memory_entries(); 