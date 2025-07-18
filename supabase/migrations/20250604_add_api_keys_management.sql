-- Create API keys management table
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  key_type VARCHAR(50) NOT NULL CHECK (key_type IN ('GEMINI_API_KEY', 'GOOGLE_API_KEY')),
  api_key TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  usage_count INTEGER DEFAULT 0,
  daily_limit INTEGER DEFAULT 60000,
  last_used TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_api_keys_type ON api_keys(key_type);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(is_active);
CREATE INDEX IF NOT EXISTS idx_api_keys_type_active ON api_keys(key_type, is_active);

-- Enable RLS
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- Only admins can read/write API keys
CREATE POLICY "Only admins can view api keys" ON api_keys
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Only admins can insert api keys" ON api_keys
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Only admins can update api keys" ON api_keys
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Only admins can delete api keys" ON api_keys
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Create function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_api_keys_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER trigger_update_api_keys_updated_at
  BEFORE UPDATE ON api_keys
  FOR EACH ROW
  EXECUTE FUNCTION update_api_keys_updated_at();

-- Insert some example data (replace with your actual keys)
INSERT INTO api_keys (name, key_type, api_key, description, created_by) VALUES
  ('Primary Google Drive API Key', 'GOOGLE_API_KEY', 'your-google-api-key-here', 'Main Google Drive API key for accessing Drive files', NULL),
  ('Gemini API Key 1', 'GEMINI_API_KEY', 'your-gemini-api-key-1-here', 'Primary Gemini API key for OCR processing', NULL),
  ('Gemini API Key 2', 'GEMINI_API_KEY', 'your-gemini-api-key-2-here', 'Secondary Gemini API key for load balancing', NULL)
ON CONFLICT DO NOTHING; 