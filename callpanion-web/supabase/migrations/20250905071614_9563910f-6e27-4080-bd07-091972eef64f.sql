-- Add phone_number column to relatives table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'relatives' AND column_name = 'phone_number') THEN
        ALTER TABLE public.relatives ADD COLUMN phone_number text;
    END IF;
END $$;

-- Update the rpc_find_due_schedules_next_min function to handle Indonesian timezones
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
SET search_path = 'public'
AS $$
DECLARE
  now_utc timestamptz := now() at time zone 'UTC';
  window_start timestamptz := now_utc - interval '2 minutes';
  window_end timestamptz := now_utc + interval '2 minutes';
BEGIN
  RETURN QUERY
  WITH time_slots AS (
    SELECT 
      s.id as schedule_id,
      s.household_id,
      s.relative_id,
      COALESCE(r.phone_number, '+62-800-0000-0000') as phone_number, -- Default Indonesian number if none set
      s.timezone,
      s.morning_time,
      s.afternoon_time,
      s.evening_time,
      s.active
    FROM schedules s
    JOIN relatives r ON r.id = s.relative_id
    WHERE s.active = true
      AND COALESCE(r.phone_number, '') != ''
  ),
  expanded_slots AS (
    SELECT 
      schedule_id,
      household_id,
      relative_id,
      phone_number,
      -- Convert local times to UTC for comparison
      EXTRACT(EPOCH FROM (
        (CURRENT_DATE AT TIME ZONE timezone + morning_time::time) AT TIME ZONE timezone AT TIME ZONE 'UTC'
      ))::bigint as morning_unix,
      EXTRACT(EPOCH FROM (
        (CURRENT_DATE AT TIME ZONE timezone + afternoon_time::time) AT TIME ZONE timezone AT TIME ZONE 'UTC'
      ))::bigint as afternoon_unix,
      EXTRACT(EPOCH FROM (
        (CURRENT_DATE AT TIME ZONE timezone + evening_time::time) AT TIME ZONE timezone AT TIME ZONE 'UTC'
      ))::bigint as evening_unix
    FROM time_slots
  ),
  due_calls AS (
    SELECT schedule_id, household_id, relative_id, phone_number, morning_unix as run_at_unix
    FROM expanded_slots
    WHERE (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') BETWEEN 
          (to_timestamp(morning_unix) - interval '1 minute') AND 
          (to_timestamp(morning_unix) + interval '1 minute')
    
    UNION ALL
    
    SELECT schedule_id, household_id, relative_id, phone_number, afternoon_unix as run_at_unix
    FROM expanded_slots  
    WHERE (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') BETWEEN 
          (to_timestamp(afternoon_unix) - interval '1 minute') AND 
          (to_timestamp(afternoon_unix) + interval '1 minute')
    
    UNION ALL
    
    SELECT schedule_id, household_id, relative_id, phone_number, evening_unix as run_at_unix
    FROM expanded_slots
    WHERE (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') BETWEEN 
          (to_timestamp(evening_unix) - interval '1 minute') AND 
          (to_timestamp(evening_unix) + interval '1 minute')
  )
  SELECT * FROM due_calls;