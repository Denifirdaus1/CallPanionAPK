-- Create trial codes table
CREATE TABLE public.trial_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  description TEXT,
  max_uses INTEGER DEFAULT 1,
  current_uses INTEGER DEFAULT 0,
  trial_duration_days INTEGER DEFAULT 7,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create trial activations table to track who used which codes
CREATE TABLE public.trial_activations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  trial_code_id UUID REFERENCES public.trial_codes(id) NOT NULL,
  activated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  UNIQUE(user_id, trial_code_id)
);

-- Enable RLS
ALTER TABLE public.trial_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trial_activations ENABLE ROW LEVEL SECURITY;

-- RLS policies for trial_codes
CREATE POLICY "Admins can manage trial codes" ON public.trial_codes
  FOR ALL USING (has_admin_access_with_mfa(auth.uid()));

CREATE POLICY "Users can view active trial codes" ON public.trial_codes
  FOR SELECT USING (is_active = true AND (expires_at IS NULL OR expires_at > now()));

-- RLS policies for trial_activations  
CREATE POLICY "Users can view their own trial activations" ON public.trial_activations
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own trial activations" ON public.trial_activations
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view all trial activations" ON public.trial_activations
  FOR ALL USING (has_admin_access_with_mfa(auth.uid()));

-- Function to activate a trial code
CREATE OR REPLACE FUNCTION public.activate_trial_code(trial_code_text TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  code_record trial_codes%ROWTYPE;
  activation_expires_at TIMESTAMP WITH TIME ZONE;
  result jsonb;
BEGIN
  -- Check if user is authenticated
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
  END IF;

  -- Find the trial code
  SELECT * INTO code_record 
  FROM trial_codes 
  WHERE code = trial_code_text 
    AND is_active = true 
    AND (expires_at IS NULL OR expires_at > now())
    AND current_uses < max_uses;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired trial code');
  END IF;

  -- Check if user already used this code
  IF EXISTS (
    SELECT 1 FROM trial_activations 
    WHERE user_id = auth.uid() AND trial_code_id = code_record.id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'You have already used this trial code');
  END IF;

  -- Calculate expiration
  activation_expires_at := now() + (code_record.trial_duration_days || ' days')::interval;

  -- Insert activation
  INSERT INTO trial_activations (user_id, trial_code_id, expires_at)
  VALUES (auth.uid(), code_record.id, activation_expires_at);

  -- Update usage count
  UPDATE trial_codes 
  SET current_uses = current_uses + 1,
      updated_at = now()
  WHERE id = code_record.id;

  RETURN jsonb_build_object(
    'success', true, 
    'expires_at', activation_expires_at,
    'trial_days', code_record.trial_duration_days
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', 'Failed to activate trial code');
END;
$$;