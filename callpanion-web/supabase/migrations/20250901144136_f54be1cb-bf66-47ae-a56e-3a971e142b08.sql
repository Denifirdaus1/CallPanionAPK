-- Raw webhook archive (optional but very useful)
CREATE TABLE IF NOT EXISTS app.webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  provider_call_id TEXT,
  household_id UUID,
  payload JSONB NOT NULL,
  signature TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE app.webhook_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='app' AND tablename='webhook_events' AND policyname='service role all webhook_events'
  ) THEN
    CREATE POLICY "service role all webhook_events"
      ON app.webhook_events
      FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

-- make sure the upsert in app.call_summaries is valid
CREATE UNIQUE INDEX IF NOT EXISTS uq_call_summaries_provider_call_id
  ON app.call_summaries(provider_call_id);

-- for quick audits & housekeeping
CREATE INDEX IF NOT EXISTS idx_webhook_events_created_at
  ON app.webhook_events(created_at DESC);