-- Fix search path security warning for app.set_updated_at function
create or replace function app.set_updated_at()
returns trigger 
language plpgsql 
security definer
set search_path to 'app'
as $$
begin
  new.updated_at := now();
  return new;
end; $$;