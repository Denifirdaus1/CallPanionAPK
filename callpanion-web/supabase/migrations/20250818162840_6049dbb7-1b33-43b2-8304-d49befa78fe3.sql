-- Profiles table security hardening - Add precise RLS policies
-- Drop existing overly permissive policies first
DROP POLICY IF EXISTS "profiles_select_self" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_self" ON public.profiles;

-- Create precise policies for profiles table
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = id);

CREATE POLICY "Users can update their own non-sensitive profile fields" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id AND 
  -- Ensure role cannot be changed by regular users
  (role IS NULL OR role = (SELECT role FROM public.profiles WHERE id = auth.uid()))
);

CREATE POLICY "Only MFA admins can update user roles" 
ON public.profiles 
FOR UPDATE 
USING (has_admin_access_with_mfa(auth.uid()))
WITH CHECK (has_admin_access_with_mfa(auth.uid()));

CREATE POLICY "Admins can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (has_admin_access_with_mfa(auth.uid()));

-- Service role can manage profiles for system operations
CREATE POLICY "Service role can manage profiles" 
ON public.profiles 
FOR ALL 
USING (is_service_role())
WITH CHECK (is_service_role());