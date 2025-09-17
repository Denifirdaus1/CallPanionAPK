-- Address linter: ensure views run with invoker's privileges
DO $$
BEGIN
  -- Set customers_list_masked to SECURITY INVOKER if it exists
  IF EXISTS (
    SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'customers_list_masked'
  ) THEN
    ALTER VIEW public.customers_list_masked SET (security_invoker = on);
  END IF;
END $$;