-- Enable pg_cron and pg_net extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Add unique constraint to cron_heartbeat if it doesn't exist
ALTER TABLE cron_heartbeat ADD CONSTRAINT IF NOT EXISTS cron_heartbeat_job_name_unique UNIQUE (job_name);

-- Create the cron job to call schedulerDailyCalls every 5 minutes
SELECT cron.schedule(
  'callpanion-daily-calls',
  '*/5 * * * *', -- every 5 minutes
  $$
  SELECT net.http_post(
    url := 'https://umjtepmdwfyfhdzbkyli.supabase.co/functions/v1/schedulerDailyCalls',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtanRlcG1kd2Z5ZmhkemJreWxpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MDUyNTksImV4cCI6MjA3MDQ4MTI1OX0.BhMkFrAOfeGw2ImHDXSTVmgM6P--L3lq9pNKDX3XzWE',
      'x-cron-secret', 'cron-secret-key-2025'
    ),
    body := jsonb_build_object('triggered_by', 'cron', 'timestamp', now())
  ) as request_id;
  $$
);

-- Insert heartbeat record to track cron job execution
INSERT INTO cron_heartbeat (job_name, status, details) 
VALUES ('callpanion-daily-calls', 'initialized', jsonb_build_object('schedule', '*/5 * * * *'))
ON CONFLICT (job_name) DO UPDATE SET
  last_run = now(),
  status = 'initialized',
  details = jsonb_build_object('schedule', '*/5 * * * *');