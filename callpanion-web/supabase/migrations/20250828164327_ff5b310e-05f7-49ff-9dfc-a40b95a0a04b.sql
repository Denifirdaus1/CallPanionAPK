
-- Add call permission fields directly to elders so family admins can manage them
ALTER TABLE public.elders
ADD COLUMN IF NOT EXISTS can_receive_calls boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS can_make_calls boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS quiet_hours_start text,
ADD COLUMN IF NOT EXISTS quiet_hours_end text,
ADD COLUMN IF NOT EXISTS allowed_contacts jsonb NOT NULL DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

-- Notes:
-- - We reuse existing RLS on elders:
--   * INSERT/UPDATE/DELETE: only family admins (is_admin(family_id))
--   * SELECT: all family members (is_member(family_id))
-- - No CHECK constraints added (per guidance); input validation done in app
