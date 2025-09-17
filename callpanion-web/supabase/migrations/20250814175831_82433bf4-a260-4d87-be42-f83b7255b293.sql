-- Fix waitlist table security - Step 2: Enhance insert policy security
-- Make the insert policy more restrictive while maintaining anonymous signup functionality

-- Update the insert policy to prevent abuse
DROP POLICY IF EXISTS "Anyone can join waitlist" ON public.waitlist;

CREATE POLICY "Secure waitlist signup" 
ON public.waitlist 
FOR INSERT 
WITH CHECK (
  -- Require valid email and consent
  email IS NOT NULL 
  AND email != ''
  AND consent = true
  -- Prevent manipulation of admin-only timestamp fields
  AND confirmed_at IS NULL
  AND unsubscribed_at IS NULL
);