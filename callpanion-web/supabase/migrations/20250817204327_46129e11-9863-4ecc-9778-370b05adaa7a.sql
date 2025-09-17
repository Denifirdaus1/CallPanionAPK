
-- Create a secure, single-entry RPC to add a relative and optionally generate an elderly invite
create or replace function public.add_relative_secure(
  household_id_param uuid,
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
returns jsonb
language plpgsql
security definer
set search_path = 'public','auth'
as $function$
declare
  new_relative_id uuid;
  new_invite_id uuid;
  invite_token text := null;
begin
  -- Authorization: must be household member or admin to add relatives
  if not app_is_household_member(household_id_param)
     and not has_admin_access_with_mfa(auth.uid()) then
    raise exception 'Unauthorized to add a relative to this household';
  end if;

  -- Basic validation
  if coalesce(trim(first_name_param),'') = '' or coalesce(trim(last_name_param),'') = '' then
    raise exception 'First and last names are required';
  end if;

  insert into public.relatives (
    household_id, first_name, last_name, town, county, country,
    call_cadence, timezone, quiet_hours_start, quiet_hours_end
  ) values (
    household_id_param, first_name_param, last_name_param, town_param, county_param, country_param,
    call_cadence_param, timezone_param, quiet_hours_start_param, quiet_hours_end_param
  )
  returning id into new_relative_id;

  -- Optional: create an elderly invite token (only household admins or org admins)
  if invite_email_param is not null and trim(invite_email_param) <> '' then
    if not app_is_household_admin(household_id_param)
       and not has_admin_access_with_mfa(auth.uid()) then
      raise exception 'Only household admins can create invites';
    end if;

    if invite_email_param !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' then
      raise exception 'Invalid invite email';
    end if;

    invite_token := encode(gen_random_bytes(32), 'hex');

    insert into public.invites (
      household_id, email, role, token, invited_by, expires_at,
      gdpr_consent_status, gdpr_consent_timestamp
    ) values (
      household_id_param, invite_email_param, 'elderly', invite_token, auth.uid(), now() + interval '7 days',
      gdpr_consent_param, case when gdpr_consent_param then now() else null end
    )
    returning id into new_invite_id;

    perform log_security_event(
      'relative_invite_created',
      jsonb_build_object('invite_id', new_invite_id, 'relative_id', new_relative_id, 'household_id', household_id_param)
    );
  end if;

  perform log_security_event(
    'relative_created_secure',
    jsonb_build_object('relative_id', new_relative_id, 'household_id', household_id_param)
  );

  return jsonb_build_object(
    'success', true,
    'relative_id', new_relative_id,
    'invite_token', invite_token
  );

exception when others then
  perform log_security_event(
    'add_relative_secure_error',
    jsonb_build_object('error', SQLERRM, 'household_id', household_id_param)
  );
  return jsonb_build_object('success', false, 'error', SQLERRM);
end;
$function$;

-- (Optional) Make it explicit that authenticated clients can call the RPC
grant execute on function public.add_relative_secure(
  uuid, text, text, text, text, text, text, text, text, text, text, boolean
) to authenticated;
