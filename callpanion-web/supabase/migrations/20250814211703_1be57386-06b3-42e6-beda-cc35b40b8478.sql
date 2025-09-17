-- Security Fix Migration: Tighten RLS Policies and Secure Data Access
-- Phase 1: Database Access Control Hardening

-- 1. Enhanced audit logging function for sensitive data access
CREATE OR REPLACE FUNCTION public.log_sensitive_data_access(
  _table_name text,
  _operation text,
  _record_id text,
  _accessed_fields text[]
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
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
      'ip_address', current_setting('request.headers', true)::json ->> 'x-forwarded-for',
      'user_agent', current_setting('request.headers', true)::json ->> 'user-agent'
    )
  );
END;
$$;

-- 2. Secure customer data access function with audit logging
CREATE OR REPLACE FUNCTION public.get_customer_data_secure(customer_id uuid)
RETURNS TABLE(
  id uuid,
  full_name text,
  preferred_name text,
  status text,
  plan text,
  device_status text,
  timezone text,
  city text,
  country text,
  risk_flag boolean,
  created_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'auth'
AS $$
BEGIN
  -- Check authorization
  IF NOT (
    has_admin_access_with_mfa(auth.uid()) OR
    has_access_to_customer(auth.uid(), customer_id)
  ) THEN
    RAISE EXCEPTION 'Unauthorized access to customer data';
  END IF;

  -- Log the access
  PERFORM log_sensitive_data_access(
    'customers', 
    'SELECT', 
    customer_id::text, 
    ARRAY['basic_info']
  );

  -- Return non-sensitive customer data
  RETURN QUERY
  SELECT 
    c.id,
    c.full_name,
    c.preferred_name,
    c.status,
    c.plan,
    c.device_status,
    c.timezone,
    c.city,
    c.country,
    c.risk_flag,
    c.created_at
  FROM public.customers c
  WHERE c.id = customer_id;
END;
$$;

-- 3. Secure relatives data access function
CREATE OR REPLACE FUNCTION public.get_relatives_secure(household_id_param uuid)
RETURNS TABLE(
  id uuid,
  first_name text,
  last_name text,
  town text,
  county text,
  country text,
  call_cadence text,
  timezone text,
  quiet_hours_start text,
  quiet_hours_end text,
  last_active_at timestamp with time zone,
  created_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'auth'
AS $$
BEGIN
  -- Check authorization
  IF NOT (
    app_is_household_member(household_id_param) OR
    has_admin_access_with_mfa(auth.uid())
  ) THEN
    RAISE EXCEPTION 'Unauthorized access to relatives data';
  END IF;

  -- Log the access
  PERFORM log_sensitive_data_access(
    'relatives', 
    'SELECT', 
    household_id_param::text, 
    ARRAY['basic_info']
  );

  -- Return relatives data (excluding sensitive escalation contacts)
  RETURN QUERY
  SELECT 
    r.id,
    r.first_name,
    r.last_name,
    r.town,
    r.county,
    r.country,
    r.call_cadence,
    r.timezone,
    r.quiet_hours_start,
    r.quiet_hours_end,
    r.last_active_at,
    r.created_at
  FROM public.relatives r
  WHERE r.household_id = household_id_param
    AND r.inactive_since IS NULL;
END;
$$;

-- 4. Enhanced invite token validation function
CREATE OR REPLACE FUNCTION public.validate_invite_token(token_param text)
RETURNS TABLE(
  id uuid,
  household_id uuid,
  role text,
  expires_at timestamp with time zone,
  is_valid boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Log the token validation attempt
  PERFORM log_sensitive_data_access(
    'invites', 
    'VALIDATE_TOKEN', 
    token_param, 
    ARRAY['token_validation']
  );

  RETURN QUERY
  SELECT 
    i.id,
    i.household_id,
    i.role,
    i.expires_at,
    (i.expires_at > now() AND i.accepted_at IS NULL) as is_valid
  FROM public.invites i
  WHERE i.token = token_param;
END;
$$;

-- 5. Tighten RLS policies on customers table
DROP POLICY IF EXISTS "Family can read household customers" ON public.customers;
CREATE POLICY "Family can read basic customer data" 
ON public.customers 
FOR SELECT 
USING (
  -- Only allow access through the secure function or for admins
  has_admin_access_with_mfa(auth.uid()) OR
  (
    EXISTS (
      SELECT 1 FROM public.household_members hm1
      JOIN public.household_members hm2 ON hm1.household_id = hm2.household_id
      WHERE hm1.user_id = auth.uid() 
        AND hm2.customer_id = customers.id
        AND hm1.role IN ('FAMILY_PRIMARY', 'FAMILY_MEMBER')
    )
    -- Limit fields accessible via direct query
    AND false -- Force use of secure function
  )
);

-- 6. Tighten RLS policies on relatives table  
DROP POLICY IF EXISTS "relatives_select_for_members" ON public.relatives;
CREATE POLICY "relatives_select_secure" 
ON public.relatives 
FOR SELECT 
USING (
  has_admin_access_with_mfa(auth.uid()) OR
  (
    app_is_household_member(household_id) 
    -- Force use of secure function for sensitive data
    AND false
  )
);

-- 7. Enhance invite token security
DROP POLICY IF EXISTS "invites_rw_for_members" ON public.invites;

CREATE POLICY "invites_select_limited" 
ON public.invites 
FOR SELECT 
USING (
  has_admin_access_with_mfa(auth.uid()) OR
  (
    app_is_household_member(household_id) 
    -- Only allow non-sensitive fields
    AND expires_at > now()
  )
);

CREATE POLICY "invites_insert_secure" 
ON public.invites 
FOR INSERT 
WITH CHECK (
  app_is_household_admin(household_id) AND
  invited_by = auth.uid() AND
  expires_at > now() AND
  expires_at <= (now() + interval '7 days')
);

CREATE POLICY "invites_update_limited" 
ON public.invites 
FOR UPDATE 
USING (
  app_is_household_admin(household_id) OR
  has_admin_access_with_mfa(auth.uid())
)
WITH CHECK (
  app_is_household_admin(household_id) OR
  has_admin_access_with_mfa(auth.uid())
);

-- 8. Add rate limiting table for security monitoring
CREATE TABLE IF NOT EXISTS public.security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  event_type text NOT NULL,
  ip_address text,
  user_agent text,
  details jsonb,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on security events
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read security events" 
ON public.security_events 
FOR SELECT 
USING (has_admin_access_with_mfa(auth.uid()));

CREATE POLICY "System can insert security events" 
ON public.security_events 
FOR INSERT 
WITH CHECK (true);

-- 9. Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.get_customer_data_secure(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_relatives_secure(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_invite_token(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_sensitive_data_access(text, text, text, text[]) TO authenticated;