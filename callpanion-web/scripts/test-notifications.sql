-- ===============================================
-- TEST QUERIES FOR ENHANCED NOTIFICATION SYSTEM
-- ===============================================
-- Use these queries to test and monitor the notification system

-- 1. Check current system status
SELECT '🔍 SYSTEM STATUS' as section;

-- Check if new tables exist
SELECT
  'notification_queue' as table_name,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notification_queue')
    THEN '✅ Exists' ELSE '❌ Missing' END as status
UNION ALL
SELECT
  'cron_heartbeat' as table_name,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cron_heartbeat')
    THEN '✅ Exists' ELSE '❌ Missing' END as status;

-- Check if new functions exist
SELECT
  routine_name,
  '✅ Available' as status
FROM information_schema.routines
WHERE routine_name IN ('rpc_find_schedules_to_queue', 'rpc_find_ready_notifications', 'cleanup_notification_queue')
AND routine_schema = 'public';

-- 2. Check cron job status
SELECT '📅 CRON JOB STATUS' as section;

SELECT * FROM cron_job_status;

-- 3. Test RPC functions
SELECT '🧪 TESTING RPC FUNCTIONS' as section;

-- Test schedules to queue (should show schedules 5 min before execution)
SELECT
  'rpc_find_schedules_to_queue' as function_name,
  COUNT(*) as result_count
FROM rpc_find_schedules_to_queue();

-- Test ready notifications (should show notifications ready for execution)
SELECT
  'rpc_find_ready_notifications' as function_name,
  COUNT(*) as result_count
FROM rpc_find_ready_notifications();

-- 4. Check current notification queue
SELECT '📋 NOTIFICATION QUEUE STATUS' as section;

SELECT
  status,
  COUNT(*) as count,
  MIN(scheduled_time) as earliest_schedule,
  MAX(scheduled_time) as latest_schedule
FROM notification_queue
GROUP BY status
ORDER BY status;

-- 5. Check recent heartbeat activity
SELECT '💓 RECENT HEARTBEAT ACTIVITY' as section;

SELECT
  job_name,
  last_run,
  status,
  details->'summary' as summary
FROM cron_heartbeat
WHERE job_name LIKE '%callpanion%'
ORDER BY last_run DESC;

-- 6. Check active schedules
SELECT '📅 ACTIVE SCHEDULES' as section;

SELECT
  h.name as household_name,
  r.first_name || ' ' || r.last_name as relative_name,
  s.timezone,
  s.morning_time,
  s.afternoon_time,
  s.evening_time,
  s.active
FROM schedules s
JOIN households h ON h.id = s.household_id
JOIN relatives r ON r.id = s.relative_id
WHERE s.active = true
ORDER BY h.name, r.first_name;

-- 7. Check device pairings
SELECT '📱 DEVICE PAIRINGS' as section;

SELECT
  h.name as household_name,
  r.first_name || ' ' || r.last_name as relative_name,
  dp.device_info->>'platform' as platform,
  CASE WHEN dp.device_info->>'fcm_token' IS NOT NULL THEN '✅' ELSE '❌' END as has_fcm,
  CASE WHEN dp.device_info->>'voip_token' IS NOT NULL THEN '✅' ELSE '❌' END as has_voip,
  dp.claimed_at
FROM device_pairs dp
JOIN households h ON h.id = dp.household_id
JOIN relatives r ON r.id = dp.relative_id
WHERE dp.claimed_at IS NOT NULL
ORDER BY h.name, r.first_name;

-- 8. Simulate a test schedule (for manual testing)
SELECT '🔧 TEST SIMULATION' as section;

-- This shows what would happen for a test schedule at current time + 6 minutes
WITH test_schedule AS (
  SELECT
    gen_random_uuid() as schedule_id,
    (SELECT id FROM households LIMIT 1) as household_id,
    (SELECT id FROM relatives LIMIT 1) as relative_id,
    'evening' as slot_type,
    (NOW() + INTERVAL '6 minutes') as scheduled_time,
    'UTC' as timezone
)
SELECT
  'Test schedule would be queued at:' as description,
  (scheduled_time - INTERVAL '5 minutes')::timestamp as queue_time,
  'Test schedule would execute at:' as description2,
  scheduled_time::timestamp as execution_time
FROM test_schedule;

-- 9. Performance check
SELECT '⚡ PERFORMANCE METRICS' as section;

SELECT
  'notification_queue' as table_name,
  COUNT(*) as total_rows,
  COUNT(CASE WHEN status = 'queued' THEN 1 END) as queued,
  COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent,
  COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed
FROM notification_queue;

-- 10. Recent errors
SELECT '❌ RECENT ERRORS' as section;

SELECT
  relative_id,
  last_error,
  retry_count,
  updated_at
FROM notification_queue
WHERE last_error IS NOT NULL
ORDER BY updated_at DESC
LIMIT 10;

-- Instructions for manual testing
SELECT '📖 MANUAL TESTING INSTRUCTIONS' as section;

SELECT
  '1. Create a test schedule in the dashboard for 5-10 minutes from now' as step_1,
  '2. Watch the notification_queue table - entry should appear 5 min before schedule' as step_2,
  '3. Check cron_heartbeat for scheduler activity' as step_3,
  '4. Verify notification is sent at scheduled time' as step_4,
  '5. Check call_sessions and call_logs for created records' as step_5;