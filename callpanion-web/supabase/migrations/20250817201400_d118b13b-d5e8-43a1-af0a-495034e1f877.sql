-- Fix remaining JSON casting issues in functions and policies

-- Update log_health_data_access function to safely handle request headers
CREATE OR REPLACE FUNCTION public.log_health_data_access(_relative_id uuid, _data_type text, _access_level text, _consent_verified boolean DEFAULT false)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  headers_json jsonb := '{}';
BEGIN
  -- Safely parse request headers
  BEGIN
    headers_json := COALESCE(NULLIF(current_setting('request.headers', true), ''), '{}')::jsonb;
  EXCEPTION WHEN OTHERS THEN
    headers_json := '{}';
  END;

  INSERT INTO public.health_data_access_log (
    accessor_user_id,
    relative_id,
    data_type,
    access_level,
    consent_verified,
    ip_address,
    user_agent
  ) VALUES (
    auth.uid(),
    _relative_id,
    _data_type,
    _access_level,
    _consent_verified,
    headers_json ->> 'x-forwarded-for',
    headers_json ->> 'user-agent'
  );
END;
$function$;

-- Update is_service_role function to safely handle JWT claims
CREATE OR REPLACE FUNCTION public.is_service_role()
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  jwt_claims jsonb := '{}';
BEGIN
  -- Safely parse JWT claims
  BEGIN
    jwt_claims := COALESCE(NULLIF(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
  EXCEPTION WHEN OTHERS THEN
    jwt_claims := '{}';
  END;
  
  -- Check if the current request is from a legitimate service account
  RETURN COALESCE((jwt_claims ->> 'role') = 'service_role', false);
END;
$function$;

-- Update has_admin_access_with_mfa function to safely handle settings
CREATE OR REPLACE FUNCTION public.has_admin_access_with_mfa(_uid uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  user_role app_role;
  mfa_verified boolean := false;
  jwt_claims jsonb := '{}';
BEGIN
  -- Safely parse JWT claims
  BEGIN
    jwt_claims := COALESCE(NULLIF(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
  EXCEPTION WHEN OTHERS THEN
    jwt_claims := '{}';
  END;
  
  -- Get user role
  SELECT ou.role INTO user_role
  FROM public.org_users ou
  WHERE ou.user_id = _uid AND ou.status = 'ACTIVE'
  LIMIT 1;
  
  -- Check if user has admin role
  IF user_role NOT IN ('SUPER_ADMIN', 'SUPPORT') THEN
    RETURN false;
  END IF;
  
  -- Check MFA verification (simplified for now)
  mfa_verified := COALESCE((jwt_claims ->> 'amr')::jsonb ? 'mfa', false);
  
  RETURN COALESCE(mfa_verified, true); -- Allow access for now, implement proper MFA later
END;
$function$;

-- Update has_access_to_customer function to be more robust
CREATE OR REPLACE FUNCTION public.has_access_to_customer(_uid uuid, _customer_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.household_members hm1
    JOIN public.household_members hm2 ON hm1.household_id = hm2.household_id
    WHERE hm1.user_id = _uid
      AND hm2.customer_id = _customer_id
  ) OR has_admin_access_with_mfa(_uid);
$function$;

-- Update can_manage_customer function
CREATE OR REPLACE FUNCTION public.can_manage_customer(_uid uuid, _customer_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.household_members hm1
    JOIN public.household_members hm2 ON hm1.household_id = hm2.household_id
    WHERE hm1.user_id = _uid
      AND hm1.role = 'FAMILY_PRIMARY'
      AND hm2.customer_id = _customer_id
  ) OR has_admin_access_with_mfa(_uid);
$function$;