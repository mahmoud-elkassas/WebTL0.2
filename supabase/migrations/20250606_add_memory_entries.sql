-- Create memory_entries table for storing detailed memory entries with tags
CREATE TABLE public.memory_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id UUID NOT NULL REFERENCES public.series(id) ON DELETE CASCADE,
  chapter_id UUID REFERENCES public.chapters(id) ON DELETE CASCADE,
  content TEXT NOT NULL, 
  tags TEXT[] DEFAULT '{}',
  key_events TEXT[] DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add RLS policies
ALTER TABLE public.memory_entries ENABLE ROW LEVEL SECURITY;

-- Allow anyone to select memory entries
CREATE POLICY "Allow anyone to select memory entries" 
  ON public.memory_entries 
  FOR SELECT 
  USING (true);

-- Allow authenticated users to insert their own memory entries
CREATE POLICY "Allow authenticated users to insert their own memory entries"
  ON public.memory_entries
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- Allow users to update only their own memory entries or if they're admin
CREATE POLICY "Allow users to update only their own memory entries"
  ON public.memory_entries
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = created_by OR 
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Allow users to delete only their own memory entries or if they're admin  
CREATE POLICY "Allow users to delete only their own memory entries"
  ON public.memory_entries
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = created_by OR 
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Add function to handle memory entry creation after translations
CREATE OR REPLACE FUNCTION generate_memory_entry_from_translation() 
RETURNS TRIGGER AS $$
DECLARE
  chapter_id UUID;
  summary_text TEXT;
BEGIN
  -- Find the chapter ID for the given series_id and chapter number
  SELECT id INTO chapter_id
  FROM public.chapters 
  WHERE series_id = NEW.series_id AND chapter_number = NEW.chapter;
  
  -- If chapter found, create a simple memory entry
  IF chapter_id IS NOT NULL THEN
    -- Use the first 200 characters of translation as a simple memory
    IF length(NEW.translated_text) > 500 THEN
      summary_text := substring(NEW.translated_text from 1 for 200) || '...';
    ELSE
      summary_text := NEW.translated_text;
    END IF;
    
    -- Create memory entry with basic info
    INSERT INTO public.memory_entries (
      series_id,
      chapter_id,
      content,
      tags,
      created_by
    ) VALUES (
      NEW.series_id,
      chapter_id,
      summary_text,
      ARRAY['auto-generated'],
      NEW.created_by
    );
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to generate memory entry when a translation is added
DROP TRIGGER IF EXISTS generate_memory_entry_on_translation ON public.translations;
CREATE TRIGGER generate_memory_entry_on_translation
  AFTER INSERT ON public.translations
  FOR EACH ROW
  EXECUTE FUNCTION generate_memory_entry_from_translation();

-- Add description column to glossaries table
ALTER TABLE public.glossaries 
ADD COLUMN IF NOT EXISTS category TEXT;

-- Add column to glossaries for auto-suggested terms
ALTER TABLE public.glossaries 
ADD COLUMN IF NOT EXISTS auto_suggested BOOLEAN DEFAULT false; 