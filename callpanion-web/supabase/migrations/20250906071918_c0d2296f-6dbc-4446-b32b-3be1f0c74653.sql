-- Check if pg_cron extension is enabled and create/update the cron job
SELECT cron.schedule(
  'callpanion-daily-calls',
  '*/5 * * * *', -- every 5 minutes
  $$
  UPDATE public.cron_heartbeat 
  SET last_run = now(), status = 'running'
  WHERE job_name = 'callpanion-daily-calls';

  INSERT INTO public.cron_heartbeat (job_name, last_run, status)
  VALUES ('callpanion-daily-calls', now(), 'running')
  ON CONFLICT (job_name) DO UPDATE SET last_run = now(), status = 'running';

  SELECT net.http_post(
    url := 'https://umjtepmdwfyfhdzbkyli.supabase.co/functions/v1/schedulerDailyCalls',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtanRlcG1kd2Z5ZmhkemJreWxpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDkwNTI1OSwiZXhwIjoyMDcwNDgxMjU5fQ.8TYM-WmrIrIZfSdcVh5w8Fj2k7BvLYPv8NdLNJM9CXk"}'::jsonb,
    body := '{"trigger": "cron"}'::jsonb
  );

  UPDATE public.cron_heartbeat 
  SET status = 'completed', details = jsonb_build_object('last_execution', now())
  WHERE job_name = 'callpanion-daily-calls';
  $$
);