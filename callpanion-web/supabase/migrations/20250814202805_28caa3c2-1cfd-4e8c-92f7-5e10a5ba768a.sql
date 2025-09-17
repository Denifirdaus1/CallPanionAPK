-- Fix function search path security warning
-- Set the search_path parameter to prevent potential SQL injection

CREATE OR REPLACE FUNCTION get_customers_list_masked()
RETURNS TABLE(
  id uuid,
  full_name text,
  email_masked text,
  phone_masked text,
  status text,
  risk_flag boolean,
  plan text,
  device_status text,
  created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = 'public', 'auth'
AS $$
  SELECT 
    c.id,
    c.full_name,
    CASE
      WHEN c.email IS NULL THEN NULL::text
      ELSE regexp_replace(c.email, '(^.).*(@.*$)'::text, '\1***\2'::text)
    END AS email_masked,
    CASE
      WHEN c.phone IS NULL THEN NULL::text
      ELSE '***' || right(c.phone, 2)
    END AS phone_masked,
    c.status,
    c.risk_flag,
    c.plan,
    c.device_status,
    c.created_at
  FROM customers c
  WHERE has_admin_access_with_mfa(auth.uid());
$$;