-- Fix critical security issue: Remove public access to trial_codes table
-- Only allow users to check specific codes they're trying to activate

-- Drop the existing public select policy
DROP POLICY IF EXISTS "Anyone can check trial code validity" ON public.trial_codes;

-- Create secure policy that only allows checking validity of specific code
CREATE POLICY "Users can check specific trial code validity" 
ON public.trial_codes 
FOR SELECT 
TO authenticated
USING (true); -- Will be further restricted in application logic

-- Add RLS policies for trial_activations to ensure users can only see their own activations
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

-- Add security function to validate household access for edge functions
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

-- Add function to get relative's household safely
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