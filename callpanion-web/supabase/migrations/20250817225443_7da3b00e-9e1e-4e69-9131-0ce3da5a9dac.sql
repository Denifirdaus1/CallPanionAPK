
-- 1) Subscriptions table to track PayPal (and future) subscriptions
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  household_id uuid references public.households(id) on delete set null,
  provider text not null default 'paypal',
  provider_subscription_id text unique,
  plan_id text,
  status text, -- e.g. APPROVAL_PENDING, ACTIVE, SUSPENDED, CANCELLED
  trial_end timestamptz,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2) Indexes
create index if not exists idx_subscriptions_user_id on public.subscriptions(user_id);
create index if not exists idx_subscriptions_provider_sub_id on public.subscriptions(provider_subscription_id);

-- 3) RLS: users can see their own records; only edge/service can write
alter table public.subscriptions enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'public' and tablename = 'subscriptions' and policyname = 'user_can_select_own_subscriptions'
  ) then
    create policy "user_can_select_own_subscriptions"
    on public.subscriptions
    for select
    using (user_id = auth.uid());
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'public' and tablename = 'subscriptions' and policyname = 'edge_can_insert_subscriptions'
  ) then
    create policy "edge_can_insert_subscriptions"
    on public.subscriptions
    for insert
    with check (is_edge_function_request() or is_service_role());
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'public' and tablename = 'subscriptions' and policyname = 'edge_can_update_subscriptions'
  ) then
    create policy "edge_can_update_subscriptions"
    on public.subscriptions
    for update
    using (is_edge_function_request() or is_service_role())
    with check (is_edge_function_request() or is_service_role());
  end if;
end $$;

-- 4) Trigger to keep updated_at fresh
create or replace function public.tg_set_updated_at_subscriptions()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists set_updated_at_subscriptions on public.subscriptions;

create trigger set_updated_at_subscriptions
before update on public.subscriptions
for each row
execute function public.tg_set_updated_at_subscriptions();
