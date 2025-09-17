-- Add RLS policies for health_data_consents table
-- This table manages consent for health data access

-- Policy 1: Admins with MFA can manage all consents
CREATE POLICY "health_data_consents_admin_full_access" 
ON public.health_data_consents 
FOR ALL 
USING (has_admin_access_with_mfa(auth.uid()))
WITH CHECK (has_admin_access_with_mfa(auth.uid()));

-- Policy 2: Family primary members can manage consents for relatives in their household
CREATE POLICY "health_data_consents_family_manage" 
ON public.health_data_consents 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 
    FROM public.relatives r
    JOIN public.household_members hm ON hm.household_id = r.household_id
    WHERE r.id = health_data_consents.relative_id
      AND hm.user_id = auth.uid()
      AND hm.role = 'FAMILY_PRIMARY'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM public.relatives r
    JOIN public.household_members hm ON hm.household_id = r.household_id
    WHERE r.id = health_data_consents.relative_id
      AND hm.user_id = auth.uid()
      AND hm.role = 'FAMILY_PRIMARY'
  )
);

-- Policy 3: Users can view consents that have been granted to them
CREATE POLICY "health_data_consents_grantee_view" 
ON public.health_data_consents 
FOR SELECT 
USING (granted_to_user_id = auth.uid());