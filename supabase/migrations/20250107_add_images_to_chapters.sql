-- Add images field to chapters table to store Google Drive image information
-- This will store an array of image objects with id, name, and download URL

ALTER TABLE public.chapters 
ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb;

-- Add index for better performance when querying images
CREATE INDEX IF NOT EXISTS idx_chapters_images ON public.chapters USING GIN (images);

-- Update the chapters table to include any missing constraints
ALTER TABLE public.chapters 
ADD COLUMN IF NOT EXISTS drive_folder_id TEXT,
ADD COLUMN IF NOT EXISTS drive_folder_url TEXT;

-- Add indexes for drive folder fields
CREATE INDEX IF NOT EXISTS idx_chapters_drive_folder_id ON public.chapters(drive_folder_id); 