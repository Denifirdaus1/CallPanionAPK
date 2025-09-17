-- Fix remaining JSON errors by redefining admin helper without JSON parsing
CREATE OR REPLACE FUNCTION public.has_admin_access_with_mfa(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.org_users ou
    WHERE ou.user_id = _uid
      AND ou.mfa_enabled = true
      AND ou.status::text = 'ACTIVE'
      AND ou.role::text IN ('SUPER_ADMIN','ADMIN','SUPPORT')
  );
$$;

-- Simplify and de-duplicate relatives RLS policies
ALTER TABLE public.relatives ENABLE ROW LEVEL SECURITY;

-- Drop conflicting/duplicate policies
DROP POLICY IF EXISTS "relatives_secure_access" ON public.relatives;
DROP POLICY IF EXISTS "relatives_household_insert" ON public.relatives;
DROP POLICY IF EXISTS "deny_all_public_access" ON public.relatives;
DROP POLICY IF EXISTS "relatives_household_member_read" ON public.relatives;
DROP POLICY IF EXISTS "relatives_update_for_members" ON public.relatives;
DROP POLICY IF EXISTS "relatives_insert_by_member" ON public.relatives;
DROP POLICY IF EXISTS "relatives_household_admin_insert" ON public.relatives;
DROP POLICY IF EXISTS "relatives_household_admin_update" ON public.relatives;
DROP POLICY IF EXISTS "relatives_household_admin_delete" ON public.relatives;
DROP POLICY IF EXISTS "relatives_select_household_members" ON public.relatives;
DROP POLICY IF EXISTS "relatives_insert_household_members" ON public.relatives;
DROP POLICY IF EXISTS "relatives_update_household_members" ON public.relatives;
DROP POLICY IF EXISTS "relatives_delete_household_admins" ON public.relatives;
DROP POLICY IF EXISTS "relatives_read_access" ON public.relatives;
DROP POLICY IF EXISTS "relatives_write_access" ON public.relatives;
DROP POLICY IF EXISTS "relatives_update_access" ON public.relatives;
DROP POLICY IF EXISTS "relatives_delete_access" ON public.relatives;

-- Create clean, minimal policies
CREATE POLICY "relatives_read_access"
ON public.relatives
FOR SELECT
USING (app_is_household_member(household_id) OR has_admin_access_with_mfa(auth.uid()));

CREATE POLICY "relatives_write_access"
ON public.relatives
FOR INSERT
WITH CHECK (app_is_household_member(household_id) OR has_admin_access_with_mfa(auth.uid()));

CREATE POLICY "relatives_update_access"
ON public.relatives
FOR UPDATE
USING (app_is_household_member(household_id) OR has_admin_access_with_mfa(auth.uid()))
WITH CHECK (app_is_household_member(household_id) OR has_admin_access_with_mfa(auth.uid()));

CREATE POLICY "relatives_delete_access"
ON public.relatives
FOR DELETE
USING (app_is_household_admin(household_id) OR has_admin_access_with_mfa(auth.uid()));