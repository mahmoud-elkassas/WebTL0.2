-- Migration: Add translated_text field to chapters table
-- Description: This adds the translated_text field to store chapter translations

-- Add translated_text column to chapters table
ALTER TABLE public.chapters ADD COLUMN IF NOT EXISTS translated_text TEXT;

-- Update RLS policies to allow translators to update this field
DROP POLICY IF EXISTS "Translators can update chapters they have permission for" ON public.chapters;
