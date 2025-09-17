-- Fix search_path security warnings for newly created functions
-- This addresses the security linter warnings

-- Update functions to have secure search_path
CREATE OR REPLACE FUNCTION public.validate_household_access(
  _user_id uuid, 
  _household_id uuid
) RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.household_members hm
    WHERE hm.household_id = _household_id 
      AND hm.user_id = _user_id
  ) OR has_admin_access_with_mfa(_user_id);
$$;

-- Update second function to have secure search_path  
CREATE OR REPLACE FUNCTION public.get_relative_household_secure(
  _relative_id uuid,
  _user_id uuid
) RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
STABLE
AS $$
  SELECT r.household_id
  FROM public.relatives r
  JOIN public.household_members hm ON hm.household_id = r.household_id
  WHERE r.id = _relative_id 
    AND (hm.user_id = _user_id OR has_admin_access_with_mfa(_user_id))
  LIMIT 1;
$$;