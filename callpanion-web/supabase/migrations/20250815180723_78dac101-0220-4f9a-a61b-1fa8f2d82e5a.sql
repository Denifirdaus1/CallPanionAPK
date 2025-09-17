-- Enhanced Security Recommendations Implementation

-- 1. Create consent types for granular health data access
CREATE TYPE public.consent_type AS ENUM (
  'HEALTH_DATA_ACCESS',
  'CALL_RECORDINGS_ACCESS', 
  'DETAILED_ANALYSIS_ACCESS',
  'EMERGENCY_CONTACT_ACCESS'
);

-- 2. Create health data consent table
CREATE TABLE public.health_data_consents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  relative_id UUID NOT NULL REFERENCES public.relatives(id) ON DELETE CASCADE,
  granted_to_user_id UUID NOT NULL, -- The family member being granted access
  consent_type public.consent_type NOT NULL,
  granted BOOLEAN NOT NULL DEFAULT false,
  granted_at TIMESTAMP WITH TIME ZONE,
  revoked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(relative_id, granted_to_user_id, consent_type)
);

-- Enable RLS on health data consents
ALTER TABLE public.health_data_consents ENABLE ROW LEVEL SECURITY;

-- 3. Enhanced household member roles with health access levels
CREATE TYPE public.health_access_level AS ENUM (
  'FULL_ACCESS',     -- Can view all health data
  'SUMMARY_ONLY',    -- Can only view health summaries
  'NO_ACCESS'        -- Cannot view health data
);

-- Add health access level to household members
ALTER TABLE public.household_members 
ADD COLUMN health_access_level public.health_access_level DEFAULT 'SUMMARY_ONLY';

-- 4. Create enhanced audit logging for health data access
CREATE TABLE public.health_data_access_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  accessor_user_id UUID NOT NULL,
  relative_id UUID NOT NULL,
  data_type TEXT NOT NULL, -- 'call_logs', 'call_analysis', 'health_summary'
  access_level TEXT NOT NULL, -- 'full', 'summary', 'denied'
  consent_verified BOOLEAN NOT NULL DEFAULT false,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on health data access log
ALTER TABLE public.health_data_access_log ENABLE ROW LEVEL SECURITY;

-- 5. Create security functions for consent checking
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

CREATE OR REPLACE FUNCTION public.get_user_health_access_level(
  _user_id UUID,
  _household_id UUID
) RETURNS public.health_access_level
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT COALESCE(hm.health_access_level, 'NO_ACCESS'::public.health_access_level)
  FROM public.household_members hm
  WHERE hm.user_id = _user_id 
    AND hm.household_id = _household_id
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.log_health_data_access(
  _relative_id UUID,
  _data_type TEXT,
  _access_level TEXT,
  _consent_verified BOOLEAN DEFAULT false
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
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
    current_setting('request.headers', true)::json ->> 'x-forwarded-for',
    current_setting('request.headers', true)::json ->> 'user-agent'
  );
END;
$$;

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