-- Migration to fix the function parameter name issue
-- Error: 42P13: cannot change name of input parameter "p_series_id"

-- Step 1: Drop the existing functions completely with CASCADE to remove dependencies
DROP FUNCTION IF EXISTS public.update_series_glossary_json() CASCADE;
DROP FUNCTION IF EXISTS public.update_series_glossary_json(UUID) CASCADE;

-- Step 2: Create a new function with the correct parameter name
CREATE FUNCTION public.update_series_glossary_json(series_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  glossary_data JSONB;
BEGIN
  -- Build JSON object from glossary terms
  SELECT jsonb_object_agg(
    source_term,
    jsonb_build_object(
      'translation', translated_term,
      'gender', gender,
      'role', role,
      'alias', alias
    )
  )
  INTO glossary_data
  FROM public.glossaries
  WHERE public.glossaries.series_id = update_series_glossary_json.series_id;
  
  -- If no glossary terms, use empty object
  IF glossary_data IS NULL THEN
    glossary_data := '{}'::jsonb;
  END IF;
  
  -- Update the series record
  UPDATE public.series
  SET glossary_json = glossary_data
  WHERE id = series_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Create the trigger function
CREATE FUNCTION public.update_series_glossary_json()
RETURNS TRIGGER AS $$
BEGIN
  -- Call the main function
  PERFORM public.update_series_glossary_json(COALESCE(NEW.series_id, OLD.series_id));
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Recreate the triggers
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