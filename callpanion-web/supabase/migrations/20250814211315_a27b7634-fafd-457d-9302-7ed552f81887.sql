-- Fix the security definer view issue
-- Drop the problematic view
DROP VIEW IF EXISTS public.customer_sensitive_data;

-- Create a function instead of a view to access sensitive customer data securely
CREATE OR REPLACE FUNCTION public.get_customer_sensitive_data(customer_id uuid)
RETURNS TABLE (
  id uuid,
  full_name text,
  email text,
  phone text,
  address_line text,
  postcode text
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = 'public', 'auth'
AS $$
  SELECT 
    c.id,
    c.full_name,
    c.email,
    c.phone,
    c.address_line,
    c.postcode
  FROM public.customers c
  WHERE c.id = customer_id
    AND (
      -- Only admins with MFA can access sensitive data
      has_admin_access_with_mfa(auth.uid()) OR
      -- Or primary family members of the household
      EXISTS (
        SELECT 1 FROM public.household_members hm1
        JOIN public.household_members hm2 ON hm1.household_id = hm2.household_id
        WHERE hm1.user_id = auth.uid() 
          AND hm1.role = 'FAMILY_PRIMARY'
          AND hm2.customer_id = c.id
      )
    );
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_customer_sensitive_data(uuid) TO authenticated;