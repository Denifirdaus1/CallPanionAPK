-- Setup cron job untuk polling batch call status setiap 5 menit
SELECT cron.schedule(
  'poll-batch-call-status',
  '*/5 * * * *', -- setiap 5 menit
  $$
  SELECT
    net.http_post(
        url:='https://umjtepmdwfyfhdzbkyli.supabase.co/functions/v1/poll-batch-status',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtanRlcG1kd2Z5ZmhkemJreWxpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDkwNTI1OSwiZXhwIjoyMDcwNDgxMjU5fQ.P7Mxze8H0Kx7sHRLN1iqWoSLZqUPGMbIHFGAYL5B29k"}'::jsonb,
        body:='{"time": "' || now() || '"}'::jsonb
    ) as request_id;
  $$
);