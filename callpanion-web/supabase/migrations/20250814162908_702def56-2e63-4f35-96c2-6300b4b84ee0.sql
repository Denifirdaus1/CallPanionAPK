-- Create households and related tables with RLS policies

-- Households
CREATE TABLE IF NOT EXISTS public.households (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

-- Household Members
CREATE TABLE IF NOT EXISTS public.household_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  role text NOT NULL DEFAULT 'owner',
  created_at timestamptz DEFAULT now(),
  UNIQUE (household_id, user_id)
);

-- Relatives – GDPR-friendly address fields
CREATE TABLE IF NOT EXISTS public.relatives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  first_name text,
  last_name text,
  town text NOT NULL,
  county text,
  country text NOT NULL DEFAULT 'United Kingdom',
  postcode text,
  timezone text DEFAULT 'Europe/London',
  call_cadence text DEFAULT 'daily',
  quiet_hours_start text,
  quiet_hours_end text,
  escalation_contact_name text,
  escalation_contact_email text,
  created_at timestamptz DEFAULT now(),
  last_active_at timestamptz DEFAULT now(),
  inactive_since timestamptz
);

-- Invites
CREATE TABLE IF NOT EXISTS public.invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'viewer',
  token text NOT NULL,
  invited_by uuid NOT NULL REFERENCES auth.users(id),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz
);

-- Enable RLS
ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relatives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;

-- Households policies
CREATE POLICY "household_insert_by_creator"
ON public.households FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid());

CREATE POLICY "household_select_for_members"
ON public.households FOR SELECT
TO authenticated
USING (
  created_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.household_members hm
    WHERE hm.household_id = households.id AND hm.user_id = auth.uid()
  )
);

CREATE POLICY "household_update_for_members"
ON public.households FOR UPDATE
TO authenticated
USING (
  created_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.household_members hm
    WHERE hm.household_id = households.id AND hm.user_id = auth.uid()
  )
)
WITH CHECK (true);

-- Household members policies
CREATE POLICY "members_select"
ON public.household_members FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.households h 
    WHERE h.id = household_members.household_id AND h.created_by = auth.uid()
  )
);

CREATE POLICY "members_insert_self"
ON public.household_members FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Relatives policies
CREATE POLICY "relatives_select_for_members"
ON public.relatives FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.household_members hm 
    WHERE hm.household_id = relatives.household_id AND hm.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.households h 
    WHERE h.id = relatives.household_id AND h.created_by = auth.uid()
  )
);

CREATE POLICY "relatives_insert_for_members"
ON public.relatives FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.households h 
    WHERE h.id = relatives.household_id AND h.created_by = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.household_members hm 
    WHERE hm.household_id = relatives.household_id AND hm.user_id = auth.uid()
  )
);

CREATE POLICY "relatives_update_for_members"
ON public.relatives FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.household_members hm 
    WHERE hm.household_id = relatives.household_id AND hm.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.households h 
    WHERE h.id = relatives.household_id AND h.created_by = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.households h 
    WHERE h.id = relatives.household_id AND h.created_by = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.household_members hm 
    WHERE hm.household_id = relatives.household_id AND hm.user_id = auth.uid()
  )
);

-- Invites policies
CREATE POLICY "invites_rw_for_members"
ON public.invites FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.households h
    JOIN public.household_members hm ON hm.household_id = h.id
    WHERE h.id = invites.household_id 
    AND (h.created_by = auth.uid() OR hm.user_id = auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.households h
    JOIN public.household_members hm ON hm.household_id = h.id
    WHERE h.id = invites.household_id 
    AND (h.created_by = auth.uid() OR hm.user_id = auth.uid())
  )
);