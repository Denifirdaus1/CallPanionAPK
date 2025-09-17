-- Add new permission columns to household_members
ALTER TABLE public.household_members 
ADD COLUMN IF NOT EXISTS can_view_calendar boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS can_post_updates boolean NOT NULL DEFAULT false;

-- Update the accept_invite_secure_v2 function to handle new permissions
CREATE OR REPLACE FUNCTION public.accept_invite_secure_v2(invite_token text, gdpr_consent boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  invite_record record;
  current_user_email text;
  invite_metadata jsonb;
BEGIN
  -- Get current user's email
  SELECT email INTO current_user_email FROM auth.users WHERE id = auth.uid();
  
  IF current_user_email IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
  END IF;

  -- Get and validate invite
  SELECT * INTO invite_record FROM public.invites 
  WHERE token = invite_token 
    AND email = current_user_email
    AND expires_at > now() 
    AND accepted_at IS NULL;
  
  IF invite_record.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired invite');
  END IF;

  -- Parse metadata for permissions
  invite_metadata := COALESCE(invite_record.metadata, '{}'::jsonb);

  -- Update invite as accepted
  UPDATE public.invites 
  SET accepted_at = now(),
      gdpr_consent_status = gdpr_consent,
      gdpr_consent_timestamp = CASE WHEN gdpr_consent THEN now() ELSE NULL END
  WHERE id = invite_record.id;

  -- Add user to household with permissions from metadata
  INSERT INTO public.household_members (
    household_id, user_id, role, added_by,
    health_access_level, can_view_calendar, can_post_updates
  )
  VALUES (
    invite_record.household_id, 
    auth.uid(), 
    invite_record.role::household_member_role, 
    invite_record.invited_by,
    COALESCE((invite_metadata->>'health_access_level')::health_access_level, 'NO_ACCESS'::health_access_level),
    COALESCE((invite_metadata->>'can_view_calendar')::boolean, false),
    COALESCE((invite_metadata->>'can_post_updates')::boolean, false)
  );

  RETURN jsonb_build_object(
    'success', true, 
    'household_id', invite_record.household_id,
    'role', invite_record.role
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', 'Invite acceptance failed');
END;
$function$;