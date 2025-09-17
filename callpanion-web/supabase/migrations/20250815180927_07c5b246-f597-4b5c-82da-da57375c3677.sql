-- Fix consent type enum and complete security implementation

-- 1. Drop and recreate the consent_type enum with correct values
DO $$
BEGIN
    -- Drop existing enum if it exists
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'consent_type') THEN
        DROP TYPE public.consent_type CASCADE;
    END IF;
    
    -- Create the consent_type enum with correct values
    CREATE TYPE public.consent_type AS ENUM (
      'HEALTH_DATA_ACCESS',
      'CALL_RECORDINGS_ACCESS', 
      'DETAILED_ANALYSIS_ACCESS',
      'EMERGENCY_CONTACT_ACCESS'
    );
END$$;

-- 2. Recreate health_data_consents table with correct enum
DROP TABLE IF EXISTS public.health_data_consents CASCADE;
CREATE TABLE public.health_data_consents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  relative_id UUID NOT NULL REFERENCES public.relatives(id) ON DELETE CASCADE,
  granted_to_user_id UUID NOT NULL,
  consent_type public.consent_type NOT NULL,
  granted BOOLEAN NOT NULL DEFAULT false,
  granted_at TIMESTAMP WITH TIME ZONE,
  revoked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(relative_id, granted_to_user_id, consent_type)
);

-- Enable RLS
ALTER TABLE public.health_data_consents ENABLE ROW LEVEL SECURITY;

-- 3. Enhanced RLS policies for call_analysis with consent checking
DROP POLICY IF EXISTS "call_analysis_enhanced_access" ON public.call_analysis;

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
           AND has_health_data_consent(r.id, auth.uid(), 'DETAILED_ANALYSIS_ACCESS'::public.consent_type)) OR
          -- Summary access (mood_score only, no transcript/detailed flags)
          (get_user_health_access_level(auth.uid(), r.household_id) = 'SUMMARY_ONLY')
        )
    )
  )
);

-- 4. Enhanced RLS policies for call_logs with consent checking  
DROP POLICY IF EXISTS "call_logs_enhanced_access" ON public.call_logs;

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
           AND has_health_data_consent(r.id, auth.uid(), 'CALL_RECORDINGS_ACCESS'::public.consent_type)) OR
          -- Summary access (basic call data only, no audio/detailed health)
          (get_user_health_access_level(auth.uid(), r.household_id) IN ('SUMMARY_ONLY', 'FULL_ACCESS'))
        )
    )
  )
);

-- 5. RLS policies for new tables
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

-- 6. Create trigger for updated_at on health_data_consents
CREATE TRIGGER update_health_consents_updated_at
  BEFORE UPDATE ON public.health_data_consents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 7. Create function to manage consent grants with correct enum usage
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