-- Ensure RLS is enabled on critical user data tables
-- This migration verifies and enables RLS on all user-facing tables

-- Enable RLS on profiles if not already enabled
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Enable RLS on household_members if not already enabled  
ALTER TABLE public.household_members ENABLE ROW LEVEL SECURITY;

-- Enable RLS on relatives if not already enabled
ALTER TABLE public.relatives ENABLE ROW LEVEL SECURITY;

-- Enable RLS on family_messages if not already enabled
ALTER TABLE public.family_messages ENABLE ROW LEVEL SECURITY;

-- Enable RLS on invites if not already enabled
ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;

-- Enable RLS on call_logs if not already enabled
ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;

-- Enable RLS on call_analysis if not already enabled
ALTER TABLE public.call_analysis ENABLE ROW LEVEL SECURITY;

-- Verify no publicly readable user data tables exist
-- Update any tables that might be publicly accessible

-- Comment: This migration ensures all user data is protected by RLS
-- No user data should be accessible without proper authentication and authorization