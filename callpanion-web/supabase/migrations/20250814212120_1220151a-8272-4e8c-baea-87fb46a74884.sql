-- Security Fix Phase 3: Fix search path and final hardening (Fixed)
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

-- 2. Add additional call data protection - Create secure call data access function
CREATE OR REPLACE FUNCTION public.get_call_data_secure(user_id_param uuid, date_range_start timestamp with time zone DEFAULT (now() - interval '30 days'))
RETURNS TABLE(
  call_id uuid,
  call_outcome text,
  call_duration integer,
  call_timestamp timestamp with time zone,
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
    cl.timestamp as call_timestamp,
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

-- 3. Final security comments and documentation
COMMENT ON FUNCTION public.get_customer_data_secure IS 'Secure function to access customer data with authorization and audit logging. Replaces direct table access.';
COMMENT ON FUNCTION public.get_relatives_secure IS 'Secure function to access relatives data excluding sensitive escalation contacts.';
COMMENT ON FUNCTION public.get_household_safe IS 'Secure function to access household data excluding sensitive location information.';
COMMENT ON FUNCTION public.get_call_data_secure IS 'Secure function to access call analytics without exposing audio URLs or transcripts.';
COMMENT ON TABLE public.security_events IS 'Audit table for security-related events and access attempts.';