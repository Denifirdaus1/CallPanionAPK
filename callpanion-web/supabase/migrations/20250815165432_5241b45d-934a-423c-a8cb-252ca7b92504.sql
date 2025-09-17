-- SECURITY FIX: Clean up customers table RLS policies to prevent email harvesting

-- Step 1: Remove all existing conflicting policies
DROP POLICY IF EXISTS "Admins can manage customers" ON public.customers;
DROP POLICY IF EXISTS "Admins can read customers" ON public.customers;
DROP POLICY IF EXISTS "Admins only direct customer access" ON public.customers;
DROP POLICY IF EXISTS "Primary family can create customers" ON public.customers;
DROP POLICY IF EXISTS "Primary family can update customers" ON public.customers;
DROP POLICY IF EXISTS "customers_authenticated_insert" ON public.customers;
DROP POLICY IF EXISTS "deny_all_public_access" ON public.customers;

-- Step 2: Create comprehensive, secure policies with no gaps

-- CRITICAL: Default deny-all policy (most restrictive, applies first)
CREATE POLICY "customers_deny_all_default" ON public.customers
FOR ALL TO public USING (false) WITH CHECK (false);

-- Policy 1: Super admins with MFA can do everything
CREATE POLICY "customers_super_admin_full_access" ON public.customers
FOR ALL TO authenticated 
USING (has_admin_access_with_mfa(auth.uid())) 
WITH CHECK (has_admin_access_with_mfa(auth.uid()));

-- Policy 2: Primary family members can read customers in their household only
CREATE POLICY "customers_family_read_access" ON public.customers
FOR SELECT TO authenticated 
USING (
  EXISTS (
    SELECT 1 
    FROM household_members hm1
    JOIN household_members hm2 ON hm1.household_id = hm2.household_id
    WHERE hm1.user_id = auth.uid() 
      AND hm1.role = 'FAMILY_PRIMARY'
      AND hm2.customer_id = customers.id
  )
);

-- Policy 3: Primary family members can create customers (with proper validation)
CREATE POLICY "customers_family_create_access" ON public.customers
FOR INSERT TO authenticated 
WITH CHECK (
  created_by = auth.uid() AND
  EXISTS (
    SELECT 1 FROM household_members hm
    WHERE hm.user_id = auth.uid() 
      AND hm.role = 'FAMILY_PRIMARY'
  )
);

-- Policy 4: Primary family members can update customers in their household only
CREATE POLICY "customers_family_update_access" ON public.customers
FOR UPDATE TO authenticated 
USING (
  EXISTS (
    SELECT 1 
    FROM household_members hm1
    JOIN household_members hm2 ON hm1.household_id = hm2.household_id
    WHERE hm1.user_id = auth.uid() 
      AND hm1.role = 'FAMILY_PRIMARY'
      AND hm2.customer_id = customers.id
  )
) 
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM household_members hm1
    JOIN household_members hm2 ON hm1.household_id = hm2.household_id
    WHERE hm1.user_id = auth.uid() 
      AND hm1.role = 'FAMILY_PRIMARY'
      AND hm2.customer_id = customers.id
  )
);