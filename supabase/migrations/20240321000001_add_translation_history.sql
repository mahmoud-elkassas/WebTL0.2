-- Create translation_history table
CREATE TABLE IF NOT EXISTS translation_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  series_id UUID NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  chapter UUID REFERENCES chapters(id) ON DELETE SET NULL,
  source_text TEXT NOT NULL,
  translated_text TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS translation_history_series_id_idx ON translation_history(series_id);
CREATE INDEX IF NOT EXISTS translation_history_chapter_idx ON translation_history(chapter);
CREATE INDEX IF NOT EXISTS translation_history_created_by_idx ON translation_history(created_by);
CREATE INDEX IF NOT EXISTS translation_history_created_at_idx ON translation_history(created_at);

-- Add RLS policies
ALTER TABLE translation_history ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own translations, translations for series they have access to, and series creators to view all translations
CREATE POLICY "Users can view translations"
  ON translation_history
  FOR SELECT
  USING (
    auth.uid() = created_by OR
    EXISTS (
      SELECT 1 FROM series_access
      WHERE series_id = translation_history.series_id
      AND user_id = auth.uid()
      AND status = 'approved'
    ) OR
    EXISTS (
      SELECT 1 FROM series
      WHERE id = translation_history.series_id
      AND created_by = auth.uid()
    )
  );

-- Allow users to insert their own translations if they have access to the series
CREATE POLICY "Users can insert translations"
  ON translation_history
  FOR INSERT
  WITH CHECK (
    auth.uid() = created_by AND
    (
      EXISTS (
        SELECT 1 FROM series_access
        WHERE series_id = translation_history.series_id
        AND user_id = auth.uid()
        AND status = 'approved'
      ) OR
      EXISTS (
        SELECT 1 FROM series
        WHERE id = translation_history.series_id
        AND created_by = auth.uid()
      )
    )
  );

-- Allow users to update their own translations
CREATE POLICY "Users can update their own translations"
  ON translation_history
  FOR UPDATE
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

-- Allow users to delete their own translations
CREATE POLICY "Users can delete their own translations"
  ON translation_history
  FOR DELETE
  USING (auth.uid() = created_by); 