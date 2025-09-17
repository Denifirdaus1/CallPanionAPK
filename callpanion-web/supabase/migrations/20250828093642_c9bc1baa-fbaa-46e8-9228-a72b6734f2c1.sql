-- Fix the activate_trial_code function by renaming conflicting variable
CREATE OR REPLACE FUNCTION public.activate_trial_code(trial_code_text text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  trial_record record;
  user_id uuid;
  now_ts timestamptz := now();
BEGIN
  -- Get current user ID
  user_id := auth.uid();
  
  -- Validate user is authenticated
  IF user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
  END IF;
  
  -- Log the attempt for security monitoring
  INSERT INTO public.audit_log (actor_user_id, action, entity_type, details)
  VALUES (user_id, 'trial_code_activation_attempt', 'trial_codes', jsonb_build_object('code_provided', true));
  
  -- Find and validate the trial code (only active, unexpired codes)
  SELECT * INTO trial_record
  FROM public.trial_codes
  WHERE code = trial_code_text
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now_ts)
    AND (max_uses IS NULL OR current_uses < max_uses);
  
  -- Check if code exists and is valid
  IF trial_record.id IS NULL THEN
    -- Log failed attempt
    INSERT INTO public.audit_log (actor_user_id, action, entity_type, details)
    VALUES (user_id, 'trial_code_activation_failed', 'trial_codes', jsonb_build_object('reason', 'invalid_or_expired'));
    
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired trial code');
  END IF;
  
  -- Check if user already has an active trial/subscription
  IF EXISTS (
    SELECT 1 FROM public.subscriptions 
    WHERE user_id = auth.uid() 
      AND status IN ('active', 'trialing')
      AND (current_period_end IS NULL OR current_period_end > now_ts)
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'User already has an active subscription or trial');
  END IF;
  
  -- Check if user already activated this trial code
  IF EXISTS (
    SELECT 1 FROM public.trial_activations 
    WHERE user_id = auth.uid() 
      AND trial_code_id = trial_record.id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Trial code already used');
  END IF;
  
  -- Increment usage count
  UPDATE public.trial_codes
  SET 
    current_uses = COALESCE(current_uses, 0) + 1,
    updated_at = now_ts
  WHERE id = trial_record.id;
  
  -- Create trial activation record
  INSERT INTO public.trial_activations (
    user_id,
    trial_code_id,
    activated_at,
    expires_at,
    is_active
  ) VALUES (
    user_id,
    trial_record.id,
    now_ts,
    now_ts + (COALESCE(trial_record.trial_duration_days, 30) || ' days')::interval,
    true
  );
  
  -- Create or update user subscription with trial
  INSERT INTO public.subscriptions (
    user_id,
    status,
    trial_start,
    trial_end,
    current_period_start,
    current_period_end,
    created_at,
    updated_at
  ) VALUES (
    user_id,
    'trialing',
    now_ts,
    now_ts + (COALESCE(trial_record.trial_duration_days, 30) || ' days')::interval,
    now_ts,
    now_ts + (COALESCE(trial_record.trial_duration_days, 30) || ' days')::interval,
    now_ts,
    now_ts
  )
  ON CONFLICT (user_id) 
  DO UPDATE SET
    status = 'trialing',
    trial_start = now_ts,
    trial_end = now_ts + (COALESCE(trial_record.trial_duration_days, 30) || ' days')::interval,
    current_period_start = now_ts,
    current_period_end = now_ts + (COALESCE(trial_record.trial_duration_days, 30) || ' days')::interval,
    updated_at = now_ts;
  
  -- Create or update subscribers table entry
  INSERT INTO public.subscribers (
    user_id,
    email,
    stripe_customer_id,
    subscribed,
    subscription_tier,
    subscription_end,
    trial_end,
    updated_at
  ) VALUES (
    user_id,
    (SELECT email FROM auth.users WHERE id = user_id),
    null,
    false,
    'trial',
    null,
    now_ts + (COALESCE(trial_record.trial_duration_days, 30) || ' days')::interval,
    now_ts
  )
  ON CONFLICT (user_id) 
  DO UPDATE SET
    subscribed = false,
    subscription_tier = 'trial',
    trial_end = now_ts + (COALESCE(trial_record.trial_duration_days, 30) || ' days')::interval,
    updated_at = now_ts;
  
  -- Log successful activation
  INSERT INTO public.audit_log (actor_user_id, action, entity_type, entity_id, details)
  VALUES (
    user_id, 
    'trial_code_activated', 
    'trial_codes', 
    trial_record.id::text,
    jsonb_build_object(
      'trial_days', COALESCE(trial_record.trial_duration_days, 30),
      'code_description', trial_record.description
    )
  );
  
  RETURN jsonb_build_object(
    'success', true, 
    'trial_days', COALESCE(trial_record.trial_duration_days, 30),
    'trial_end', now_ts + (COALESCE(trial_record.trial_duration_days, 30) || ' days')::interval
  );
  
EXCEPTION WHEN OTHERS THEN
  -- Log error
  INSERT INTO public.audit_log (actor_user_id, action, entity_type, details)
  VALUES (user_id, 'trial_code_activation_error', 'trial_codes', jsonb_build_object('error', SQLERRM));
  
  RETURN jsonb_build_object('success', false, 'error', 'Trial code activation failed');
END;
$function$;

-- Create subscribers table to track subscription status
CREATE TABLE IF NOT EXISTS public.subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  email TEXT NOT NULL UNIQUE,
  stripe_customer_id TEXT,
  subscribed BOOLEAN NOT NULL DEFAULT false,
  subscription_tier TEXT,
  subscription_end TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.subscribers ENABLE ROW LEVEL SECURITY;

-- Create policy for users to view their own subscription info
CREATE POLICY "select_own_subscription" ON public.subscribers
FOR SELECT
USING (user_id = auth.uid() OR email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- Create policy for edge functions to update subscription info
CREATE POLICY "update_own_subscription" ON public.subscribers
FOR UPDATE
USING (user_id = auth.uid() OR is_service_role());

-- Create policy for edge functions to insert subscription info
CREATE POLICY "insert_subscription" ON public.subscribers
FOR INSERT
WITH CHECK (user_id = auth.uid() OR is_service_role());