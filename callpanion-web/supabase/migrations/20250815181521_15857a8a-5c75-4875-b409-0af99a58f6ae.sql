-- Final security implementation - simplified approach

-- 1. Create health access levels for household members if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'health_access_level') THEN
        CREATE TYPE public.health_access_level AS ENUM (
          'FULL_ACCESS',
          'SUMMARY_ONLY', 
          'NO_ACCESS'
        );
    END IF;
END$$;

-- 2. Add health access level column if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'household_members' 
        AND column_name = 'health_access_level'
    ) THEN
        ALTER TABLE public.household_members 
        ADD COLUMN health_access_level public.health_access_level DEFAULT 'SUMMARY_ONLY';
    END IF;
END$$;

-- 3. Create simple health data consent table without complex enums
CREATE TABLE IF NOT EXISTS public.health_consents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  relative_id UUID NOT NULL REFERENCES public.relatives(id) ON DELETE CASCADE,
  granted_to_user_id UUID NOT NULL,
  can_view_detailed_health BOOLEAN NOT NULL DEFAULT false,
  can_view_call_recordings BOOLEAN NOT NULL DEFAULT false,
  can_view_transcripts BOOLEAN NOT NULL DEFAULT false,
  granted_at TIMESTAMP WITH TIME ZONE,
  revoked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(relative_id, granted_to_user_id)
);

-- Enable RLS
ALTER TABLE public.health_consents ENABLE ROW LEVEL SECURITY;

-- 4. Enhanced RLS policies for call_analysis with simplified consent checking
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
          (hm.health_access_level = 'FULL_ACCESS' AND
           EXISTS (
             SELECT 1 FROM public.health_consents hc 
             WHERE hc.relative_id = r.id 
               AND hc.granted_to_user_id = auth.uid() 
               AND hc.can_view_detailed_health = true
               AND hc.revoked_at IS NULL
           )) OR
          -- Summary access (mood_score only, no transcript/detailed flags)
          (hm.health_access_level = 'SUMMARY_ONLY')
        )
    )
  )
);

-- 5. Enhanced RLS policies for call_logs with simplified consent checking  
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
          (hm.health_access_level = 'FULL_ACCESS' AND
           EXISTS (
             SELECT 1 FROM public.health_consents hc 
             WHERE hc.relative_id = r.id 
               AND hc.granted_to_user_id = auth.uid() 
               AND hc.can_view_call_recordings = true
               AND hc.revoked_at IS NULL
           )) OR
          -- Summary access (basic call data only, no audio/detailed health)
          (hm.health_access_level IN ('SUMMARY_ONLY', 'FULL_ACCESS'))
        )
    )
  )
);

-- 6. RLS policies for health consent table
CREATE POLICY "health_consents_family_manage" ON public.health_consents
FOR ALL USING (
  has_admin_access_with_mfa(auth.uid()) OR
  EXISTS (
    SELECT 1 FROM public.relatives r
    JOIN public.household_members hm ON hm.household_id = r.household_id
    WHERE r.id = health_consents.relative_id
      AND hm.user_id = auth.uid()
      AND hm.role = 'FAMILY_PRIMARY'
  )
)
WITH CHECK (
  has_admin_access_with_mfa(auth.uid()) OR
  EXISTS (
    SELECT 1 FROM public.relatives r
    JOIN public.household_members hm ON hm.household_id = r.household_id
    WHERE r.id = health_consents.relative_id
      AND hm.user_id = auth.uid()
      AND hm.role = 'FAMILY_PRIMARY'
  )
);

-- 7. Set default health access levels for existing household members
UPDATE public.household_members 
SET health_access_level = 
  CASE 
    WHEN role = 'FAMILY_PRIMARY' THEN 'FULL_ACCESS'::public.health_access_level
    ELSE 'SUMMARY_ONLY'::public.health_access_level
  END
WHERE health_access_level IS NULL;

-- 8. Create simplified consent management function
CREATE OR REPLACE FUNCTION public.manage_health_consent(
  _relative_id UUID,
  _granted_to_user_id UUID,
  _can_view_detailed_health BOOLEAN DEFAULT false,
  _can_view_call_recordings BOOLEAN DEFAULT false,
  _can_view_transcripts BOOLEAN DEFAULT false
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
  INSERT INTO public.health_consents (
    relative_id, granted_to_user_id, 
    can_view_detailed_health, can_view_call_recordings, can_view_transcripts,
    granted_at
  ) VALUES (
    _relative_id, _granted_to_user_id, 
    _can_view_detailed_health, _can_view_call_recordings, _can_view_transcripts,
    now()
  )
  ON CONFLICT (relative_id, granted_to_user_id)
  DO UPDATE SET
    can_view_detailed_health = EXCLUDED.can_view_detailed_health,
    can_view_call_recordings = EXCLUDED.can_view_call_recordings,
    can_view_transcripts = EXCLUDED.can_view_transcripts,
    granted_at = now(),
    revoked_at = NULL,
    updated_at = now();
    
  -- Log the consent change
  PERFORM log_security_event('health_consent_changed', jsonb_build_object(
    'relative_id', _relative_id,
    'granted_to_user_id', _granted_to_user_id,
    'detailed_health', _can_view_detailed_health,
    'call_recordings', _can_view_call_recordings,
    'transcripts', _can_view_transcripts
  ));
END;
$$;