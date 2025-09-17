-- Allow household creators to SELECT their newly created households (fixes insert+select flow)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'households'
      AND policyname = 'households_select_access'
  ) THEN
    ALTER POLICY "households_select_access"
      ON public.households
      USING (
        has_admin_access_with_mfa(auth.uid())
        OR app_is_household_member(id)
        OR created_by = auth.uid()
      );
  END IF;
END $$;