-- Fix security warnings by setting search_path for existing functions
CREATE OR REPLACE FUNCTION public.has_admin_access_with_mfa(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Check if user has admin role and MFA is enabled
  RETURN EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = _user_id 
      AND p.role = 'admin'
      AND p.mfa_enabled = true
  );
END;
$function$;