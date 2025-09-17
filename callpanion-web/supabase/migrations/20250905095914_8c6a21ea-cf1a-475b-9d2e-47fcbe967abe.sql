-- Drop existing cron job and recreate with proper secret
SELECT cron.unschedule('callpanion-scheduler');

-- Create the cron job with the correct secret from vault
SELECT cron.schedule(
  'callpanion-scheduler',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://umjtepmdwfyfhdzbkyli.supabase.co/functions/v1/schedulerDailyCalls',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtanRlcG1kd2Z5ZmhkemJreWxpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDkwNTI1OSwiZXhwIjoyMDcwNDgxMjU5fQ.YAOEVGSa5aPKxz1mh1IlnPwAaAWEqq9uDqPXIy5N7P4',
      'x-cron-secret', 'cron-secret-callpanion-2025'
    ),
    body := jsonb_build_object('source', 'pg_cron')
  );
  $$
);