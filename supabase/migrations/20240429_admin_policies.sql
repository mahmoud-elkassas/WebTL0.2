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