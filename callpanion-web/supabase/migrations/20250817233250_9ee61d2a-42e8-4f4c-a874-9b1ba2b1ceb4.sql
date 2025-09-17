-- Security Fix 1: Prevent unauthorized role changes on profiles table
-- This trigger ensures only admins with MFA can change user roles
CREATE OR REPLACE FUNCTION public.prevent_unauthorized_role_changes()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow if user is updating their own non-role fields
  IF OLD.role = NEW.role THEN
    RETURN NEW;
  END IF;
  
  -- Only allow role changes by admins with MFA
  IF NOT has_admin_access_with_mfa(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized role modification attempt';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

-- Apply the trigger to profiles table
DROP TRIGGER IF EXISTS prevent_role_escalation ON public.profiles;
CREATE TRIGGER prevent_role_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_unauthorized_role_changes();

-- Security Fix 2: Fix unsubscribe token secret fallback
-- Update the generate_unsubscribe_token function to not use fallback secrets
CREATE OR REPLACE FUNCTION public.generate_unsubscribe_token(user_email text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  payload text;
  signature text;
  secret_key text;
BEGIN
  -- Get the secret from environment (will be set via Supabase secrets)
  secret_key := current_setting('app.unsubscribe_secret', true);
  
  -- Throw error if secret is not set - no fallback for security
  IF secret_key IS NULL OR secret_key = '' THEN
    RAISE EXCEPTION 'Unsubscribe secret not configured - contact administrator';
  END IF;
  
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
  
  -- Create signature using email + secret from environment
  signature := encode(
    digest(payload || user_email || secret_key, 'sha256'), 
    'base64'
  );
  
  RETURN payload || '.' || signature;
END;
$$;

-- Update the validate_unsubscribe_token function similarly
CREATE OR REPLACE FUNCTION public.validate_unsubscribe_token(token text)
RETURNS TABLE(email text, is_valid boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  parts text[];
  payload text;
  signature text;
  expected_signature text;
  decoded_payload jsonb;
  token_email text;
  expiry numeric;
  secret_key text;
BEGIN
  -- Get the secret from environment
  secret_key := current_setting('app.unsubscribe_secret', true);
  
  -- Throw error if secret is not set - no fallback for security
  IF secret_key IS NULL OR secret_key = '' THEN
    RAISE EXCEPTION 'Unsubscribe secret not configured - contact administrator';
  END IF;
  
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
    
    -- Verify signature using the secret from environment
    expected_signature := encode(
      digest(payload || token_email || secret_key, 'sha256'), 
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