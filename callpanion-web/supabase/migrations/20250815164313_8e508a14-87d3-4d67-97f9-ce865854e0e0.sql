-- CRITICAL SECURITY FIXES FOR IDENTIFIED VULNERABILITIES

-- FIX 1: Secure household_members table - prevent privilege escalation
DROP POLICY IF EXISTS "household_members_insert_safe" ON public.household_members;
DROP POLICY IF EXISTS "Users can insert their own household membership" ON public.household_members;

-- Only allow invite acceptance or admin/household admin to add members
CREATE POLICY "household_members_secure_insert" ON public.household_members
FOR INSERT TO authenticated WITH CHECK (
  -- Option 1: Self-insertion only if there's a valid invite
  (user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.invites i 
    WHERE i.household_id = household_members.household_id 
      AND i.email = (SELECT email FROM auth.users WHERE id = auth.uid())
      AND i.expires_at > now() 
      AND i.accepted_at IS NULL
  )) OR
  -- Option 2: Household admin can add members
  app_is_household_admin(household_id) OR
  -- Option 3: Super admin with MFA
  has_admin_access_with_mfa(auth.uid())
);

-- FIX 2: Secure invites table - prevent unauthorized invite acceptance
DROP POLICY IF EXISTS "invites_update_limited" ON public.invites;

CREATE POLICY "invites_secure_update" ON public.invites
FOR UPDATE TO authenticated USING (
  -- Only allow updating your own invite (by email match) or household admin
  (email = (SELECT email FROM auth.users WHERE id = auth.uid()) AND expires_at > now()) OR
  app_is_household_admin(household_id) OR
  has_admin_access_with_mfa(auth.uid())
) WITH CHECK (
  -- Same check for the updated data
  (email = (SELECT email FROM auth.users WHERE id = auth.uid()) AND expires_at > now()) OR
  app_is_household_admin(household_id) OR
  has_admin_access_with_mfa(auth.uid())
);

-- FIX 3: Secure security_events table - only service role should insert
DROP POLICY IF EXISTS "System can insert security events" ON public.security_events;

CREATE POLICY "service_role_only_insert_security_events" ON public.security_events
FOR INSERT WITH CHECK (is_service_role());

-- FIX 4: Tighten waitlist policies - prevent unauthorized updates
DROP POLICY IF EXISTS "Admins can update waitlist" ON public.waitlist;
DROP POLICY IF EXISTS "waitlist_super_admin_mfa_only" ON public.waitlist;

CREATE POLICY "waitlist_admin_mfa_only" ON public.waitlist
FOR ALL TO authenticated USING (
  is_super_admin(auth.uid()) AND has_admin_access_with_mfa(auth.uid())
);