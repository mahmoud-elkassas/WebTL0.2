/*
  Complete Schema for Webtoon Translation Tool
  
  This migration can be used to reset and rebuild the entire database schema.
--   DROP TABLE IF EXISTS public.translations CASCADE;
-- DROP TABLE IF EXISTS public.chapters CASCADE;
-- DROP TABLE IF EXISTS public.glossaries CASCADE;
-- DROP TABLE IF EXISTS public.access_requests CASCADE;
-- DROP TABLE IF EXISTS public.series CASCADE;
-- DROP TABLE IF EXISTS public.profiles CASCADE;

*/


-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'translator', 'admin')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create series table
CREATE TABLE IF NOT EXISTS public.series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  source_language TEXT NOT NULL,
  genre TEXT[] DEFAULT '{}',
  tone_notes TEXT,
  glossary_json JSONB DEFAULT '{}'::jsonb,
  chapter_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create chapters table
CREATE TABLE IF NOT EXISTS public.chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id UUID REFERENCES public.series(id) ON DELETE CASCADE,
  chapter_number VARCHAR(20) NOT NULL,
  title TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create glossaries table
CREATE TABLE IF NOT EXISTS public.glossaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id UUID REFERENCES public.series(id) ON DELETE CASCADE,
  source_term TEXT NOT NULL,
  translated_term TEXT NOT NULL,
  term_type TEXT CHECK (term_type IN ('Character Name', 'Location', 'Technique', 'Skill', 'Organization', 'System Term', 'Sound Effect', 'Other')),
  character_tone TEXT,
  notes TEXT,
  auto_translated BOOLEAN DEFAULT FALSE,
  approved BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create access_requests table
CREATE TABLE IF NOT EXISTS public.access_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reason TEXT,
  decided_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create translations table
CREATE TABLE IF NOT EXISTS public.translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id UUID REFERENCES public.series(id) ON DELETE CASCADE,
  chapter TEXT NOT NULL,
  source_text TEXT NOT NULL,
  translated_text TEXT NOT NULL,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS chapters_series_id_idx ON public.chapters(series_id);
CREATE INDEX IF NOT EXISTS glossaries_series_id_idx ON public.glossaries(series_id);
CREATE INDEX IF NOT EXISTS translations_series_id_idx ON public.translations(series_id);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.series ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.glossaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.translations ENABLE ROW LEVEL SECURITY;

-- Profiles policies
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone" 
  ON public.profiles FOR SELECT 
  USING (true);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" 
  ON public.profiles FOR UPDATE 
  USING (auth.uid() = id);

-- Series policies
DROP POLICY IF EXISTS "Series are viewable by authenticated users" ON public.series;
CREATE POLICY "Series are viewable by authenticated users" 
  ON public.series FOR SELECT 
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Series can be inserted by approved users" ON public.series;
CREATE POLICY "Series can be inserted by approved users" 
  ON public.series FOR INSERT 
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM public.profiles 
      WHERE role = 'admin' 
      OR role = 'translator'
    )
  );

DROP POLICY IF EXISTS "Series can be updated by creator or admin" ON public.series;
CREATE POLICY "Series can be updated by creator or admin" 
  ON public.series FOR UPDATE 
  USING (
    auth.uid() = created_by 
    OR auth.uid() IN (
      SELECT id FROM public.profiles 
      WHERE role = 'admin'
    )
  );

-- Chapters policies
DROP POLICY IF EXISTS "Chapters are viewable by authenticated users" ON public.chapters;
CREATE POLICY "Chapters are viewable by authenticated users" 
  ON public.chapters FOR SELECT 
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Chapters can be inserted by approved users" ON public.chapters;
CREATE POLICY "Chapters can be inserted by approved users" 
  ON public.chapters FOR INSERT 
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM public.profiles 
      WHERE role = 'admin' 
      OR role = 'translator'
    )
  );

DROP POLICY IF EXISTS "Chapters can be updated by creator or admin" ON public.chapters;
CREATE POLICY "Chapters can be updated by creator or admin" 
  ON public.chapters FOR UPDATE 
  USING (
    auth.uid() = created_by 
    OR auth.uid() IN (
      SELECT id FROM public.profiles 
      WHERE role = 'admin'
    )
  );

-- Glossaries policies
DROP POLICY IF EXISTS "Glossaries are viewable by authenticated users" ON public.glossaries;
CREATE POLICY "Glossaries are viewable by authenticated users" 
  ON public.glossaries FOR SELECT 
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Glossaries can be inserted by approved users" ON public.glossaries;
CREATE POLICY "Glossaries can be inserted by approved users" 
  ON public.glossaries FOR INSERT 
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM public.profiles 
      WHERE role = 'admin' 
      OR role = 'translator'
    )
  );

DROP POLICY IF EXISTS "Glossaries can be updated by creator or admin" ON public.glossaries;
CREATE POLICY "Glossaries can be updated by creator or admin" 
  ON public.glossaries FOR UPDATE 
  USING (
    auth.uid() = created_by 
    OR auth.uid() IN (
      SELECT id FROM public.profiles 
      WHERE role = 'admin'
    )
  );

-- Access requests policies
DROP POLICY IF EXISTS "Users can view their own access requests" ON public.access_requests;
CREATE POLICY "Users can view their own access requests" 
  ON public.access_requests FOR SELECT 
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admin can view all access requests" ON public.access_requests;
CREATE POLICY "Admin can view all access requests" 
  ON public.access_requests FOR SELECT 
  USING (
    auth.uid() IN (
      SELECT id FROM public.profiles 
      WHERE role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Users can create their own access requests" ON public.access_requests;
CREATE POLICY "Users can create their own access requests" 
  ON public.access_requests FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admin can update access requests" ON public.access_requests;
CREATE POLICY "Admin can update access requests" 
  ON public.access_requests FOR UPDATE 
  USING (
    auth.uid() IN (
      SELECT id FROM public.profiles 
      WHERE role = 'admin'
    )
  );

-- Translations policies
DROP POLICY IF EXISTS "Translations are viewable by authenticated users" ON public.translations;
CREATE POLICY "Translations are viewable by authenticated users" 
  ON public.translations FOR SELECT 
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Translations can be inserted by approved users" ON public.translations;
CREATE POLICY "Translations can be inserted by approved users" 
  ON public.translations FOR INSERT 
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM public.profiles 
      WHERE role = 'admin' 
      OR role = 'translator'
    )
  );

-- Function to update glossary_json when glossaries change
CREATE OR REPLACE FUNCTION update_series_glossary_json() 
RETURNS TRIGGER AS $$
DECLARE
  glossary_data JSONB;
BEGIN
  -- Build JSON object from glossary terms
  SELECT jsonb_object_agg(source_term, translated_term)
  INTO glossary_data
  FROM public.glossaries
  WHERE series_id = COALESCE(NEW.series_id, OLD.series_id);
  
  -- If no glossary terms, use empty object
  IF glossary_data IS NULL THEN
    glossary_data := '{}'::jsonb;
  END IF;
  
  -- Update the series record
  UPDATE public.series
  SET glossary_json = glossary_data
  WHERE id = COALESCE(NEW.series_id, OLD.series_id);
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Triggers to update glossary_json when glossaries change
DROP TRIGGER IF EXISTS update_glossary_json_on_insert ON public.glossaries;
CREATE TRIGGER update_glossary_json_on_insert
  AFTER INSERT ON public.glossaries
  FOR EACH ROW
  EXECUTE FUNCTION update_series_glossary_json();

DROP TRIGGER IF EXISTS update_glossary_json_on_update ON public.glossaries;
CREATE TRIGGER update_glossary_json_on_update
  AFTER UPDATE ON public.glossaries
  FOR EACH ROW
  EXECUTE FUNCTION update_series_glossary_json();

DROP TRIGGER IF EXISTS update_glossary_json_on_delete ON public.glossaries;
CREATE TRIGGER update_glossary_json_on_delete
  AFTER DELETE ON public.glossaries
  FOR EACH ROW
  EXECUTE FUNCTION update_series_glossary_json();

-- Function to handle user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (NEW.id, NEW.email, 'user');
  
  RETURN NEW;
END;
$$;

-- Trigger to automatically create a user profile
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Function to handle access request approval
CREATE OR REPLACE FUNCTION public.handle_access_request_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- If the access request is being updated to 'approved'
  IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
    -- Update the user's role to translator
    UPDATE public.profiles
    SET role = 'translator'
    WHERE id = NEW.user_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger for access request approval
DROP TRIGGER IF EXISTS on_access_request_approved ON public.access_requests;
CREATE TRIGGER on_access_request_approved
  AFTER UPDATE ON public.access_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_access_request_approval();

-- Function to create admin user
CREATE OR REPLACE FUNCTION public.create_admin_user(email TEXT, password TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_id UUID;
BEGIN
  -- Create the user
  user_id := (SELECT id FROM auth.users WHERE auth.users.email = create_admin_user.email);
  
  IF user_id IS NULL THEN
    user_id := gen_random_uuid();
    
    -- Insert into auth.users
    INSERT INTO auth.users (id, email, email_confirmed_at, role)
    VALUES (user_id, email, now(), 'authenticated');
    
    -- Insert into auth.identities
    INSERT INTO auth.identities (id, provider_id, provider, user_id)
    VALUES (gen_random_uuid(), email, 'email', user_id);
    
    -- Set password (this requires the pgcrypto extension)
    -- Make sure encryption.enable_crypt is true in supabase dashboard
    UPDATE auth.users 
    SET encrypted_password = crypt(password, gen_salt('bf'))
    WHERE id = user_id;
  END IF;
  
  -- Ensure there is a profile and it's set to admin
  INSERT INTO public.profiles (id, email, role)
  VALUES (user_id, email, 'admin')
  ON CONFLICT (id) DO UPDATE SET role = 'admin';
  
  RETURN user_id;
END;
$$;

-- Create default admin user (comment out if not needed)
-- SELECT public.create_admin_user('admin@example.com', 'Admin123!'); 

-- Function to update chapter count when chapters change
CREATE OR REPLACE FUNCTION update_series_chapter_count() 
RETURNS TRIGGER AS $$
DECLARE
  count_value INTEGER;
BEGIN
  -- Count chapters for the series
  SELECT COUNT(*) 
  INTO count_value
  FROM public.chapters
  WHERE series_id = COALESCE(NEW.series_id, OLD.series_id);
  
  -- Update the series record
  UPDATE public.series
  SET chapter_count = count_value
  WHERE id = COALESCE(NEW.series_id, OLD.series_id);
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Triggers to update chapter_count when chapters change
DROP TRIGGER IF EXISTS update_chapter_count_on_insert ON public.chapters;
CREATE TRIGGER update_chapter_count_on_insert
  AFTER INSERT ON public.chapters
  FOR EACH ROW
  EXECUTE FUNCTION update_series_chapter_count();

DROP TRIGGER IF EXISTS update_chapter_count_on_delete ON public.chapters;
CREATE TRIGGER update_chapter_count_on_delete
  AFTER DELETE ON public.chapters
  FOR EACH ROW
  EXECUTE FUNCTION update_series_chapter_count(); 