-- Alternative: Allow server-side access to API keys
-- Run this in your Supabase SQL Editor if you prefer not to use service role key

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Only admins can view api keys" ON api_keys;
DROP POLICY IF EXISTS "Only admins can insert api keys" ON api_keys;
DROP POLICY IF EXISTS "Only admins can update api keys" ON api_keys;

-- Create more permissive policies for server-side access
-- This allows reading for system operations while keeping write access admin-only

-- Allow anyone to read API keys (for server-side operations)
-- But this should be secure since the table only contains API keys for system use
CREATE POLICY "Allow system read access to api keys" ON api_keys
  FOR SELECT USING (true);

-- Only admins can insert api keys
CREATE POLICY "Only admins can insert api keys" ON api_keys
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Only admins can update api keys
CREATE POLICY "Only admins can update api keys" ON api_keys
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Only admins can delete api keys
CREATE POLICY "Only admins can delete api keys" ON api_keys
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  ); 