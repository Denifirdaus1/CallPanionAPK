-- Fix RLS policies that have unsafe JSON casting

-- First, drop the problematic policies
DROP POLICY IF EXISTS "Edge functions can manage call analysis" ON public.call_analysis;
DROP POLICY IF EXISTS "Edge functions can manage call logs" ON public.call_logs;

-- Create a safer function to check if request is from edge functions
CREATE OR REPLACE FUNCTION public.is_edge_function_request()
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  headers_json jsonb := '{}';
  user_agent text;
BEGIN
  -- Safely parse request headers
  BEGIN
    headers_json := COALESCE(NULLIF(current_setting('request.headers', true), ''), '{}')::jsonb;
    user_agent := headers_json ->> 'user-agent';
  EXCEPTION WHEN OTHERS THEN
    user_agent := '';
  END;
  
  -- Check if the request is from service role AND has edge function user agent
  RETURN is_service_role() AND (user_agent LIKE '%supabase-edge-functions%');
END;
$function$;

-- Recreate the policies with safe JSON handling
CREATE POLICY "Edge functions can manage call analysis" 
ON public.call_analysis 
FOR ALL 
USING (is_edge_function_request())
WITH CHECK (is_edge_function_request());

CREATE POLICY "Edge functions can manage call logs" 
ON public.call_logs 
FOR ALL 
USING (is_edge_function_request())
WITH CHECK (is_edge_function_request());