-- Security Fix Phase 3 (Corrected): Fix search path and final hardening

-- Create secure call data access function (fixed syntax)
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

-- Add security documentation
COMMENT ON FUNCTION public.get_customer_data_secure IS 'Secure function to access customer data with authorization and audit logging. Replaces direct table access.';
COMMENT ON FUNCTION public.get_relatives_secure IS 'Secure function to access relatives data excluding sensitive escalation contacts.';
COMMENT ON FUNCTION public.get_household_safe IS 'Secure function to access household data excluding sensitive location information.';
COMMENT ON FUNCTION public.get_call_data_secure IS 'Secure function to access call analytics without exposing audio URLs or transcripts.';
COMMENT ON TABLE public.security_events IS 'Audit table for security-related events and access attempts.';