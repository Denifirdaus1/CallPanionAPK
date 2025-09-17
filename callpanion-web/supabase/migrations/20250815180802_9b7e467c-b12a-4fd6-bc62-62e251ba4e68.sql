-- Enhanced Security Recommendations Implementation (Fixed)

-- 1. Check if consent_type exists, if not create it
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'consent_type') THEN
        CREATE TYPE public.consent_type AS ENUM (
          'HEALTH_DATA_ACCESS',
          'CALL_RECORDINGS_ACCESS', 
          'DETAILED_ANALYSIS_ACCESS',
          'EMERGENCY_CONTACT_ACCESS'
        );
    END IF;
END$$;

-- 2. Create health data consent table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.health_data_consents (
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

-- 3. Create health access level enum if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'health_access_level') THEN
        CREATE TYPE public.health_access_level AS ENUM (
          'FULL_ACCESS',     -- Can view all health data
          'SUMMARY_ONLY',    -- Can only view health summaries
          'NO_ACCESS'        -- Cannot view health data
        );
    END IF;
END$$;

-- Add health access level to household members if column doesn't exist
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

-- 4. Create enhanced audit logging for health data access
CREATE TABLE IF NOT EXISTS public.health_data_access_log (
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