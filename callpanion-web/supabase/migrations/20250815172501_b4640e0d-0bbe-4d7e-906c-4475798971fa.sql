-- Fix waitlist table security by adding proper SELECT policy
-- Remove the overly broad ALL policy and create specific policies

DROP POLICY IF EXISTS "waitlist_admin_mfa_only" ON waitlist;

-- Allow only super admins with MFA to read waitlist data
CREATE POLICY "waitlist_select_admin_only" 
ON waitlist 
FOR SELECT 
USING (is_super_admin(auth.uid()) AND has_admin_access_with_mfa(auth.uid()));

-- Allow only super admins with MFA to update/delete waitlist data  
CREATE POLICY "waitlist_manage_admin_only"
ON waitlist 
FOR ALL
USING (is_super_admin(auth.uid()) AND has_admin_access_with_mfa(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()) AND has_admin_access_with_mfa(auth.uid()));

-- Keep the existing insert policy for public signups (unchanged)
-- waitlist_insert_only policy already exists and is correct