-- Comprehensive Security Fixes Migration

-- 1. Clean up conflicting RLS policies on households table
DROP POLICY IF EXISTS "Household access through secure function only" ON public.households;
DROP POLICY IF EXISTS "household_delete_safe" ON public.households;
DROP POLICY IF EXISTS "household_insert_safe" ON public.households;
DROP POLICY IF EXISTS "household_update_safe" ON public.households;
DROP POLICY IF EXISTS "household members can select households" ON public.households;

-- Create single, secure household policy
CREATE POLICY "households_secure_access" ON public.households
FOR ALL USING (
  has_admin_access_with_mfa(auth.uid()) OR 
  app_is_household_member(id)
) WITH CHECK (
  has_admin_access_with_mfa(auth.uid()) OR 
  (app_is_household_admin(id) AND auth.uid() IS NOT NULL)
);

-- 2. Clean up conflicting policies on household_members
DROP POLICY IF EXISTS "Creator can seed themselves as primary" ON public.household_members;
DROP POLICY IF EXISTS "members_insert_self" ON public.household_members;
DROP POLICY IF EXISTS "admins can delete household_members" ON public.household_members;
DROP POLICY IF EXISTS "admins can insert household_members" ON public.household_members;
DROP POLICY IF EXISTS "members can select household_members" ON public.household_members;

-- Keep only the safe policies for household_members
-- (The existing safe policies should remain)

-- 3. Create rate limiting table for public endpoints
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  identifier text NOT NULL, -- IP or user identifier
  endpoint text NOT NULL,
  request_count integer DEFAULT 1,
  window_start timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now()
);

-- Add unique constraint for rate limiting
CREATE UNIQUE INDEX IF NOT EXISTS idx_rate_limits_identifier_endpoint 
ON public.rate_limits (identifier, endpoint, window_start);

-- 4. Create security logging table
CREATE TABLE IF NOT EXISTS public.endpoint_access_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  endpoint text NOT NULL,
  ip_address text,
  user_agent text,
  origin text,
  request_data jsonb,
  response_status integer,
  blocked boolean DEFAULT false,
  block_reason text,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on new security tables
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.endpoint_access_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can access security tables
CREATE POLICY "admins_only_rate_limits" ON public.rate_limits
FOR ALL USING (has_admin_access_with_mfa(auth.uid()))
WITH CHECK (has_admin_access_with_mfa(auth.uid()));

CREATE POLICY "admins_only_endpoint_logs" ON public.endpoint_access_logs
FOR ALL USING (has_admin_access_with_mfa(auth.uid()))
WITH CHECK (has_admin_access_with_mfa(auth.uid()));

-- 5. Create origin validation function
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

-- 6. Create rate limiting function
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

-- 7. Fix function search paths for existing functions
CREATE OR REPLACE FUNCTION public.sync_household_to_hubspot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  household_admin_email text;
  household_admin_name text;
  relative_data record;
  consent_status boolean := false;
  consent_timestamp timestamp with time zone;
BEGIN
  -- Get the household admin's email from auth.users via household_members
  SELECT u.email, u.raw_user_meta_data ->> 'display_name'
  INTO household_admin_email, household_admin_name
  FROM auth.users u
  JOIN household_members hm ON hm.user_id = u.id
  WHERE hm.household_id = NEW.id 
    AND hm.role = 'FAMILY_PRIMARY'
  LIMIT 1;

  -- Get the first relative for this household
  SELECT * INTO relative_data
  FROM relatives 
  WHERE household_id = NEW.id 
  LIMIT 1;

  -- Get consent status
  SELECT NEW.gdpr_consent_status, NEW.gdpr_consent_timestamp
  INTO consent_status, consent_timestamp;

  -- Call the HubSpot sync edge function
  PERFORM net.http_post(
    url := 'https://umjtepmdwfyfhdzbkyli.supabase.co/functions/v1/hubspot-sync',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.jwt_token', true) || '"}'::jsonb,
    body := jsonb_build_object(
      'type', 'household_created',
      'data', jsonb_build_object(
        'firstname', COALESCE(relative_data.first_name, split_part(household_admin_name, ' ', 1)),
        'lastname', COALESCE(relative_data.last_name, split_part(household_admin_name, ' ', 2)),
        'email', household_admin_email,
        'contact_role', 'household_admin',
        'household_id', NEW.id::text,
        'city', COALESCE(NEW.city, relative_data.town),
        'state', COALESCE(relative_data.county, ''),
        'country', COALESCE(NEW.country, relative_data.country, 'United Kingdom'),
        'signup_date', NEW.created_at::date::text,
        'gdpr_consent_status', CASE WHEN consent_status THEN 'yes' ELSE 'no' END,
        'gdpr_consent_timestamp', COALESCE(consent_timestamp, NEW.created_at)::text
      )
    )
  );

  RETURN NEW;
END;
$function$;

-- 8. Update other functions with proper search paths
CREATE OR REPLACE FUNCTION public.sync_invite_acceptance_to_hubspot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  household_data record;
  inviter_email text;
BEGIN
  -- Only trigger when accepted_at is newly set
  IF OLD.accepted_at IS NULL AND NEW.accepted_at IS NOT NULL THEN
    
    -- Get household data
    SELECT * INTO household_data
    FROM households 
    WHERE id = NEW.household_id;

    -- Get inviter email for fallback
    SELECT u.email INTO inviter_email
    FROM auth.users u
    WHERE u.id = NEW.invited_by;

    -- Call the HubSpot sync edge function
    PERFORM net.http_post(
      url := 'https://umjtepmdwfyfhdzbkyli.supabase.co/functions/v1/hubspot-sync',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.jwt_token', true) || '"}'::jsonb,
      body := jsonb_build_object(
        'type', 'invite_accepted',
        'data', jsonb_build_object(
          'email', NEW.email,
          'contact_role', COALESCE(NEW.role, 'viewer'),
          'household_id', NEW.household_id::text,
          'city', household_data.city,
          'country', COALESCE(household_data.country, 'United Kingdom'),
          'signup_date', NEW.accepted_at::date::text,
          'gdpr_consent_status', CASE WHEN COALESCE(NEW.gdpr_consent_status, false) THEN 'yes' ELSE 'no' END,
          'gdpr_consent_timestamp', COALESCE(NEW.gdpr_consent_timestamp, NEW.accepted_at)::text
        )
      )
    );
  END IF;

  RETURN NEW;
END;
$function$;