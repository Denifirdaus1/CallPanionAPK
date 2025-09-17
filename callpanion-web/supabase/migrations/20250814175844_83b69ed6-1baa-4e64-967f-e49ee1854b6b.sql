-- Fix waitlist table security - Step 3: Add admin update policy
-- Allow admins to manage waitlist entries for confirmation/unsubscription

CREATE POLICY "Admins can update waitlist" 
ON public.waitlist 
FOR UPDATE 
USING (has_admin_access_with_mfa(auth.uid()))
WITH CHECK (has_admin_access_with_mfa(auth.uid()));