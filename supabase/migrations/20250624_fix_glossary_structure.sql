-- Migration to fix glossary structure and ensure compatibility with application code
-- 
-- This migration addresses several issues:
-- 1. Ensures all required columns exist in the glossaries table
-- 2. Fixes the update_series_glossary_json function parameter naming issue
-- 3. Ensures proper triggers are in place for glossary updates
-- 4. Adds performance optimizations with indexes
-- 5. Provides backward compatibility for different parameter naming conventions
--
-- The key fix is ensuring the parameter name in update_series_glossary_json is 'series_id'
-- rather than 'p_series_id' to match application calls

-- First, ensure all required columns exist in the glossaries table
ALTER TABLE public.glossaries
ADD COLUMN IF NOT EXISTS gender TEXT,
ADD COLUMN IF NOT EXISTS role TEXT,
ADD COLUMN IF NOT EXISTS alias TEXT,
ADD COLUMN IF NOT EXISTS term_type TEXT,
ADD COLUMN IF NOT EXISTS entity_type TEXT,
ADD COLUMN IF NOT EXISTS character_role TEXT,
ADD COLUMN IF NOT EXISTS language TEXT,
ADD COLUMN IF NOT EXISTS character_tone TEXT,
ADD COLUMN IF NOT EXISTS auto_suggested BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS approved BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS source_context TEXT;

-- Add glossary_json column to series table if it doesn't exist
ALTER TABLE public.series
ADD COLUMN IF NOT EXISTS glossary_json JSONB DEFAULT '{}'::jsonb;

-- Fix the update_series_glossary_json function
-- First drop existing functions to avoid conflicts
DROP FUNCTION IF EXISTS public.update_series_glossary_json();
DROP FUNCTION IF EXISTS public.update_series_glossary_json(UUID);

-- Create the parameterless function for triggers
CREATE OR REPLACE FUNCTION public.update_series_glossary_json()
RETURNS TRIGGER AS $$
DECLARE
  enhanced_glossary_data JSONB;
BEGIN
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
  
  -- Update the series record with glossary data
  UPDATE public.series
  SET glossary_json = enhanced_glossary_data
  WHERE id = COALESCE(NEW.series_id, OLD.series_id);
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create the function with series_id parameter for direct calls
-- IMPORTANT: Parameter name must be 'series_id' to match application calls
CREATE OR REPLACE FUNCTION public.update_series_glossary_json(series_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  enhanced_glossary_data JSONB;
BEGIN
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
  WHERE g.series_id = series_id;
  
  -- If no enhanced glossary terms, use empty object
  IF enhanced_glossary_data IS NULL THEN
    enhanced_glossary_data := '{}'::jsonb;
  END IF;
  
  -- Update the series record with glossary data
  UPDATE public.series
  SET glossary_json = enhanced_glossary_data
  WHERE id = series_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create an alias function with p_series_id parameter for backward compatibility
CREATE OR REPLACE FUNCTION public.update_series_glossary_json_alt(p_series_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN public.update_series_glossary_json(p_series_id);
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

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_glossaries_source_term ON public.glossaries(source_term);
CREATE INDEX IF NOT EXISTS idx_glossaries_series_term ON public.glossaries(series_id, source_term);

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

-- Add RLS policies for glossary management
DROP POLICY IF EXISTS "Allow glossary read access" ON public.glossaries;
CREATE POLICY "Allow glossary read access" 
  ON public.glossaries FOR SELECT 
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow glossary insert for translators" ON public.glossaries;
CREATE POLICY "Allow glossary insert for translators" 
  ON public.glossaries FOR INSERT 
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM public.profiles 
      WHERE role = 'admin' 
      OR role = 'translator'
    )
  );

DROP POLICY IF EXISTS "Allow glossary update for translators" ON public.glossaries;
CREATE POLICY "Allow glossary update for translators" 
  ON public.glossaries FOR UPDATE 
  USING (
    auth.uid() IN (
      SELECT id FROM public.profiles 
      WHERE role = 'admin' 
      OR role = 'translator'
    )
  );

-- Add function to search glossary terms
CREATE OR REPLACE FUNCTION public.search_glossary_terms(
  p_series_id UUID,
  p_search_term TEXT
)
RETURNS TABLE (
  id UUID,
  series_id UUID,
  source_term TEXT,
  translated_term TEXT,
  gender TEXT,
  role TEXT,
  alias TEXT,
  term_type TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    g.id, 
    g.series_id, 
    g.source_term, 
    g.translated_term, 
    g.gender, 
    g.role, 
    g.alias, 
    g.term_type
  FROM 
    public.glossaries g
  WHERE 
    g.series_id = p_series_id
    AND (
      g.source_term ILIKE '%' || p_search_term || '%'
      OR g.translated_term ILIKE '%' || p_search_term || '%'
    )
  ORDER BY 
    g.source_term;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 