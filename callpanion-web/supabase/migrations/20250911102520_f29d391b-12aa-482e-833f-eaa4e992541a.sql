-- Fix the RPC function to properly detect due schedules
-- The issue is with the timezone and time window calculation

CREATE OR REPLACE FUNCTION public.rpc_find_due_schedules_next_min()
RETURNS TABLE(schedule_id uuid, household_id uuid, relative_id uuid, phone_number text, run_at_unix bigint, slot_type text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH schedule_slots AS (
    -- Morning slots
    SELECT 
      s.id as schedule_id,
      r.household_id,
      r.id as relative_id,
      COALESCE(r.phone_e164, '') as phone_number, -- No longer required for in-app calls
      EXTRACT(EPOCH FROM (
        DATE_TRUNC('day', NOW() AT TIME ZONE s.timezone) + s.morning_time::interval
      ) AT TIME ZONE s.timezone)::bigint as run_at_unix,
      'morning'::text as slot_type,
      s.timezone,
      s.morning_time as slot_time
    FROM schedules s
    JOIN relatives r ON r.id = s.relative_id
    WHERE s.active = true 
      AND s.morning_time IS NOT NULL
    
    UNION ALL
    
    -- Afternoon slots  
    SELECT 
      s.id as schedule_id,
      r.household_id,
      r.id as relative_id,
      COALESCE(r.phone_e164, '') as phone_number,
      EXTRACT(EPOCH FROM (
        DATE_TRUNC('day', NOW() AT TIME ZONE s.timezone) + s.afternoon_time::interval
      ) AT TIME ZONE s.timezone)::bigint as run_at_unix,
      'afternoon'::text as slot_type,
      s.timezone,
      s.afternoon_time as slot_time
    FROM schedules s
    JOIN relatives r ON r.id = s.relative_id
    WHERE s.active = true 
      AND s.afternoon_time IS NOT NULL
    
    UNION ALL
    
    -- Evening slots
    SELECT 
      s.id as schedule_id,
      r.household_id,
      r.id as relative_id,
      COALESCE(r.phone_e164, '') as phone_number,
      EXTRACT(EPOCH FROM (
        DATE_TRUNC('day', NOW() AT TIME ZONE s.timezone) + s.evening_time::interval
      ) AT TIME ZONE s.timezone)::bigint as run_at_unix,
      'evening'::text as slot_type,
      s.timezone,
      s.evening_time as slot_time
    FROM schedules s
    JOIN relatives r ON r.id = s.relative_id
    WHERE s.active = true 
      AND s.evening_time IS NOT NULL
      
    UNION ALL
    
    -- Next day morning slots
    SELECT 
      s.id as schedule_id,
      r.household_id,
      r.id as relative_id,
      COALESCE(r.phone_e164, '') as phone_number,
      EXTRACT(EPOCH FROM (
        DATE_TRUNC('day', NOW() AT TIME ZONE s.timezone) + INTERVAL '1 day' + s.morning_time::interval
      ) AT TIME ZONE s.timezone)::bigint as run_at_unix,
      'morning'::text as slot_type,
      s.timezone,
      s.morning_time as slot_time
    FROM schedules s
    JOIN relatives r ON r.id = s.relative_id
    WHERE s.active = true 
      AND s.morning_time IS NOT NULL
      
    UNION ALL
    
    -- Next day afternoon slots
    SELECT 
      s.id as schedule_id,
      r.household_id,
      r.id as relative_id,
      COALESCE(r.phone_e164, '') as phone_number,
      EXTRACT(EPOCH FROM (
        DATE_TRUNC('day', NOW() AT TIME ZONE s.timezone) + INTERVAL '1 day' + s.afternoon_time::interval
      ) AT TIME ZONE s.timezone)::bigint as run_at_unix,
      'afternoon'::text as slot_type,
      s.timezone,
      s.afternoon_time as slot_time
    FROM schedules s
    JOIN relatives r ON r.id = s.relative_id
    WHERE s.active = true 
      AND s.afternoon_time IS NOT NULL
      
    UNION ALL
    
    -- Next day evening slots
    SELECT 
      s.id as schedule_id,
      r.household_id,
      r.id as relative_id,
      COALESCE(r.phone_e164, '') as phone_number,
      EXTRACT(EPOCH FROM (
        DATE_TRUNC('day', NOW() AT TIME ZONE s.timezone) + INTERVAL '1 day' + s.evening_time::interval
      ) AT TIME ZONE s.timezone)::bigint as run_at_unix,
      'evening'::text as slot_type,
      s.timezone,
      s.evening_time as slot_time
    FROM schedules s
    JOIN relatives r ON r.id = s.relative_id
    WHERE s.active = true 
      AND s.evening_time IS NOT NULL
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
        AND (cl.provider = 'elevenlabs' OR cl.provider = 'webrtc')
        AND cl.timestamp::date = CURRENT_DATE
        AND (
          (ss.slot_type = 'morning' AND EXTRACT(HOUR FROM cl.timestamp AT TIME ZONE ss.timezone) BETWEEN 5 AND 11) OR
          (ss.slot_type = 'afternoon' AND EXTRACT(HOUR FROM cl.timestamp AT TIME ZONE ss.timezone) BETWEEN 11 AND 17) OR
          (ss.slot_type = 'evening' AND EXTRACT(HOUR FROM cl.timestamp AT TIME ZONE ss.timezone) BETWEEN 17 AND 23)
        )
    );
END;
$function$;