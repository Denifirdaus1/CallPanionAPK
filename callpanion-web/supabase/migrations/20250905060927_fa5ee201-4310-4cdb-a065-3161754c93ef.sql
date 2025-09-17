-- Fix the handle_new_user function to use correct enum value
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public 
AS $$
DECLARE 
  _hid uuid;
BEGIN
  -- Insert into profiles with correct column name
  INSERT INTO public.profiles(id, display_name)
  VALUES (NEW.id, split_part(NEW.email,'@',1))
  ON CONFLICT (id) DO NOTHING;

  -- Create a household for the user
  INSERT INTO public.households(name, created_by, timezone)
  VALUES (CONCAT('Family of ', COALESCE(NEW.email,'')), NEW.id, 'UTC')
  RETURNING id INTO _hid;

  -- Add user as FAMILY_PRIMARY (not 'owner')
  INSERT INTO public.household_members(household_id, user_id, role, added_by)
  VALUES (_hid, NEW.id, 'FAMILY_PRIMARY'::household_member_role, NEW.id);

  RETURN NEW;
END;
$$;