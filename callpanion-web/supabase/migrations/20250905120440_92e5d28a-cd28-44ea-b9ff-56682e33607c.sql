-- Drop existing RPC function
DROP FUNCTION IF EXISTS public.rpc_find_due_schedules_next_min();

-- Create improved RPC function that supports 3 time slots per day
CREATE OR REPLACE FUNCTION public.rpc_find_due_schedules_next_min()
RETURNS TABLE(
  schedule_id uuid,
  household_id uuid,
  relative_id uuid,
  phone_number text,
  run_at_unix bigint,
  slot_type text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH schedule_slots AS (
    -- Morning slots
    SELECT 
      s.id as schedule_id,
      r.household_id,
      r.id as relative_id,
      r.phone_e164 as phone_number,
      EXTRACT(EPOCH FROM (
        (CURRENT_DATE AT TIME ZONE s.timezone + s.morning_time::interval) AT TIME ZONE s.timezone AT TIME ZONE 'UTC'
      ))::bigint as run_at_unix,
      'morning'::text as slot_type,
      s.timezone,
      s.morning_time as slot_time
    FROM schedules s
    JOIN relatives r ON r.id = s.relative_id
    WHERE s.active = true 
      AND s.morning_time IS NOT NULL
      AND r.phone_e164 IS NOT NULL
      AND r.phone_e164 != ''
    
    UNION ALL
    
    -- Afternoon slots  
    SELECT 
      s.id as schedule_id,
      r.household_id,
      r.id as relative_id,
      r.phone_e164 as phone_number,
      EXTRACT(EPOCH FROM (
        (CURRENT_DATE AT TIME ZONE s.timezone + s.afternoon_time::interval) AT TIME ZONE s.timezone AT TIME ZONE 'UTC'
      ))::bigint as run_at_unix,
      'afternoon'::text as slot_type,
      s.timezone,
      s.afternoon_time as slot_time
    FROM schedules s
    JOIN relatives r ON r.id = s.relative_id
    WHERE s.active = true 
      AND s.afternoon_time IS NOT NULL
      AND r.phone_e164 IS NOT NULL
      AND r.phone_e164 != ''
    
    UNION ALL
    
    -- Evening slots
    SELECT 
      s.id as schedule_id,
      r.household_id,
      r.id as relative_id,
      r.phone_e164 as phone_number,
      EXTRACT(EPOCH FROM (
        (CURRENT_DATE AT TIME ZONE s.timezone + s.evening_time::interval) AT TIME ZONE s.timezone AT TIME ZONE 'UTC'
      ))::bigint as run_at_unix,
      'evening'::text as slot_type,
      s.timezone,
      s.evening_time as slot_time
    FROM schedules s
    JOIN relatives r ON r.id = s.relative_id
    WHERE s.active = true 
      AND s.evening_time IS NOT NULL
      AND r.phone_e164 IS NOT NULL
      AND r.phone_e164 != ''
  )
  SELECT 
    ss.schedule_id,
    ss.household_id,
    ss.relative_id,
    ss.phone_number,
    ss.run_at_unix,
    ss.slot_type
  FROM schedule_slots ss
  WHERE 
    -- Check if this time slot is due (within 5 minute window)
    ABS(EXTRACT(EPOCH FROM NOW()) - ss.run_at_unix) <= 300
    -- Exclude if already called today for this slot
    AND NOT EXISTS (
      SELECT 1 FROM call_logs cl
      WHERE cl.relative_id = ss.relative_id
        AND cl.household_id = ss.household_id
        AND cl.provider = 'elevenlabs'
        AND cl.timestamp::date = CURRENT_DATE
        AND (
          (ss.slot_type = 'morning' AND EXTRACT(HOUR FROM cl.timestamp AT TIME ZONE ss.timezone) BETWEEN 5 AND 11) OR
          (ss.slot_type = 'afternoon' AND EXTRACT(HOUR FROM cl.timestamp AT TIME ZONE ss.timezone) BETWEEN 11 AND 17) OR
          (ss.slot_type = 'evening' AND EXTRACT(HOUR FROM cl.timestamp AT TIME ZONE ss.timezone) BETWEEN 17 AND 23)
        )
    );
END;
$$;

-- Add call tracking table for daily limits
CREATE TABLE IF NOT EXISTS public.daily_call_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL,
  relative_id uuid NOT NULL,
  call_date date NOT NULL DEFAULT CURRENT_DATE,
  morning_called boolean DEFAULT false,
  afternoon_called boolean DEFAULT false,
  evening_called boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(household_id, relative_id, call_date)
);

-- Enable RLS
ALTER TABLE public.daily_call_tracking ENABLE ROW LEVEL SECURITY;

-- RLS policies for daily_call_tracking
CREATE POLICY "Household members can view their tracking"
ON public.daily_call_tracking
FOR SELECT
USING (app_is_household_member(household_id));

CREATE POLICY "Service role can manage tracking"
ON public.daily_call_tracking
FOR ALL
USING (is_service_role())
WITH CHECK (is_service_role());

-- Test the new RPC function
SELECT * FROM rpc_find_due_schedules_next_min();