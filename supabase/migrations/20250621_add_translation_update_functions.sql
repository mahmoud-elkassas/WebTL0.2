-- Add translation update functions for replacing or merging existing translations
-- This migration adds functions to handle translation updates with different strategies

-- Create a table to track translation versions
CREATE TABLE IF NOT EXISTS public.translation_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  translation_id UUID NOT NULL REFERENCES public.translations(id) ON DELETE CASCADE,
  source_text TEXT NOT NULL,
  translated_text TEXT NOT NULL,
  version_number INTEGER NOT NULL,
  is_current BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(translation_id, version_number)
);

-- Add RLS policies to translation_versions
ALTER TABLE public.translation_versions ENABLE ROW LEVEL SECURITY;

-- Allow anyone to select translation versions
CREATE POLICY "Allow anyone to select translation versions" 
  ON public.translation_versions 
  FOR SELECT 
  USING (true);

-- Allow authenticated users to insert translation versions
CREATE POLICY "Allow authenticated users to insert translation versions" 
  ON public.translation_versions
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Add a column to track merge strategy on translations
ALTER TABLE public.translations
ADD COLUMN IF NOT EXISTS merge_strategy TEXT DEFAULT 'replace';

-- Function to replace an existing translation
CREATE OR REPLACE FUNCTION replace_translation(
  p_translation_id UUID,
  p_new_source TEXT,
  p_new_translation TEXT,
  p_user_id UUID
) RETURNS UUID AS $$
DECLARE
  v_current_version INTEGER;
  v_translation_record public.translations%ROWTYPE;
  v_result UUID;
BEGIN
  -- Get the current translation
  SELECT * INTO v_translation_record
  FROM public.translations
  WHERE id = p_translation_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Translation with ID % not found', p_translation_id;
  END IF;
  
  -- Get the highest version number
  SELECT COALESCE(MAX(version_number), 0) INTO v_current_version
  FROM public.translation_versions
  WHERE translation_id = p_translation_id;
  
  -- Create a new version record for the old translation
  INSERT INTO public.translation_versions (
    translation_id,
    source_text,
    translated_text,
    version_number,
    is_current,
    created_by
  ) VALUES (
    p_translation_id,
    v_translation_record.source_text,
    v_translation_record.translated_text,
    v_current_version + 1,
    false,
    v_translation_record.created_by
  );
  
  -- Update the translation with new content
  UPDATE public.translations
  SET 
    source_text = p_new_source,
    translated_text = p_new_translation,
    updated_at = now()
  WHERE id = p_translation_id
  RETURNING id INTO v_result;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Function to merge an existing translation with new content
CREATE OR REPLACE FUNCTION merge_translation(
  p_translation_id UUID,
  p_new_source TEXT,
  p_new_translation TEXT,
  p_user_id UUID,
  p_merge_strategy TEXT DEFAULT 'append' -- 'append', 'prepend', or 'smart'
) RETURNS UUID AS $$
DECLARE
  v_current_version INTEGER;
  v_translation_record public.translations%ROWTYPE;
  v_merged_source TEXT;
  v_merged_translation TEXT;
  v_result UUID;
BEGIN
  -- Get the current translation
  SELECT * INTO v_translation_record
  FROM public.translations
  WHERE id = p_translation_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Translation with ID % not found', p_translation_id;
  END IF;
  
  -- Get the highest version number
  SELECT COALESCE(MAX(version_number), 0) INTO v_current_version
  FROM public.translation_versions
  WHERE translation_id = p_translation_id;
  
  -- Create a new version record for the old translation
  INSERT INTO public.translation_versions (
    translation_id,
    source_text,
    translated_text,
    version_number,
    is_current,
    created_by
  ) VALUES (
    p_translation_id,
    v_translation_record.source_text,
    v_translation_record.translated_text,
    v_current_version + 1,
    false,
    v_translation_record.created_by
  );
  
  -- Determine merge strategy
  CASE p_merge_strategy
    WHEN 'append' THEN
      v_merged_source := v_translation_record.source_text || E'\n\n' || p_new_source;
      v_merged_translation := v_translation_record.translated_text || E'\n\n' || p_new_translation;
    WHEN 'prepend' THEN
      v_merged_source := p_new_source || E'\n\n' || v_translation_record.source_text;
      v_merged_translation := p_new_translation || E'\n\n' || v_translation_record.translated_text;
    WHEN 'smart' THEN
      -- Smart merge attempts to intelligently combine content
      -- For simplicity, we're just appending with a separator
      v_merged_source := v_translation_record.source_text || E'\n\n--- UPDATED CONTENT ---\n\n' || p_new_source;
      v_merged_translation := v_translation_record.translated_text || E'\n\n--- UPDATED CONTENT ---\n\n' || p_new_translation;
    ELSE
      -- Default to append
      v_merged_source := v_translation_record.source_text || E'\n\n' || p_new_source;
      v_merged_translation := v_translation_record.translated_text || E'\n\n' || p_new_translation;
  END CASE;
  
  -- Update the translation with merged content
  UPDATE public.translations
  SET 
    source_text = v_merged_source,
    translated_text = v_merged_translation,
    merge_strategy = p_merge_strategy,
    updated_at = now()
  WHERE id = p_translation_id
  RETURNING id INTO v_result;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Function to get all versions of a translation
CREATE OR REPLACE FUNCTION get_translation_versions(
  p_translation_id UUID
) RETURNS TABLE (
  id UUID,
  version_number INTEGER,
  source_text TEXT,
  translated_text TEXT,
  is_current BOOLEAN,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  -- Get the current version
  RETURN QUERY
  SELECT
    t.id,
    0 AS version_number,
    t.source_text,
    t.translated_text,
    true AS is_current,
    t.created_by,
    t.created_at
  FROM
    public.translations t
  WHERE
    t.id = p_translation_id
  
  UNION ALL
  
  -- Get all previous versions
  SELECT
    tv.id,
    tv.version_number,
    tv.source_text,
    tv.translated_text,
    tv.is_current,
    tv.created_by,
    tv.created_at
  FROM
    public.translation_versions tv
  WHERE
    tv.translation_id = p_translation_id
  ORDER BY
    version_number DESC;
END;
$$ LANGUAGE plpgsql; 