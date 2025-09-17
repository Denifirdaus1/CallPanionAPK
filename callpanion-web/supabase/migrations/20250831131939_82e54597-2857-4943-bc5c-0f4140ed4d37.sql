-- =========================
-- CallPanion MVP Core Schema (household-scoped)
-- Safe & idempotent
-- =========================

-- Extensions
create extension if not exists pgcrypto;  -- needed for gen_random_uuid()
create extension if not exists pg_cron;
create extension if not exists pg_net;
-- pg_net lets SQL call your Edge Functions; pg_cron handles scheduling.

-- Helpers expected (from project):
-- app_is_household_member(household_id uuid) -> boolean
-- has_admin_access_with_mfa(uid uuid) -> boolean
-- is_service_role() -> boolean
-- Note: Service role ALWAYS bypasses RLS; policies don't apply to it.

-- =========================================================
-- 0) Trigger helper (nice-to-have)
-- =========================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- =========================================================
-- 1) SCHEDULES (3x daily calls per relative)
-- =========================================================
create table if not exists public.schedules (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  relative_id uuid not null references public.relatives(id) on delete cascade,
  timezone text not null,
  morning_time time not null default '09:00',
  afternoon_time time not null default '13:00',
  evening_time time not null default '18:00',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_indexes where indexname = 'idx_schedules_active_tz_household') then
    create index idx_schedules_active_tz_household on public.schedules(household_id, active, timezone);
  end if;
end $$;

drop trigger if exists trg_schedules_updated_at on public.schedules;
create trigger trg_schedules_updated_at
before update on public.schedules
for each row execute procedure public.set_updated_at();

alter table public.schedules enable row level security;

-- RLS (members + service role)
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='schedules' and policyname='service-role-all') then
    create policy "service-role-all" on public.schedules
      using (is_service_role()) with check (is_service_role());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='schedules' and policyname='member-select') then
    create policy "member-select" on public.schedules
      for select to authenticated
      using (app_is_household_member(household_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='schedules' and policyname='member-iud') then
    create policy "member-iud" on public.schedules
      for all to authenticated
      using (app_is_household_member(household_id))
      with check (app_is_household_member(household_id));
  end if;
end $$;

-- =========================================================
-- 2) CALL LOGS (augment existing table)
-- =========================================================
alter table public.call_logs
  add column if not exists provider text default 'elevenlabs',
  add column if not exists provider_call_id text,
  add column if not exists household_id uuid references public.households(id),
  add column if not exists relative_id uuid references public.relatives(id);

-- Idempotency: prefer (provider, provider_call_id)
do $$
begin
  if not exists (select 1 from pg_indexes where indexname = 'uq_call_logs_provider_call_combo') then
    create unique index uq_call_logs_provider_call_combo
      on public.call_logs(provider, provider_call_id)
      where provider_call_id is not null;
  end if;
end $$;

-- Robust time index: choose available column
do $$
declare colname text;
begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='call_logs' and column_name='timestamp') then
    colname := 'timestamp';
  elsif exists (select 1 from information_schema.columns where table_schema='public' and table_name='call_logs' and column_name='created_at') then
    colname := 'created_at';
  elsif exists (select 1 from information_schema.columns where table_schema='public' and table_name='call_logs' and column_name='started_at') then
    colname := 'started_at';
  else
    colname := null;
  end if;
  if colname is not null and not exists (select 1 from pg_indexes where indexname = 'idx_call_logs_household_relative_time') then
    execute format('create index idx_call_logs_household_relative_time on public.call_logs(household_id, relative_id, %I desc)', colname);
  end if;
end $$;

-- =========================================================
-- 3) CALL SUMMARIES (normalized post-call artifacts)
-- =========================================================
create table if not exists public.call_summaries (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  relative_id uuid not null references public.relatives(id) on delete cascade,
  call_log_id uuid references public.call_logs(id) on delete set null,
  provider text not null default 'elevenlabs',
  provider_call_id text,
  mood text,
  mood_score int check (mood_score between 1 and 10),
  key_points jsonb default '{}'::jsonb,
  transcript_url text,
  tl_dr text,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_indexes where indexname = 'idx_call_summaries_household_call') then
    create index idx_call_summaries_household_call on public.call_summaries(household_id, call_log_id);
  end if;
  if not exists (select 1 from pg_indexes where indexname = 'idx_call_summaries_provider_call') then
    create index idx_call_summaries_provider_call on public.call_summaries(provider, provider_call_id);
  end if;
end $$;

alter table public.call_summaries enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='call_summaries' and policyname='service-role-all') then
    create policy "service-role-all" on public.call_summaries
      using (is_service_role()) with check (is_service_role());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='call_summaries' and policyname='member-select') then
    create policy "member-select" on public.call_summaries
      for select to authenticated
      using (app_is_household_member(household_id));
  end if;
  -- No member I/U/D: summaries written by webhooks (service role)
end $$;

-- =========================================================
-- 4) WEBHOOK EVENTS (audit inbound provider events)
-- =========================================================
create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid,                              -- nullable: resolve later
  provider text not null,
  provider_call_id text,
  payload jsonb not null,
  signature text,
  received_at timestamptz not null default now()
);

-- Add FK if missing
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where table_schema='public' and table_name='webhook_events' and constraint_name='webhook_events_household_fk'
  ) then
    alter table public.webhook_events
      add constraint webhook_events_household_fk
      foreign key (household_id) references public.households(id) on delete set null;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_indexes where indexname = 'idx_webhook_events_provider_received') then
    create index idx_webhook_events_provider_received on public.webhook_events(provider, received_at desc);
  end if;
end $$;

alter table public.webhook_events enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='webhook_events' and policyname='service-role-all') then
    create policy "service-role-all" on public.webhook_events
      using (is_service_role()) with check (is_service_role());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='webhook_events' and policyname='member-select') then
    create policy "member-select" on public.webhook_events
      for select to authenticated
      using (app_is_household_member(household_id));
  end if;
  -- No member INSERT; webhooks must be service-role only
end $$;

-- =========================================================
-- 5) QUOTAS (per-household limits)
-- =========================================================
create table if not exists public.quotas (
  household_id uuid primary key references public.households(id) on delete cascade,
  daily_call_cap int not null default 3,
  monthly_call_cap int not null default 90,
  calls_today int not null default 0,
  last_reset date default current_date
);

alter table public.quotas enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='quotas' and policyname='service-role-all') then
    create policy "service-role-all" on public.quotas
      using (is_service_role()) with check (is_service_role());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='quotas' and policyname='member-select') then
    create policy "member-select" on public.quotas
      for select to authenticated
      using (app_is_household_member(household_id));
  end if;
  -- No member I/U/D: quotas managed by admin/service role
end $$;

-- =========================================================
-- 6) RELATIVES helper index (guarded)
-- =========================================================
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='relatives' and column_name='timezone'
  ) and not exists (select 1 from pg_indexes where indexname='idx_relatives_household_timezone') then
    create index idx_relatives_household_timezone on public.relatives(household_id, timezone);
  end if;
end $$;

-- =========================================================
-- 7) Verify (safe)
-- =========================================================
select 'tables_present' as check,
  (select count(*) from information_schema.tables where table_schema='public' and table_name in ('schedules','call_summaries','webhook_events','quotas')) as cnt;

select 'rls_status' as check, relname, relrowsecurity
from pg_class
where relname in ('schedules','call_summaries','webhook_events','quotas');

select 'policies' as check, tablename, count(*) as policy_count
from pg_policies
where schemaname='public' and tablename in ('schedules','call_summaries','webhook_events','quotas')
group by tablename;

select 'idempotency_idx_call_logs' as check, indexname
from pg_indexes
where tablename='call_logs' and indexname like '%provider_call%';