-- Create series_access table
CREATE TABLE IF NOT EXISTS series_access (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  series_id UUID NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(series_id, user_id)
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS series_access_series_id_idx ON series_access(series_id);
CREATE INDEX IF NOT EXISTS series_access_user_id_idx ON series_access(user_id);
CREATE INDEX IF NOT EXISTS series_access_status_idx ON series_access(status);

-- Add RLS policies
ALTER TABLE series_access ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own access requests and series creators to view all requests
CREATE POLICY "Users can view their own access requests"
  ON series_access
  FOR SELECT
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM series
      WHERE id = series_access.series_id
      AND created_by = auth.uid()
    )
  );

-- Allow users to insert their own access requests
CREATE POLICY "Users can insert their own access requests"
  ON series_access
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Allow series creators to update access requests
CREATE POLICY "Series creators can update access requests"
  ON series_access
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM series
      WHERE id = series_access.series_id
      AND created_by = auth.uid()
    )
  );

-- Allow series creators to delete access requests
CREATE POLICY "Series creators can delete access requests"
  ON series_access
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM series
      WHERE id = series_access.series_id
      AND created_by = auth.uid()
    )
  ); 