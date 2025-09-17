-- Security Fix Phase 3: Fix search path and final hardening
-- Address function search path security and add final protections

-- 1. Fix search path for all security functions
CREATE OR REPLACE FUNCTION public.log_sensitive_data_access(
  _table_name text,
  _operation text,
  _record_id text,
  _accessed_fields text[]
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
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
    (SELECT email FROM auth.users WHERE id = auth.uid()),
    _operation || '_sensitive_data',
    _table_name,
    _record_id,
    jsonb_build_object(
      'accessed_fields', _accessed_fields,
      'ip_address', current_setting('request.headers', true)::json ->> 'x-forwarded-for',
      'user_agent', current_setting('request.headers', true)::json ->> 'user-agent'
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_customer_data_secure(customer_id uuid)
RETURNS TABLE(
  id uuid,
  full_name text,
  preferred_name text,
  status text,
  plan text,
  device_status text,
  timezone text,
  city text,
  country text,
  risk_flag boolean,
  created_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Check authorization
  IF NOT (
    has_admin_access_with_mfa(auth.uid()) OR
    has_access_to_customer(auth.uid(), customer_id)
  ) THEN
    RAISE EXCEPTION 'Unauthorized access to customer data';
  END IF;

  -- Log the access
  PERFORM log_sensitive_data_access(
    'customers', 
    'SELECT', 
    customer_id::text, 
    ARRAY['basic_info']
  );

  -- Return non-sensitive customer data
  RETURN QUERY
  SELECT 
    c.id,
    c.full_name,
    c.preferred_name,
    c.status,
    c.plan,
    c.device_status,
    c.timezone,
    c.city,
    c.country,
    c.risk_flag,
    c.created_at
  FROM public.customers c
  WHERE c.id = customer_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_relatives_secure(household_id_param uuid)
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
SET search_path = 'public'
AS $$
BEGIN
  -- Check authorization
  IF NOT (
    app_is_household_member(household_id_param) OR
    has_admin_access_with_mfa(auth.uid())
  ) THEN
    RAISE EXCEPTION 'Unauthorized access to relatives data';
  END IF;

  -- Log the access
  PERFORM log_sensitive_data_access(
    'relatives', 
    'SELECT', 
    household_id_param::text, 
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
  WHERE r.household_id = household_id_param
    AND r.inactive_since IS NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_invite_token(token_param text)
RETURNS TABLE(
  id uuid,
  household_id uuid,
  role text,
  expires_at timestamp with time zone,
  is_valid boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Log the token validation attempt
  PERFORM log_sensitive_data_access(
    'invites', 
    'VALIDATE_TOKEN', 
    token_param, 
    ARRAY['token_validation']
  );

  RETURN QUERY
  SELECT 
    i.id,
    i.household_id,
    i.role,
    i.expires_at,
    (i.expires_at > now() AND i.accepted_at IS NULL) as is_valid
  FROM public.invites i
  WHERE i.token = token_param;
END;
$$;

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
SET search_path = 'public'
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

CREATE OR REPLACE FUNCTION public.get_relative_escalation_contacts(relative_id_param uuid)
RETURNS TABLE(
  escalation_contact_name text,
  escalation_contact_email text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
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

CREATE OR REPLACE FUNCTION public.log_failed_access_attempt()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
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

-- 2. Add additional call data protection
-- Create secure call data access function
CREATE OR REPLACE FUNCTION public.get_call_data_secure(user_id_param uuid, date_range_start timestamp with time zone DEFAULT (now() - interval '30 days'))
RETURNS TABLE(
  call_id uuid,
  call_outcome text,
  call_duration integer,
  timestamp timestamp with time zone,
  mood_score integer,
  health_flag boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Only allow users to access their own data or admins
  IF NOT (auth.uid() = user_id_param OR has_admin_access_with_mfa(auth.uid())) THEN
    RAISE EXCEPTION 'Unauthorized access to call data';
  END IF;

  -- Log the access
  PERFORM log_sensitive_data_access(
    'call_logs', 
    'SELECT_SECURE', 
    user_id_param::text, 
    ARRAY['call_summary']
  );

  -- Return aggregated call data without sensitive audio URLs or transcripts
  RETURN QUERY
  SELECT 
    cl.id as call_id,
    cl.call_outcome,
    cl.call_duration,
    cl.timestamp,
    ca.mood_score,
    ca.health_flag
  FROM public.call_logs cl
  LEFT JOIN public.call_analysis ca ON cl.id = ca.call_log_id
  WHERE cl.user_id = user_id_param
    AND cl.timestamp >= date_range_start
  ORDER BY cl.timestamp DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_call_data_secure(uuid, timestamp with time zone) TO authenticated;

-- 3. Final security comment and documentation
COMMENT ON FUNCTION public.get_customer_data_secure IS 'Secure function to access customer data with authorization and audit logging. Replaces direct table access.';
COMMENT ON FUNCTION public.get_relatives_secure IS 'Secure function to access relatives data excluding sensitive escalation contacts.';
COMMENT ON FUNCTION public.get_household_safe IS 'Secure function to access household data excluding sensitive location information.';
COMMENT ON FUNCTION public.get_call_data_secure IS 'Secure function to access call analytics without exposing audio URLs or transcripts.';
COMMENT ON TABLE public.security_events IS 'Audit table for security-related events and access attempts.';