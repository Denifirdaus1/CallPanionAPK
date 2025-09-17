-- Fix critical security vulnerability: Restrict access to customers_list_masked view
-- This view currently has no RLS policies, making it publicly accessible

-- Enable RLS on customers_list_masked
ALTER TABLE customers_list_masked ENABLE ROW LEVEL SECURITY;

-- Add RLS policy to restrict access to admins only
CREATE POLICY "Admins can read customers_list_masked" 
ON customers_list_masked 
FOR SELECT 
USING (has_admin_access_with_mfa(auth.uid()));

-- Optional: Add policy for authenticated users with specific roles if needed
-- Uncomment the next lines if family members need access to this view
-- CREATE POLICY "Family members can read customers_list_masked" 
-- ON customers_list_masked 
-- FOR SELECT 
-- USING (auth.uid() IS NOT NULL AND get_current_user_role(auth.uid()) IN ('FAMILY_PRIMARY', 'FAMILY_MEMBER'));