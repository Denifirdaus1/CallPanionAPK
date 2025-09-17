-- Fix the activate_trial_code function to handle timestamp comparison correctly
CREATE OR REPLACE FUNCTION public.activate_trial_code(trial_code_text text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    updated_at = current_time
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
    current_time,
    current_time + (COALESCE(trial_record.trial_duration_days, 30) || ' days')::interval,
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
$function$;