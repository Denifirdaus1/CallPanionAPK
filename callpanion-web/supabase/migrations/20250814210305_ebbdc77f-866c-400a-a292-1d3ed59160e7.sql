-- Fix household insert RLS policy issue

-- Drop conflicting insert policies
DROP POLICY IF EXISTS "Authenticated can create households" ON public.households;
DROP POLICY IF EXISTS "household_insert_by_creator" ON public.households;

-- Create a single, clear insert policy
CREATE POLICY "household_insert_safe" ON public.households
FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid() OR created_by IS NULL
);