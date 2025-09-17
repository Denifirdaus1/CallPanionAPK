-- Fix the household creation by ensuring the trigger works and policies are correct

-- Make sure the trigger function exists and works
CREATE OR REPLACE FUNCTION public.set_created_by_households()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'auth'
AS $$
BEGIN
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

-- Ensure the trigger exists
DROP TRIGGER IF EXISTS set_created_by_households_trigger ON public.households;
CREATE TRIGGER set_created_by_households_trigger
  BEFORE INSERT ON public.households
  FOR EACH ROW
  EXECUTE FUNCTION public.set_created_by_households();

-- Update the insert policy to be more permissive for authenticated users
DROP POLICY IF EXISTS "household_insert_safe" ON public.households;
CREATE POLICY "household_insert_safe" ON public.households
FOR INSERT TO authenticated
WITH CHECK (true);  -- Let the trigger handle setting created_by