-- Fix the existing function by updating it with the correct search_path
-- keeping the original parameter name
CREATE OR REPLACE FUNCTION public.has_admin_access_with_mfa(_uid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Check if user has admin role and MFA is enabled
  RETURN EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = _uid 
      AND p.role = 'admin'
      AND p.mfa_enabled = true
  );
END;
$function$;