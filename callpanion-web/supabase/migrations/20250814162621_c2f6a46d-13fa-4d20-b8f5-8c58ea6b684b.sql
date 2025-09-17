-- Update database functions to have secure search_path
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

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

CREATE OR REPLACE FUNCTION public.set_user_id_family_photos()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.user_id IS NULL THEN
    NEW.user_id := auth.uid();
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_user_id_photo_comments()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.user_id IS NULL THEN
    NEW.user_id := auth.uid();
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_created_by_households()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
BEGIN
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_created_by_customers()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
BEGIN
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  RETURN NEW;
END; 
$function$;