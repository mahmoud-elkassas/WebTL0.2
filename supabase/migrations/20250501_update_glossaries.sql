-- Update the glossaries table to ensure character_tone exists
ALTER TABLE public.glossaries
ADD COLUMN IF NOT EXISTS character_tone TEXT;

-- Add notes column if it doesn't exist
ALTER TABLE public.glossaries
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add term_type column if it doesn't exist 
ALTER TABLE public.glossaries
ADD COLUMN IF NOT EXISTS term_type TEXT;

-- Rename translated_term to match the code (in case it's still target_term from older migrations)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'glossaries' 
    AND column_name = 'target_term'
  ) THEN
    ALTER TABLE public.glossaries RENAME COLUMN target_term TO translated_term;
  END IF;
END $$;

-- Add notes column for series if it doesn't exist
ALTER TABLE public.series
ADD COLUMN IF NOT EXISTS tone_notes TEXT; 