-- Find all functions that don't have search_path set
SELECT 
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as signature,
  CASE 
    WHEN p.proconfig IS NULL THEN 'No search_path set'
    WHEN NOT EXISTS (
      SELECT 1 FROM unnest(p.proconfig) AS config 
      WHERE config LIKE 'search_path%'
    ) THEN 'No search_path set'
    ELSE 'search_path configured'
  END as search_path_status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
  AND p.prokind = 'f'
  AND (p.proconfig IS NULL OR NOT EXISTS (
    SELECT 1 FROM unnest(p.proconfig) AS config 
    WHERE config LIKE 'search_path%'
  ))
ORDER BY p.proname;