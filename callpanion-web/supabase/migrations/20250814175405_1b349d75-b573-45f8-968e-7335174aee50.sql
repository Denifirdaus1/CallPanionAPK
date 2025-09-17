-- Fix customer data security by restricting access to sensitive personal information
-- This addresses the security concern about family members having too broad access to customer data

-- First, let's create a function to check if a user is the primary family member for a customer
CREATE OR REPLACE FUNCTION public.is_primary_family_member(_uid uuid, _customer_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.household_members hm_user
    JOIN public.household_members hm_cust
      ON hm_user.household_id = hm_cust.household_id
    WHERE hm_user.user_id = _uid
      AND hm_cust.customer_id = _customer_id
      AND hm_user.role = 'FAMILY_PRIMARY'
  );
$$;

-- Drop the existing overly permissive policy
DROP POLICY IF EXISTS "Family can read own customers" ON public.customers;

-- Create more restrictive policies
CREATE POLICY "Customers can read their own data" 
ON public.customers 
FOR SELECT 
USING (
  -- Allow customer to see their own data if they have a user account
  EXISTS (
    SELECT 1 FROM public.household_members hm 
    WHERE hm.customer_id = customers.id AND hm.user_id = auth.uid()
  )
);

CREATE POLICY "Primary family members can read customer data" 
ON public.customers 
FOR SELECT 
USING (
  -- Only primary family members can access customer data
  public.is_primary_family_member(auth.uid(), id)
);

-- Keep the created_by access for those who created the customer record
CREATE POLICY "Creators can read customers they created" 
ON public.customers 
FOR SELECT 
USING (created_by = auth.uid());

-- Update the update policy to be more restrictive as well
DROP POLICY IF EXISTS "Primary can update customers" ON public.customers;

CREATE POLICY "Limited customer updates" 
ON public.customers 
FOR UPDATE 
USING (
  -- Admin access
  public.has_admin_access_with_mfa(auth.uid()) 
  OR 
  -- Primary family member access
  public.is_primary_family_member(auth.uid(), id)
  OR 
  -- Creator access
  created_by = auth.uid()
)
WITH CHECK (
  public.has_admin_access_with_mfa(auth.uid()) 
  OR 
  public.is_primary_family_member(auth.uid(), id)
  OR 
  created_by = auth.uid()
);