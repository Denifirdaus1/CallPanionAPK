-- Create a simpler RPC that avoids JSON parsing/logging and returns a TABLE
CREATE OR REPLACE FUNCTION public.add_relative_simple(
  household_id_param uuid,
  first_name_param text,
  last_name_param text,
  town_param text DEFAULT NULL::text,
  county_param text DEFAULT NULL::text,
  country_param text DEFAULT NULL::text,
  call_cadence_param text DEFAULT NULL::text,
  timezone_param text DEFAULT NULL::text,
  quiet_hours_start_param text DEFAULT NULL::text,
  quiet_hours_end_param text DEFAULT NULL::text,
  invite_email_param text DEFAULT NULL::text,
  gdpr_consent_param boolean DEFAULT false
)
RETURNS TABLE(success boolean, relative_id uuid, invite_token text, error text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','auth'
AS $$
DECLARE
  new_relative_id uuid;
  new_invite_id uuid;
  invite_token_local text := NULL;
BEGIN
  -- Authorization: must be household member or admin to add relatives
  IF NOT app_is_household_member(household_id_param)
     AND NOT has_admin_access_with_mfa(auth.uid()) THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::text, 'Unauthorized to add a relative to this household';
    RETURN;
  END IF;

  -- Basic validation
  IF COALESCE(TRIM(first_name_param),'') = '' OR COALESCE(TRIM(last_name_param),'') = '' THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::text, 'First and last names are required';
    RETURN;
  END IF;

  INSERT INTO public.relatives (
    household_id, first_name, last_name, town, county, country,
    call_cadence, timezone, quiet_hours_start, quiet_hours_end
  ) VALUES (
    household_id_param, first_name_param, last_name_param, town_param, county_param, country_param,
    call_cadence_param, timezone_param, quiet_hours_start_param, quiet_hours_end_param
  ) RETURNING id INTO new_relative_id;

  -- Optional: create an elderly invite token (only household admins or org admins)
  IF invite_email_param IS NOT NULL AND TRIM(invite_email_param) <> '' THEN
    IF NOT app_is_household_admin(household_id_param)
       AND NOT has_admin_access_with_mfa(auth.uid()) THEN
      -- Still return success for relative creation, but indicate invite limitation
      RETURN QUERY SELECT true, new_relative_id, NULL::text, 'Only household admins can create invites';
      RETURN;
    END IF;

    IF invite_email_param !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
      -- Relative created but invite invalid
      RETURN QUERY SELECT true, new_relative_id, NULL::text, 'Invalid invite email';
      RETURN;
    END IF;

    invite_token_local := encode(gen_random_bytes(32), 'hex');

    INSERT INTO public.invites (
      household_id, email, role, token, invited_by, expires_at,
      gdpr_consent_status, gdpr_consent_timestamp
    ) VALUES (
      household_id_param, invite_email_param, 'elderly', invite_token_local, auth.uid(), now() + interval '7 days',
      gdpr_consent_param, CASE WHEN gdpr_consent_param THEN now() ELSE NULL END
    ) RETURNING id INTO new_invite_id;
  END IF;

  RETURN QUERY SELECT true, new_relative_id, invite_token_local, NULL::text;

EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT false, NULL::uuid, NULL::text, SQLERRM;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.add_relative_simple(
  uuid, text, text, text, text, text, text, text, text, text, text, boolean
) TO authenticated;