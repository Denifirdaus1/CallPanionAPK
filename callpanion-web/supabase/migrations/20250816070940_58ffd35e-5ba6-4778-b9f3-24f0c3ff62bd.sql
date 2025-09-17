-- Fix security warning: Set search_path for elder.generate_pairing_code function
CREATE OR REPLACE FUNCTION elder.generate_pairing_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = elder, public
AS $$
DECLARE
  code TEXT;
  attempts INTEGER := 0;
  max_attempts INTEGER := 10;
BEGIN
  LOOP
    -- Generate 6-digit code
    code := LPAD((RANDOM() * 999999)::INTEGER::TEXT, 6, '0');
    
    -- Check if code is unique and not expired
    IF NOT EXISTS (
      SELECT 1 FROM elder.pairing_tokens 
      WHERE code_6 = code 
      AND expires_at > now()
    ) THEN
      RETURN code;
    END IF;
    
    attempts := attempts + 1;
    IF attempts >= max_attempts THEN
      RAISE EXCEPTION 'Unable to generate unique pairing code after % attempts', max_attempts;
    END IF;
  END LOOP;
END;
$$;