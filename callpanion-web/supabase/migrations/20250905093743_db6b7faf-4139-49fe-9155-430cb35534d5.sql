-- Create a schedule that should be due right now for testing
-- Get current time in different timezones
WITH current_times AS (
  SELECT 
    now() AT TIME ZONE 'Asia/Jakarta' as jakarta_time,
    now() AT TIME ZONE 'Europe/London' as london_time,
    EXTRACT(HOUR FROM (now() AT TIME ZONE 'Asia/Jakarta')) as jakarta_hour,
    EXTRACT(MINUTE FROM (now() AT TIME ZONE 'Asia/Jakarta')) as jakarta_minute,
    EXTRACT(HOUR FROM (now() AT TIME ZONE 'Europe/London')) as london_hour,
    EXTRACT(MINUTE FROM (now() AT TIME ZONE 'Europe/London')) as london_minute
)
SELECT 
  jakarta_time,
  london_time,
  jakarta_hour || ':' || LPAD(jakarta_minute::text, 2, '0') as jakarta_time_str,
  london_hour || ':' || LPAD(london_minute::text, 2, '0') as london_time_str
FROM current_times;