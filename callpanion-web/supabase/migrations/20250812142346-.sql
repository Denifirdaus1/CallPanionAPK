-- Fix security linter issues: add profiles policies and set function search_path

-- Recreate update_updated_at with fixed search_path
CREATE OR REPLACE FUNCTION app.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- Add RLS policies for app.profiles (self access)
DROP POLICY IF EXISTS "user can select own profile (app)" ON app.profiles;
CREATE POLICY "user can select own profile (app)"
ON app.profiles
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user can update own profile (app)" ON app.profiles;
CREATE POLICY "user can update own profile (app)"
ON app.profiles
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
