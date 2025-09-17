-- Fix infinite recursion in RLS policies

-- First, drop the problematic policies
DROP POLICY IF EXISTS "Household members can read households" ON public.households;
DROP POLICY IF EXISTS "Primary can delete households" ON public.households;
DROP POLICY IF EXISTS "Primary can manage households" ON public.households;
DROP POLICY IF EXISTS "household_select_for_members" ON public.households;
DROP POLICY IF EXISTS "household_update_for_members" ON public.households;
DROP POLICY IF EXISTS "household members can select households" ON public.households;

DROP POLICY IF EXISTS "Members can read household_members" ON public.household_members;
DROP POLICY IF EXISTS "Primary can delete household_members" ON public.household_members;
DROP POLICY IF EXISTS "Primary can insert members" ON public.household_members;
DROP POLICY IF EXISTS "Primary can update household_members" ON public.household_members;
DROP POLICY IF EXISTS "members_select" ON public.household_members;
DROP POLICY IF EXISTS "admins can delete household_members" ON public.household_members;
DROP POLICY IF EXISTS "admins can insert household_members" ON public.household_members;
DROP POLICY IF EXISTS "members can select household_members" ON public.household_members;

-- Create security definer functions to avoid recursion
CREATE OR REPLACE FUNCTION public.app_is_household_member(_household_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public', 'auth'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.household_members hm
    WHERE hm.household_id = _household_id AND hm.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.app_is_household_admin(_household_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public', 'auth'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.household_members hm
    WHERE hm.household_id = _household_id 
      AND hm.user_id = auth.uid() 
      AND hm.role = 'FAMILY_PRIMARY'
  );
$$;

CREATE OR REPLACE FUNCTION public.app_is_household_creator(_household_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public', 'auth'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.households h
    WHERE h.id = _household_id AND h.created_by = auth.uid()
  );
$$;

-- Create new safe policies for households
CREATE POLICY "household_select_safe" ON public.households
FOR SELECT TO authenticated
USING (
  app_is_household_member(id) OR 
  app_is_household_creator(id) OR 
  has_admin_access_with_mfa(auth.uid())
);

CREATE POLICY "household_update_safe" ON public.households
FOR UPDATE TO authenticated
USING (
  app_is_household_admin(id) OR 
  app_is_household_creator(id) OR 
  has_admin_access_with_mfa(auth.uid())
)
WITH CHECK (
  app_is_household_admin(id) OR 
  app_is_household_creator(id) OR 
  has_admin_access_with_mfa(auth.uid())
);

CREATE POLICY "household_delete_safe" ON public.households
FOR DELETE TO authenticated
USING (
  app_is_household_admin(id) OR 
  has_admin_access_with_mfa(auth.uid())
);

-- Create new safe policies for household_members
CREATE POLICY "household_members_select_safe" ON public.household_members
FOR SELECT TO authenticated
USING (
  user_id = auth.uid() OR 
  app_is_household_member(household_id) OR 
  has_admin_access_with_mfa(auth.uid())
);

CREATE POLICY "household_members_insert_safe" ON public.household_members
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid() OR 
  app_is_household_admin(household_id) OR 
  has_admin_access_with_mfa(auth.uid())
);

CREATE POLICY "household_members_update_safe" ON public.household_members
FOR UPDATE TO authenticated
USING (
  app_is_household_admin(household_id) OR 
  has_admin_access_with_mfa(auth.uid())
)
WITH CHECK (
  app_is_household_admin(household_id) OR 
  has_admin_access_with_mfa(auth.uid())
);

CREATE POLICY "household_members_delete_safe" ON public.household_members
FOR DELETE TO authenticated
USING (
  app_is_household_admin(household_id) OR 
  has_admin_access_with_mfa(auth.uid())
);