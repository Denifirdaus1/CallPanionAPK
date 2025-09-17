
-- 1) Allow signups by removing the hard @callpanion.co.uk restriction
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
BEGIN
  -- Domain restriction removed to allow broader signups

  -- Ensure profile row exists
  INSERT INTO public.profiles (id, display_name, role)
  VALUES (NEW.id, coalesce(NEW.raw_user_meta_data ->> 'display_name', ''), coalesce(NEW.raw_user_meta_data ->> 'role', NULL))
  ON CONFLICT (id) DO NOTHING;

  -- Upsert org_users entry for this email/user
  INSERT INTO public.org_users (email, user_id, role, status)
  VALUES (NEW.email, NEW.id, 'SUPPORT', 'ACTIVE')
  ON CONFLICT (email)
  DO UPDATE SET user_id = EXCLUDED.user_id, status = 'ACTIVE', updated_at = now();

  -- Audit
  PERFORM public.log_audit(NEW.id, NEW.email, 'user_signup', 'auth.users', NEW.id::text, jsonb_build_object('email', NEW.email));

  RETURN NEW;
END;
$function$;

-- 2) Ensure RLS is enabled on key tables (no-op if already enabled)
ALTER TABLE public.family_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photo_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3) Create BEFORE INSERT triggers to auto-set user_id if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_user_id_family_photos_trigger') THEN
    CREATE TRIGGER set_user_id_family_photos_trigger
    BEFORE INSERT ON public.family_photos
    FOR EACH ROW
    EXECUTE FUNCTION public.set_user_id_family_photos();
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_user_id_photo_comments_trigger') THEN
    CREATE TRIGGER set_user_id_photo_comments_trigger
    BEFORE INSERT ON public.photo_comments
    FOR EACH ROW
    EXECUTE FUNCTION public.set_user_id_photo_comments();
  END IF;
END$$;

-- 4) Tighten execution permissions on increment_photo_likes
REVOKE ALL ON FUNCTION public.increment_photo_likes(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_photo_likes(uuid) TO authenticated;

-- 5) Restrict profiles SELECT to "own profile only"
DO $$
BEGIN
  -- Drop broad read policy if it exists
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'Profiles are viewable by authenticated users'
  ) THEN
    DROP POLICY "Profiles are viewable by authenticated users" ON public.profiles;
  END IF;

  -- Create own-profile read policy if not already present
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'Users can read their own profile'
  ) THEN
    CREATE POLICY "Users can read their own profile"
      ON public.profiles
      FOR SELECT
      USING (auth.uid() = id);
  END IF;
END$$;
