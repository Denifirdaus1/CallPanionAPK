-- Fix JSON casting issues in functions that access request.headers
-- Update log_sensitive_data_access function to safely handle request headers
CREATE OR REPLACE FUNCTION public.log_sensitive_data_access(_table_name text, _operation text, _record_id text, _accessed_fields text[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  headers_json jsonb := '{}';
BEGIN
  -- Safely parse request headers
  BEGIN
    headers_json := COALESCE(NULLIF(current_setting('request.headers', true), ''), '{}')::jsonb;
  EXCEPTION WHEN OTHERS THEN
    headers_json := '{}';
  END;

  INSERT INTO public.audit_log (
    actor_user_id, 
    actor_email, 
    action, 
    entity_type, 
    entity_id, 
    details
  )
  VALUES (
    auth.uid(),
    (SELECT email FROM auth.users WHERE id = auth.uid()),
    _operation || '_sensitive_data',
    _table_name,
    _record_id,
    jsonb_build_object(
      'accessed_fields', _accessed_fields,
      'ip_address', headers_json ->> 'x-forwarded-for',
      'user_agent', headers_json ->> 'user-agent'
    )
  );
END;
$function$;

-- Update log_security_event function to safely handle request headers
CREATE OR REPLACE FUNCTION public.log_security_event(event_type_param text, details_param jsonb DEFAULT '{}'::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  headers_json jsonb := '{}';
BEGIN
  -- Safely parse request headers
  BEGIN
    headers_json := COALESCE(NULLIF(current_setting('request.headers', true), ''), '{}')::jsonb;
  EXCEPTION WHEN OTHERS THEN
    headers_json := '{}';
  END;

  INSERT INTO public.security_events (
    user_id,
    event_type,
    ip_address,
    user_agent,
    details
  ) VALUES (
    auth.uid(),
    event_type_param,
    headers_json ->> 'x-forwarded-for',
    headers_json ->> 'user-agent',
    details_param
  );
END;
$function$;

-- Update validate_origin_and_log function to safely handle request headers  
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
  safe_request_data jsonb := '{}';
BEGIN
  -- Safely handle request data
  BEGIN
    safe_request_data := COALESCE(_request_data, '{}');
  EXCEPTION WHEN OTHERS THEN
    safe_request_data := '{}';
  END;

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
    _endpoint, _ip_address, _user_agent, _origin, safe_request_data,
    NOT is_allowed, 
    CASE WHEN NOT is_allowed THEN 'Invalid origin' ELSE NULL END
  ) RETURNING id INTO log_id;
  
  RETURN is_allowed;
END;
$function$;