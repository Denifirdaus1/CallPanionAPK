-- ===============================================
-- ENHANCED CRON JOB FOR IN-APP CALL NOTIFICATIONS
-- ===============================================
-- This migration creates a more accurate cron job that runs every minute
-- to ensure proper timing for the 5-minute queueing system.

-- First, remove the old cron job if it exists
SELECT cron.unschedule('callpanion-in-app-calls');

-- Create the new enhanced cron job that runs every minute
SELECT cron.schedule(
  'callpanion-in-app-calls-enhanced',
  '* * * * *', -- every minute for maximum precision
  $$
  -- Update heartbeat to show job is starting
  INSERT INTO public.cron_heartbeat (job_name, last_run, status, details)
  VALUES ('callpanion-in-app-calls', now(), 'running', jsonb_build_object('trigger', 'cron_every_minute'))
  ON CONFLICT (job_name) DO UPDATE SET
    last_run = now(),
    status = 'running',
    details = jsonb_build_object('trigger', 'cron_every_minute', 'started_at', now());

  -- Call the enhanced scheduler function
  SELECT net.http_post(
    url := 'https://umjtepmdwfyfhdzbkyli.supabase.co/functions/v1/schedulerInAppCalls',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtanRlcG1kd2Z5ZmhkemJreWxpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDkwNTI1OSwiZXhwIjoyMDcwNDgxMjU5fQ.8TYM-WmrIrIZfSdcVh-v8Fj2k7BvLYPv8NdLNJM9CXk',
      'x-cron-trigger', 'enhanced_every_minute'
    ),
    body := jsonb_build_object(
      'trigger', 'enhanced_cron',
      'timestamp', now()::text,
      'version', '3.0.0-enhanced'
    )
  );
  $$
);

-- Create a cleanup cron job that runs every hour to clean old notifications
SELECT cron.schedule(
  'callpanion-notification-cleanup',
  '0 * * * *', -- every hour at minute 0
  $$
  -- Clean up old notifications
  SELECT public.cleanup_notification_queue();

  -- Log cleanup activity
  INSERT INTO public.cron_heartbeat (job_name, last_run, status, details)
  VALUES ('callpanion-notification-cleanup', now(), 'completed', jsonb_build_object('trigger', 'cleanup_hourly'))
  ON CONFLICT (job_name) DO UPDATE SET
    last_run = now(),
    status = 'completed',
    details = jsonb_build_object('trigger', 'cleanup_hourly', 'completed_at', now());
  $$
);

-- Verify cron jobs are created
DO $$
DECLARE
  job_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO job_count
  FROM cron.job
  WHERE jobname IN ('callpanion-in-app-calls-enhanced', 'callpanion-notification-cleanup');

  IF job_count >= 2 THEN
    RAISE NOTICE '✅ Enhanced cron jobs created successfully!';
    RAISE NOTICE '📅 Main scheduler: every minute (* * * * *)';
    RAISE NOTICE '🧹 Cleanup job: every hour (0 * * * *)';
    RAISE NOTICE '🎯 System ready for precise 5-minute queueing!';
  ELSE
    RAISE WARNING '⚠️ Only % cron jobs created, expected 2', job_count;
  END IF;
END
$$;

-- Add monitoring view for cron job status
CREATE OR REPLACE VIEW public.cron_job_status AS
SELECT
  cj.jobname,
  cj.schedule,
  cj.active,
  ch.last_run,
  ch.status,
  ch.details,
  CASE
    WHEN ch.last_run > NOW() - INTERVAL '5 minutes' THEN 'healthy'
    WHEN ch.last_run > NOW() - INTERVAL '15 minutes' THEN 'warning'
    ELSE 'critical'
  END as health_status
FROM cron.job cj
LEFT JOIN public.cron_heartbeat ch ON cj.jobname LIKE '%' || ch.job_name || '%'
WHERE cj.jobname LIKE 'callpanion%'
ORDER BY cj.jobname;

-- Grant permissions for monitoring
GRANT SELECT ON public.cron_job_status TO authenticated;
GRANT SELECT ON public.cron_job_status TO service_role;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🚀 Enhanced In-App Call Notification System Deployed! 🚀';
  RAISE NOTICE '════════════════════════════════════════════════════════';
  RAISE NOTICE '📋 System Components:';
  RAISE NOTICE '   ✅ notification_queue table with 5-min queueing';
  RAISE NOTICE '   ✅ Enhanced scheduler with 2-phase system';
  RAISE NOTICE '   ✅ Cron job running every minute for precision';
  RAISE NOTICE '   ✅ Automatic cleanup every hour';
  RAISE NOTICE '   ✅ Device detection and token management';
  RAISE NOTICE '   ✅ Retry mechanism for failed notifications';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 How it works for schedule at 20:45:';
  RAISE NOTICE '   20:40 → Notification queued with device info';
  RAISE NOTICE '   20:45 → Notification sent exactly on time';
  RAISE NOTICE '   20:46 → If failed, retry up to 3 times';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Monitor with: SELECT * FROM cron_job_status;';
  RAISE NOTICE '════════════════════════════════════════════════════════';
END
$$;