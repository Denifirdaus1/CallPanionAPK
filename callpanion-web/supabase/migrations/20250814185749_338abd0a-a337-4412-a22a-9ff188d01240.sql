-- Fix security warnings by setting proper search_path on all functions
CREATE OR REPLACE FUNCTION sync_household_to_hubspot()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = 'public', 'auth'
AS $$
DECLARE
  household_admin_email text;
  household_admin_name text;
  relative_data record;
  consent_status boolean := false;
  consent_timestamp timestamp with time zone;
BEGIN
  -- Get the household admin's email from auth.users via household_members
  SELECT u.email, u.raw_user_meta_data ->> 'display_name'
  INTO household_admin_email, household_admin_name
  FROM auth.users u
  JOIN household_members hm ON hm.user_id = u.id
  WHERE hm.household_id = NEW.id 
    AND hm.role = 'FAMILY_PRIMARY'
  LIMIT 1;

  -- Get the first relative for this household
  SELECT * INTO relative_data
  FROM relatives 
  WHERE household_id = NEW.id 
  LIMIT 1;

  -- Get consent status
  SELECT NEW.gdpr_consent_status, NEW.gdpr_consent_timestamp
  INTO consent_status, consent_timestamp;

  -- Call the HubSpot sync edge function
  PERFORM net.http_post(
    url := 'https://umjtepmdwfyfhdzbkyli.supabase.co/functions/v1/hubspot-sync',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.jwt_token', true) || '"}'::jsonb,
    body := jsonb_build_object(
      'type', 'household_created',
      'data', jsonb_build_object(
        'firstname', COALESCE(relative_data.first_name, split_part(household_admin_name, ' ', 1)),
        'lastname', COALESCE(relative_data.last_name, split_part(household_admin_name, ' ', 2)),
        'email', household_admin_email,
        'contact_role', 'household_admin',
        'household_id', NEW.id::text,
        'city', COALESCE(NEW.city, relative_data.town),
        'state', COALESCE(relative_data.county, ''),
        'country', COALESCE(NEW.country, relative_data.country, 'United Kingdom'),
        'signup_date', NEW.created_at::date::text,
        'gdpr_consent_status', CASE WHEN consent_status THEN 'yes' ELSE 'no' END,
        'gdpr_consent_timestamp', COALESCE(consent_timestamp, NEW.created_at)::text
      )
    )
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION sync_invite_acceptance_to_hubspot()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = 'public', 'auth'
AS $$
DECLARE
  household_data record;
  inviter_email text;
BEGIN
  -- Only trigger when accepted_at is newly set
  IF OLD.accepted_at IS NULL AND NEW.accepted_at IS NOT NULL THEN
    
    -- Get household data
    SELECT * INTO household_data
    FROM households 
    WHERE id = NEW.household_id;

    -- Get inviter email for fallback
    SELECT u.email INTO inviter_email
    FROM auth.users u
    WHERE u.id = NEW.invited_by;

    -- Call the HubSpot sync edge function
    PERFORM net.http_post(
      url := 'https://umjtepmdwfyfhdzbkyli.supabase.co/functions/v1/hubspot-sync',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.jwt_token', true) || '"}'::jsonb,
      body := jsonb_build_object(
        'type', 'invite_accepted',
        'data', jsonb_build_object(
          'email', NEW.email,
          'contact_role', COALESCE(NEW.role, 'viewer'),
          'household_id', NEW.household_id::text,
          'city', household_data.city,
          'country', COALESCE(household_data.country, 'United Kingdom'),
          'signup_date', NEW.accepted_at::date::text,
          'gdpr_consent_status', CASE WHEN COALESCE(NEW.gdpr_consent_status, false) THEN 'yes' ELSE 'no' END,
          'gdpr_consent_timestamp', COALESCE(NEW.gdpr_consent_timestamp, NEW.accepted_at)::text
        )
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION manual_hubspot_sync(household_id_param uuid)
RETURNS text 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = 'public'
AS $$
DECLARE
  result_message text;
BEGIN
  -- Trigger the household sync function manually
  PERFORM sync_household_to_hubspot() FROM households WHERE id = household_id_param;
  
  result_message := 'Manual HubSpot sync triggered for household: ' || household_id_param;
  RETURN result_message;
END;
$$;