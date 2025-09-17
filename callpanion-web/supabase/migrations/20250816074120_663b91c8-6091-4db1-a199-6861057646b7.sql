-- Update validate_origin_and_log function to allow *.callpanion.co.uk subdomains
CREATE OR REPLACE FUNCTION public.validate_origin_and_log(_endpoint text, _origin text, _ip_address text, _user_agent text, _request_data jsonb DEFAULT '{}'::jsonb)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  allowed_origins text[] := ARRAY[
    'https://umjtepmdwfyfhdzbkyli.supabase.co',
    'https://loving-goldfinch-e42fd2.lovableproject.com',
    'https://callpanion.co.uk',
    'https://www.callpanion.co.uk'
  ];
  is_allowed boolean := false;
  log_id uuid;
BEGIN
  -- Allow common preview domains, localhost, and callpanion.co.uk subdomains
  is_allowed :=
    _origin IS NULL OR
    _origin = ANY(allowed_origins) OR
    _origin LIKE 'https://%.lovableproject.com' OR
    _origin LIKE 'https://%.lovable.app' OR
    _origin LIKE 'https://%.callpanion.co.uk' OR
    _origin LIKE 'http://localhost:%' OR
    _origin = 'http://localhost' OR
    _origin = 'http://127.0.0.1';
  
  -- Log the access attempt
  INSERT INTO public.endpoint_access_logs (
    endpoint, ip_address, user_agent, origin, request_data, 
    blocked, block_reason
  ) VALUES (
    _endpoint, _ip_address, _user_agent, _origin, _request_data,
    NOT is_allowed, 
    CASE WHEN NOT is_allowed THEN 'Invalid origin' ELSE NULL END
  ) RETURNING id INTO log_id;
  
  RETURN is_allowed;
END;
$function$;