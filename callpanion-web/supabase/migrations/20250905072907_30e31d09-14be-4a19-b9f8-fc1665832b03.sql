-- Fix the RPC function SQL error by properly aliasing tables
DROP FUNCTION IF EXISTS public.rpc_find_due_schedules_next_min();

CREATE OR REPLACE FUNCTION public.rpc_find_due_schedules_next_min()
RETURNS TABLE(
  schedule_id uuid,
  household_id uuid,
  relative_id uuid,
  phone_number text,
  run_at_unix bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  now_utc timestamptz := now() AT TIME ZONE 'UTC';
BEGIN
  RETURN QUERY
  WITH schedule_times AS (
    SELECT 
      s.id as schedule_id,
      s.household_id,
      s.relative_id,
      r.phone_number,
      s.timezone,
      s.morning_time,
      s.afternoon_time,
      s.evening_time
    FROM public.schedules s
    JOIN public.relatives r ON r.id = s.relative_id
    WHERE s.active = true 
      AND r.phone_number IS NOT NULL
      AND r.phone_number != ''
  ),
  due_slots AS (
    -- Morning slots
    SELECT 
      st.schedule_id,
      st.household_id,
      st.relative_id,
      st.phone_number,
      EXTRACT(EPOCH FROM (
        (CURRENT_DATE AT TIME ZONE st.timezone + st.morning_time::time) AT TIME ZONE st.timezone
      ))::bigint as run_at_unix
    FROM schedule_times st
    WHERE st.morning_time IS NOT NULL
      AND ABS(EXTRACT(EPOCH FROM (
        (CURRENT_DATE AT TIME ZONE st.timezone + st.morning_time::time) AT TIME ZONE st.timezone - now_utc
      ))) <= 300 -- within 5 minutes
      
    UNION ALL
    
    -- Afternoon slots  
    SELECT 
      st.schedule_id,
      st.household_id,
      st.relative_id,
      st.phone_number,
      EXTRACT(EPOCH FROM (
        (CURRENT_DATE AT TIME ZONE st.timezone + st.afternoon_time::time) AT TIME ZONE st.timezone
      ))::bigint as run_at_unix
    FROM schedule_times st
    WHERE st.afternoon_time IS NOT NULL
      AND ABS(EXTRACT(EPOCH FROM (
        (CURRENT_DATE AT TIME ZONE st.timezone + st.afternoon_time::time) AT TIME ZONE st.timezone - now_utc
      ))) <= 300 -- within 5 minutes
      
    UNION ALL
    
    -- Evening slots
    SELECT 
      st.schedule_id,
      st.household_id,
      st.relative_id,
      st.phone_number,
      EXTRACT(EPOCH FROM (
        (CURRENT_DATE AT TIME ZONE st.timezone + st.evening_time::time) AT TIME ZONE st.timezone
      ))::bigint as run_at_unix
    FROM schedule_times st
    WHERE st.evening_time IS NOT NULL
      AND ABS(EXTRACT(EPOCH FROM (
        (CURRENT_DATE AT TIME ZONE st.timezone + st.evening_time::time) AT TIME ZONE st.timezone - now_utc
      ))) <= 300 -- within 5 minutes
  )
  SELECT 
    ds.schedule_id,
    ds.household_id,
    ds.relative_id,
    ds.phone_number,
    ds.run_at_unix
  FROM due_slots ds
  -- Only return calls that haven't been made yet today
  WHERE NOT EXISTS (
    SELECT 1 FROM public.call_logs cl
    WHERE cl.relative_id = ds.relative_id
      AND cl.provider = 'elevenlabs'
      AND cl.created_at::date = CURRENT_DATE
      AND ABS(EXTRACT(EPOCH FROM cl.created_at) - ds.run_at_unix) <= 300
  )
  ORDER BY ds.run_at_unix;
END;
$$;