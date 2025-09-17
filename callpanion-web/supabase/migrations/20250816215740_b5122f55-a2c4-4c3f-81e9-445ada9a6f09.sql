-- Allow authenticated users to create (self-seed) a household they own.
-- Ensures initial household creation passes RLS when created_by is set to auth.uid().

-- Enable RLS (safe if already enabled)
ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;

-- Create insert policy if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'households'
      AND policyname = 'households_self_seed_insert'
  ) THEN
    CREATE POLICY "households_self_seed_insert"
      ON public.households
      FOR INSERT
      TO authenticated
      WITH CHECK (
        auth.uid() IS NOT NULL AND created_by = auth.uid()
      );
  END IF;
END $$;