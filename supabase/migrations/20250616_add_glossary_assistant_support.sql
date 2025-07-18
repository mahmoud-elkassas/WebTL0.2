-- Add support columns for enhanced glossary assistant functionality

-- Add approved_by column to glossaries table to track who approved suggested terms
ALTER TABLE public.glossaries 
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id);

-- Add approval_date column to glossaries table
ALTER TABLE public.glossaries 
ADD COLUMN IF NOT EXISTS approval_date TIMESTAMP WITH TIME ZONE;

-- Add source_context column to glossaries table to store context where term was found
ALTER TABLE public.glossaries 
ADD COLUMN IF NOT EXISTS source_context TEXT;

-- Ensure the auto_suggested column exists (safeguard in case previous migration didn't run)
ALTER TABLE public.glossaries 
ADD COLUMN IF NOT EXISTS auto_suggested BOOLEAN DEFAULT false;

-- Create a view that includes both manual and approved auto-suggested terms
CREATE OR REPLACE VIEW public.approved_glossary_terms AS
  SELECT * FROM public.glossaries
  WHERE approved = true OR (auto_suggested = true AND approved_by IS NOT NULL);

-- Create a view for pending auto-suggested terms
CREATE OR REPLACE VIEW public.pending_glossary_terms AS
  SELECT * FROM public.glossaries
  WHERE auto_suggested = true AND approved_by IS NULL;

-- Add function to approve auto-suggested terms
CREATE OR REPLACE FUNCTION approve_glossary_term(
  term_id UUID,
  user_id UUID
) RETURNS boolean AS $$
DECLARE
  success boolean;
BEGIN
  UPDATE public.glossaries
  SET 
    approved_by = user_id,
    approval_date = now(),
    approved = true
  WHERE id = term_id;
  
  GET DIAGNOSTICS success = ROW_COUNT;
  RETURN success > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add columns for enhanced glossary fields (language-specific honorifics)
ALTER TABLE public.glossaries
ADD COLUMN IF NOT EXISTS entity_type TEXT CHECK (entity_type IN ('Person', 'Place', 'Technique', 'Organization', 'Item', 'Term'));

ALTER TABLE public.glossaries
ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('Male', 'Female', 'Unknown'));

ALTER TABLE public.glossaries
ADD COLUMN IF NOT EXISTS character_role TEXT CHECK (character_role IN ('Protagonist', 'Antagonist', 'Supporting Character', 'Minor Character', 'Villain', 'Mentor', 'Family Member', 'Love Interest', 'Other'));

ALTER TABLE public.glossaries
ADD COLUMN IF NOT EXISTS language TEXT CHECK (language IN ('Korean', 'Japanese', 'Chinese'));

-- Create new migration to update term_type constraints to include new honorific types
ALTER TABLE public.glossaries
DROP CONSTRAINT IF EXISTS glossaries_term_type_check;

ALTER TABLE public.glossaries
ADD CONSTRAINT glossaries_term_type_check CHECK (
  term_type IN (
    'Character Name', 
    'Location', 
    'Technique', 
    'Skill', 
    'Organization', 
    'System Term', 
    'Sound Effect', 
    'Honorific - Korean',
    'Honorific - Chinese',
    'Honorific - Japanese',
    'Family Relation',
    'Formal Title',
    'Cultural Term',
    'Other'
  )
); 