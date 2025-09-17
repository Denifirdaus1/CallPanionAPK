-- Fix waitlist table security - Step 1: Remove public read access
-- Only restrict read access, keeping insert functionality for anonymous users

-- Drop any public read policies that might exist
DROP POLICY IF EXISTS "Public can read waitlist" ON public.waitlist;
DROP POLICY IF EXISTS "Anyone can read waitlist" ON public.waitlist;
DROP POLICY IF EXISTS "Public read access" ON public.waitlist;