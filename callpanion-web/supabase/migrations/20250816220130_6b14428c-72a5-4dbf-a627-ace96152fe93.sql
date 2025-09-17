-- Fix bootstrap RLS for creating a household and self-adding as admin, and allow inserting relatives

-- 1) Relax restrictive households policy to allow creators to insert their own household
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'households'
      AND policyname = 'households_secure_access'
  ) THEN
    ALTER POLICY "households_secure_access"
      ON public.households
      USING (
        has_admin_access_with_mfa(auth.uid()) OR app_is_household_member(id)
      )
      WITH CHECK (
        -- Allow normal admin paths
        has_admin_access_with_mfa(auth.uid()) OR app_is_household_admin(id)
        -- And allow creators to insert their own household (bootstrap)
        OR created_by = auth.uid()
      );
  END IF;
END $$;

-- 2) Allow household creators to insert themselves as primary member
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'household_members'
      AND policyname = 'household_members_creator_self_add'
  ) THEN
    CREATE POLICY "household_members_creator_self_add"
      ON public.household_members
      FOR INSERT
      TO authenticated
      WITH CHECK (
        user_id = auth.uid()
        AND EXISTS (
          SELECT 1 FROM public.households h
          WHERE h.id = household_id AND h.created_by = auth.uid()
        )
      );
  END IF;
END $$;

-- 3) Ensure household members can insert relatives in their household
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'relatives'
      AND policyname = 'relatives_insert_by_member'
  ) THEN
    CREATE POLICY "relatives_insert_by_member"
      ON public.relatives
      FOR INSERT
      TO authenticated
      WITH CHECK (
        app_is_household_member(household_id)
      );
  END IF;
END $$;