-- Enable RLS on health_data_access_log table
ALTER TABLE public.health_data_access_log ENABLE ROW LEVEL SECURITY;

-- Policy 1: Admins with MFA can access all health data access logs
CREATE POLICY "health_data_access_log_admin_full_access" 
ON public.health_data_access_log 
FOR ALL 
USING (has_admin_access_with_mfa(auth.uid()))
WITH CHECK (has_admin_access_with_mfa(auth.uid()));

-- Policy 2: Family primary members can view logs for relatives in their household
CREATE POLICY "health_data_access_log_family_access" 
ON public.health_data_access_log 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 
    FROM public.relatives r
    JOIN public.household_members hm ON hm.household_id = r.household_id
    WHERE r.id = health_data_access_log.relative_id
      AND hm.user_id = auth.uid()
      AND hm.role = 'FAMILY_PRIMARY'
  )
);

-- Policy 3: Users can view logs of their own access attempts (for transparency)
CREATE POLICY "health_data_access_log_own_access" 
ON public.health_data_access_log 
FOR SELECT 
USING (accessor_user_id = auth.uid());

-- Policy 4: Only service role can insert new log entries (for audit integrity)
CREATE POLICY "health_data_access_log_service_insert" 
ON public.health_data_access_log 
FOR INSERT 
WITH CHECK (is_service_role());

-- Policy 5: Deny all other access by default
CREATE POLICY "health_data_access_log_deny_default" 
ON public.health_data_access_log 
FOR ALL 
USING (false);