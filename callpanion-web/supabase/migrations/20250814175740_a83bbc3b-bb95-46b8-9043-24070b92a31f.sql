-- Fix waitlist table security to prevent email harvesting by competitors
-- This addresses the security concern about public access to customer email addresses

-- First, let's ensure there are no public read policies on the waitlist table
-- Drop any existing public read policies if they exist
DROP POLICY IF EXISTS "Public can read waitlist" ON public.waitlist;
DROP POLICY IF EXISTS "Anyone can read waitlist" ON public.waitlist;
DROP POLICY IF EXISTS "Public read access" ON public.waitlist;

-- Ensure only admins can read waitlist data (this policy should already exist but let's be explicit)
-- First drop and recreate to ensure it's the only read policy
DROP POLICY IF EXISTS "Admins can read waitlist" ON public.waitlist;

CREATE POLICY "Admins can read waitlist" 
ON public.waitlist 
FOR SELECT 
USING (has_admin_access_with_mfa(auth.uid()));

-- Keep the insert policy for anonymous users to join the waitlist
-- This is essential for the waitlist functionality
-- The existing policy should be fine but let's ensure it's restrictive on what can be inserted

-- Update the insert policy to be more secure while maintaining functionality
DROP POLICY IF EXISTS "Anyone can join waitlist" ON public.waitlist;

CREATE POLICY "Anonymous can join waitlist" 
ON public.waitlist 
FOR INSERT 
WITH CHECK (
  -- Allow inserts but ensure no sensitive admin fields can be set
  email IS NOT NULL 
  AND email != ''
  AND consent = true
  -- Prevent setting of admin-only fields
  AND confirmed_at IS NULL
  AND unsubscribed_at IS NULL
);

-- Ensure no update or delete policies exist for non-admins
DROP POLICY IF EXISTS "Public can update waitlist" ON public.waitlist;
DROP POLICY IF EXISTS "Public can delete waitlist" ON public.waitlist;

-- Add admin-only policies for updates (for confirmation/unsubscription management)
CREATE POLICY "Admins can update waitlist" 
ON public.waitlist 
FOR UPDATE 
USING (has_admin_access_with_mfa(auth.uid()))
WITH CHECK (has_admin_access_with_mfa(auth.uid()));

-- No delete policy - waitlist entries should be preserved for analytics