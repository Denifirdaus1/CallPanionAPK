-- ===============================================
-- NOTIFICATION QUEUE SYSTEM FOR IN-APP CALLS
-- ===============================================
-- This migration creates a robust notification queueing system
-- that queues notifications 5 minutes before execution time
-- and executes them exactly at the scheduled time.

-- Step 1: Create notification_queue table
CREATE TABLE IF NOT EXISTS public.notification_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  relative_id UUID NOT NULL REFERENCES public.relatives(id) ON DELETE CASCADE,
  schedule_id UUID NOT NULL REFERENCES public.schedules(id) ON DELETE CASCADE,

  -- Timing information
  scheduled_time TIMESTAMPTZ NOT NULL, -- When the call should happen
  queue_time TIMESTAMPTZ NOT NULL,     -- When it was queued (5 min before)

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'sent', 'failed', 'expired')),

  -- Notification details
  slot_type TEXT NOT NULL CHECK (slot_type IN ('morning', 'afternoon', 'evening')),
  notification_type TEXT NOT NULL DEFAULT 'in_app_call',

  -- Retry tracking
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,

  -- Metadata
  platform TEXT, -- 'ios', 'android', 'unknown'
  device_token TEXT,
  voip_token TEXT,

  -- Error tracking
  last_error TEXT,
  error_details JSONB,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,

  -- Ensure no duplicate queued notifications for same relative/time slot
  UNIQUE(relative_id, household_id, scheduled_time, slot_type)
);

-- Step 2: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_notification_queue_status ON public.notification_queue(status);
CREATE INDEX IF NOT EXISTS idx_notification_queue_scheduled_time ON public.notification_queue(scheduled_time);
CREATE INDEX IF NOT EXISTS idx_notification_queue_queue_time ON public.notification_queue(queue_time);
CREATE INDEX IF NOT EXISTS idx_notification_queue_household ON public.notification_queue(household_id);
CREATE INDEX IF NOT EXISTS idx_notification_queue_relative ON public.notification_queue(relative_id);
CREATE INDEX IF NOT EXISTS idx_notification_queue_processing ON public.notification_queue(status, scheduled_time) WHERE status IN ('queued', 'processing');

-- Step 3: Create updated_at trigger
CREATE OR REPLACE FUNCTION public.update_notification_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER notification_queue_updated_at
  BEFORE UPDATE ON public.notification_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.update_notification_queue_updated_at();

-- Step 4: RPC function to find schedules that need to be queued (5 minutes before execution)
CREATE OR REPLACE FUNCTION public.rpc_find_schedules_to_queue()
RETURNS TABLE(
  schedule_id UUID,
  household_id UUID,
  relative_id UUID,
  slot_type TEXT,
  scheduled_time TIMESTAMPTZ,
  timezone TEXT
)
LANGUAGE SQL STABLE AS $$
  WITH base AS (
    SELECT s.id as schedule_id, s.household_id, s.relative_id, s.timezone,
           (NOW() AT TIME ZONE s.timezone) as now_local,
           s.morning_time, s.afternoon_time, s.evening_time, s.active
    FROM public.schedules s
    WHERE s.active = true
  ),
  slots AS (
    SELECT schedule_id, household_id, relative_id, timezone,
           -- Calculate exact scheduled times for today in local timezone, then convert to UTC
           (DATE_TRUNC('day', now_local) + morning_time)::TIMESTAMPTZ AT TIME ZONE timezone AS morning_scheduled,
           (DATE_TRUNC('day', now_local) + afternoon_time)::TIMESTAMPTZ AT TIME ZONE timezone AS afternoon_scheduled,
           (DATE_TRUNC('day', now_local) + evening_time)::TIMESTAMPTZ AT TIME ZONE timezone AS evening_scheduled
    FROM base
  ),
  queue_targets AS (
    -- Morning slot: queue 5 minutes before execution
    SELECT schedule_id, household_id, relative_id, 'morning'::TEXT as slot_type,
           morning_scheduled as scheduled_time, timezone
    FROM slots
    WHERE morning_scheduled - INTERVAL '5 minutes' BETWEEN NOW() AND NOW() + INTERVAL '60 seconds'

    UNION ALL

    -- Afternoon slot: queue 5 minutes before execution
    SELECT schedule_id, household_id, relative_id, 'afternoon'::TEXT as slot_type,
           afternoon_scheduled as scheduled_time, timezone
    FROM slots
    WHERE afternoon_scheduled - INTERVAL '5 minutes' BETWEEN NOW() AND NOW() + INTERVAL '60 seconds'

    UNION ALL

    -- Evening slot: queue 5 minutes before execution
    SELECT schedule_id, household_id, relative_id, 'evening'::TEXT as slot_type,
           evening_scheduled as scheduled_time, timezone
    FROM slots
    WHERE evening_scheduled - INTERVAL '5 minutes' BETWEEN NOW() AND NOW() + INTERVAL '60 seconds'
  )
  SELECT qt.schedule_id, qt.household_id, qt.relative_id, qt.slot_type, qt.scheduled_time, qt.timezone
  FROM queue_targets qt
  -- Exclude already queued notifications
  WHERE NOT EXISTS (
    SELECT 1 FROM public.notification_queue nq
    WHERE nq.schedule_id = qt.schedule_id
    AND nq.relative_id = qt.relative_id
    AND nq.scheduled_time = qt.scheduled_time
    AND nq.slot_type = qt.slot_type
    AND nq.status IN ('queued', 'processing', 'sent')
  );
$$;

-- Step 5: RPC function to find queued notifications ready for execution
CREATE OR REPLACE FUNCTION public.rpc_find_ready_notifications()
RETURNS TABLE(
  queue_id UUID,
  household_id UUID,
  relative_id UUID,
  schedule_id UUID,
  scheduled_time TIMESTAMPTZ,
  slot_type TEXT,
  platform TEXT,
  device_token TEXT,
  voip_token TEXT,
  retry_count INTEGER
)
LANGUAGE SQL STABLE AS $$
  SELECT nq.id as queue_id, nq.household_id, nq.relative_id, nq.schedule_id,
         nq.scheduled_time, nq.slot_type, nq.platform, nq.device_token, nq.voip_token,
         nq.retry_count
  FROM public.notification_queue nq
  WHERE nq.status = 'queued'
  AND nq.scheduled_time BETWEEN NOW() - INTERVAL '30 seconds' AND NOW() + INTERVAL '30 seconds'
  AND nq.retry_count < nq.max_retries
  ORDER BY nq.scheduled_time ASC, nq.created_at ASC;
$$;

-- Step 6: Function to clean up old/expired notifications
CREATE OR REPLACE FUNCTION public.cleanup_notification_queue()
RETURNS INTEGER
LANGUAGE plpgsql AS $$
DECLARE
  cleaned_count INTEGER;
BEGIN
  -- Mark expired notifications (more than 10 minutes past scheduled time)
  UPDATE public.notification_queue
  SET status = 'expired', updated_at = NOW()
  WHERE status IN ('queued', 'processing')
  AND scheduled_time < NOW() - INTERVAL '10 minutes';

  GET DIAGNOSTICS cleaned_count = ROW_COUNT;

  -- Delete old completed/failed/expired notifications (older than 7 days)
  DELETE FROM public.notification_queue
  WHERE status IN ('sent', 'failed', 'expired')
  AND updated_at < NOW() - INTERVAL '7 days';

  RETURN cleaned_count;
END;
$$;

-- Step 7: Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_queue TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_queue TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_find_schedules_to_queue() TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_find_schedules_to_queue() TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_find_ready_notifications() TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_find_ready_notifications() TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_notification_queue() TO service_role;

-- Step 8: Create RLS policies
ALTER TABLE public.notification_queue ENABLE ROW LEVEL SECURITY;

-- Policy for authenticated users (can see their household's notifications)
CREATE POLICY "Users can view their household notifications" ON public.notification_queue
  FOR SELECT USING (
    household_id IN (
      SELECT household_id FROM public.household_members
      WHERE user_id = auth.uid()
    )
  );

-- Policy for service role (full access)
CREATE POLICY "Service role has full access" ON public.notification_queue
  FOR ALL USING (auth.role() = 'service_role');

-- Add comment for documentation
COMMENT ON TABLE public.notification_queue IS 'Queue for in-app call notifications with 5-minute pre-queueing system';
COMMENT ON FUNCTION public.rpc_find_schedules_to_queue() IS 'Finds schedules that need to be queued 5 minutes before execution';
COMMENT ON FUNCTION public.rpc_find_ready_notifications() IS 'Finds queued notifications ready for immediate execution';
COMMENT ON FUNCTION public.cleanup_notification_queue() IS 'Cleans up expired and old notifications';

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Notification queue system created successfully! 🚀';
  RAISE NOTICE 'Tables: notification_queue';
  RAISE NOTICE 'Functions: rpc_find_schedules_to_queue(), rpc_find_ready_notifications(), cleanup_notification_queue()';
  RAISE NOTICE 'System ready for 5-minute pre-queueing of in-app call notifications.';
END
$$;