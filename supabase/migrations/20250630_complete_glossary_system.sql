-- Complete Glossary System for Webtoon Translation Application
-- This migration creates or updates the complete glossary system
-- It ensures compatibility with the application code and fixes any parameter naming issues

-- Step 1: Ensure the glossaries table exists with all required fields
CREATE TABLE IF NOT EXISTS public.glossaries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    series_id UUID NOT NULL REFERENCES public.series(id) ON DELETE CASCADE,
    source_term TEXT NOT NULL,
    translated_term TEXT NOT NULL,
    gender TEXT,
    role TEXT,
    alias TEXT,
    term_type TEXT,
    entity_type TEXT,
    character_role TEXT,
    language TEXT,
    character_tone TEXT,
    notes TEXT,
    auto_suggested BOOLEAN DEFAULT false,
    approved BOOLEAN DEFAULT false,
    source_context TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id),
    UNIQUE(series_id, source_term)
);

-- Step 2: Add glossary_json column to series table
ALTER TABLE public.series
ADD COLUMN IF NOT EXISTS glossary_json JSONB DEFAULT '{}'::jsonb;

-- Step 3: Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Create trigger for updated_at
DROP TRIGGER IF EXISTS set_glossaries_updated_at ON public.glossaries;
CREATE TRIGGER set_glossaries_updated_at
    BEFORE UPDATE ON public.glossaries
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Step 5: Drop all existing glossary functions to avoid conflicts
DROP FUNCTION IF EXISTS public.update_series_glossary_json() CASCADE;
DROP FUNCTION IF EXISTS public.update_series_glossary_json(UUID) CASCADE;

-- Step 6: Create the function with series_id parameter (exact name is important)
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

-- Step 7: Create the parameterless function for triggers
CREATE FUNCTION public.update_series_glossary_json()
RETURNS TRIGGER AS $$
BEGIN
  -- Call the main function
  PERFORM public.update_series_glossary_json(COALESCE(NEW.series_id, OLD.series_id));
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Step 8: Create triggers for glossary changes
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

-- Step 9: Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_glossaries_series_id ON public.glossaries(series_id);
CREATE INDEX IF NOT EXISTS idx_glossaries_source_term ON public.glossaries(source_term);
CREATE INDEX IF NOT EXISTS idx_glossaries_translated_term ON public.glossaries(translated_term);
CREATE INDEX IF NOT EXISTS idx_glossaries_series_term ON public.glossaries(series_id, source_term);
CREATE INDEX IF NOT EXISTS idx_glossaries_term_type ON public.glossaries(term_type);

-- Step 10: Enable Row Level Security
ALTER TABLE public.glossaries ENABLE ROW LEVEL SECURITY;

-- Step 11: Create RLS policies
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

DROP POLICY IF EXISTS "Allow glossary delete for admins" ON public.glossaries;
CREATE POLICY "Allow glossary delete for admins" 
  ON public.glossaries FOR DELETE 
  USING (
    auth.uid() IN (
      SELECT id FROM public.profiles 
      WHERE role = 'admin'
    )
  );

-- Step 12: Create utility functions for glossary management

-- Function to search glossary terms
CREATE OR REPLACE FUNCTION public.search_glossary_terms(
  search_series_id UUID,
  search_term TEXT
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
    g.series_id = search_series_id
    AND (
      g.source_term ILIKE '%' || search_term || '%'
      OR g.translated_term ILIKE '%' || search_term || '%'
    )
  ORDER BY 
    g.source_term;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get glossary stats
CREATE OR REPLACE FUNCTION public.get_glossary_stats(stats_series_id UUID)
RETURNS TABLE (
  term_type TEXT,
  count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(g.term_type, 'Other') as term_type,
    COUNT(*) as count
  FROM 
    public.glossaries g
  WHERE 
    g.series_id = stats_series_id
  GROUP BY 
    COALESCE(g.term_type, 'Other')
  ORDER BY 
    count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to import glossary terms in bulk
CREATE OR REPLACE FUNCTION public.import_glossary_terms(
  import_series_id UUID,
  terms JSONB,
  user_id UUID
)
RETURNS TABLE (
  success BOOLEAN,
  imported_count INTEGER,
  failed_count INTEGER,
  message TEXT
) AS $$
DECLARE
  term_record JSONB;
  imported INTEGER := 0;
  failed INTEGER := 0;
  result_message TEXT := 'Import completed';
BEGIN
  -- Check if user has permission
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = user_id AND (role = 'admin' OR role = 'translator')
  ) THEN
    RETURN QUERY SELECT false, 0, 0, 'User does not have permission to import terms';
    RETURN;
  END IF;
  
  -- Process each term in the JSON array
  FOR term_record IN SELECT * FROM jsonb_array_elements(terms)
  LOOP
    BEGIN
      INSERT INTO public.glossaries (
        series_id,
        source_term,
        translated_term,
        gender,
        role,
        alias,
        term_type,
        entity_type,
        character_role,
        language,
        character_tone,
        notes,
        auto_suggested,
        approved,
        created_by,
        updated_by
      ) VALUES (
        import_series_id,
        term_record->>'source_term',
        term_record->>'translated_term',
        term_record->>'gender',
        term_record->>'role',
        term_record->>'alias',
        term_record->>'term_type',
        term_record->>'entity_type',
        term_record->>'character_role',
        term_record->>'language',
        term_record->>'character_tone',
        term_record->>'notes',
        COALESCE((term_record->>'auto_suggested')::BOOLEAN, false),
        COALESCE((term_record->>'approved')::BOOLEAN, false),
        user_id,
        user_id
      )
      ON CONFLICT (series_id, source_term) 
      DO UPDATE SET
        translated_term = EXCLUDED.translated_term,
        gender = EXCLUDED.gender,
        role = EXCLUDED.role,
        alias = EXCLUDED.alias,
        term_type = EXCLUDED.term_type,
        entity_type = EXCLUDED.entity_type,
        character_role = EXCLUDED.character_role,
        language = EXCLUDED.language,
        character_tone = EXCLUDED.character_tone,
        notes = EXCLUDED.notes,
        approved = EXCLUDED.approved,
        updated_by = user_id,
        updated_at = NOW();
        
      imported := imported + 1;
    EXCEPTION WHEN OTHERS THEN
      failed := failed + 1;
    END;
  END LOOP;
  
  -- Update the series glossary JSON
  PERFORM public.update_series_glossary_json(import_series_id);
  
  -- Return results
  IF failed > 0 THEN
    result_message := 'Import completed with some errors';
  END IF;
  
  RETURN QUERY SELECT 
    (failed = 0), 
    imported, 
    failed, 
    result_message;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 13: Update all existing series with the glossary data
DO $$
DECLARE
  series_rec RECORD;
BEGIN
  FOR series_rec IN SELECT id FROM public.series LOOP
    PERFORM public.update_series_glossary_json(series_rec.id);
  END LOOP;
END;
$$; 