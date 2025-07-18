-- User access control schema for series
-- This extends the existing schema to support user permissions

-- Create user_roles table to define user roles
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Create series_permissions to control who can access what series
CREATE TABLE IF NOT EXISTS series_permissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  series_id UUID NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission_type VARCHAR(50) NOT NULL DEFAULT 'read', -- 'read', 'write', 'admin'
  granted_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(series_id, user_id)
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role);
CREATE INDEX IF NOT EXISTS idx_series_permissions_series_id ON series_permissions(series_id);
CREATE INDEX IF NOT EXISTS idx_series_permissions_user_id ON series_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_series_permissions_permission_type ON series_permissions(permission_type);

-- Create a view to get user profiles with roles
CREATE OR REPLACE VIEW user_profiles_with_roles AS
SELECT 
  au.id,
  au.email,
  au.created_at,
  au.updated_at,
  COALESCE(ur.role, 'user') as role
FROM auth.users au
LEFT JOIN user_roles ur ON au.id = ur.user_id;

-- Create a view to get series with user permissions
CREATE OR REPLACE VIEW series_with_permissions AS
SELECT 
  s.*,
  sp.user_id,
  sp.permission_type,
  sp.granted_by,
  sp.created_at as permission_granted_at
FROM series s
LEFT JOIN series_permissions sp ON s.id = sp.series_id;

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin(user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = $1 AND role = 'admin'
  );
$$;

-- Function to check if user can access series
CREATE OR REPLACE FUNCTION can_access_series(user_id UUID, series_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
AS $$
  SELECT 
    -- Admin can access everything
    is_admin($1) OR
    -- User has explicit permission (STRICT: NO open access by default)
    EXISTS (
      SELECT 1 FROM series_permissions 
      WHERE series_permissions.user_id = $1 AND series_permissions.series_id = $2
    );
$$;

-- Function to get accessible series for a user - STRICT VERSION
CREATE OR REPLACE FUNCTION get_accessible_series(user_id UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  source_language TEXT,
  genre JSONB,
  tone_notes TEXT,
  glossary_json JSONB,
  chapter_count INTEGER,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  permission_type TEXT
)
LANGUAGE SQL
SECURITY DEFINER
AS $$
  SELECT DISTINCT
    s.id,
    s.name,
    s.description,
    s.source_language,
    CASE 
      WHEN s.genre IS NULL THEN NULL::JSONB
      ELSE to_jsonb(s.genre)
    END as genre,
    s.tone_notes,
    s.glossary_json,
    s.chapter_count,
    s.created_by,
    s.created_at,
    s.updated_at,
    COALESCE(sp.permission_type, 'read') as permission_type
  FROM series s
  LEFT JOIN series_permissions sp ON s.id = sp.series_id
  WHERE 
    -- Admin can see everything
    is_admin($1) OR
    -- User has explicit permission (STRICT: NO open access)
    sp.user_id = $1;
$$;

-- Row Level Security Policies

-- Enable RLS on tables
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE series_permissions ENABLE ROW LEVEL SECURITY;

-- User roles policies
CREATE POLICY "Users can view their own role" ON user_roles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles" ON user_roles
  FOR SELECT USING (is_admin(auth.uid()));

CREATE POLICY "Admins can insert roles" ON user_roles
  FOR INSERT WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can update roles" ON user_roles
  FOR UPDATE USING (is_admin(auth.uid()));

CREATE POLICY "Admins can delete roles" ON user_roles
  FOR DELETE USING (is_admin(auth.uid()));

-- Series permissions policies
CREATE POLICY "Users can view permissions for series they can access" ON series_permissions
  FOR SELECT USING (
    is_admin(auth.uid()) OR 
    can_access_series(auth.uid(), series_id)
  );

CREATE POLICY "Admins can insert permissions" ON series_permissions
  FOR INSERT WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can update permissions" ON series_permissions
  FOR UPDATE USING (is_admin(auth.uid()));

CREATE POLICY "Admins can delete permissions" ON series_permissions
  FOR DELETE USING (is_admin(auth.uid()));

-- Update series policies to respect permissions
DROP POLICY IF EXISTS "Users can view series" ON series;
CREATE POLICY "Users can view accessible series" ON series
  FOR SELECT USING (can_access_series(auth.uid(), id));

DROP POLICY IF EXISTS "Users can create series" ON series;
CREATE POLICY "Admins can create series" ON series
  FOR INSERT WITH CHECK (is_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can update series" ON series;
CREATE POLICY "Admins can update series" ON series
  FOR UPDATE USING (is_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can delete series" ON series;
CREATE POLICY "Admins can delete series" ON series
  FOR DELETE USING (is_admin(auth.uid()));

-- Insert default admin user (replace with your actual admin email)
-- IMPORTANT: Uncomment and replace with your email after running the schema
-- INSERT INTO user_roles (user_id, role) 
-- VALUES ((SELECT id FROM auth.users WHERE email = 'your-admin-email@example.com'), 'admin')
-- ON CONFLICT (user_id) DO UPDATE SET role = 'admin';

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Ensure series table structure matches TypeScript interface
-- If your series table doesn't exist yet, uncomment this:
/*
CREATE TABLE IF NOT EXISTS series (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  source_language TEXT NOT NULL,
  genre JSONB,
  tone_notes TEXT,
  memory_summary TEXT,
  glossary_json JSONB,
  chapter_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for series table
CREATE INDEX IF NOT EXISTS idx_series_created_by ON series(created_by);
CREATE INDEX IF NOT EXISTS idx_series_source_language ON series(source_language);
CREATE INDEX IF NOT EXISTS idx_series_created_at ON series(created_at);
*/ 