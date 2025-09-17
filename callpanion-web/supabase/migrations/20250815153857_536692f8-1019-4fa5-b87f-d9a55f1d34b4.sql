-- Fix overly restrictive RLS policies that block legitimate access

-- Fix relatives table policies - replace the blocking policy with proper access control
DROP POLICY IF EXISTS "Relatives secure access only" ON public.relatives;

CREATE POLICY "relatives_secure_access" ON public.relatives
FOR SELECT USING (
  -- Admins with MFA can access all relatives
  has_admin_access_with_mfa(auth.uid()) OR
  -- Household members can access relatives in their household
  app_is_household_member(household_id)
);

-- Fix call_analysis table policies - replace blocking policy with proper access control
DROP POLICY IF EXISTS "call_analysis_secure_access_only" ON public.call_analysis;

CREATE POLICY "call_analysis_household_access" ON public.call_analysis
FOR SELECT USING (
  -- Admins with MFA can access all call analysis
  has_admin_access_with_mfa(auth.uid()) OR
  -- Household members can access call analysis for relatives in their household
  EXISTS (
    SELECT 1 FROM public.relatives r
    JOIN public.household_members hm ON hm.household_id = r.household_id
    WHERE r.id = call_analysis.user_id 
      AND hm.user_id = auth.uid()
  )
);

-- Fix call_logs table policies - replace blocking policy with proper access control  
DROP POLICY IF EXISTS "call_logs_secure_access_only" ON public.call_logs;

CREATE POLICY "call_logs_household_access" ON public.call_logs
FOR SELECT USING (
  -- Admins with MFA can access all call logs
  has_admin_access_with_mfa(auth.uid()) OR
  -- Household members can access call logs for relatives in their household
  EXISTS (
    SELECT 1 FROM public.relatives r
    JOIN public.household_members hm ON hm.household_id = r.household_id
    WHERE r.id = call_logs.user_id 
      AND hm.user_id = auth.uid()
  )
);

-- Create secure access function for relatives data
CREATE OR REPLACE FUNCTION public.get_relatives_for_household(_household_id uuid)
RETURNS TABLE(
  id uuid,
  first_name text,
  last_name text,
  town text,
  county text,
  country text,
  call_cadence text,
  timezone text,
  quiet_hours_start text,
  quiet_hours_end text,
  last_active_at timestamp with time zone,
  created_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
BEGIN
  -- Check authorization
  IF NOT (
    app_is_household_member(_household_id) OR
    has_admin_access_with_mfa(auth.uid())
  ) THEN
    RAISE EXCEPTION 'Unauthorized access to relatives data';
  END IF;

  -- Log the access
  PERFORM log_sensitive_data_access(
    'relatives', 
    'SELECT', 
    _household_id::text, 
    ARRAY['basic_info']
  );

  -- Return relatives data (excluding sensitive escalation contacts)
  RETURN QUERY
  SELECT 
    r.id,
    r.first_name,
    r.last_name,
    r.town,
    r.county,
    r.country,
    r.call_cadence,
    r.timezone,
    r.quiet_hours_start,
    r.quiet_hours_end,
    r.last_active_at,
    r.created_at
  FROM public.relatives r
  WHERE r.household_id = _household_id
    AND r.inactive_since IS NULL;
END;
$$;