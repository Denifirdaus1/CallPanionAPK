-- Remove automatic household creation from handle_new_user function
-- This function should only create profile, not household
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public 
AS $$
BEGIN
  -- Only insert into profiles, do not auto-create household
  INSERT INTO public.profiles(id, display_name)
  VALUES (NEW.id, split_part(NEW.email,'@',1))
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;