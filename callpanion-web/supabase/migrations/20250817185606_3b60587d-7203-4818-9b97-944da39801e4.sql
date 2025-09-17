-- Update the generate_unsubscribe_token function to use the secret from environment
CREATE OR REPLACE FUNCTION public.generate_unsubscribe_token(user_email text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  payload text;
  signature text;
  secret_key text;
BEGIN
  -- Get the secret from environment (will be set via Supabase secrets)
  secret_key := current_setting('app.unsubscribe_secret', true);
  
  -- Fallback to a default if not set (should not happen in production)
  IF secret_key IS NULL OR secret_key = '' THEN
    secret_key := 'fallback_secret_change_me';
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
$function$;

-- Update the validate_unsubscribe_token function to use the same secret
CREATE OR REPLACE FUNCTION public.validate_unsubscribe_token(token text)
 RETURNS TABLE(email text, is_valid boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  
  -- Fallback to a default if not set (should not happen in production)
  IF secret_key IS NULL OR secret_key = '' THEN
    secret_key := 'fallback_secret_change_me';
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
$function$;