-- Create a SECURITY DEFINER helper to safely read the current user's email without granting direct access to auth.users
CREATE OR REPLACE FUNCTION public.current_user_email()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT email FROM auth.users WHERE id = auth.uid();
$$;

-- Replace risky policy that directly queried auth.users inside RLS (causing permission denied)
DROP POLICY IF EXISTS "household_members_secure_insert" ON public.household_members;

CREATE POLICY "household_members_secure_insert"
ON public.household_members
FOR INSERT
WITH CHECK (
  (
    user_id = auth.uid() AND EXISTS (
      SELECT 1 FROM public.invites i
      WHERE i.household_id = household_members.household_id
        AND i.email = public.current_user_email()
        AND i.expires_at > now()
        AND i.accepted_at IS NULL
    )
  )
  OR app_is_household_admin(household_id)
  OR has_admin_access_with_mfa(auth.uid())
);