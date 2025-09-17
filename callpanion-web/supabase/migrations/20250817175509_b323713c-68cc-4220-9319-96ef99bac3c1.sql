-- Fix RLS policies for relatives table and household operations

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "relatives_family_access" ON relatives;
DROP POLICY IF EXISTS "relatives_household_admin_manage" ON relatives;
DROP POLICY IF EXISTS "relatives_household_member_read" ON relatives;

-- Create proper RLS policies for relatives table
CREATE POLICY "relatives_household_member_read" ON relatives
FOR SELECT USING (
  app_is_household_member(household_id) OR 
  has_admin_access_with_mfa(auth.uid())
);

CREATE POLICY "relatives_household_admin_insert" ON relatives
FOR INSERT WITH CHECK (
  app_is_household_admin(household_id) OR 
  has_admin_access_with_mfa(auth.uid()) OR
  (EXISTS (
    SELECT 1 FROM household_members hm 
    WHERE hm.household_id = relatives.household_id 
    AND hm.user_id = auth.uid() 
    AND hm.role = 'FAMILY_PRIMARY'
  ))
);

CREATE POLICY "relatives_household_admin_update" ON relatives
FOR UPDATE USING (
  app_is_household_admin(household_id) OR 
  has_admin_access_with_mfa(auth.uid())
) WITH CHECK (
  app_is_household_admin(household_id) OR 
  has_admin_access_with_mfa(auth.uid())
);

CREATE POLICY "relatives_household_admin_delete" ON relatives
FOR DELETE USING (
  app_is_household_admin(household_id) OR 
  has_admin_access_with_mfa(auth.uid())
);

-- Ensure RLS is enabled
ALTER TABLE relatives ENABLE ROW LEVEL SECURITY;