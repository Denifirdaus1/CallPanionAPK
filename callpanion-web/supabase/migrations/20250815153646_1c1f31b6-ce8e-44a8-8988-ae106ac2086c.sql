-- Fix all remaining functions with mutable search paths

-- Fix validate_origin_and_log function
CREATE OR REPLACE FUNCTION public.validate_origin_and_log(
  _endpoint text,
  _origin text,
  _ip_address text,
  _user_agent text,
  _request_data jsonb DEFAULT '{}'::jsonb
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  allowed_origins text[] := ARRAY[
    'https://umjtepmdwfyfhdzbkyli.supabase.co',
    'https://loving-goldfinch-e42fd2.lovableproject.com'
  ];
  is_allowed boolean := false;
  log_id uuid;
BEGIN
  -- Check if origin is allowed
  is_allowed := _origin = ANY(allowed_origins) OR _origin IS NULL;
  
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
$$;

-- Fix check_rate_limit function
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  _identifier text,
  _endpoint text,
  _max_requests integer DEFAULT 10,
  _window_minutes integer DEFAULT 1
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_window timestamp with time zone;
  request_count integer;
BEGIN
  current_window := date_trunc('minute', now());
  
  -- Get current request count for this window
  SELECT COALESCE(r.request_count, 0) INTO request_count
  FROM public.rate_limits r
  WHERE r.identifier = _identifier 
    AND r.endpoint = _endpoint
    AND r.window_start = current_window;
  
  -- If under limit, increment counter
  IF request_count < _max_requests THEN
    INSERT INTO public.rate_limits (identifier, endpoint, request_count, window_start)
    VALUES (_identifier, _endpoint, 1, current_window)
    ON CONFLICT (identifier, endpoint, window_start)
    DO UPDATE SET request_count = rate_limits.request_count + 1;
    
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$;