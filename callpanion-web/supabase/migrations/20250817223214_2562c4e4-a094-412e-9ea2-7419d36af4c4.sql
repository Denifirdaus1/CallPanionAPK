-- Add role field to profiles table (since auth.users is managed by Supabase)
ALTER TABLE public.profiles ADD COLUMN role TEXT DEFAULT 'free' CHECK (role IN ('free', 'subscriber', 'admin'));

-- Create index for performance
CREATE INDEX idx_profiles_role ON public.profiles(role);

-- Update existing profiles to have 'free' role
UPDATE public.profiles SET role = 'free' WHERE role IS NULL;

-- Make role NOT NULL after setting defaults
ALTER TABLE public.profiles ALTER COLUMN role SET NOT NULL;

-- Create RLS policy for admins to manage user roles
CREATE POLICY "Admins can update user roles" ON public.profiles
  FOR UPDATE 
  USING (has_admin_access_with_mfa(auth.uid()))
  WITH CHECK (has_admin_access_with_mfa(auth.uid()));

-- Create RLS policy for admins to view all profiles for role management
CREATE POLICY "Admins can view all profiles for role management" ON public.profiles
  FOR SELECT 
  USING (has_admin_access_with_mfa(auth.uid()));

-- Function to check if user is subscriber
CREATE OR REPLACE FUNCTION public.is_subscriber(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public', 'auth'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = _user_id AND role IN ('subscriber', 'admin')
  );
$$;