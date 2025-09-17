-- Complete security implementation - create missing functions first

-- 1. Create the missing consent checking function
CREATE OR REPLACE FUNCTION public.has_health_data_consent(
  _relative_id UUID, 
  _user_id UUID, 
  _consent_type public.consent_type
) RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.health_data_consents hdc
    WHERE hdc.relative_id = _relative_id
      AND hdc.granted_to_user_id = _user_id
      AND hdc.consent_type = _consent_type
      AND hdc.granted = true
      AND hdc.revoked_at IS NULL
  );
$$;

-- 2. Create the secure call summary function with consent checking
CREATE OR REPLACE FUNCTION public.get_call_summary_with_consent(
  relative_id_param UUID
) RETURNS TABLE(
  total_calls INTEGER,
  completed_calls INTEGER, 
  missed_calls INTEGER,
  average_duration INTEGER,
  last_call_date TIMESTAMP WITH TIME ZONE,
  mood_trend TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  user_access_level public.health_access_level;
  household_id_val UUID;
BEGIN
  -- Get household and access level
  SELECT r.household_id INTO household_id_val
  FROM public.relatives r WHERE r.id = relative_id_param;
  
  SELECT get_user_health_access_level(auth.uid(), household_id_val) INTO user_access_level;
  
  -- Check authorization
  IF NOT (
    has_admin_access_with_mfa(auth.uid()) OR
    (user_access_level IN ('SUMMARY_ONLY', 'FULL_ACCESS') AND
     app_is_household_member(household_id_val))
  ) THEN
    RAISE EXCEPTION 'Unauthorized access to call summary';
  END IF;

  -- Log the access
  PERFORM log_health_data_access(
    relative_id_param,
    'call_summary', 
    user_access_level::text,
    true
  );

  -- Return summary data based on access level
  RETURN QUERY
  SELECT 
    COUNT(*)::INTEGER as total_calls,
    COUNT(CASE WHEN cl.call_outcome = 'completed' THEN 1 END)::INTEGER as completed_calls,
    COUNT(CASE WHEN cl.call_outcome = 'missed' THEN 1 END)::INTEGER as missed_calls,
    COALESCE(AVG(cl.call_duration), 0)::INTEGER as average_duration,
    MAX(cl.timestamp) as last_call_date,
    CASE 
      WHEN user_access_level = 'FULL_ACCESS' AND 
           has_health_data_consent(relative_id_param, auth.uid(), 'DETAILED_ANALYSIS_ACCESS'::public.consent_type)
      THEN 
        CASE 
          WHEN AVG(ca.mood_score) > 7 THEN 'positive'
          WHEN AVG(ca.mood_score) > 4 THEN 'neutral' 
          ELSE 'concerning'
        END
      ELSE 'restricted'
    END as mood_trend
  FROM public.call_logs cl
  LEFT JOIN public.call_analysis ca ON cl.id = ca.call_log_id
  WHERE cl.user_id = relative_id_param
    AND cl.timestamp >= (now() - interval '30 days');
END;
$$;