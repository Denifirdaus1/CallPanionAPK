-- Update the get_relatives_secure function to include more fields if it doesn't exist
CREATE OR REPLACE FUNCTION public.get_relatives_secure(household_id_param uuid)
RETURNS TABLE(
  id uuid,
  first_name text,
  last_name text,
  town text,
  county text,
  country text,
  call_cadence text,
  timezone text,
  quiet_hours_start text,
  quiet_hours_end text,
  last_active_at timestamp with time zone,
  created_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Check if user has access to this household
  IF NOT (
    EXISTS (
      SELECT 1 FROM public.household_members hm
      WHERE hm.household_id = household_id_param 
        AND hm.user_id = auth.uid()
    ) OR
    has_admin_access_with_mfa(auth.uid())
  ) THEN
    RAISE EXCEPTION 'Unauthorized access to relatives data';
  END IF;

  -- Return relatives data
  RETURN QUERY
  SELECT 
    r.id,
    r.first_name,
    r.last_name,
    r.town,
    r.county,
    r.country,
    r.call_cadence,
    r.timezone,
    r.quiet_hours_start,
    r.quiet_hours_end,
    r.last_active_at,
    r.created_at
  FROM public.relatives r
  WHERE r.household_id = household_id_param
    AND r.inactive_since IS NULL
  ORDER BY r.created_at DESC;
END;
$$;

-- Also add a function to store additional invite metadata
-- First add columns to invites table to store relationship and permissions
ALTER TABLE public.invites 
ADD COLUMN IF NOT EXISTS relationship_type text,
ADD COLUMN IF NOT EXISTS permissions_metadata jsonb DEFAULT '{}';

COMMENT ON COLUMN public.invites.relationship_type IS 'Relationship to the older adult (daughter, son, spouse, friend, other)';
COMMENT ON COLUMN public.invites.permissions_metadata IS 'JSON object storing permission preferences for the invite';

-- Update the invites table to have better tracking
ALTER TABLE public.invites 
ADD COLUMN IF NOT EXISTS display_name text;

COMMENT ON COLUMN public.invites.display_name IS 'Display name of the person being invited';