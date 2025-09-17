-- Drop the conflicting deny-all policy
DROP POLICY IF EXISTS "health_data_access_log_deny_default" ON public.health_data_access_log;

-- Update the service insert policy to be more specific about roles
DROP POLICY IF EXISTS "health_data_access_log_service_insert" ON public.health_data_access_log;

-- Recreate the service insert policy with proper conditions
CREATE POLICY "health_data_access_log_service_insert" 
ON public.health_data_access_log 
FOR INSERT 
WITH CHECK (
  is_service_role() OR 
  has_admin_access_with_mfa(auth.uid())
);

-- Add a policy to deny unauthorized updates and deletes (audit integrity)
CREATE POLICY "health_data_access_log_deny_modifications" 
ON public.health_data_access_log 
FOR UPDATE 
USING (false);