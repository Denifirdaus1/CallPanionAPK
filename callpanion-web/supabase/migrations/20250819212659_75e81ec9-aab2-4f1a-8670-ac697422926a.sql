-- Security Fix: Add trigger to prevent unauthorized role changes on profiles table
-- This ensures only admins with MFA can change user roles

CREATE TRIGGER prevent_profiles_role_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_unauthorized_role_changes();

-- Security Fix: Move pgvector extension to extensions schema
-- This removes the security warning about extensions in public schema

DROP EXTENSION IF EXISTS vector;
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;