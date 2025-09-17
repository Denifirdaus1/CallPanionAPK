-- Security Hardening Migration
-- 1) Add creator ownership to households and trigger to set it
BEGIN;

ALTER TABLE public.households ADD COLUMN IF NOT EXISTS created_by uuid;

CREATE OR REPLACE FUNCTION public.set_created_by_households()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
BEGIN
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_created_by_households_trg ON public.households;
CREATE TRIGGER set_created_by_households_trg
BEFORE INSERT ON public.households
FOR EACH ROW
EXECUTE FUNCTION public.set_created_by_households();

-- 2) Function to allow safe initial seeding by creator
CREATE OR REPLACE FUNCTION public.can_self_seed_household(_uid uuid, _household_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
  SELECT
    (SELECT h.created_by = _uid FROM public.households h WHERE h.id = _household_id) AND
    NOT EXISTS (
      SELECT 1 FROM public.household_members hm WHERE hm.household_id = _household_id
    );
$$;

-- 3) Tighten household_members insert policies and enforce single primary
DROP POLICY IF EXISTS "Self or primary can insert members" ON public.household_members;

CREATE POLICY "Primary can insert members"
ON public.household_members
FOR INSERT
TO authenticated
WITH CHECK (public.can_manage_household(auth.uid(), household_id));

CREATE POLICY "Creator can seed themselves as primary"
ON public.household_members
FOR INSERT
TO authenticated
WITH CHECK (
  public.can_self_seed_household(auth.uid(), household_id)
  AND user_id = auth.uid()
  AND role = 'FAMILY_PRIMARY'
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='household_members_one_primary'
  ) THEN
    CREATE UNIQUE INDEX household_members_one_primary
    ON public.household_members (household_id)
    WHERE role = 'FAMILY_PRIMARY';
  END IF;
END$$;

-- 4) Scope family_photos to households and restrict visibility
ALTER TABLE public.family_photos ADD COLUMN IF NOT EXISTS household_id uuid REFERENCES public.households(id);

DROP POLICY IF EXISTS "Authenticated can read photos" ON public.family_photos;
DROP POLICY IF EXISTS "Users can insert own photos" ON public.family_photos;
DROP POLICY IF EXISTS "Owners can update own photos" ON public.family_photos;
DROP POLICY IF EXISTS "Owners can delete own photos" ON public.family_photos;

CREATE POLICY "Household members can read photos"
ON public.family_photos
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.household_members hm
    WHERE hm.household_id = family_photos.household_id
      AND hm.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert photos in their household"
ON public.family_photos
FOR INSERT
TO authenticated
WITH CHECK (
  (user_id = auth.uid() OR user_id IS NULL)
  AND EXISTS (
    SELECT 1 FROM public.household_members hm
    WHERE hm.household_id = household_id
      AND hm.user_id = auth.uid()
  )
);

CREATE POLICY "Owners can update photos in their household"
ON public.family_photos
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.household_members hm
    WHERE hm.household_id = family_photos.household_id
      AND hm.user_id = auth.uid()
  )
)
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.household_members hm
    WHERE hm.household_id = household_id
      AND hm.user_id = auth.uid()
  )
);

CREATE POLICY "Owners can delete photos in their household"
ON public.family_photos
FOR DELETE
TO authenticated
USING (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.household_members hm
    WHERE hm.household_id = family_photos.household_id
      AND hm.user_id = auth.uid()
  )
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='idx_family_photos_household_id'
  ) THEN
    CREATE INDEX idx_family_photos_household_id ON public.family_photos(household_id);
  END IF;
END$$;

-- 5) Restrict photo_comments to household members via the photo
DROP POLICY IF EXISTS "Authenticated can read photo_comments" ON public.photo_comments;
DROP POLICY IF EXISTS "Users can insert own photo_comments" ON public.photo_comments;
DROP POLICY IF EXISTS "Owners can update own photo_comments" ON public.photo_comments;
DROP POLICY IF EXISTS "Owners can delete own photo_comments" ON public.photo_comments;

CREATE POLICY "Household members can read photo_comments"
ON public.photo_comments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.family_photos p
    JOIN public.household_members hm
      ON hm.household_id = p.household_id
    WHERE p.id = photo_comments.photo_id
      AND hm.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert photo_comments in their household"
ON public.photo_comments
FOR INSERT
TO authenticated
WITH CHECK (
  (user_id = auth.uid() OR user_id IS NULL)
  AND EXISTS (
    SELECT 1
    FROM public.family_photos p
    JOIN public.household_members hm
      ON hm.household_id = p.household_id
    WHERE p.id = photo_id
      AND hm.user_id = auth.uid()
  )
);

CREATE POLICY "Owners can update photo_comments in their household"
ON public.photo_comments
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.family_photos p
    JOIN public.household_members hm
      ON hm.household_id = p.household_id
    WHERE p.id = photo_comments.photo_id
      AND hm.user_id = auth.uid()
  )
)
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.family_photos p
    JOIN public.household_members hm
      ON hm.household_id = p.household_id
    WHERE p.id = photo_id
      AND hm.user_id = auth.uid()
  )
);

CREATE POLICY "Owners can delete photo_comments in their household"
ON public.photo_comments
FOR DELETE
TO authenticated
USING (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.family_photos p
    JOIN public.household_members hm
      ON hm.household_id = p.household_id
    WHERE p.id = photo_comments.photo_id
      AND hm.user_id = auth.uid()
  )
);

COMMIT;