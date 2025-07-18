-- Migration to implement strict series access permissions
-- By default, no series are accessible unless user is admin or has explicit permission

-- Update the can_access_series function to remove open access
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

-- Update the get_accessible_series function to implement strict permissions
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

-- Update the series RLS policy to use the strict can_access_series function
DROP POLICY IF EXISTS "Users can view accessible series" ON series;
CREATE POLICY "Users can view accessible series" ON series
  FOR SELECT USING (can_access_series(auth.uid(), id));

-- Update the series_permissions RLS policy to use the strict can_access_series function
DROP POLICY IF EXISTS "Users can view permissions for series they can access" ON series_permissions;
CREATE POLICY "Users can view permissions for series they can access" ON series_permissions
  FOR SELECT USING (
    is_admin(auth.uid()) OR 
    can_access_series(auth.uid(), series_id)
  ); 