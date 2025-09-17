-- Continue Enhanced Security Implementation - Add RLS Policies and Complete Setup

-- 6. Enhanced RLS policies for call_analysis with consent checking
DROP POLICY IF EXISTS "call_analysis_household_access" ON public.call_analysis;

CREATE POLICY "call_analysis_enhanced_access" ON public.call_analysis
FOR SELECT USING (
  has_admin_access_with_mfa(auth.uid()) OR
  (
    EXISTS (
      SELECT 1 FROM public.relatives r
      JOIN public.household_members hm ON hm.household_id = r.household_id
      WHERE r.id = call_analysis.user_id
        AND hm.user_id = auth.uid()
        AND (
          -- Full access with consent
          (get_user_health_access_level(auth.uid(), r.household_id) = 'FULL_ACCESS' 
           AND has_health_data_consent(r.id, auth.uid(), 'DETAILED_ANALYSIS_ACCESS')) OR
          -- Summary access (mood_score only, no transcript/detailed flags)
          (get_user_health_access_level(auth.uid(), r.household_id) = 'SUMMARY_ONLY')
        )
    )
  )
);

-- 7. Enhanced RLS policies for call_logs with consent checking  
DROP POLICY IF EXISTS "call_logs_household_access" ON public.call_logs;

CREATE POLICY "call_logs_enhanced_access" ON public.call_logs
FOR SELECT USING (
  has_admin_access_with_mfa(auth.uid()) OR
  (
    EXISTS (
      SELECT 1 FROM public.relatives r
      JOIN public.household_members hm ON hm.household_id = r.household_id
      WHERE r.id = call_logs.user_id
        AND hm.user_id = auth.uid()
        AND (
          -- Full access with consent (including audio recordings)
          (get_user_health_access_level(auth.uid(), r.household_id) = 'FULL_ACCESS' 
           AND has_health_data_consent(r.id, auth.uid(), 'CALL_RECORDINGS_ACCESS')) OR
          -- Summary access (basic call data only, no audio/detailed health)
          (get_user_health_access_level(auth.uid(), r.household_id) IN ('SUMMARY_ONLY', 'FULL_ACCESS'))
        )
    )
  )
);

-- 8. Create secure functions for health data retrieval
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
           has_health_data_consent(relative_id_param, auth.uid(), 'DETAILED_ANALYSIS_ACCESS')
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

-- 9. RLS policies for new tables
CREATE POLICY "health_consents_family_manage" ON public.health_data_consents
FOR ALL USING (
  has_admin_access_with_mfa(auth.uid()) OR
  EXISTS (
    SELECT 1 FROM public.relatives r
    JOIN public.household_members hm ON hm.household_id = r.household_id
    WHERE r.id = health_data_consents.relative_id
      AND hm.user_id = auth.uid()
      AND hm.role = 'FAMILY_PRIMARY'
  )
)
WITH CHECK (
  has_admin_access_with_mfa(auth.uid()) OR
  EXISTS (
    SELECT 1 FROM public.relatives r
    JOIN public.household_members hm ON hm.household_id = r.household_id
    WHERE r.id = health_data_consents.relative_id
      AND hm.user_id = auth.uid()
      AND hm.role = 'FAMILY_PRIMARY'
  )
);

CREATE POLICY "health_access_log_admin_only" ON public.health_data_access_log
FOR ALL USING (has_admin_access_with_mfa(auth.uid()))
WITH CHECK (has_admin_access_with_mfa(auth.uid()));

-- 10. Create trigger for updated_at on health_data_consents
DROP TRIGGER IF EXISTS update_health_consents_updated_at ON public.health_data_consents;
CREATE TRIGGER update_health_consents_updated_at
  BEFORE UPDATE ON public.health_data_consents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 11. Set default health access levels for existing household members
UPDATE public.household_members 
SET health_access_level = 
  CASE 
    WHEN role = 'FAMILY_PRIMARY' THEN 'FULL_ACCESS'::public.health_access_level
    ELSE 'SUMMARY_ONLY'::public.health_access_level
  END
WHERE health_access_level IS NULL;

-- 12. Create function to manage consent grants
CREATE OR REPLACE FUNCTION public.grant_health_data_consent(
  _relative_id UUID,
  _granted_to_user_id UUID,
  _consent_type public.consent_type,
  _granted BOOLEAN
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Check if user has permission to grant consent
  IF NOT (
    has_admin_access_with_mfa(auth.uid()) OR
    EXISTS (
      SELECT 1 FROM public.relatives r
      JOIN public.household_members hm ON hm.household_id = r.household_id
      WHERE r.id = _relative_id
        AND hm.user_id = auth.uid()
        AND hm.role = 'FAMILY_PRIMARY'
    )
  ) THEN
    RAISE EXCEPTION 'Unauthorized to manage health data consent';
  END IF;

  -- Insert or update consent
  INSERT INTO public.health_data_consents (
    relative_id, granted_to_user_id, consent_type, granted, granted_at
  ) VALUES (
    _relative_id, _granted_to_user_id, _consent_type, _granted,
    CASE WHEN _granted THEN now() ELSE NULL END
  )
  ON CONFLICT (relative_id, granted_to_user_id, consent_type)
  DO UPDATE SET
    granted = EXCLUDED.granted,
    granted_at = CASE WHEN EXCLUDED.granted THEN now() ELSE health_data_consents.granted_at END,
    revoked_at = CASE WHEN NOT EXCLUDED.granted THEN now() ELSE NULL END,
    updated_at = now();
    
  -- Log the consent change
  PERFORM log_security_event('health_consent_changed', jsonb_build_object(
    'relative_id', _relative_id,
    'granted_to_user_id', _granted_to_user_id,
    'consent_type', _consent_type::text,
    'granted', _granted
  ));
END;
$$;