-- ===============================================
-- TEST 5-MINUTE QUEUEING SYSTEM
-- ===============================================
-- This script creates test scenarios to verify the 5-minute queueing system

-- 1. Check current system status
SELECT '🔍 SYSTEM STATUS' as section;
SELECT
  'notification_queue' as table_name,
  COUNT(*) as current_entries
FROM notification_queue;

-- 2. Check active schedules
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
LIMIT 5;

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

-- 4. Create test scenario - simulate schedule that should be queued in next minute
SELECT '🧪 CREATING TEST SCENARIO' as section;

-- First, let's see what households and relatives exist
SELECT
  'Available test data:' as info,
  COUNT(DISTINCT h.id) as households,
  COUNT(DISTINCT r.id) as relatives,
  COUNT(DISTINCT s.id) as schedules
FROM households h
LEFT JOIN relatives r ON r.household_id = h.id
LEFT JOIN schedules s ON s.household_id = h.id;

-- Create a test schedule that will be due in 6 minutes (so queuing should happen in 1 minute)
DO $$
DECLARE
  test_household_id UUID;
  test_relative_id UUID;
  target_time TIME;
  target_date DATE;
  target_datetime TIMESTAMPTZ;
BEGIN
  -- Get a test household and relative
  SELECT h.id, r.id INTO test_household_id, test_relative_id
  FROM households h
  JOIN relatives r ON r.household_id = h.id
  LIMIT 1;

  IF test_household_id IS NOT NULL THEN
    -- Calculate target time (6 minutes from now)
    target_datetime := NOW() + INTERVAL '6 minutes';
    target_time := target_datetime::TIME;
    target_date := target_datetime::DATE;

    -- Create or update a test schedule
    INSERT INTO schedules (
      household_id,
      relative_id,
      timezone,
      evening_time,  -- Use evening slot for testing
      active,
      created_at,
      updated_at
    ) VALUES (
      test_household_id,
      test_relative_id,
      'UTC',
      target_time,
      true,
      NOW(),
      NOW()
    )
    ON CONFLICT (household_id, relative_id)
    DO UPDATE SET
      evening_time = target_time,
      active = true,
      updated_at = NOW();

    RAISE NOTICE '✅ Test schedule created for household % and relative %', test_household_id, test_relative_id;
    RAISE NOTICE '🕐 Schedule time: % (should be queued at %)',
      target_datetime,
      target_datetime - INTERVAL '5 minutes';
  ELSE
    RAISE NOTICE '❌ No test data available. Please create a household and relative first.';
  END IF;
END $$;

-- 5. Verify test schedule was created
SELECT '✅ TEST SCHEDULE VERIFICATION' as section;
SELECT
  h.name as household_name,
  r.first_name || ' ' || r.last_name as relative_name,
  s.timezone,
  s.evening_time,
  (DATE_TRUNC('day', NOW() AT TIME ZONE s.timezone) + s.evening_time)::TIMESTAMPTZ AT TIME ZONE s.timezone as next_execution,
  ((DATE_TRUNC('day', NOW() AT TIME ZONE s.timezone) + s.evening_time)::TIMESTAMPTZ AT TIME ZONE s.timezone) - INTERVAL '5 minutes' as queue_time,
  s.active
FROM schedules s
JOIN households h ON h.id = s.household_id
JOIN relatives r ON r.id = s.relative_id
WHERE s.active = true
AND s.evening_time IS NOT NULL
AND (DATE_TRUNC('day', NOW() AT TIME ZONE s.timezone) + s.evening_time)::TIMESTAMPTZ AT TIME ZONE s.timezone > NOW()
ORDER BY next_execution
LIMIT 3;

-- 6. Show what the queueing function will find in the next minute
SELECT '🔮 PREDICTION: What will be queued in next minute' as section;
SELECT
  s.id as schedule_id,
  s.household_id,
  s.relative_id,
  'evening' as slot_type,
  (DATE_TRUNC('day', NOW() AT TIME ZONE s.timezone) + s.evening_time)::TIMESTAMPTZ AT TIME ZONE s.timezone as scheduled_time,
  s.timezone,
  ((DATE_TRUNC('day', NOW() AT TIME ZONE s.timezone) + s.evening_time)::TIMESTAMPTZ AT TIME ZONE s.timezone) - INTERVAL '5 minutes' as queue_trigger_time,
  CASE
    WHEN ((DATE_TRUNC('day', NOW() AT TIME ZONE s.timezone) + s.evening_time)::TIMESTAMPTZ AT TIME ZONE s.timezone) - INTERVAL '5 minutes' BETWEEN NOW() AND NOW() + INTERVAL '60 seconds'
    THEN '✅ Will be queued in next minute!'
    ELSE '⏳ Not ready for queueing yet'
  END as queueing_status
FROM schedules s
WHERE s.active = true
AND s.evening_time IS NOT NULL
AND (DATE_TRUNC('day', NOW() AT TIME ZONE s.timezone) + s.evening_time)::TIMESTAMPTZ AT TIME ZONE s.timezone > NOW()
ORDER BY scheduled_time
LIMIT 5;

-- 7. Instructions for testing
SELECT '📖 TESTING INSTRUCTIONS' as section;
SELECT
  '1. Wait 1 minute, then run scheduler manually or wait for cron' as step_1,
  '2. Check notification_queue table for new entries' as step_2,
  '3. Wait until schedule time to see execution' as step_3,
  '4. Monitor logs in Supabase Functions dashboard' as step_4,
  '5. Verify device receives notification at correct time' as step_5;