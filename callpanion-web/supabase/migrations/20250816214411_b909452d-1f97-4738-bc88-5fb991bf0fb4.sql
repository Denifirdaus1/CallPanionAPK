
-- Allow authenticated users to create (self-seed) a household they own.
-- This fixes "new row violates row-level security policy for table households"
-- during the initial household creation step.

-- Ensure RLS is enabled (already enabled in your project, but safe to include)
ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;

-- Create a permissive INSERT policy that allows a user to create their own household,
-- provided they set created_by = auth.uid().
-- Note: We intentionally do NOT rely on triggers here because RLS WITH CHECK runs before triggers.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'households'
      AND policyname = 'households_self_seed_insert'
  ) THEN
    CREATE POLICY "households_self_seed_insert"
      ON public.households
      FOR INSERT
      WITH CHECK (
        auth.uid() IS NOT NULL
        AND created_by = auth.uid()
      );
  END IF;
END $$;
