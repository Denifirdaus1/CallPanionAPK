-- CRITICAL HOTFIX: Add missing mfa_enabled column to fix database errors
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS mfa_enabled boolean DEFAULT false;

-- Fix the has_admin_access_with_mfa function to handle missing mfa_enabled safely
CREATE OR REPLACE FUNCTION public.has_admin_access_with_mfa(_uid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Check if user has admin role and MFA is enabled (with safe fallback)
  RETURN EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = _uid 
      AND p.role = 'admin'
      AND COALESCE(p.mfa_enabled, false) = true
  );
END;
$function$;