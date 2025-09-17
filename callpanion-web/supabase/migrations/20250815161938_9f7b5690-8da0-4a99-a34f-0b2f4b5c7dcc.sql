-- CRITICAL SECURITY FIXES FOR IDENTIFIED VULNERABILITIES

-- FIX 1: Secure household_members table - prevent privilege escalation
DROP POLICY IF EXISTS "household_members_insert_safe" ON public.household_members;
DROP POLICY IF EXISTS "Users can insert their own household membership" ON public.household_members;

-- Only allow invite acceptance or admin/household admin to add members
CREATE POLICY "household_members_secure_insert" ON public.household_members
FOR INSERT TO authenticated WITH CHECK (
  -- Option 1: Self-insertion only if there's a valid invite
  (user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.invites i 
    WHERE i.household_id = household_members.household_id 
      AND i.email = (SELECT email FROM auth.users WHERE id = auth.uid())
      AND i.expires_at > now() 
      AND i.accepted_at IS NULL
  )) OR
  -- Option 2: Household admin can add members
  app_is_household_admin(household_id) OR
  -- Option 3: Super admin with MFA
  has_admin_access_with_mfa(auth.uid())
);

-- FIX 2: Secure invites table - prevent unauthorized invite acceptance
DROP POLICY IF EXISTS "invites_update_limited" ON public.invites;

CREATE POLICY "invites_secure_update" ON public.invites
FOR UPDATE TO authenticated USING (
  -- Only allow updating your own invite (by email match) or household admin
  (email = (SELECT email FROM auth.users WHERE id = auth.uid()) AND expires_at > now()) OR
  app_is_household_admin(household_id) OR
  has_admin_access_with_mfa(auth.uid())
) WITH CHECK (
  -- Same check for the updated data
  (email = (SELECT email FROM auth.users WHERE id = auth.uid()) AND expires_at > now()) OR
  app_is_household_admin(household_id) OR
  has_admin_access_with_mfa(auth.uid())
);

-- FIX 3: Secure security_events table - only service role should insert
DROP POLICY IF EXISTS "System can insert security events" ON public.security_events;

CREATE POLICY "service_role_only_insert_security_events" ON public.security_events
FOR INSERT WITH CHECK (is_service_role());

-- FIX 4: Tighten waitlist policies - prevent unauthorized updates
DROP POLICY IF EXISTS "Admins can update waitlist" ON public.waitlist;

CREATE POLICY "waitlist_super_admin_mfa_only" ON public.waitlist
FOR ALL TO authenticated USING (
  is_super_admin(auth.uid()) AND has_admin_access_with_mfa(auth.uid())
);

-- FIX 5: Create secure invite acceptance function
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
  result jsonb;
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

-- FIX 6: Create signed unsubscribe token function
CREATE OR REPLACE FUNCTION public.generate_unsubscribe_token(user_email text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  secret_key text := 'unsubscribe_secret_' || current_setting('app.settings.jwt_secret', true);
  payload text;
  signature text;
BEGIN
  -- Create payload with email and expiry
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
  
  -- Create signature (simplified - in production use proper HMAC)
  signature := encode(
    digest(payload || secret_key, 'sha256'), 
    'base64'
  );
  
  RETURN payload || '.' || signature;
END;
$$;

-- FIX 7: Create secure unsubscribe validation function
CREATE OR REPLACE FUNCTION public.validate_unsubscribe_token(token text)
RETURNS table(email text, is_valid boolean)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  secret_key text := 'unsubscribe_secret_' || current_setting('app.settings.jwt_secret', true);
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
  
  -- Verify signature
  expected_signature := encode(
    digest(payload || secret_key, 'sha256'), 
    'base64'
  );
  
  IF signature != expected_signature THEN
    RETURN QUERY SELECT ''::text, false;
    RETURN;
  END IF;
  
  -- Decode payload
  BEGIN
    decoded_payload := convert_from(decode(payload, 'base64'), 'utf8')::jsonb;
    token_email := decoded_payload ->> 'email';
    expiry := (decoded_payload ->> 'exp')::numeric;
    
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