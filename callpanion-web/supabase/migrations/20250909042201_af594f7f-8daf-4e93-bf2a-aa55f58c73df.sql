-- Create elder schema and tables for Flutter app integration
CREATE SCHEMA IF NOT EXISTS elder;

-- Pairing tokens for device setup
CREATE TABLE IF NOT EXISTS elder.pairing_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  code_6 TEXT NOT NULL,
  pair_token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  claimed_by_device_id UUID,
  claimed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Elder devices (Flutter apps)
CREATE TABLE IF NOT EXISTS elder.devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT 'Elder Device',
  device_fingerprint TEXT,
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'paired' CHECK (status IN ('paired', 'active', 'inactive')),
  last_seen_at TIMESTAMP WITH TIME ZONE,
  push_token TEXT, -- For FCM/APNS notifications
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add RLS policies
ALTER TABLE elder.pairing_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE elder.devices ENABLE ROW LEVEL SECURITY;

-- Pairing tokens policies
CREATE POLICY "Users can manage pairing tokens for their households" ON elder.pairing_tokens
  USING (EXISTS (
    SELECT 1 FROM public.household_members hm 
    WHERE hm.household_id = elder.pairing_tokens.household_id 
    AND hm.user_id = auth.uid()
    AND hm.role = 'FAMILY_PRIMARY'
  ));

-- Devices policies  
CREATE POLICY "Users can view devices for their households" ON elder.devices
  USING (EXISTS (
    SELECT 1 FROM public.household_members hm 
    WHERE hm.household_id = elder.devices.household_id 
    AND hm.user_id = auth.uid()
  ));

CREATE POLICY "Device users can update their own device" ON elder.devices
  FOR UPDATE USING (user_id = auth.uid());

-- Create function to generate 6-digit pairing codes
CREATE OR REPLACE FUNCTION elder.generate_pairing_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN LPAD((FLOOR(RANDOM() * 900000) + 100000)::TEXT, 6, '0');
END;
$$;

-- Update triggers
CREATE TRIGGER elder_devices_updated_at
  BEFORE UPDATE ON elder.devices
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_elder_pairing_tokens_code_token ON elder.pairing_tokens(code_6, pair_token);
CREATE INDEX IF NOT EXISTS idx_elder_pairing_tokens_household ON elder.pairing_tokens(household_id);
CREATE INDEX IF NOT EXISTS idx_elder_devices_household ON elder.devices(household_id);
CREATE INDEX IF NOT EXISTS idx_elder_devices_user ON elder.devices(user_id);