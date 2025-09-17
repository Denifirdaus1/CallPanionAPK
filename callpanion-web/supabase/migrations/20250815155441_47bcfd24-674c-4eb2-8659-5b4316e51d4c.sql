-- CRITICAL SECURITY FIX: Enable RLS and create restrictive policies for all sensitive tables

-- Enable RLS on all tables that don't have it enabled
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relatives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_notes ENABLE ROW LEVEL SECURITY;

-- Drop permissive policies and replace with restrictive ones
DROP POLICY IF EXISTS "Secure waitlist signup" ON public.waitlist;
DROP POLICY IF EXISTS "Family can insert customers" ON public.customers;
DROP POLICY IF EXISTS "relatives_insert_for_members" ON public.relatives;

-- Restrictive waitlist policies (public signup only, admin read)
CREATE POLICY "waitlist_insert_only" ON public.waitlist
FOR INSERT WITH CHECK (
  email IS NOT NULL AND 
  email <> '' AND 
  consent = true AND 
  confirmed_at IS NULL AND 
  unsubscribed_at IS NULL
);

-- No SELECT policy for waitlist - only admins via existing admin policy

-- Restrictive customer policies (authenticated users only with proper access)
CREATE POLICY "customers_authenticated_insert" ON public.customers
FOR INSERT TO authenticated WITH CHECK (
  created_by = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.household_members hm
    WHERE hm.user_id = auth.uid() 
      AND hm.role = 'FAMILY_PRIMARY'
  )
);

-- Restrictive relatives policies (household members only)
CREATE POLICY "relatives_household_insert" ON public.relatives
FOR INSERT TO authenticated WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.households h
    WHERE h.id = relatives.household_id 
      AND h.created_by = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.household_members hm
    WHERE hm.household_id = relatives.household_id 
      AND hm.user_id = auth.uid()
  )
);

-- Deny all public access to sensitive tables by default
CREATE POLICY "deny_all_public_access" ON public.customers
FOR ALL TO public USING (false);

CREATE POLICY "deny_all_public_access" ON public.households  
FOR ALL TO public USING (false);

CREATE POLICY "deny_all_public_access" ON public.relatives
FOR ALL TO public USING (false);

CREATE POLICY "deny_all_public_access" ON public.call_analysis
FOR ALL TO public USING (false);

CREATE POLICY "deny_all_public_access" ON public.call_logs
FOR ALL TO public USING (false);

CREATE POLICY "deny_all_public_access" ON public.case_notes
FOR ALL TO public USING (false);