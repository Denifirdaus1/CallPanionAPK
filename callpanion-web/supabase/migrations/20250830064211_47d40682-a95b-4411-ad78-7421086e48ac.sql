-- RLS policies for public.family_photos (household-scoped via household_members)
DO $$ BEGIN
  IF to_regclass('public.family_photos') IS NOT NULL THEN
    -- ensure RLS is enabled (idempotent)
    EXECUTE 'ALTER TABLE public.family_photos ENABLE ROW LEVEL SECURITY';

    -- SELECT: only members of the same household
    EXECUTE $p$
      CREATE POLICY family_photos_select_household
      ON public.family_photos
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.household_members hm
          WHERE hm.user_id = auth.uid()
            AND hm.household_id = family_photos.household_id
        )
      )
    $p$;

    -- INSERT: only members of the household
    EXECUTE $p$
      CREATE POLICY family_photos_insert_household
      ON public.family_photos
      FOR INSERT TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.household_members hm
          WHERE hm.user_id = auth.uid()
            AND hm.household_id = family_photos.household_id
        )
      )
    $p$;

    -- (optional) UPDATE/DELETE if the app needs editing/removal from UI
    -- EXECUTE ... UPDATE policy similar to SELECT
    -- EXECUTE ... DELETE policy similar to SELECT
  END IF;
END $$;

-- helpful index for policy predicate
CREATE INDEX IF NOT EXISTS idx_family_photos_household ON public.family_photos(household_id);