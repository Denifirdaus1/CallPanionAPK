-- Fix critical security vulnerability: Remove public access to trial codes
-- Drop the vulnerable policy that allows public access to trial codes
DROP POLICY IF EXISTS "Users can view active trial codes" ON public.trial_codes;

-- Create a more secure policy that only allows authenticated users to validate codes they're trying to use
-- This policy will be used by the activate_trial_code RPC function internally
CREATE POLICY "Service can validate trial codes" 
ON public.trial_codes 
FOR SELECT 
USING (is_service_role());

-- Remove the overly permissive authenticated user policy as well for security
DROP POLICY IF EXISTS "Users can validate trial codes" ON public.trial_codes;

-- Update the activate_trial_code RPC function to be more secure
CREATE OR REPLACE FUNCTION public.activate_trial_code(trial_code_text text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  trial_record record;
  user_id uuid;
  current_time timestamptz := now();
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
    AND (expires_at IS NULL OR expires_at > current_time)
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
      AND (current_period_end IS NULL OR current_period_end > current_time)
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'User already has an active subscription or trial');
  END IF;
  
  -- Increment usage count
  UPDATE public.trial_codes
  SET 
    current_uses = COALESCE(current_uses, 0) + 1,
    updated_at = current_time
  WHERE id = trial_record.id;
  
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
    current_time,
    current_time + (COALESCE(trial_record.trial_duration_days, 30) || ' days')::interval,
    current_time,
    current_time + (COALESCE(trial_record.trial_duration_days, 30) || ' days')::interval,
    current_time,
    current_time
  )
  ON CONFLICT (user_id) 
  DO UPDATE SET
    status = 'trialing',
    trial_start = current_time,
    trial_end = current_time + (COALESCE(trial_record.trial_duration_days, 30) || ' days')::interval,
    current_period_start = current_time,
    current_period_end = current_time + (COALESCE(trial_record.trial_duration_days, 30) || ' days')::interval,
    updated_at = current_time;
  
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
    'trial_end', current_time + (COALESCE(trial_record.trial_duration_days, 30) || ' days')::interval
  );
  
EXCEPTION WHEN OTHERS THEN
  -- Log error
  INSERT INTO public.audit_log (actor_user_id, action, entity_type, details)
  VALUES (user_id, 'trial_code_activation_error', 'trial_codes', jsonb_build_object('error', SQLERRM));
  
  RETURN jsonb_build_object('success', false, 'error', 'Trial code activation failed');
END;
$$;