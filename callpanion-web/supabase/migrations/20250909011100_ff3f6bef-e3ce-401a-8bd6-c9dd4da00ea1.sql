-- Setup separate cron jobs for batch calls and in-app calls
-- This ensures complete independence between the two systems

-- First, clean up existing cron jobs to avoid conflicts
SELECT cron.unschedule('callpanion-daily-calls');
SELECT cron.unschedule('callpanion-daily-scheduler');
SELECT cron.unschedule('schedulerDailyCalls-every-minute');

-- Create separate cron job for batch calls (ElevenLabs)
SELECT cron.schedule(
  'callpanion-batch-calls',
  '*/5 * * * *', -- every 5 minutes
  $$
  UPDATE public.cron_heartbeat 
  SET last_run = now(), status = 'running'
  WHERE job_name = 'callpanion-batch-calls';

  INSERT INTO public.cron_heartbeat (job_name, last_run, status)
  VALUES ('callpanion-batch-calls', now(), 'running')
  ON CONFLICT (job_name) DO UPDATE SET last_run = now(), status = 'running';

  SELECT net.http_post(
    url := 'https://umjtepmdwfyfhdzbkyli.supabase.co/functions/v1/schedulerDailyCalls',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtanRlcG1kd2Z5ZmhkemJreWxpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDkwNTI1OSwiZXhwIjoyMDcwNDgxMjU5fQ.8TYM-WmrIrIZfSdcVh5w8Fj2k7BvLYPv8NdLNJM9CXk"}'::jsonb,
    body := '{"trigger": "batch_cron"}'::jsonb
  );

  UPDATE public.cron_heartbeat 
  SET status = 'completed', details = jsonb_build_object('last_execution', now())
  WHERE job_name = 'callpanion-batch-calls';
  $$
);

-- Create separate cron job for in-app calls (WebRTC + Push Notifications)
SELECT cron.schedule(
  'callpanion-in-app-calls',
  '*/3 * * * *', -- every 3 minutes (slightly offset to avoid conflicts)
  $$
  UPDATE public.cron_heartbeat 
  SET last_run = now(), status = 'running'
  WHERE job_name = 'callpanion-in-app-calls';

  INSERT INTO public.cron_heartbeat (job_name, last_run, status)
  VALUES ('callpanion-in-app-calls', now(), 'running')
  ON CONFLICT (job_name) DO UPDATE SET last_run = now(), status = 'running';

  SELECT net.http_post(
    url := 'https://umjtepmdwfyfhdzbkyli.supabase.co/functions/v1/schedulerInAppCalls',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtanRlcG1kd2Z5ZmhkemJreWxpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDkwNTI1OSwiZXhwIjoyMDcwNDgxMjU5fQ.8TYM-WmrIrIZfSdcVh5w8Fj2k7BvLYPv8NdLNJM9CXk"}'::jsonb,
    body := '{"trigger": "in_app_cron"}'::jsonb
  );

  UPDATE public.cron_heartbeat 
  SET status = 'completed', details = jsonb_build_object('last_execution', now())
  WHERE job_name = 'callpanion-in-app-calls';
  $$
);

-- Verify the new cron jobs are created
SELECT jobname, schedule, created FROM cron.job WHERE jobname LIKE 'callpanion-%' ORDER BY created DESC;