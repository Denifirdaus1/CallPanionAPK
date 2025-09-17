
CREATE OR REPLACE FUNCTION public.create_household_and_relative_simple(
  household_name_param text DEFAULT NULL,
  first_name_param text,
  last_name_param text,
  town_param text DEFAULT NULL,
  county_param text DEFAULT NULL,
  country_param text DEFAULT NULL,
  call_cadence_param text DEFAULT NULL,
  timezone_param text DEFAULT NULL,
  quiet_hours_start_param text DEFAULT NULL,
  quiet_hours_end_param text DEFAULT NULL,
  invite_email_param text DEFAULT NULL,
  gdpr_consent_param boolean DEFAULT false
)
RETURNS TABLE(
  success boolean,
  household_id uuid,
  relative_id uuid,
  invite_token text,
  error text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','auth'
AS $function$
DECLARE
  new_household_id uuid;
  new_relative_id uuid;
  new_invite_id uuid;
  invite_token_local text := NULL;
  current_user uuid;
BEGIN
  -- Require authenticated user
  current_user := auth.uid();
  IF current_user IS NULL THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::uuid, NULL::text, 'Authentication required';
    RETURN;
  END IF;

  -- Prevent creating multiple households for the same user
  IF EXISTS (
    SELECT 1 FROM public.household_members hm
    WHERE hm.user_id = current_user
  ) THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::uuid, NULL::text, 'User already belongs to a household';
    RETURN;
  END IF;

  -- Create household owned by the user
  INSERT INTO public.households (name, created_by)
  VALUES (COALESCE(NULLIF(TRIM(household_name_param), ''), 'My Household'), current_user)
  RETURNING id INTO new_household_id;

  -- Make the user the primary family member
  INSERT INTO public.household_members (household_id, user_id, role)
  VALUES (new_household_id, current_user, 'FAMILY_PRIMARY'::public.household_member_role);

  -- Add the relative
  INSERT INTO public.relatives (
    household_id, first_name, last_name, town, county, country,
    call_cadence, timezone, quiet_hours_start, quiet_hours_end
  ) VALUES (
    new_household_id, first_name_param, last_name_param, town_param, county_param, country_param,
    COALESCE(call_cadence_param, 'daily'), COALESCE(timezone_param, 'Europe/London'),
    quiet_hours_start_param, quiet_hours_end_param
  ) RETURNING id INTO new_relative_id;

  -- Optional: create an invite for the elder
  IF invite_email_param IS NOT NULL AND TRIM(invite_email_param) <> '' THEN
    IF invite_email_param !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
      -- Household and relative created; report invalid email as a soft warning
      RETURN QUERY SELECT true, new_household_id, new_relative_id, NULL::text, 'Invalid invite email';
      RETURN;
    END IF;

    invite_token_local := encode(gen_random_bytes(32), 'hex');

    INSERT INTO public.invites (
      household_id, email, role, token, invited_by, expires_at,
      gdpr_consent_status, gdpr_consent_timestamp
    ) VALUES (
      new_household_id, invite_email_param, 'elderly', invite_token_local, current_user,
      now() + interval '7 days',
      gdpr_consent_param, CASE WHEN gdpr_consent_param THEN now() ELSE NULL END
    ) RETURNING id INTO new_invite_id;
  END IF;

  RETURN QUERY
    SELECT true, new_household_id, new_relative_id, invite_token_local, NULL::text;

EXCEPTION WHEN OTHERS THEN
  RETURN QUERY
    SELECT false, NULL::uuid, NULL::uuid, NULL::text, SQLERRM;
END;
$function$;
