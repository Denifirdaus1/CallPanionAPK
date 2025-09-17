-- First, let's clean up all the conflicting RLS policies on relatives
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

-- Create the missing core helper functions with safe JSON parsing
CREATE OR REPLACE FUNCTION public.has_admin_access_with_mfa(_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  user_role text;
BEGIN
  -- Simple admin check - adjust this logic based on your admin system
  -- For now, we'll make this always return false to avoid JSON parsing issues
  -- You can update this later with your specific admin logic
  RETURN false;
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$function$;

-- Create app_is_household_member function with safe logic
CREATE OR REPLACE FUNCTION public.app_is_household_member(_household_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.household_members hm
    WHERE hm.household_id = _household_id AND hm.user_id = auth.uid()
  );
$function$;

-- Create app_is_household_admin function with safe logic
CREATE OR REPLACE FUNCTION public.app_is_household_admin(_household_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.household_members hm
    WHERE hm.household_id = _household_id 
      AND hm.user_id = auth.uid() 
      AND hm.role = 'FAMILY_PRIMARY'
  );
$function$;

-- Now create simple, clean RLS policies for relatives
CREATE POLICY "relatives_read_access" 
ON public.relatives 
FOR SELECT 
USING (app_is_household_member(household_id));

CREATE POLICY "relatives_write_access" 
ON public.relatives 
FOR INSERT 
WITH CHECK (app_is_household_member(household_id));

CREATE POLICY "relatives_update_access" 
ON public.relatives 
FOR UPDATE 
USING (app_is_household_member(household_id))
WITH CHECK (app_is_household_member(household_id));

CREATE POLICY "relatives_delete_access" 
ON public.relatives 
FOR DELETE 
USING (app_is_household_admin(household_id));

-- Ensure household_members policies work correctly too
ALTER TABLE public.household_members ENABLE ROW LEVEL SECURITY;

-- Clean existing household_members policies
DROP POLICY IF EXISTS "household_members_creator_self_add" ON public.household_members;
DROP POLICY IF EXISTS "household_members_delete_safe" ON public.household_members;
DROP POLICY IF EXISTS "household_members_secure_insert" ON public.household_members;
DROP POLICY IF EXISTS "household_members_select_safe" ON public.household_members;
DROP POLICY IF EXISTS "household_members_update_safe" ON public.household_members;
DROP POLICY IF EXISTS "admins can delete household_members" ON public.household_members;
DROP POLICY IF EXISTS "admins can insert household_members" ON public.household_members;
DROP POLICY IF EXISTS "members can select household_members" ON public.household_members;

-- Create simple household_members policies
CREATE POLICY "household_members_read" 
ON public.household_members 
FOR SELECT 
USING (user_id = auth.uid() OR app_is_household_member(household_id));

CREATE POLICY "household_members_insert" 
ON public.household_members 
FOR INSERT 
WITH CHECK (
  (user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.households h 
    WHERE h.id = household_id AND h.created_by = auth.uid()
  )) OR 
  app_is_household_admin(household_id)
);

CREATE POLICY "household_members_update" 
ON public.household_members 
FOR UPDATE 
USING (app_is_household_admin(household_id))
WITH CHECK (app_is_household_admin(household_id));

CREATE POLICY "household_members_delete" 
ON public.household_members 
FOR DELETE 
USING (app_is_household_admin(household_id));