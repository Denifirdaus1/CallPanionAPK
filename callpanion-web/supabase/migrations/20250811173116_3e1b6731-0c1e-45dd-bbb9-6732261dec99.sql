-- 1) Enforce domain allow-list on signup by attaching trigger to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 2) Ensure user_id is set automatically on inserts
DROP TRIGGER IF EXISTS set_user_id_family_photos_trigger ON public.family_photos;
CREATE TRIGGER set_user_id_family_photos_trigger
  BEFORE INSERT ON public.family_photos
  FOR EACH ROW EXECUTE FUNCTION public.set_user_id_family_photos();

DROP TRIGGER IF EXISTS set_user_id_photo_comments_trigger ON public.photo_comments;
CREATE TRIGGER set_user_id_photo_comments_trigger
  BEFORE INSERT ON public.photo_comments
  FOR EACH ROW EXECUTE FUNCTION public.set_user_id_photo_comments();

-- 3) Keep updated_at fresh across tables that have it
DROP TRIGGER IF EXISTS update_alerts_updated_at ON public.alerts;
CREATE TRIGGER update_alerts_updated_at
  BEFORE UPDATE ON public.alerts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_consents_updated_at ON public.consents;
CREATE TRIGGER update_consents_updated_at
  BEFORE UPDATE ON public.consents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_customers_updated_at ON public.customers;
CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_org_users_updated_at ON public.org_users;
CREATE TRIGGER update_org_users_updated_at
  BEFORE UPDATE ON public.org_users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) Tighten RLS: restrict public reads to authenticated users only
-- family_photos
DROP POLICY IF EXISTS "Public read photos" ON public.family_photos;
CREATE POLICY "Authenticated can read photos"
  ON public.family_photos
  FOR SELECT
  TO authenticated
  USING (true);

-- photo_comments
DROP POLICY IF EXISTS "Public read photo_comments" ON public.photo_comments;
CREATE POLICY "Authenticated can read photo_comments"
  ON public.photo_comments
  FOR SELECT
  TO authenticated
  USING (true);

-- profiles
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Profiles are viewable by authenticated users"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (true);
