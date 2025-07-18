-- Add support for enhanced translation workflow using Gemini 1.5 Pro

-- Add a table to store translation system prompts
CREATE TABLE IF NOT EXISTS public.translation_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id UUID REFERENCES public.series(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  prompt_text TEXT NOT NULL,
  is_default BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add RLS policies to translation_prompts
ALTER TABLE public.translation_prompts ENABLE ROW LEVEL SECURITY;

-- Allow anyone to select translation prompts
CREATE POLICY "Allow anyone to select translation prompts" 
  ON public.translation_prompts 
  FOR SELECT 
  USING (true);

-- Allow authenticated users to insert their own translation prompts
CREATE POLICY "Allow authenticated users to insert translation prompts" 
  ON public.translation_prompts
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow users to update only their own translation prompts or if they're admin
CREATE POLICY "Allow users to update their own translation prompts" 
  ON public.translation_prompts
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = created_by OR 
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Add a table to store translation assists (AI suggestions)
CREATE TABLE IF NOT EXISTS public.translation_assists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id UUID REFERENCES public.series(id) ON DELETE CASCADE,
  chapter_id UUID REFERENCES public.chapters(id) ON DELETE CASCADE,
  query_text TEXT NOT NULL,
  response_text TEXT NOT NULL,
  query_type TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add RLS policies to translation_assists
ALTER TABLE public.translation_assists ENABLE ROW LEVEL SECURITY;

-- Allow selecting only assists for series the user has access to
CREATE POLICY "Allow selecting translation assists" 
  ON public.translation_assists 
  FOR SELECT 
  USING (true);

-- Allow authenticated users to insert their own translation assists
CREATE POLICY "Allow authenticated users to insert translation assists" 
  ON public.translation_assists
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Add a function to get suggested translation system prompt based on series attributes
CREATE OR REPLACE FUNCTION get_suggested_system_prompt(
  p_series_id UUID
) RETURNS TEXT AS $$
DECLARE
  v_series_genre TEXT[];
  v_series_language TEXT;
  v_base_prompt TEXT;
  v_genre_specific TEXT := '';
BEGIN
  -- Get series info
  SELECT 
    genre, 
    source_language 
  INTO 
    v_series_genre, 
    v_series_language
  FROM public.series
  WHERE id = p_series_id;
  
  -- Base prompt for any translation
  v_base_prompt := 'You are a professional translator. Translate the provided text from SOURCE_LANGUAGE to English, maintaining the original formatting and style.';
  
  -- Replace placeholder with actual language
  v_base_prompt := REPLACE(v_base_prompt, 'SOURCE_LANGUAGE', v_series_language);
  
  -- Add genre-specific guidance if available
  IF v_series_genre IS NOT NULL AND array_length(v_series_genre, 1) > 0 THEN
    -- This would be more sophisticated in a real implementation
    IF 'Action' = ANY(v_series_genre) THEN
      v_genre_specific := v_genre_specific || ' Use dynamic, powerful language for action scenes.';
    END IF;
    
    IF 'Romance' = ANY(v_series_genre) THEN
      v_genre_specific := v_genre_specific || ' Emphasize emotional nuances and relationships.';
    END IF;
    
    IF 'Comedy' = ANY(v_series_genre) THEN
      v_genre_specific := v_genre_specific || ' Preserve humor through appropriate cultural adaptation.';
    END IF;
  END IF;
  
  -- Combine base prompt with genre-specific guidance
  RETURN v_base_prompt || v_genre_specific;
END;
$$ LANGUAGE plpgsql; 