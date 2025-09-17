-- RLS explicit-deny for internal rate limiter table
DO $$ BEGIN
  IF to_regclass('public.invite_rate_limiter') IS NOT NULL THEN
    -- ensure RLS is on (idempotent)
    EXECUTE 'ALTER TABLE public.invite_rate_limiter ENABLE ROW LEVEL SECURITY';

    -- Deny SELECT from any client role
    EXECUTE $$CREATE POLICY invite_rate_limiter_deny_select
      ON public.invite_rate_limiter
      FOR SELECT TO authenticated, anon
      USING (false)$$;

    -- Deny INSERT
    EXECUTE $$CREATE POLICY invite_rate_limiter_deny_insert
      ON public.invite_rate_limiter
      FOR INSERT TO authenticated, anon
      WITH CHECK (false)$$;

    -- Deny UPDATE
    EXECUTE $$CREATE POLICY invite_rate_limiter_deny_update
      ON public.invite_rate_limiter
      FOR UPDATE TO authenticated, anon
      USING (false)$$;

    -- Deny DELETE
    EXECUTE $$CREATE POLICY invite_rate_limiter_deny_delete
      ON public.invite_rate_limiter
      FOR DELETE TO authenticated, anon
      USING (false)$$;
  END IF;
END $$;