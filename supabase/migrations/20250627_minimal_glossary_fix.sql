-- Minimal migration to fix glossary function issues
-- This only addresses the function parameter naming issue

-- First, completely drop all existing glossary functions
DROP FUNCTION IF EXISTS public.update_series_glossary_json() CASCADE;
DROP FUNCTION IF EXISTS public.update_series_glossary_json(UUID) CASCADE;

-- Create the function with series_id parameter (exact name is important)
CREATE OR REPLACE FUNCTION public.update_series_glossary_json(series_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- Update the series record with glossary JSON
    UPDATE public.series
    SET glossary_json = (
        SELECT jsonb_object_agg(
            source_term,
            jsonb_build_object(
                'translation', translated_term,
                'gender', gender,
                'role', role,
                'alias', alias
            )
        )
        FROM public.glossaries
        WHERE public.glossaries.series_id = update_series_glossary_json.series_id
    )
    WHERE id = series_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the parameterless function for triggers
CREATE OR REPLACE FUNCTION public.update_series_glossary_json()
RETURNS TRIGGER AS $$
BEGIN
    -- Call the main function with the appropriate series_id
    PERFORM public.update_series_glossary_json(COALESCE(NEW.series_id, OLD.series_id));
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Recreate triggers
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