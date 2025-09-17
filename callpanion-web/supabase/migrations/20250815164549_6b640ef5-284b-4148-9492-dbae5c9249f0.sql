-- Create secure invite acceptance function
CREATE OR REPLACE FUNCTION public.accept_invite_secure(
  invite_token text,
  gdpr_consent boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  invite_record record;
  current_user_email text;
BEGIN
  -- Get current user's email
  SELECT email INTO current_user_email FROM auth.users WHERE id = auth.uid();
  
  IF current_user_email IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
  END IF;

  -- Get and validate invite
  SELECT * INTO invite_record FROM public.invites 
  WHERE token = invite_token 
    AND email = current_user_email
    AND expires_at > now() 
    AND accepted_at IS NULL;
  
  IF invite_record.id IS NULL THEN
    -- Log failed attempt
    PERFORM log_security_event('invalid_invite_acceptance', jsonb_build_object(
      'token', invite_token,
      'user_email', current_user_email
    ));
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired invite');
  END IF;

  -- Update invite as accepted
  UPDATE public.invites 
  SET accepted_at = now(),
      gdpr_consent_status = gdpr_consent,
      gdpr_consent_timestamp = CASE WHEN gdpr_consent THEN now() ELSE NULL END
  WHERE id = invite_record.id;

  -- Add user to household
  INSERT INTO public.household_members (household_id, user_id, role, added_by)
  VALUES (invite_record.household_id, auth.uid(), invite_record.role::household_member_role, invite_record.invited_by);

  -- Log successful acceptance
  PERFORM log_security_event('invite_accepted_secure', jsonb_build_object(
    'household_id', invite_record.household_id,
    'role', invite_record.role
  ));

  RETURN jsonb_build_object(
    'success', true, 
    'household_id', invite_record.household_id,
    'role', invite_record.role
  );

EXCEPTION WHEN OTHERS THEN
  PERFORM log_security_event('invite_acceptance_error', jsonb_build_object(
    'error', SQLERRM,
    'token', invite_token
  ));
  RETURN jsonb_build_object('success', false, 'error', 'Invite acceptance failed');
END;
$$;

-- Create signed unsubscribe token function
CREATE OR REPLACE FUNCTION public.generate_unsubscribe_token(user_email text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  payload text;
  signature text;
BEGIN
  -- Create payload with email and timestamp
  payload := encode(
    convert_to(
      jsonb_build_object(
        'email', user_email,
        'exp', extract(epoch from (now() + interval '30 days'))
      )::text, 
      'utf8'
    ), 
    'base64'
  );
  
  -- Create simple signature using email + secret
  signature := encode(
    digest(payload || user_email || 'callpanion_unsubscribe_2024', 'sha256'), 
    'base64'
  );
  
  RETURN payload || '.' || signature;
END;
$$;

-- Create secure unsubscribe validation function
CREATE OR REPLACE FUNCTION public.validate_unsubscribe_token(token text)
RETURNS table(email text, is_valid boolean)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  parts text[];
  payload text;
  signature text;
  expected_signature text;
  decoded_payload jsonb;
  token_email text;
  expiry numeric;
BEGIN
  -- Split token
  parts := string_to_array(token, '.');
  
  IF array_length(parts, 1) != 2 THEN
    RETURN QUERY SELECT ''::text, false;
    RETURN;
  END IF;
  
  payload := parts[1];
  signature := parts[2];
  
  -- Decode payload first to get email
  BEGIN
    decoded_payload := convert_from(decode(payload, 'base64'), 'utf8')::jsonb;
    token_email := decoded_payload ->> 'email';
    expiry := (decoded_payload ->> 'exp')::numeric;
    
    -- Verify signature
    expected_signature := encode(
      digest(payload || token_email || 'callpanion_unsubscribe_2024', 'sha256'), 
      'base64'
    );
    
    IF signature != expected_signature THEN
      RETURN QUERY SELECT token_email, false;
      RETURN;
    END IF;
    
    -- Check expiry
    IF extract(epoch from now()) > expiry THEN
      RETURN QUERY SELECT token_email, false;
      RETURN;
    END IF;
    
    RETURN QUERY SELECT token_email, true;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT ''::text, false;
  END;
END;
$$;