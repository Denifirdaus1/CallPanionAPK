-- Update relatives with phone numbers for testing
UPDATE relatives 
SET phone_number = '+62-812-1234-5678' 
WHERE id = '39c8c65d-1d95-459b-82d1-963f9b5d9108';

UPDATE relatives 
SET phone_number = '+62-813-9876-5432' 
WHERE id = 'a12cbd83-2956-4c32-8308-c8188fbac36e';

-- Test manual call to schedulerDailyCalls via http_post (like cron does)
SELECT net.http_post(
  url := 'https://umjtepmdwfyfhdzbkyli.supabase.co/functions/v1/schedulerDailyCalls',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtanRlcG1kd2Z5ZmhkemJreWxpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MDUyNTksImV4cCI6MjA3MDQ4MTI1OX0.BhMkFrAOfeGw2ImHDXSTVmgM6P--L3lq9pNKDX3XzWE',
    'x-cron-secret', 'cron-secret-key-2025'
  ),
  body := jsonb_build_object('test', 'manual_trigger', 'timestamp', now())
) as request_id;