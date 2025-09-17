
-- 1) Create a single secure RPC that creates a household, adds the creator as primary member,
--    then adds a relative using the existing add_relative_simple() function.
--    Returns: success, household_id, relative_id, invite_token, error

create or replace function public.create_household_and_relative_simple(
  household_name_param text,
  first_name_param text,
  last_name_param text,
  town_param text default null,
  county_param text default null,
  country_param text default null,
  call_cadence_param text default null,
  timezone_param text default null,
  quiet_hours_start_param text default null,
  quiet_hours_end_param text default null,
  invite_email_param text default null,
  gdpr_consent_param boolean default false
)
returns table(
  success boolean,
  household_id uuid,
  relative_id uuid,
  invite_token text,
  error text
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  new_household_id uuid;
  add_success boolean;
  add_relative_id uuid;
  add_invite_token text;
  add_error text;
begin
  -- Require auth
  if auth.uid() is null then
    return query select false, null::uuid, null::uuid, null::text, 'Authentication required';
    return;
  end if;

  -- Create household for the current user (name defaults to "My Household" if blank)
  insert into public.households (name, created_by)
  values (
    coalesce(nullif(trim(household_name_param), ''), 'My Household'),
    auth.uid()
  )
  returning id into new_household_id;

  -- Add the creator as FAMILY_PRIMARY
  insert into public.household_members (household_id, user_id, role)
  values (new_household_id, auth.uid(), 'FAMILY_PRIMARY'::public.household_member_role);

  -- Add the relative via the existing secure function
  select
    r.success,
    r.relative_id,
    r.invite_token,
    r.error
  into
    add_success,
    add_relative_id,
    add_invite_token,
    add_error
  from public.add_relative_simple(
    household_id_param        => new_household_id,
    first_name_param          => first_name_param,
    last_name_param           => last_name_param,
    town_param                => town_param,
    county_param              => county_param,
    country_param             => country_param,
    call_cadence_param        => call_cadence_param,
    timezone_param            => timezone_param,
    quiet_hours_start_param   => quiet_hours_start_param,
    quiet_hours_end_param     => quiet_hours_end_param,
    invite_email_param        => invite_email_param,
    gdpr_consent_param        => gdpr_consent_param
  ) as r(success boolean, relative_id uuid, invite_token text, error text);

  if not add_success then
    return query select false, new_household_id, null::uuid, null::text, coalesce(add_error, 'Failed to add relative');
    return;
  end if;

  return query select true, new_household_id, add_relative_id, add_invite_token, null::text;
exception when others then
  -- Bubble up any error to the client in a controlled way
  return query select false, null::uuid, null::uuid, null::text, sqlerrm;
end;
$$;

-- 2) Allow authenticated users to call it via RPC
grant execute on function public.create_household_and_relative_simple(
  text, text, text, text, text, text, text, text, text, text, text, boolean
) to authenticated;
