-- Add support tables and functions for enhanced memory assistant functionality

-- Add importance_level column to memory_entries table
ALTER TABLE public.memory_entries 
ADD COLUMN IF NOT EXISTS importance_level INTEGER DEFAULT 1;

-- Add metadata column to memory_entries table for additional assistant-generated data
ALTER TABLE public.memory_entries 
ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Create a table to track relationships between memory entries
CREATE TABLE IF NOT EXISTS public.memory_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_entry_id UUID NOT NULL REFERENCES public.memory_entries(id) ON DELETE CASCADE,
  target_entry_id UUID NOT NULL REFERENCES public.memory_entries(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT unique_relationship UNIQUE (source_entry_id, target_entry_id, relationship_type)
);

-- Add RLS policies to memory_relationships
ALTER TABLE public.memory_relationships ENABLE ROW LEVEL SECURITY;

-- Allow anyone to select memory relationships
CREATE POLICY "Allow anyone to select memory relationships" 
  ON public.memory_relationships 
  FOR SELECT 
  USING (true);

-- Allow authenticated users to insert memory relationships
CREATE POLICY "Allow authenticated users to insert memory relationships" 
  ON public.memory_relationships
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow authenticated users to delete memory relationships
CREATE POLICY "Allow authenticated users to delete memory relationships" 
  ON public.memory_relationships
  FOR DELETE
  TO authenticated
  USING (true);

-- Create a function to retrieve related memory entries based on tags or relationships
CREATE OR REPLACE FUNCTION get_related_memory_entries(
  p_series_id UUID,
  p_tags TEXT[] DEFAULT NULL,
  p_limit INTEGER DEFAULT 10
) RETURNS SETOF public.memory_entries AS $$
BEGIN
  RETURN QUERY 
  SELECT DISTINCT me.*
  FROM public.memory_entries me
  LEFT JOIN public.memory_relationships mr ON me.id = mr.target_entry_id
  WHERE 
    me.series_id = p_series_id AND
    (
      -- Match tags if provided
      (p_tags IS NULL OR EXISTS (
        SELECT 1 FROM unnest(me.tags) tag
        WHERE tag = ANY(p_tags)
      )) OR
      -- Include entries that have relationships
      mr.source_entry_id IS NOT NULL
    )
  ORDER BY me.importance_level DESC, me.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql; 