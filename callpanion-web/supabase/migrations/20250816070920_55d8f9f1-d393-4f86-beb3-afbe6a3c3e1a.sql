-- Phase 1: Create new schemas and tables for CallPanion pairing system

-- Create new schemas
CREATE SCHEMA IF NOT EXISTS core;
CREATE SCHEMA IF NOT EXISTS elder;
CREATE SCHEMA IF NOT EXISTS calls;
CREATE SCHEMA IF NOT EXISTS media;
CREATE SCHEMA IF NOT EXISTS ops;

-- Create ops.leads table for marketing site
CREATE TABLE ops.leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT,
  source TEXT DEFAULT 'website',
  gdpr_marketing_consent BOOLEAN NOT NULL DEFAULT false,
  gdpr_consent_text TEXT,
  confirmed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ip_hash TEXT,
  user_agent TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT
);

-- Create unique index on email
CREATE UNIQUE INDEX idx_leads_email ON ops.leads(email);
CREATE INDEX idx_leads_created_at ON ops.leads(created_at);
CREATE INDEX idx_leads_confirmed_at ON ops.leads(confirmed_at);

-- Enable RLS on ops.leads
ALTER TABLE ops.leads ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Insert-only for public (via Edge Function), admin read
CREATE POLICY "Public can insert leads via Edge Function" 
ON ops.leads 
FOR INSERT 
WITH CHECK (true); -- Edge Function will handle validation

CREATE POLICY "Admins can read leads" 
ON ops.leads 
FOR SELECT 
USING (has_admin_access_with_mfa(auth.uid()));

-- Create elder.pairing_tokens table
CREATE TABLE elder.pairing_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id UUID NOT NULL,
  code_6 TEXT NOT NULL UNIQUE,
  pair_token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_by UUID NOT NULL,
  claimed_by_device_id UUID,
  claimed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_pairing_tokens_household_id ON elder.pairing_tokens(household_id);
CREATE INDEX idx_pairing_tokens_expires_at ON elder.pairing_tokens(expires_at);
CREATE INDEX idx_pairing_tokens_code_6 ON elder.pairing_tokens(code_6);
CREATE INDEX idx_pairing_tokens_pair_token ON elder.pairing_tokens(pair_token);

-- Enable RLS on elder.pairing_tokens
ALTER TABLE elder.pairing_tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policies for pairing_tokens
CREATE POLICY "Family admins can manage pairing tokens for their household" 
ON elder.pairing_tokens 
FOR ALL 
USING (
  app_is_household_admin(household_id) AND 
  created_by = auth.uid()
)
WITH CHECK (
  app_is_household_admin(household_id) AND 
  created_by = auth.uid()
);

CREATE POLICY "Service role can claim pairing tokens" 
ON elder.pairing_tokens 
FOR UPDATE 
USING (is_service_role())
WITH CHECK (is_service_role());

-- Create elder.devices table (extending existing devices concept)
CREATE TABLE elder.devices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id UUID NOT NULL,
  display_name TEXT NOT NULL DEFAULT 'Elder Device',
  device_fingerprint TEXT,
  last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'paired', 'unpaired')),
  app_version TEXT,
  locale TEXT DEFAULT 'en-GB',
  user_id UUID, -- Will be set when device is paired to an auth user
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_elder_devices_household_id ON elder.devices(household_id);
CREATE INDEX idx_elder_devices_last_seen_at ON elder.devices(last_seen_at);
CREATE INDEX idx_elder_devices_user_id ON elder.devices(user_id);

-- Enable RLS on elder.devices
ALTER TABLE elder.devices ENABLE ROW LEVEL SECURITY;

-- RLS Policies for elder.devices
CREATE POLICY "Household members can read devices" 
ON elder.devices 
FOR SELECT 
USING (app_is_household_member(household_id));

CREATE POLICY "Family admins can manage devices" 
ON elder.devices 
FOR ALL 
USING (app_is_household_admin(household_id))
WITH CHECK (app_is_household_admin(household_id));

CREATE POLICY "Devices can update their own status" 
ON elder.devices 
FOR UPDATE 
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Add foreign key constraints
ALTER TABLE elder.pairing_tokens 
ADD CONSTRAINT fk_pairing_tokens_household 
FOREIGN KEY (household_id) REFERENCES public.households(id) ON DELETE CASCADE;

ALTER TABLE elder.pairing_tokens 
ADD CONSTRAINT fk_pairing_tokens_created_by 
FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE elder.devices 
ADD CONSTRAINT fk_elder_devices_household 
FOREIGN KEY (household_id) REFERENCES public.households(id) ON DELETE CASCADE;

-- Add update triggers for updated_at columns
CREATE TRIGGER update_ops_leads_updated_at
  BEFORE UPDATE ON ops.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_elder_pairing_tokens_updated_at
  BEFORE UPDATE ON elder.pairing_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_elder_devices_updated_at
  BEFORE UPDATE ON elder.devices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create a function to generate secure 6-digit codes
CREATE OR REPLACE FUNCTION elder.generate_pairing_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  code TEXT;
  attempts INTEGER := 0;
  max_attempts INTEGER := 10;
BEGIN
  LOOP
    -- Generate 6-digit code
    code := LPAD((RANDOM() * 999999)::INTEGER::TEXT, 6, '0');
    
    -- Check if code is unique and not expired
    IF NOT EXISTS (
      SELECT 1 FROM elder.pairing_tokens 
      WHERE code_6 = code 
      AND expires_at > now()
    ) THEN
      RETURN code;
    END IF;
    
    attempts := attempts + 1;
    IF attempts >= max_attempts THEN
      RAISE EXCEPTION 'Unable to generate unique pairing code after % attempts', max_attempts;
    END IF;
  END LOOP;
END;
$$;