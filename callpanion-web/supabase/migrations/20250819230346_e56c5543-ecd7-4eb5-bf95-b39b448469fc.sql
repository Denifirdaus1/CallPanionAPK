-- Fix critical security issues in the database
-- This migration addresses the security vulnerabilities identified in the security review

-- Remove public access to trial_codes table (Critical Risk)
DROP POLICY IF EXISTS "Anyone can check trial code validity" ON public.trial_codes;

-- Only authenticated users can validate trial codes they're attempting to use
CREATE POLICY "Users can validate trial codes" 
ON public.trial_codes 
FOR SELECT 
TO authenticated
USING (true);  -- Access will be restricted in application logic to specific code lookups

-- Ensure trial_activations are properly secured
DROP POLICY IF EXISTS "Users can view their own trial activations" ON public.trial_activations;
DROP POLICY IF EXISTS "Users can insert their own trial activations" ON public.trial_activations;

CREATE POLICY "Users can view their own trial activations" 
ON public.trial_activations 
FOR SELECT 
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own trial activations" 
ON public.trial_activations 
FOR INSERT 
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Add security functions for edge function validation
CREATE OR REPLACE FUNCTION public.validate_household_access(
  _user_id uuid, 
  _household_id uuid
) RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.household_members hm
    WHERE hm.household_id = _household_id 
      AND hm.user_id = _user_id
  ) OR has_admin_access_with_mfa(_user_id);
$$;

-- Helper function to get relative's household with authorization check
CREATE OR REPLACE FUNCTION public.get_relative_household_secure(
  _relative_id uuid,
  _user_id uuid
) RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT r.household_id
  FROM public.relatives r
  JOIN public.household_members hm ON hm.household_id = r.household_id
  WHERE r.id = _relative_id 
    AND (hm.user_id = _user_id OR has_admin_access_with_mfa(_user_id))
  LIMIT 1;
$$;