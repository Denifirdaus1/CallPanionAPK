-- RPC: due schedules in next 60s (timezone-aware)
create or replace function public.rpc_find_due_schedules_next_min()
returns table(
  schedule_id uuid,
  household_id uuid,
  relative_id uuid,
  phone_number text,
  run_at_unix bigint
) language sql stable as $$
  with base as (
    select s.id as schedule_id, s.household_id, s.relative_id, s.timezone,
           coalesce(r.phone_number, r.contact_phone, r.phone) as phone_number,
           (now() at time zone s.timezone) as now_local,
           s.morning_time, s.afternoon_time, s.evening_time, s.active
    from public.schedules s
    join public.relatives r on r.id = s.relative_id
    where s.active = true
  ),
  slots as (
    select schedule_id, household_id, relative_id, phone_number, timezone,
      (date_trunc('day', now_local) + morning_time)::timestamp at time zone timezone as morning_ts,
      (date_trunc('day', now_local) + afternoon_time)::timestamp at time zone timezone as afternoon_ts,
      (date_trunc('day', now_local) + evening_time)::timestamp at time zone timezone as evening_ts
    from base
  ),
  due as (
    select schedule_id, household_id, relative_id, phone_number, extract(epoch from morning_ts)::bigint as run_at_unix
    from slots where morning_ts between now() and now() + interval '60 second'
    union all
    select schedule_id, household_id, relative_id, phone_number, extract(epoch from afternoon_ts)::bigint
    from slots where afternoon_ts between now() and now() + interval '60 second'
    union all
    select schedule_id, household_id, relative_id, phone_number, extract(epoch from evening_ts)::bigint
    from slots where evening_ts between now() and now() + interval '60 second'
  )
  select * from due;
$$;

-- Create the cron schedule if it doesn't exist
do $$
begin
  if not exists (select 1 from cron.job where jobname = 'scheduler-daily-calls-every-minute') then
    perform cron.schedule(
      'scheduler-daily-calls-every-minute',
      '* * * * *',
      'select net.http_post(url := current_setting(''app.settings.project_url'', true) || ''/functions/v1/schedulerDailyCalls'', headers := jsonb_build_object(''Content-Type'',''application/json'',''Authorization'',''Bearer '' || current_setting(''app.settings.functions_bearer'', true),''x-cron-secret'', current_setting(''app.settings.cron_secret'', true)), body := jsonb_build_object(''source'',''pg_cron''));'
    );
  end if;
end $$;

-- Verify
select 'rpc_exists' as check, to_regclass('public.rpc_find_due_schedules_next_min') as value;
select 'cron_job' as check, jobname as value from cron.job where jobname='scheduler-daily-calls-every-minute';