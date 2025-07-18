-- Migration: Add translated_text field to chapters table
-- Description: This adds the translated_text field to store chapter translations

-- Add translated_text column to chapters table
ALTER TABLE public.chapters ADD COLUMN IF NOT EXISTS translated_text TEXT;
