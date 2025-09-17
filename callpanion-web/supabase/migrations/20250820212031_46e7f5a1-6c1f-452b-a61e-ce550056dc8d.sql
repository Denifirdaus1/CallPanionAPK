-- Fix sync_household_to_hubspot to avoid malformed JSON headers and handle missing secrets safely
CREATE OR REPLACE FUNCTION public.sync_household_to_hubspot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
DECLARE
  household_admin_email text;
  household_admin_name text;
  relative_data record;
  consent_status boolean := false;
  consent_timestamp timestamp with time zone;
  jwt_token text;
  headers jsonb := jsonb_build_object('Content-Type', 'application/json');
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

  -- Safely build headers, include Authorization only if configured
  jwt_token := current_setting('app.jwt_token', true);
  IF jwt_token IS NOT NULL AND jwt_token <> '' THEN
    headers := headers || jsonb_build_object('Authorization', 'Bearer ' || jwt_token);
  END IF;

  -- Call the HubSpot sync edge function
  PERFORM net.http_post(
    url := 'https://umjtepmdwfyfhdzbkyli.supabase.co/functions/v1/hubspot-sync',
    headers := headers,
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

-- Remove duplicate triggers to avoid double invocation
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'public' AND c.relname = 'households' AND t.tgname = 'set_created_by_households_trg'
  ) THEN
    EXECUTE 'DROP TRIGGER set_created_by_households_trg ON public.households';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'public' AND c.relname = 'households' AND t.tgname = 'trigger_sync_household_to_hubspot'
  ) THEN
    EXECUTE 'DROP TRIGGER trigger_sync_household_to_hubspot ON public.households';
  END IF;
END $$;