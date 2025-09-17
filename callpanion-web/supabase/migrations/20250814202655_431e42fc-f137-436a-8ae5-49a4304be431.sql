-- Fix critical security vulnerability: Remove public access to customer data
-- The customers_list_masked view is currently publicly accessible, which exposes customer information

-- Drop the existing view
DROP VIEW IF EXISTS customers_list_masked;

-- Recreate the view as a security definer function instead
-- This ensures access is controlled through function permissions rather than direct table access
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

-- Grant execute permission only to authenticated users with admin access
REVOKE ALL ON FUNCTION get_customers_list_masked() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_customers_list_masked() TO authenticated;