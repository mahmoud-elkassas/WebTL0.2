/*
  # Initial Schema Setup for Webtoon Translation Tool

  1. New Tables
    - `profiles`: Stores user profile information
    - `series`: Stores series information
    - `glossaries`: Stores series-specific glossary terms
    - `access_requests`: Stores access requests from users
    - `translations`: Stores translation history

  2. Security
    - Enable RLS on all tables
    - Set up policies for each table to control access
*/

-- Create users/profiles tables for authentication and user data
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create series table for storing series information
CREATE TABLE IF NOT EXISTS public.series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  source_language TEXT NOT NULL,
  genre TEXT,
  tone_notes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create glossary table for storing series-specific glossary terms
CREATE TABLE IF NOT EXISTS public.glossaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id UUID REFERENCES public.series(id) ON DELETE CASCADE,
  source_term TEXT NOT NULL,
  translated_term TEXT NOT NULL,
  term_type TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create access_requests table for storing access requests
CREATE TABLE IF NOT EXISTS public.access_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  reason TEXT,
  decided_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create translations table for storing translation history
CREATE TABLE IF NOT EXISTS public.translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id UUID REFERENCES public.series(id) ON DELETE CASCADE,
  chapter TEXT,
  source_text TEXT NOT NULL,
  translated_text TEXT NOT NULL,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.series ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.glossaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.translations ENABLE ROW LEVEL SECURITY;

-- Set up RLS policies
-- Profiles policies
CREATE POLICY "Public profiles are viewable by everyone" 
  ON public.profiles FOR SELECT 
  USING (true);

CREATE POLICY "Users can update their own profile" 
  ON public.profiles FOR UPDATE 
  USING (auth.uid() = id);

-- Series policies
CREATE POLICY "Series are viewable by authenticated users" 
  ON public.series FOR SELECT 
  USING (auth.role() = 'authenticated');

CREATE POLICY "Series can be inserted by approved users" 
  ON public.series FOR INSERT 
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM public.profiles 
      WHERE role = 'admin' 
      OR role = 'translator'
    )
  );

CREATE POLICY "Series can be updated by creator or admin" 
  ON public.series FOR UPDATE 
  USING (
    auth.uid() = created_by 
    OR auth.uid() IN (
      SELECT id FROM public.profiles 
      WHERE role = 'admin'
    )
  );

-- Glossaries policies
CREATE POLICY "Glossaries are viewable by authenticated users" 
  ON public.glossaries FOR SELECT 
  USING (auth.role() = 'authenticated');

CREATE POLICY "Glossaries can be inserted by approved users" 
  ON public.glossaries FOR INSERT 
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM public.profiles 
      WHERE role = 'admin' 
      OR role = 'translator'
    )
  );

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
CREATE POLICY "Users can view their own access requests" 
  ON public.access_requests FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Admin can view all access requests" 
  ON public.access_requests FOR SELECT 
  USING (
    auth.uid() IN (
      SELECT id FROM public.profiles 
      WHERE role = 'admin'
    )
  );

CREATE POLICY "Users can create their own access requests" 
  ON public.access_requests FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admin can update access requests" 
  ON public.access_requests FOR UPDATE 
  USING (
    auth.uid() IN (
      SELECT id FROM public.profiles 
      WHERE role = 'admin'
    )
  );

-- Translations policies
CREATE POLICY "Translations are viewable by authenticated users" 
  ON public.translations FOR SELECT 
  USING (auth.role() = 'authenticated');

CREATE POLICY "Translations can be inserted by approved users" 
  ON public.translations FOR INSERT 
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM public.profiles 
      WHERE role = 'admin' 
      OR role = 'translator'
    )
  );

-- Create an admin function
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
    user_id := extensions.uuid_generate_v4();
    
    INSERT INTO auth.users (id, email, email_confirmed_at, role)
    VALUES (user_id, email, now(), 'authenticated');
    
    INSERT INTO auth.identities (id, provider_id, provider, user_id)
    VALUES (extensions.uuid_generate_v4(), email, 'email', user_id);
    
    -- Set password
    UPDATE auth.users SET encrypted_password = crypt(password, gen_salt('bf')) WHERE id = user_id;
  END IF;
  
  -- Ensure there is a profile and it's set to admin
  INSERT INTO public.profiles (id, email, role)
  VALUES (user_id, email, 'admin')
  ON CONFLICT (id) DO UPDATE SET role = 'admin';
  
  RETURN user_id;
END;
$$;

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

-- Trigger to automatically create a user profile and access request
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Create a default admin user
SELECT public.create_admin_user('admin@example.com', 'Admin123!');

-- Function to handle access request approval and role update
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

-- Trigger to automatically update user role when access request is approved
CREATE TRIGGER on_access_request_approved
  AFTER UPDATE ON public.access_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_access_request_approval();
  -- Add policies for admin operations
CREATE POLICY "Admins can delete any profile"
ON public.profiles
FOR DELETE
USING (
  auth.uid() IN (
    SELECT id FROM public.profiles
    WHERE role = 'admin'
  )
);

CREATE POLICY "Admins can update any profile"
ON public.profiles
FOR UPDATE
USING (
  auth.uid() IN (
    SELECT id FROM public.profiles
    WHERE role = 'admin'
  )
);

-- Grant necessary permissions to authenticated users
GRANT DELETE ON public.profiles TO authenticated;
GRANT UPDATE ON public.profiles TO authenticated; 
-- Function to handle profile deletion
CREATE OR REPLACE FUNCTION public.handle_profile_deletion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Delete the corresponding auth.users record
    DELETE FROM auth.users WHERE id = OLD.id;
    RETURN OLD;
END;
$$;

-- Create trigger for profile deletion
CREATE TRIGGER on_profile_deleted
    AFTER DELETE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_profile_deletion();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_profile_deletion() TO authenticated; 