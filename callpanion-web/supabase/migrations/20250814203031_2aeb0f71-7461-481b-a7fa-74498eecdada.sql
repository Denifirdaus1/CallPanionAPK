-- Fix critical security vulnerability: Remove unrestricted service access to call data
-- Current policies with "USING condition: true" allow any authenticated user to access all call data

-- First, create a secure service authentication function
CREATE OR REPLACE FUNCTION public.is_service_role()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public', 'auth'
AS $$
  -- Check if the current request is from a legitimate service account
  -- This verifies the JWT contains the service_role claim
  SELECT COALESCE(
    (current_setting('request.jwt.claims', true)::json ->> 'role') = 'service_role',
    false
  );
$$;

-- Drop the dangerous unrestricted policies
DROP POLICY IF EXISTS "Service can manage call analysis" ON call_analysis;
DROP POLICY IF EXISTS "Service can manage call logs" ON call_logs;

-- Create secure service policies that verify legitimate service role
CREATE POLICY "Verified service can manage call analysis" 
ON call_analysis 
FOR ALL 
USING (is_service_role())
WITH CHECK (is_service_role());

CREATE POLICY "Verified service can manage call logs" 
ON call_logs 
FOR ALL 
USING (is_service_role())
WITH CHECK (is_service_role());

-- Add additional policy to allow edge functions to manage call data
-- Edge functions run with service_role but we want to be extra cautious
CREATE POLICY "Edge functions can manage call analysis" 
ON call_analysis 
FOR ALL 
USING (
  is_service_role() AND 
  current_setting('request.headers', true)::json ->> 'user-agent' LIKE '%supabase-edge-functions%'
)
WITH CHECK (
  is_service_role() AND 
  current_setting('request.headers', true)::json ->> 'user-agent' LIKE '%supabase-edge-functions%'
);

CREATE POLICY "Edge functions can manage call logs" 
ON call_logs 
FOR ALL 
USING (
  is_service_role() AND 
  current_setting('request.headers', true)::json ->> 'user-agent' LIKE '%supabase-edge-functions%'
)
WITH CHECK (
  is_service_role() AND 
  current_setting('request.headers', true)::json ->> 'user-agent' LIKE '%supabase-edge-functions%'
);