-- Add memory_summary column to chapters table
ALTER TABLE public.chapters ADD COLUMN IF NOT EXISTS memory_summary TEXT;

-- Function to generate and update chapter memory summary
CREATE OR REPLACE FUNCTION update_chapter_memory_summary() 
RETURNS TRIGGER AS $$
DECLARE
  chapter_id UUID;
  ai_prompt TEXT;
  ai_response TEXT;
  current_summary TEXT;
BEGIN
  -- Only process if it's an INSERT operation
  IF TG_OP = 'INSERT' THEN
    -- Find the chapter ID for the given series_id and chapter number
    SELECT id, memory_summary 
    INTO chapter_id, current_summary
    FROM public.chapters 
    WHERE series_id = NEW.series_id AND chapter_number = NEW.chapter;
    
    -- If chapter found, generate the summary update
    IF chapter_id IS NOT NULL THEN
      -- Build AI prompt for updating memory summary
      ai_prompt := 'Based on the following translation, provide a concise update to the chapter summary. Focus on key events, character developments, and plot advancements. Limit to 2-3 sentences maximum.';
      
      IF current_summary IS NOT NULL AND current_summary != '' THEN
        ai_prompt := ai_prompt || ' Current summary: ' || current_summary;
      END IF;
      
      ai_prompt := ai_prompt || ' Translation text: ' || NEW.translated_text;
      
      -- Call the Gemini API via pg_net extension (make sure pg_net is installed)
      -- For this implementation, we'll add a placeholder to manually update this later
      -- In a production environment, you would use pg_net or another method to make API calls from a trigger
      
      -- For now, extract a simple summary from the translated text
      -- This is a simplified approach; in production, use the AI API
      IF length(NEW.translated_text) > 500 THEN
        ai_response := substring(NEW.translated_text from 1 for 300) || '...';
      ELSE
        ai_response := NEW.translated_text;
      END IF;
      
      -- Create or update the memory summary
      IF current_summary IS NULL OR current_summary = '' THEN
        -- New summary if none exists
        UPDATE public.chapters
        SET memory_summary = 'Chapter begins: ' || ai_response
        WHERE id = chapter_id;
      ELSE
        -- Append to existing summary
        UPDATE public.chapters
        SET memory_summary = current_summary || ' Recent events: ' || ai_response
        WHERE id = chapter_id;
      END IF;
    END IF;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update memory summary when a translation is added
DROP TRIGGER IF EXISTS update_memory_summary_on_translation ON public.translations;
CREATE TRIGGER update_memory_summary_on_translation
  AFTER INSERT ON public.translations
  FOR EACH ROW
  EXECUTE FUNCTION update_chapter_memory_summary(); 