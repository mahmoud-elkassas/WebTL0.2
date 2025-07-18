-- Fix the issue with update_series_glossary_json function not being found in schema cache
-- First, drop any existing functions with the same name to avoid conflicts
DROP FUNCTION IF EXISTS public.update_series_glossary_json();
DROP FUNCTION IF EXISTS public.update_series_glossary_json(UUID);

-- Create the parameterless function for triggers
CREATE OR REPLACE FUNCTION public.update_series_glossary_json()
RETURNS TRIGGER AS $$
DECLARE
  glossary_data JSONB;
  enhanced_glossary_data JSONB;
BEGIN
  -- Build basic JSON object from glossary terms (for backward compatibility)
  SELECT jsonb_object_agg(source_term, translated_term)
  INTO glossary_data
  FROM public.glossaries
  WHERE public.glossaries.series_id = COALESCE(NEW.series_id, OLD.series_id);
  
  -- If no glossary terms, use empty object
  IF glossary_data IS NULL THEN
    glossary_data := '{}'::jsonb;
  END IF;

  -- Build enhanced JSON object with all term metadata
  SELECT jsonb_object_agg(
    g.source_term,
    jsonb_build_object(
      'translation', g.translated_term,
      'gender', g.gender,
      'role', g.role,
      'alias', g.alias
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
    glossary_json = enhanced_glossary_data
  WHERE id = COALESCE(NEW.series_id, OLD.series_id);
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create the function with series_id parameter for direct calls
CREATE OR REPLACE FUNCTION public.update_series_glossary_json(p_series_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  glossary_data JSONB;
  enhanced_glossary_data JSONB;
BEGIN
  -- Build basic JSON object from glossary terms (for backward compatibility)
  SELECT jsonb_object_agg(source_term, translated_term)
  INTO glossary_data
  FROM public.glossaries
  WHERE public.glossaries.series_id = p_series_id;
  
  -- If no glossary terms, use empty object
  IF glossary_data IS NULL THEN
    glossary_data := '{}'::jsonb;
  END IF;

  -- Build enhanced JSON object with all term metadata
  SELECT jsonb_object_agg(
    g.source_term,
    jsonb_build_object(
      'translation', g.translated_term,
      'gender', g.gender,
      'role', g.role,
      'alias', g.alias
    )
  )
  INTO enhanced_glossary_data
  FROM public.glossaries g
  WHERE g.series_id = p_series_id;
  
  -- If no enhanced glossary terms, use empty object
  IF enhanced_glossary_data IS NULL THEN
    enhanced_glossary_data := '{}'::jsonb;
  END IF;
  
  -- Update the series record with both simple and enhanced glossary data
  UPDATE public.series
  SET 
    glossary_json = enhanced_glossary_data
  WHERE id = p_series_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Refresh triggers for glossary changes
DROP TRIGGER IF EXISTS update_glossary_json_on_insert ON public.glossaries;
DROP TRIGGER IF EXISTS update_glossary_json_on_update ON public.glossaries;
DROP TRIGGER IF EXISTS update_glossary_json_on_delete ON public.glossaries;

CREATE TRIGGER update_glossary_json_on_insert
  AFTER INSERT ON public.glossaries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_series_glossary_json();

CREATE TRIGGER update_glossary_json_on_update
  AFTER UPDATE ON public.glossaries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_series_glossary_json();

CREATE TRIGGER update_glossary_json_on_delete
  AFTER DELETE ON public.glossaries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_series_glossary_json();

-- Update all existing series with the enhanced glossary data
DO $$
DECLARE
  series_rec RECORD;
BEGIN
  FOR series_rec IN SELECT id FROM public.series LOOP
    PERFORM public.update_series_glossary_json(series_rec.id);
  END LOOP;
END;
$$; 