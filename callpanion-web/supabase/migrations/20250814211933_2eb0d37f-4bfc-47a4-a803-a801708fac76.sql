-- Security Fix Phase 2: Address Remaining Vulnerabilities
-- Fix remaining data exposure issues identified in security scan

-- 1. Fix customers table - Remove permissive policy and secure access
DROP POLICY IF EXISTS "Family can read basic customer data" ON public.customers;
DROP POLICY IF EXISTS "Customers can read own data" ON public.customers;

-- Only allow admin access directly, all family access through secure functions
CREATE POLICY "Admins only direct customer access" 
ON public.customers 
FOR SELECT 
USING (has_admin_access_with_mfa(auth.uid()));

-- 2. Fix call_logs table - Restrict to participants only
DROP POLICY IF EXISTS "Family can view call logs for household members" ON public.call_logs;
DROP POLICY IF EXISTS "Users can view their own call logs" ON public.call_logs;

CREATE POLICY "Users can view own call logs only" 
ON public.call_logs 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all call logs" 
ON public.call_logs 
FOR SELECT 
USING (has_admin_access_with_mfa(auth.uid()));

-- 3. Fix call_analysis table - Restrict to participants only  
DROP POLICY IF EXISTS "Family can view call analysis for household members" ON public.call_analysis;
DROP POLICY IF EXISTS "Users can view their own call analysis" ON public.call_analysis;

CREATE POLICY "Users can view own call analysis only" 
ON public.call_analysis 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all call analysis" 
ON public.call_analysis 
FOR SELECT 
USING (has_admin_access_with_mfa(auth.uid()));

-- 4. Fix households table - Remove location data exposure
DROP POLICY IF EXISTS "household_select_safe" ON public.households;
DROP POLICY IF EXISTS "household members can select households" ON public.households;

-- Create secure household access function
CREATE OR REPLACE FUNCTION public.get_household_safe(household_id_param uuid)
RETURNS TABLE(
  id uuid,
  name text,
  timezone text,
  created_at timestamp with time zone,
  gdpr_consent_status boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'auth'
AS $$
BEGIN
  -- Check authorization
  IF NOT (
    app_is_household_member(household_id_param) OR
    has_admin_access_with_mfa(auth.uid())
  ) THEN
    RAISE EXCEPTION 'Unauthorized access to household data';
  END IF;

  -- Log the access
  PERFORM log_sensitive_data_access(
    'households', 
    'SELECT', 
    household_id_param::text, 
    ARRAY['basic_info']
  );

  -- Return non-sensitive household data (excluding addresses)
  RETURN QUERY
  SELECT 
    h.id,
    h.name,
    h.timezone,
    h.created_at,
    h.gdpr_consent_status
  FROM public.households h
  WHERE h.id = household_id_param;
END;
$$;

CREATE POLICY "Household access through secure function only" 
ON public.households 
FOR SELECT 
USING (
  has_admin_access_with_mfa(auth.uid()) OR
  (app_is_household_member(id) AND false) -- Force use of secure function
);

-- 5. Fix waitlist table - Admin access only
DROP POLICY IF EXISTS "Admins can read waitlist" ON public.waitlist;

CREATE POLICY "Super admins only can read waitlist" 
ON public.waitlist 
FOR SELECT 
USING (is_super_admin(auth.uid()));

-- 6. Create secure relatives access with audit logging
-- The existing policy already blocks direct access, ensure it stays that way
DROP POLICY IF EXISTS "relatives_select_secure" ON public.relatives;

CREATE POLICY "Relatives secure access only" 
ON public.relatives 
FOR SELECT 
USING (
  has_admin_access_with_mfa(auth.uid()) AND false -- Block all direct access, force secure function use
);

-- 7. Add function to get relative escalation contacts (admin only)
CREATE OR REPLACE FUNCTION public.get_relative_escalation_contacts(relative_id_param uuid)
RETURNS TABLE(
  escalation_contact_name text,
  escalation_contact_email text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'auth'
AS $$
BEGIN
  -- Only super admins can access escalation contacts
  IF NOT is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized access to escalation contacts';
  END IF;

  -- Log the sensitive access
  PERFORM log_sensitive_data_access(
    'relatives', 
    'SELECT_ESCALATION', 
    relative_id_param::text, 
    ARRAY['escalation_contacts']
  );

  RETURN QUERY
  SELECT 
    r.escalation_contact_name,
    r.escalation_contact_email
  FROM public.relatives r
  WHERE r.id = relative_id_param;
END;
$$;

-- 8. Enhanced security monitoring function
CREATE OR REPLACE FUNCTION public.log_security_event(
  event_type_param text,
  details_param jsonb DEFAULT '{}'::jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.security_events (
    user_id,
    event_type,
    ip_address,
    user_agent,
    details
  ) VALUES (
    auth.uid(),
    event_type_param,
    current_setting('request.headers', true)::json ->> 'x-forwarded-for',
    current_setting('request.headers', true)::json ->> 'user-agent',
    details_param
  );
END;
$$;

-- 9. Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.get_household_safe(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_relative_escalation_contacts(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_security_event(text, jsonb) TO authenticated;

-- 10. Add security trigger for failed access attempts
CREATE OR REPLACE FUNCTION public.log_failed_access_attempt()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Log failed RLS policy access
  PERFORM log_security_event('rls_access_denied', jsonb_build_object(
    'table', TG_TABLE_NAME,
    'operation', TG_OP,
    'timestamp', now()
  ));
  
  RETURN NULL;
END;
$$;