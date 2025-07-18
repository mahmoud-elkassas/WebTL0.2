-- Fix chapter operations including delete and update with cascade behavior
-- This migration addresses issues with chapter management

-- Add ON DELETE CASCADE to the memory_entries table for chapter_id foreign key reference
-- First drop existing foreign key constraint
ALTER TABLE public.memory_entries 
  DROP CONSTRAINT IF EXISTS memory_entries_chapter_id_fkey;

-- Re-add the constraint with CASCADE options
ALTER TABLE public.memory_entries 
  ADD CONSTRAINT memory_entries_chapter_id_fkey 
  FOREIGN KEY (chapter_id) 
  REFERENCES public.chapters(id) 
  ON DELETE CASCADE;

-- Create or replace a function to properly handle chapter deletion
CREATE OR REPLACE FUNCTION handle_chapter_deletion() 
RETURNS TRIGGER AS $$
BEGIN
  -- Delete any translations associated with this chapter
  DELETE FROM public.translations 
  WHERE series_id = OLD.series_id AND chapter = OLD.chapter_number;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to handle pre-deletion cleanup
DROP TRIGGER IF EXISTS before_chapter_delete ON public.chapters;
CREATE TRIGGER before_chapter_delete
  BEFORE DELETE ON public.chapters
  FOR EACH ROW
  EXECUTE FUNCTION handle_chapter_deletion();

-- Create a function to handle chapter updates
CREATE OR REPLACE FUNCTION handle_chapter_update() 
RETURNS TRIGGER AS $$
BEGIN
  -- If chapter number changed, update related translations
  IF NEW.chapter_number <> OLD.chapter_number THEN
    UPDATE public.translations
    SET chapter = NEW.chapter_number
    WHERE series_id = NEW.series_id AND chapter = OLD.chapter_number;
  END IF;
  
  -- Always update the updated_at timestamp
  NEW.updated_at = now();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger for chapter updates
DROP TRIGGER IF EXISTS before_chapter_update ON public.chapters;
CREATE TRIGGER before_chapter_update
  BEFORE UPDATE ON public.chapters
  FOR EACH ROW
  EXECUTE FUNCTION handle_chapter_update();

-- Fix RLS policies for chapters table if needed
-- First drop any existing policies to avoid conflicts
DROP POLICY IF EXISTS "Allow authenticated users to update chapters" ON public.chapters;
DROP POLICY IF EXISTS "Allow authenticated users to delete chapters" ON public.chapters;

-- Allow authenticated users to update chapters
CREATE POLICY "Allow authenticated users to update chapters"
  ON public.chapters
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = created_by OR 
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'translator')
    )
  );

-- Allow authenticated users to delete chapters
CREATE POLICY "Allow authenticated users to delete chapters"
  ON public.chapters
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = created_by OR 
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'translator')
    )
  ); 