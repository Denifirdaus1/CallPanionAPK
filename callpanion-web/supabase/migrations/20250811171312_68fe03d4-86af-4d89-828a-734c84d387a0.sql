-- Security hardening migration
-- 1) Add owner user_id columns and triggers
ALTER TABLE public.family_photos ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.photo_comments ADD COLUMN IF NOT EXISTS user_id uuid;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_family_photos_user_id ON public.family_photos(user_id);
CREATE INDEX IF NOT EXISTS idx_photo_comments_user_id ON public.photo_comments(user_id);

-- Trigger to set user_id on insert (family_photos)
CREATE OR REPLACE FUNCTION public.set_user_id_family_photos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    NEW.user_id := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_user_id_family_photos ON public.family_photos;
CREATE TRIGGER set_user_id_family_photos
BEFORE INSERT ON public.family_photos
FOR EACH ROW
EXECUTE FUNCTION public.set_user_id_family_photos();

-- Trigger to set user_id on insert (photo_comments)
CREATE OR REPLACE FUNCTION public.set_user_id_photo_comments()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    NEW.user_id := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_user_id_photo_comments ON public.photo_comments;
CREATE TRIGGER set_user_id_photo_comments
BEFORE INSERT ON public.photo_comments
FOR EACH ROW
EXECUTE FUNCTION public.set_user_id_photo_comments();

-- 2) Create RPC to increment likes safely
CREATE OR REPLACE FUNCTION public.increment_photo_likes(photo_id uuid)
RETURNS public.family_photos
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_row public.family_photos;
BEGIN
  UPDATE public.family_photos
  SET likes = coalesce(likes, 0) + 1
  WHERE id = photo_id
  RETURNING * INTO updated_row;

  RETURN updated_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_photo_likes(uuid) TO authenticated;

-- 3) Lock down RLS for photos and comments
-- Drop overly permissive photo policies
DROP POLICY IF EXISTS "Public delete photos" ON public.family_photos;
DROP POLICY IF EXISTS "Public insert photos" ON public.family_photos;
DROP POLICY IF EXISTS "Public read photos" ON public.family_photos;
DROP POLICY IF EXISTS "Public update photos" ON public.family_photos;

-- Re-create minimal safe policies
CREATE POLICY "Public read photos"
ON public.family_photos
FOR SELECT
USING (true);

CREATE POLICY "Users can insert own photos"
ON public.family_photos
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owners can update own photos"
ON public.family_photos
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Owners can delete own photos"
ON public.family_photos
FOR DELETE
USING (auth.uid() = user_id);

-- Drop overly permissive comment policies (duplicates included)
DROP POLICY IF EXISTS "Public delete comments" ON public.photo_comments;
DROP POLICY IF EXISTS "Public insert comments" ON public.photo_comments;
DROP POLICY IF EXISTS "Public read comments" ON public.photo_comments;
DROP POLICY IF EXISTS "Public update comments" ON public.photo_comments;
DROP POLICY IF EXISTS "Public delete photo_comments" ON public.photo_comments;
DROP POLICY IF EXISTS "Public insert photo_comments" ON public.photo_comments;
DROP POLICY IF EXISTS "Public read photo_comments" ON public.photo_comments;
DROP POLICY IF EXISTS "Public update photo_comments" ON public.photo_comments;

-- Re-create minimal safe policies for comments
CREATE POLICY "Public read photo_comments"
ON public.photo_comments
FOR SELECT
USING (true);

CREATE POLICY "Users can insert own photo_comments"
ON public.photo_comments
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owners can update own photo_comments"
ON public.photo_comments
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Owners can delete own photo_comments"
ON public.photo_comments
FOR DELETE
USING (auth.uid() = user_id);

-- 4) Enforce MFA for admin access
CREATE OR REPLACE FUNCTION public.has_admin_access_with_mfa(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public', 'auth'
AS $$
  select exists (
    select 1
    from public.org_users ou
    where ou.user_id = _uid
      and ou.status = 'ACTIVE'
      and ou.role in ('SUPER_ADMIN','SUPPORT')
      and ou.mfa_enabled = true
  );
$$;

-- Replace existing admin policies to require MFA
-- alerts
DROP POLICY IF EXISTS "Admins can manage alerts" ON public.alerts;
DROP POLICY IF EXISTS "Admins can read alerts" ON public.alerts;
CREATE POLICY "Admins can manage alerts"
ON public.alerts
FOR ALL
USING (has_admin_access_with_mfa(auth.uid()))
WITH CHECK (has_admin_access_with_mfa(auth.uid()));
CREATE POLICY "Admins can read alerts"
ON public.alerts
FOR SELECT
USING (has_admin_access_with_mfa(auth.uid()));

-- consents
DROP POLICY IF EXISTS "Admins can manage consents" ON public.consents;
DROP POLICY IF EXISTS "Admins can read consents" ON public.consents;
CREATE POLICY "Admins can manage consents"
ON public.consents
FOR ALL
USING (has_admin_access_with_mfa(auth.uid()))
WITH CHECK (has_admin_access_with_mfa(auth.uid()));
CREATE POLICY "Admins can read consents"
ON public.consents
FOR SELECT
USING (has_admin_access_with_mfa(auth.uid()));

-- customers
DROP POLICY IF EXISTS "Admins can manage customers" ON public.customers;
DROP POLICY IF EXISTS "Admins can read customers" ON public.customers;
CREATE POLICY "Admins can manage customers"
ON public.customers
FOR ALL
USING (has_admin_access_with_mfa(auth.uid()))
WITH CHECK (has_admin_access_with_mfa(auth.uid()));
CREATE POLICY "Admins can read customers"
ON public.customers
FOR SELECT
USING (has_admin_access_with_mfa(auth.uid()));

-- audit_log
DROP POLICY IF EXISTS "Admins can read audit_log" ON public.audit_log;
CREATE POLICY "Admins can read audit_log"
ON public.audit_log
FOR SELECT
USING (has_admin_access_with_mfa(auth.uid()));

-- org_users
DROP POLICY IF EXISTS "Admins can manage org_users" ON public.org_users;
DROP POLICY IF EXISTS "Admins can read org_users" ON public.org_users;
CREATE POLICY "Admins can manage org_users"
ON public.org_users
FOR ALL
USING (has_admin_access_with_mfa(auth.uid()))
WITH CHECK (has_admin_access_with_mfa(auth.uid()));
CREATE POLICY "Admins can read org_users"
ON public.org_users
FOR SELECT
USING (has_admin_access_with_mfa(auth.uid()));

-- case_notes
DROP POLICY IF EXISTS "Admins can insert case_notes" ON public.case_notes;
DROP POLICY IF EXISTS "Admins can read case_notes" ON public.case_notes;
CREATE POLICY "Admins can insert case_notes"
ON public.case_notes
FOR INSERT
WITH CHECK (has_admin_access_with_mfa(auth.uid()));
CREATE POLICY "Admins can read case_notes"
ON public.case_notes
FOR SELECT
USING (has_admin_access_with_mfa(auth.uid()));