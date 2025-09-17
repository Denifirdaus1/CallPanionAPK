-- Check existing function signature
SELECT p.proname, p.proargnames, pg_get_function_identity_arguments(p.oid) as signature
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' AND p.proname = 'has_admin_access_with_mfa';