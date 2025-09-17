-- Fix search path security warnings

-- Update generate_unsubscribe_token function with proper search path
CREATE OR REPLACE FUNCTION public.generate_unsubscribe_token(user_email text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- Update validate_unsubscribe_token function with proper search path
CREATE OR REPLACE FUNCTION public.validate_unsubscribe_token(token text)
RETURNS table(email text, is_valid boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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