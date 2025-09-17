-- Fix security for v_call_last_10 view by adding explicit RLS
drop view if exists public.v_call_last_10;

create or replace view public.v_call_last_10 
with (security_invoker=true) as
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
where has_admin_access_with_mfa(auth.uid())
order by cl.occurred_at desc
limit 10;