-- Fix the signup function to use the correct column name
CREATE OR REPLACE FUNCTION public.create_family_on_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'auth'
AS $$
BEGIN
  -- Insert into profiles with correct column name
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, 
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', ''))
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