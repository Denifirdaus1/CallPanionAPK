-- Fix security warnings by setting search_path on functions

CREATE OR REPLACE FUNCTION is_member(_family uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1 FROM family_members
    WHERE family_id = _family AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION is_admin(_family uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1 FROM family_members
    WHERE family_id = _family AND user_id = auth.uid() AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION create_family_on_signup()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Insert into profiles
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, 
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', ''), 
    NEW.email)
  ON CONFLICT (id) DO NOTHING;

  -- Create a family for the user if they don't have one
  IF NOT EXISTS (SELECT 1 FROM family_members WHERE user_id = NEW.id) THEN
    INSERT INTO families (name, created_by)
    VALUES (COALESCE(NEW.raw_user_meta_data ->> 'display_name', 'My Family') || '''s Family', NEW.id);
    
    INSERT INTO family_members (family_id, user_id, role, can_view_family_health)
    SELECT f.id, NEW.id, 'admin', true
    FROM families f
    WHERE f.created_by = NEW.id
    ORDER BY f.created_at DESC
    LIMIT 1;
  END IF;

  RETURN NEW;
END;
$$;