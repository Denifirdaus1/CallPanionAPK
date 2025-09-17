-- Security Fix: Restrict site content access to authenticated users only
-- Remove public access and require authentication

-- Drop the existing public access policy
DROP POLICY IF EXISTS "Anyone can read site content" ON public.site_content;

-- Add new policy requiring authentication
CREATE POLICY "Authenticated users can read site content" 
ON public.site_content 
FOR SELECT 
USING (auth.uid() IS NOT NULL);