-- Step 2: Patch unsafe JSON parsing in database functions (corrected)
-- Update is_service_role function to safely parse JWT claims
CREATE OR REPLACE FUNCTION public.is_service_role()
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  jwt_claims jsonb := '{}';
BEGIN
  -- Safely parse JWT claims with proper error handling
  BEGIN
    jwt_claims := COALESCE(
      NULLIF(current_setting('request.jwt.claims', true), '')::jsonb, 
      '{}'::jsonb
    );
  EXCEPTION WHEN OTHERS THEN
    jwt_claims := '{}'::jsonb;
  END;
  
  -- Check if the current request is from a legitimate service account
  RETURN COALESCE((jwt_claims ->> 'role') = 'service_role', false);
END;
$function$;

-- Update is_edge_function_request function to safely parse headers
CREATE OR REPLACE FUNCTION public.is_edge_function_request()
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  headers_json jsonb := '{}';
  user_agent text;
BEGIN
  -- Safely parse request headers with proper error handling
  BEGIN
    headers_json := COALESCE(
      NULLIF(current_setting('request.headers', true), '')::jsonb,
      '{}'::jsonb
    );
    user_agent := COALESCE(headers_json ->> 'user-agent', '');
  EXCEPTION WHEN OTHERS THEN
    user_agent := '';
  END;
  
  -- Check if the request is from service role AND has edge function user agent
  RETURN is_service_role() AND (user_agent LIKE '%supabase-edge-functions%');
END;
$function$;

-- Update log_sensitive_data_access function to safely parse headers
CREATE OR REPLACE FUNCTION public.log_sensitive_data_access(_table_name text, _operation text, _record_id text, _accessed_fields text[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  headers_json jsonb := '{}';
  user_email text;
BEGIN
  -- Safely parse request headers with proper error handling
  BEGIN
    headers_json := COALESCE(
      NULLIF(current_setting('request.headers', true), '')::jsonb,
      '{}'::jsonb
    );
  EXCEPTION WHEN OTHERS THEN
    headers_json := '{}'::jsonb;
  END;

  -- Safely get user email
  BEGIN
    SELECT email INTO user_email FROM auth.users WHERE id = auth.uid();
  EXCEPTION WHEN OTHERS THEN
    user_email := null;
  END;

  INSERT INTO public.audit_log (
    actor_user_id, 
    actor_email, 
    action, 
    entity_type, 
    entity_id, 
    details
  )
  VALUES (
    auth.uid(),
    user_email,
    _operation || '_sensitive_data',
    _table_name,
    _record_id,
    jsonb_build_object(
      'accessed_fields', _accessed_fields,
      'ip_address', COALESCE(headers_json ->> 'x-forwarded-for', 'unknown'),
      'user_agent', COALESCE(headers_json ->> 'user-agent', 'unknown')
    )
  );
END;
$function$;

-- Update log_security_event function to safely parse headers
CREATE OR REPLACE FUNCTION public.log_security_event(event_type_param text, details_param jsonb DEFAULT '{}'::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  headers_json jsonb := '{}';
BEGIN
  -- Safely parse request headers with proper error handling
  BEGIN
    headers_json := COALESCE(
      NULLIF(current_setting('request.headers', true), '')::jsonb,
      '{}'::jsonb
    );
  EXCEPTION WHEN OTHERS THEN
    headers_json := '{}'::jsonb;
  END;

  INSERT INTO public.security_events (
    user_id,
    event_type,
    ip_address,
    user_agent,
    details
  ) VALUES (
    auth.uid(),
    event_type_param,
    COALESCE(headers_json ->> 'x-forwarded-for', 'unknown'),
    COALESCE(headers_json ->> 'user-agent', 'unknown'),
    COALESCE(details_param, '{}'::jsonb)
  );
END;
$function$;

-- Update log_health_data_access function to safely parse headers
CREATE OR REPLACE FUNCTION public.log_health_data_access(_relative_id uuid, _data_type text, _access_level text, _consent_verified boolean DEFAULT false)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  headers_json jsonb := '{}';
BEGIN
  -- Safely parse request headers with proper error handling
  BEGIN
    headers_json := COALESCE(
      NULLIF(current_setting('request.headers', true), '')::jsonb,
      '{}'::jsonb
    );
  EXCEPTION WHEN OTHERS THEN
    headers_json := '{}'::jsonb;
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
    COALESCE(headers_json ->> 'x-forwarded-for', 'unknown'),
    COALESCE(headers_json ->> 'user-agent', 'unknown')
  );
END;
$function$;

-- Step 3: Ensure relatives table has proper RLS policies (corrected without created_by)
-- Enable RLS on relatives table
ALTER TABLE public.relatives ENABLE ROW LEVEL SECURITY;

-- Drop existing policies that might be conflicting
DROP POLICY IF EXISTS "relatives_secure_select" ON public.relatives;
DROP POLICY IF EXISTS "relatives_secure_insert" ON public.relatives;
DROP POLICY IF EXISTS "relatives_secure_update" ON public.relatives;
DROP POLICY IF EXISTS "relatives_secure_delete" ON public.relatives;
DROP POLICY IF EXISTS "TEMP insert any authenticated" ON public.relatives;
DROP POLICY IF EXISTS "relatives: open select" ON public.relatives;
DROP POLICY IF EXISTS "relatives: open insert" ON public.relatives;
DROP POLICY IF EXISTS "relatives: open update" ON public.relatives;
DROP POLICY IF EXISTS "relatives: open delete" ON public.relatives;

-- Create proper RLS policies for relatives (without created_by column)
CREATE POLICY "relatives_select_household_members" 
ON public.relatives 
FOR SELECT 
USING (app_is_household_member(household_id) OR has_admin_access_with_mfa(auth.uid()));

CREATE POLICY "relatives_insert_household_members" 
ON public.relatives 
FOR INSERT 
WITH CHECK (app_is_household_member(household_id));

CREATE POLICY "relatives_update_household_members" 
ON public.relatives 
FOR UPDATE 
USING (app_is_household_member(household_id) OR has_admin_access_with_mfa(auth.uid()))
WITH CHECK (app_is_household_member(household_id) OR has_admin_access_with_mfa(auth.uid()));

CREATE POLICY "relatives_delete_household_admins" 
ON public.relatives 
FOR DELETE 
USING (app_is_household_admin(household_id) OR has_admin_access_with_mfa(auth.uid()));

-- Ensure foreign key constraint exists with CASCADE
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'relatives_household_id_fkey' 
    AND table_name = 'relatives'
  ) THEN
    ALTER TABLE public.relatives 
    ADD CONSTRAINT relatives_household_id_fkey 
    FOREIGN KEY (household_id) REFERENCES public.households(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Update call_logs RLS policies to use only safe functions
DROP POLICY IF EXISTS "call_logs_enhanced_access" ON public.call_logs;
DROP POLICY IF EXISTS "call_logs_household_access" ON public.call_logs;

CREATE POLICY "call_logs_safe_household_access" 
ON public.call_logs 
FOR SELECT 
USING (
  has_admin_access_with_mfa(auth.uid()) OR
  is_service_role() OR
  is_edge_function_request() OR
  EXISTS (
    SELECT 1 FROM relatives r
    JOIN household_members hm ON hm.household_id = r.household_id
    WHERE r.id = call_logs.user_id 
    AND hm.user_id = auth.uid()
  )
);

-- Update call_analysis RLS policies to use only safe functions  
DROP POLICY IF EXISTS "call_analysis_enhanced_access" ON public.call_analysis;
DROP POLICY IF EXISTS "call_analysis_household_access" ON public.call_analysis;

CREATE POLICY "call_analysis_safe_household_access" 
ON public.call_analysis 
FOR SELECT 
USING (
  has_admin_access_with_mfa(auth.uid()) OR
  is_service_role() OR
  is_edge_function_request() OR
  EXISTS (
    SELECT 1 FROM relatives r
    JOIN household_members hm ON hm.household_id = r.household_id
    WHERE r.id = call_analysis.user_id 
    AND hm.user_id = auth.uid()
  )
);