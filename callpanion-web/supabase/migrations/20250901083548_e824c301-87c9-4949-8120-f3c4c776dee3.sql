-- View for quick verification (recent calls)
create or replace view public.v_call_last_10 as
select
  cl.id as call_log_id,
  cl.provider_call_id,
  cl.call_outcome,
  cl.call_duration,
  cl.emergency_flag,
  cl.health_concerns_detected,
  cl.occurred_at,
  cs.mood,
  cs.mood_score,
  cs.tl_dr,
  cs.key_points
from app.call_logs cl
left join app.call_summaries cs
  on cs.provider_call_id = cl.provider_call_id
order by cl.occurred_at desc
limit 10;