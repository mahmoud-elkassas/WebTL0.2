-- Fix glossary_json generation to include all term metadata
DROP FUNCTION IF EXISTS update_series_glossary_json();

CREATE OR REPLACE FUNCTION update_series_glossary_json()
RETURNS TRIGGER AS $$
DECLARE
  glossary_data JSONB;
  enhanced_glossary_data JSONB;
BEGIN
  -- Build basic JSON object from glossary terms (for backward compatibility)
  SELECT jsonb_object_agg(source_term, translated_term)
  INTO glossary_data
  FROM public.glossaries
  WHERE series_id = COALESCE(NEW.series_id, OLD.series_id);
  
  -- If no glossary terms, use empty object
  IF glossary_data IS NULL THEN
    glossary_data := '{}'::jsonb;
  END IF;

  -- Build enhanced JSON object with all term metadata
  SELECT jsonb_object_agg(
    g.source_term,
    jsonb_build_object(
      'translated_term', g.translated_term,
      'term_type', g.term_type,
      'entity_type', g.entity_type,
      'gender', g.gender,
      'character_role', g.character_role,
      'language', g.language,
      'character_tone', g.character_tone,
      'notes', g.notes
    )
  )
  INTO enhanced_glossary_data
  FROM public.glossaries g
  WHERE g.series_id = COALESCE(NEW.series_id, OLD.series_id);
  
  -- If no enhanced glossary terms, use empty object
  IF enhanced_glossary_data IS NULL THEN
    enhanced_glossary_data := '{}'::jsonb;
  END IF;
  
  -- Update the series record with both simple and enhanced glossary data
  UPDATE public.series
  SET 
    glossary_json = glossary_data,
    enhanced_glossary_json = enhanced_glossary_data
  WHERE id = COALESCE(NEW.series_id, OLD.series_id);
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create a function that can be called directly via RPC
CREATE OR REPLACE FUNCTION update_series_glossary_json(series_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  glossary_data JSONB;
  enhanced_glossary_data JSONB;
BEGIN
  -- Build basic JSON object from glossary terms (for backward compatibility)
  SELECT jsonb_object_agg(source_term, translated_term)
  INTO glossary_data
  FROM public.glossaries
  WHERE series_id = $1;
  
  -- If no glossary terms, use empty object
  IF glossary_data IS NULL THEN
    glossary_data := '{}'::jsonb;
  END IF;

  -- Build enhanced JSON object with all term metadata
  SELECT jsonb_object_agg(
    g.source_term,
    jsonb_build_object(
      'translated_term', g.translated_term,
      'term_type', g.term_type,
      'entity_type', g.entity_type,
      'gender', g.gender,
      'character_role', g.character_role,
      'language', g.language,
      'character_tone', g.character_tone,
      'notes', g.notes
    )
  )
  INTO enhanced_glossary_data
  FROM public.glossaries g
  WHERE g.series_id = $1;
  
  -- If no enhanced glossary terms, use empty object
  IF enhanced_glossary_data IS NULL THEN
    enhanced_glossary_data := '{}'::jsonb;
  END IF;
  
  -- Update the series record with both simple and enhanced glossary data
  UPDATE public.series
  SET 
    glossary_json = glossary_data,
    enhanced_glossary_json = enhanced_glossary_data
  WHERE id = $1;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add enhanced_glossary_json column to series table
ALTER TABLE public.series
ADD COLUMN IF NOT EXISTS enhanced_glossary_json JSONB DEFAULT '{}'::jsonb;

-- Refresh triggers for glossary changes
DROP TRIGGER IF EXISTS update_glossary_json_on_insert ON public.glossaries;
DROP TRIGGER IF EXISTS update_glossary_json_on_update ON public.glossaries;
DROP TRIGGER IF EXISTS update_glossary_json_on_delete ON public.glossaries;

CREATE TRIGGER update_glossary_json_on_insert
  AFTER INSERT ON public.glossaries
  FOR EACH ROW
  EXECUTE FUNCTION update_series_glossary_json();

CREATE TRIGGER update_glossary_json_on_update
  AFTER UPDATE ON public.glossaries
  FOR EACH ROW
  EXECUTE FUNCTION update_series_glossary_json();

CREATE TRIGGER update_glossary_json_on_delete
  AFTER DELETE ON public.glossaries
  FOR EACH ROW
  EXECUTE FUNCTION update_series_glossary_json();

-- Update all existing series with the enhanced glossary data
DO $$
DECLARE
  series_rec RECORD;
BEGIN
  FOR series_rec IN SELECT id FROM public.series LOOP
    PERFORM update_series_glossary_json(series_rec.id);
  END LOOP;
END;
$$;

-- Add RLS policy for auto-suggested glossary terms
DROP POLICY IF EXISTS "Allow auto-suggested glossary terms" ON public.glossaries;
CREATE POLICY "Allow auto-suggested glossary terms" 
ON public.glossaries FOR INSERT 
WITH CHECK (
  auto_suggested = true AND
  auth.uid() IN (
    SELECT id FROM public.profiles 
    WHERE role = 'admin' 
    OR role = 'translator'
  )
);

-- Add RLS policy for updating auto-suggested terms
DROP POLICY IF EXISTS "Allow updating auto-suggested terms" ON public.glossaries;
CREATE POLICY "Allow updating auto-suggested terms" 
ON public.glossaries FOR UPDATE 
USING (
  auto_suggested = true AND
  auth.uid() IN (
    SELECT id FROM public.profiles 
    WHERE role = 'admin' 
    OR role = 'translator'
  )
); 