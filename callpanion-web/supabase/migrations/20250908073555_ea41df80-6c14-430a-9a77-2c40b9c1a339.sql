-- Create call_sessions table for WebRTC in-app calls
CREATE TABLE IF NOT EXISTS public.call_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id UUID NOT NULL,
  relative_id UUID NOT NULL,
  room_id TEXT,
  room_url TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled', -- scheduled, ringing, active, ended, missed, failed
  call_type TEXT NOT NULL DEFAULT 'in_app_call',
  provider TEXT NOT NULL DEFAULT 'webrtc',
  scheduled_time TIMESTAMP WITH TIME ZONE NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  duration_seconds INTEGER,
  participant_count INTEGER DEFAULT 0,
  call_log_id UUID, -- Reference to call_logs entry
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create pairing_tokens table for device pairing
CREATE TABLE IF NOT EXISTS public.pairing_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id UUID NOT NULL,
  relative_id UUID,
  token_6_digit TEXT NOT NULL UNIQUE,
  device_info JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending', -- pending, used, expired
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '24 hours'),
  used_at TIMESTAMP WITH TIME ZONE,
  used_by_device_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL
);

-- Add push token columns to devices table if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'devices' AND column_name = 'push_token') THEN
    ALTER TABLE public.devices ADD COLUMN push_token TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'devices' AND column_name = 'platform') THEN
    ALTER TABLE public.devices ADD COLUMN platform TEXT; -- 'android' or 'ios'
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'devices' AND column_name = 'push_token_updated_at') THEN
    ALTER TABLE public.devices ADD COLUMN push_token_updated_at TIMESTAMP WITH TIME ZONE;
  END IF;
END $$;

-- Add call_method_preference to households if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'households' AND column_name = 'call_method_preference') THEN
    ALTER TABLE public.households ADD COLUMN call_method_preference TEXT DEFAULT 'batch_call' CHECK (call_method_preference IN ('batch_call', 'in_app_call'));
  END IF;
END $$;

-- Add call_type to schedules if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schedules' AND column_name = 'call_type') THEN
    ALTER TABLE public.schedules ADD COLUMN call_type TEXT DEFAULT 'batch_call' CHECK (call_type IN ('batch_call', 'in_app_call'));
  END IF;
END $$;

-- Ensure call_logs.call_type exists and has proper constraint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'call_logs' AND column_name = 'call_type') THEN
    ALTER TABLE public.call_logs ADD COLUMN call_type TEXT DEFAULT 'batch_call';
  END IF;
  
  -- Update constraint to include in_app_call
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name LIKE '%call_type%' AND table_name = 'call_logs') THEN
    ALTER TABLE public.call_logs DROP CONSTRAINT IF EXISTS call_logs_call_type_check;
  END IF;
  
  ALTER TABLE public.call_logs ADD CONSTRAINT call_logs_call_type_check CHECK (call_type IN ('batch_call', 'in_app_call'));
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_call_sessions_household_relative ON public.call_sessions(household_id, relative_id);
CREATE INDEX IF NOT EXISTS idx_call_sessions_status_scheduled_time ON public.call_sessions(status, scheduled_time);
CREATE INDEX IF NOT EXISTS idx_call_sessions_call_type ON public.call_sessions(call_type);

CREATE INDEX IF NOT EXISTS idx_pairing_tokens_token ON public.pairing_tokens(token_6_digit);
CREATE INDEX IF NOT EXISTS idx_pairing_tokens_household ON public.pairing_tokens(household_id);
CREATE INDEX IF NOT EXISTS idx_pairing_tokens_status_expires ON public.pairing_tokens(status, expires_at);

CREATE INDEX IF NOT EXISTS idx_devices_push_token ON public.devices(push_token) WHERE push_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_devices_platform ON public.devices(platform) WHERE platform IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_households_call_method ON public.households(call_method_preference);
CREATE INDEX IF NOT EXISTS idx_schedules_call_type_active ON public.schedules(call_type, active);
CREATE INDEX IF NOT EXISTS idx_call_logs_call_type_timestamp ON public.call_logs(call_type, timestamp);

-- Create trigger for updating updated_at timestamp
CREATE OR REPLACE FUNCTION update_call_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_call_sessions_updated_at_trigger ON public.call_sessions;
CREATE TRIGGER update_call_sessions_updated_at_trigger
  BEFORE UPDATE ON public.call_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_call_sessions_updated_at();

-- Enable RLS on new tables
ALTER TABLE public.call_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pairing_tokens ENABLE ROW LEVEL SECURITY;

-- RLS policies for call_sessions
CREATE POLICY "Household members can view their call sessions" 
  ON public.call_sessions 
  FOR SELECT 
  USING (app_is_household_member(household_id));

CREATE POLICY "Service role can manage call sessions" 
  ON public.call_sessions 
  FOR ALL 
  USING (is_service_role())
  WITH CHECK (is_service_role());

-- RLS policies for pairing_tokens  
CREATE POLICY "Household admins can manage pairing tokens" 
  ON public.pairing_tokens 
  FOR ALL 
  USING (app_is_household_admin(household_id))
  WITH CHECK (app_is_household_admin(household_id));

CREATE POLICY "Service role can manage pairing tokens" 
  ON public.pairing_tokens 
  FOR ALL 
  USING (is_service_role())
  WITH CHECK (is_service_role());

-- Public access for device pairing (limited)
CREATE POLICY "Public can read valid pairing tokens" 
  ON public.pairing_tokens 
  FOR SELECT 
  USING (status = 'pending' AND expires_at > now());

-- Add foreign key constraints where appropriate
ALTER TABLE public.call_sessions 
  ADD CONSTRAINT fk_call_sessions_household 
  FOREIGN KEY (household_id) REFERENCES public.households(id) ON DELETE CASCADE;

ALTER TABLE public.call_sessions 
  ADD CONSTRAINT fk_call_sessions_relative 
  FOREIGN KEY (relative_id) REFERENCES public.relatives(id) ON DELETE CASCADE;

ALTER TABLE public.call_sessions 
  ADD CONSTRAINT fk_call_sessions_call_log 
  FOREIGN KEY (call_log_id) REFERENCES public.call_logs(id) ON DELETE SET NULL;

ALTER TABLE public.pairing_tokens 
  ADD CONSTRAINT fk_pairing_tokens_household 
  FOREIGN KEY (household_id) REFERENCES public.households(id) ON DELETE CASCADE;

ALTER TABLE public.pairing_tokens 
  ADD CONSTRAINT fk_pairing_tokens_relative 
  FOREIGN KEY (relative_id) REFERENCES public.relatives(id) ON DELETE SET NULL;