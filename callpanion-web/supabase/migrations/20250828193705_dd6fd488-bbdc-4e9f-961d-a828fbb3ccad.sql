-- Create rate limiter table
create table if not exists public.invite_rate_limiter (
  email text primary key,
  last_sent_at timestamptz not null default now(),
  last_ip inet
);

-- Lock it down (service role bypasses RLS)
alter table public.invite_rate_limiter enable row level security;

-- Intentionally NO policies for anon/authenticated; only service role can read/write.
-- Optional helper index
create index if not exists idx_invite_rate_limiter_last_sent_at on public.invite_rate_limiter (last_sent_at desc);