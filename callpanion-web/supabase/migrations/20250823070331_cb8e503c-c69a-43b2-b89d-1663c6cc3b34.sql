-- Update the accept_invite_secure_v2 function to handle permissions metadata
CREATE OR REPLACE FUNCTION public.accept_invite_secure_v2(invite_token text, gdpr_consent boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'auth'
AS $$
DECLARE
  invite_record record;
  current_user_email text;
  household_name text;
  health_access_level public.health_access_level;
BEGIN
  -- Get current user's email
  SELECT email INTO current_user_email FROM auth.users WHERE id = auth.uid();
  
  IF current_user_email IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
  END IF;

  -- Get and validate invite with comprehensive checks
  SELECT 
    i.*,
    h.name as household_name
  INTO invite_record 
  FROM public.invites i
  JOIN public.households h ON h.id = i.household_id
  WHERE i.token = invite_token 
    AND i.email = current_user_email
    AND i.expires_at > now() 
    AND i.accepted_at IS NULL;
  
  IF invite_record.id IS NULL THEN
    -- Log security event for failed attempt
    INSERT INTO public.security_events (user_id, event_type, details)
    VALUES (auth.uid(), 'invalid_invite_acceptance', jsonb_build_object(
      'token_provided', true,
      'user_email', current_user_email,
      'timestamp', now()
    ));
    
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired invite');
  END IF;

  -- Check if user is already a member
  IF EXISTS (
    SELECT 1 FROM public.household_members 
    WHERE household_id = invite_record.household_id 
      AND user_id = auth.uid()
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already a household member');
  END IF;

  -- Determine health access level from permissions metadata
  health_access_level := 'SUMMARY_ONLY'; -- Default
  IF invite_record.permissions_metadata IS NOT NULL THEN
    IF (invite_record.permissions_metadata->>'viewHealthInsights')::boolean = true THEN
      health_access_level := 'FULL_ACCESS';
    END IF;
  END IF;

  -- Update invite as accepted (atomic transaction)
  UPDATE public.invites 
  SET 
    accepted_at = now(),
    gdpr_consent_status = gdpr_consent,
    gdpr_consent_timestamp = CASE WHEN gdpr_consent THEN now() ELSE NULL END
  WHERE id = invite_record.id;

  -- Add user to household with proper permissions
  INSERT INTO public.household_members (household_id, user_id, role, added_by, health_access_level)
  VALUES (
    invite_record.household_id, 
    auth.uid(), 
    invite_record.role::household_member_role, 
    invite_record.invited_by,
    health_access_level
  );

  -- Log successful acceptance
  INSERT INTO public.security_events (user_id, event_type, details)
  VALUES (auth.uid(), 'invite_accepted_secure', jsonb_build_object(
    'household_id', invite_record.household_id,
    'role', invite_record.role,
    'household_name', invite_record.household_name,
    'health_access_level', health_access_level,
    'permissions_metadata', invite_record.permissions_metadata
  ));

  RETURN jsonb_build_object(
    'success', true, 
    'household_id', invite_record.household_id,
    'household_name', invite_record.household_name,
    'role', invite_record.role,
    'health_access_level', health_access_level
  );

EXCEPTION WHEN OTHERS THEN
  -- Log error
  INSERT INTO public.security_events (user_id, event_type, details)
  VALUES (auth.uid(), 'invite_acceptance_error', jsonb_build_object(
    'error', SQLERRM,
    'token_provided', true
  ));
  
  RETURN jsonb_build_object('success', false, 'error', 'Invite acceptance failed');
END;
$$;