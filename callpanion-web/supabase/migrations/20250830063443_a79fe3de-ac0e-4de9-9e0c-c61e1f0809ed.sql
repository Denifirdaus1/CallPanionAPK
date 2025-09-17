-- FIX M1: RLS & Idempotency

-- 1) family_photos: ensure RLS is ENABLED (policies from previous migration rely on this)
DO $$ BEGIN
  IF to_regclass('public.family_photos') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.family_photos ENABLE ROW LEVEL SECURITY';
  END IF;
END $$;

-- 2) wellbeing_logs: health data needs RLS like family_photos
DO $$ BEGIN
  IF to_regclass('public.wellbeing_logs') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.wellbeing_logs ENABLE ROW LEVEL SECURITY';

    -- SELECT policy (household-scoped)
    EXECUTE 'CREATE POLICY wellbeing_logs_select_family ON public.wellbeing_logs
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.household_members hm
          WHERE hm.user_id = auth.uid()
            AND hm.household_id = wellbeing_logs.household_id
        )
      )';

    -- INSERT policy
    EXECUTE 'CREATE POLICY wellbeing_logs_insert_family ON public.wellbeing_logs
      FOR INSERT TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.household_members hm
          WHERE hm.user_id = auth.uid()
            AND hm.household_id = wellbeing_logs.household_id
        )
      )';

  END IF;
END $$;

-- 3) Idempotency should live on calls.conversation_id (preferred webhook key)
-- If calls.conversation_id exists, enforce uniqueness safely.
DO $$ BEGIN
  IF to_regclass('public.calls') IS NOT NULL AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='calls' AND column_name='conversation_id'
  ) THEN
    -- Create a UNIQUE INDEX (partial index avoids multiple NULL rows)
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS idx_calls_conversation_id_unique
      ON public.calls(conversation_id)
      WHERE conversation_id IS NOT NULL';
  END IF;
END $$;

-- 4) Helpful indexes for RLS lookups
CREATE INDEX IF NOT EXISTS idx_household_members_user_household ON public.household_members(user_id, household_id);
CREATE INDEX IF NOT EXISTS idx_family_photos_household ON public.family_photos(household_id);
CREATE INDEX IF NOT EXISTS idx_wellbeing_logs_household ON public.wellbeing_logs(household_id);