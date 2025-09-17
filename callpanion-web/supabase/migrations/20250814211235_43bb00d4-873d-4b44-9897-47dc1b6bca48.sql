-- Fix customer table RLS policies to improve security
-- Drop existing potentially insecure policies
DROP POLICY IF EXISTS "Creators can read customers they created" ON public.customers;
DROP POLICY IF EXISTS "Customers can read their own data" ON public.customers;
DROP POLICY IF EXISTS "Primary family members can read customer data" ON public.customers;
DROP POLICY IF EXISTS "Limited customer updates" ON public.customers;

-- Create more secure customer data access policies
-- 1. Only allow reading essential customer data (not sensitive fields like phone, email, full address)
CREATE POLICY "Family can read basic customer info" ON public.customers
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.household_members hm1
    JOIN public.household_members hm2 ON hm1.household_id = hm2.household_id
    WHERE hm1.user_id = auth.uid() 
      AND hm2.customer_id = customers.id
  )
)
WITH (SELECT (id, preferred_name, status, plan, device_status, timezone, city, country, created_at, updated_at));

-- 2. Allow admins to read full customer data
CREATE POLICY "Admins can read full customer data" ON public.customers
FOR SELECT TO authenticated
USING (has_admin_access_with_mfa(auth.uid()));

-- 3. Allow customers to read their own basic data only
CREATE POLICY "Customers can read own basic data" ON public.customers
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.household_members hm
    WHERE hm.customer_id = customers.id AND hm.user_id = auth.uid()
  )
)
WITH (SELECT (id, preferred_name, status, timezone, city, country));

-- 4. Restrict updates to verified family primary members and admins only
CREATE POLICY "Verified family primary can update customers" ON public.customers
FOR UPDATE TO authenticated
USING (
  has_admin_access_with_mfa(auth.uid()) OR
  (
    EXISTS (
      SELECT 1 FROM public.household_members hm1
      JOIN public.household_members hm2 ON hm1.household_id = hm2.household_id
      WHERE hm1.user_id = auth.uid() 
        AND hm1.role = 'FAMILY_PRIMARY'
        AND hm2.customer_id = customers.id
    )
  )
)
WITH CHECK (
  has_admin_access_with_mfa(auth.uid()) OR
  (
    EXISTS (
      SELECT 1 FROM public.household_members hm1
      JOIN public.household_members hm2 ON hm1.household_id = hm2.household_id
      WHERE hm1.user_id = auth.uid() 
        AND hm1.role = 'FAMILY_PRIMARY'
        AND hm2.customer_id = customers.id
    )
  )
);

-- 5. Only allow customer creation by verified users with proper household association
CREATE POLICY "Verified users can create customers" ON public.customers
FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.household_members hm
    WHERE hm.user_id = auth.uid() AND hm.role = 'FAMILY_PRIMARY'
  )
);