-- Add JSON glossary column to series table
ALTER TABLE public.series
ADD COLUMN IF NOT EXISTS glossary_json JSONB DEFAULT '{}'::jsonb;

-- Create chapter table for series
CREATE TABLE IF NOT EXISTS public.chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id UUID REFERENCES public.series(id) ON DELETE CASCADE,
  chapter_number VARCHAR(20) NOT NULL,
  title TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS chapters_series_id_idx ON public.chapters(series_id);
CREATE INDEX IF NOT EXISTS glossaries_series_id_idx ON public.glossaries(series_id);

-- Enable RLS on new table
ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for chapters
CREATE POLICY "Chapters are viewable by authenticated users" 
  ON public.chapters FOR SELECT 
  USING (auth.role() = 'authenticated');

CREATE POLICY "Chapters can be inserted by approved users" 
  ON public.chapters FOR INSERT 
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM public.profiles 
      WHERE role = 'admin' 
      OR role = 'translator'
    )
  );

CREATE POLICY "Chapters can be updated by creator or admin" 
  ON public.chapters FOR UPDATE 
  USING (
    auth.uid() = created_by 
    OR auth.uid() IN (
      SELECT id FROM public.profiles 
      WHERE role = 'admin'
    )
  );

-- Create function to update glossary_json when glossaries are modified
CREATE OR REPLACE FUNCTION update_series_glossary_json() 
RETURNS TRIGGER AS $$
DECLARE
  glossary_data JSONB;
BEGIN
  -- Build JSON object from glossary terms
  SELECT jsonb_object_agg(source_term, translated_term)
  INTO glossary_data
  FROM public.glossaries
  WHERE series_id = COALESCE(NEW.series_id, OLD.series_id);
  
  -- If no glossary terms, use empty object
  IF glossary_data IS NULL THEN
    glossary_data := '{}'::jsonb;
  END IF;
  
  -- Update the series record
  UPDATE public.series
  SET glossary_json = glossary_data
  WHERE id = COALESCE(NEW.series_id, OLD.series_id);
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to update glossary_json when glossaries change
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

-- Add column for chapter to translations table if not exists
ALTER TABLE public.translations
ALTER COLUMN chapter SET NOT NULL; 