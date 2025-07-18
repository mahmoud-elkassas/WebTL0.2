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