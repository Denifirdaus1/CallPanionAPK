-- Fix the household policy to properly allow self-creation
-- The issue is that the existing secure policy is too restrictive for new household creation

DROP POLICY IF EXISTS "households_secure_access" ON public.households;

-- Create separate policies for different operations
CREATE POLICY "households_select_access"
  ON public.households
  FOR SELECT
  TO authenticated
  USING (
    has_admin_access_with_mfa(auth.uid()) OR app_is_household_member(id)
  );

CREATE POLICY "households_insert_self_create"
  ON public.households
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL AND created_by = auth.uid()
  );

CREATE POLICY "households_update_admin_only"
  ON public.households
  FOR UPDATE
  TO authenticated
  USING (
    has_admin_access_with_mfa(auth.uid()) OR app_is_household_admin(id)
  )
  WITH CHECK (
    has_admin_access_with_mfa(auth.uid()) OR app_is_household_admin(id)
  );

CREATE POLICY "households_delete_admin_only"
  ON public.households
  FOR DELETE
  TO authenticated
  USING (
    has_admin_access_with_mfa(auth.uid()) OR app_is_household_admin(id)
  );