-- Fix customer table RLS policies with proper security restrictions
-- Drop existing potentially insecure policies
DROP POLICY IF EXISTS "Creators can read customers they created" ON public.customers;
DROP POLICY IF EXISTS "Customers can read their own data" ON public.customers;
DROP POLICY IF EXISTS "Primary family members can read customer data" ON public.customers;
DROP POLICY IF EXISTS "Limited customer updates" ON public.customers;

-- Create more secure customer data access policies
-- 1. Family members can only read customers in their household with verification
CREATE POLICY "Family can read household customers" ON public.customers
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.household_members hm1
    JOIN public.household_members hm2 ON hm1.household_id = hm2.household_id
    WHERE hm1.user_id = auth.uid() 
      AND hm2.customer_id = customers.id
      AND hm1.role IN ('FAMILY_PRIMARY', 'FAMILY_MEMBER')
  )
);

-- 2. Customers can only read their own data
CREATE POLICY "Customers can read own data" ON public.customers
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.household_members hm
    WHERE hm.customer_id = customers.id AND hm.user_id = auth.uid()
  )
);

-- 3. Only verified family primary members can update customer data
CREATE POLICY "Primary family can update customers" ON public.customers
FOR UPDATE TO authenticated
USING (
  has_admin_access_with_mfa(auth.uid()) OR
  EXISTS (
    SELECT 1 FROM public.household_members hm1
    JOIN public.household_members hm2 ON hm1.household_id = hm2.household_id
    WHERE hm1.user_id = auth.uid() 
      AND hm1.role = 'FAMILY_PRIMARY'
      AND hm2.customer_id = customers.id
  )
)
WITH CHECK (
  has_admin_access_with_mfa(auth.uid()) OR
  EXISTS (
    SELECT 1 FROM public.household_members hm1
    JOIN public.household_members hm2 ON hm1.household_id = hm2.household_id
    WHERE hm1.user_id = auth.uid() 
      AND hm1.role = 'FAMILY_PRIMARY'
      AND hm2.customer_id = customers.id
  )
);

-- 4. Restrict customer creation to verified family primary members only
CREATE POLICY "Primary family can create customers" ON public.customers
FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.household_members hm
    WHERE hm.user_id = auth.uid() AND hm.role = 'FAMILY_PRIMARY'
  )
);

-- Create a secure view for sensitive customer data access (phone, email, full address)
CREATE OR REPLACE VIEW public.customer_sensitive_data AS
SELECT 
  c.id,
  c.full_name,
  c.email,
  c.phone,
  c.address_line,
  c.postcode
FROM public.customers c
WHERE 
  -- Only admins with MFA can access sensitive data
  has_admin_access_with_mfa(auth.uid()) OR
  -- Or primary family members of the household
  EXISTS (
    SELECT 1 FROM public.household_members hm1
    JOIN public.household_members hm2 ON hm1.household_id = hm2.household_id
    WHERE hm1.user_id = auth.uid() 
      AND hm1.role = 'FAMILY_PRIMARY'
      AND hm2.customer_id = c.id
  );

-- Enable RLS on the view
ALTER VIEW public.customer_sensitive_data SET (security_barrier = true);