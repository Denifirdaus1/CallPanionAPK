-- Schema: app
create schema if not exists app;

-- helper: updated_at auto-refresh
create or replace function app.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end; $$;

-- 1) Call logs (satu baris per conversation)
create table if not exists app.call_logs (
  id                         uuid primary key default gen_random_uuid(),
  provider                   text not null default 'elevenlabs',
  provider_call_id           text not null,                     -- e.g. conversation_id
  agent_id                   text,
  user_id                    uuid,
  household_id               uuid,
  relative_id                uuid,
  call_outcome               text not null default 'completed', -- completed/failed/cancelled
  call_duration              integer,                           -- seconds
  emergency_flag             boolean default false,
  health_concerns_detected   boolean default false,
  occurred_at                timestamptz not null default now(),
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),
  constraint call_outcome_chk check (call_outcome in ('completed','failed','cancelled'))
);

-- unik per provider + id (aman kalau nanti ada provider lain)
create unique index if not exists uq_call_logs_provider_id
  on app.call_logs(provider, provider_call_id);

create index if not exists idx_call_logs_provider_time
  on app.call_logs(provider, occurred_at desc);

create index if not exists idx_call_logs_occurred_at
  on app.call_logs(occurred_at desc);

-- trigger updated_at
do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'tr_call_logs_set_updated_at'
  ) then
    create trigger tr_call_logs_set_updated_at
    before update on app.call_logs
    for each row execute function app.set_updated_at();
  end if;
end $$;

-- 2) Call summaries (ringkasan & pointer transcript)
create table if not exists app.call_summaries (
  id                uuid primary key default gen_random_uuid(),
  call_log_id       uuid references app.call_logs(id) on delete cascade,
  provider          text not null default 'elevenlabs',
  provider_call_id  text not null,
  mood              text,
  mood_score        integer check (mood_score between 1 and 5),
  key_points        jsonb not null default '{}'::jsonb,
  transcript_url    text,
  tl_dr             text,
  created_at        timestamptz not null default now()
);

create index if not exists idx_call_summaries_call
  on app.call_summaries(call_log_id);

create index if not exists idx_call_summaries_provider_call
  on app.call_summaries(provider, provider_call_id);

-- RLS: enable, dan izinkan service_role (Edge Functions) full access.
alter table app.call_logs enable row level security;
alter table app.call_summaries enable row level security;

do $$
begin
  if not exists (
      select 1 from pg_policies
      where schemaname = 'app' and tablename = 'call_logs' and policyname = 'service role all call_logs'
  ) then
    create policy "service role all call_logs"
      on app.call_logs
      for all
      using (true) with check (true);
  end if;

  if not exists (
      select 1 from pg_policies
      where schemaname = 'app' and tablename = 'call_summaries' and policyname = 'service role all call_summaries'
  ) then
    create policy "service role all call_summaries"
      on app.call_summaries
      for all
      using (true) with check (true);
  end if;
end $$;