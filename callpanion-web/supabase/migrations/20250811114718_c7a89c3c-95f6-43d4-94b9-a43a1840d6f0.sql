
-- 1) Create trigger to insert a profile row whenever a new auth user is created
-- Note: The function public.handle_new_user() already exists in your project.
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2) Keep profiles.updated_at fresh on every update
drop trigger if exists profiles_set_timestamp on public.profiles;

create trigger profiles_set_timestamp
  before update on public.profiles
  for each row execute procedure public.update_updated_at_column();
