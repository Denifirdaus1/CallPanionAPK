-- Fix security issues: Remove auth.users exposure and replace with secure function

-- 1. Drop the problematic view that exposes auth.users
DROP VIEW IF EXISTS public.vw_user_onboarding_status;

-- 2. Create a secure function to get user onboarding status without exposing auth.users
CREATE OR REPLACE FUNCTION public.get_user_onboarding_status()
RETURNS TABLE(
  user_id uuid,
  email text,
  signed_up_at timestamp with time zone,
  households bigint,
  relatives_ready bigint,
  relatives_with_active_schedule bigint,
  ready_for_calls boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only return data for the authenticated user (not exposing other users)
  RETURN QUERY
  SELECT 
    auth.uid() AS user_id,
    (SELECT email FROM auth.users WHERE id = auth.uid()) AS email,
    (SELECT created_at FROM auth.users WHERE id = auth.uid()) AS signed_up_at,
    count(DISTINCT hm.household_id) AS households,
    count(DISTINCT
        CASE
            WHEN ((r.phone_e164 IS NOT NULL) AND (r.timezone IS NOT NULL)) THEN r.id
            ELSE NULL::uuid
        END) AS relatives_ready,
    count(DISTINCT
        CASE
            WHEN (s.active IS TRUE) THEN r.id
            ELSE NULL::uuid
        END) AS relatives_with_active_schedule,
    ((count(DISTINCT hm.household_id) > 0) AND (count(DISTINCT
        CASE
            WHEN ((r.phone_e164 IS NOT NULL) AND (r.timezone IS NOT NULL)) THEN r.id
            ELSE NULL::uuid
        END) > 0) AND (count(DISTINCT
        CASE
            WHEN (s.active IS TRUE) THEN r.id
            ELSE NULL::uuid
        END) > 0)) AS ready_for_calls
  FROM household_members hm
  LEFT JOIN relatives r ON (r.household_id = hm.household_id)
  LEFT JOIN schedules s ON (s.relative_id = r.id)
  WHERE hm.user_id = auth.uid()
  GROUP BY auth.uid();
END;
$$;