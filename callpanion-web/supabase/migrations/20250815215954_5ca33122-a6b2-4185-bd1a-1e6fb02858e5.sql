-- Add explicit DELETE policy (audit logs should generally not be deleted except by admins)
CREATE POLICY "health_data_access_log_admin_delete" 
ON public.health_data_access_log 
FOR DELETE 
USING (has_admin_access_with_mfa(auth.uid()));