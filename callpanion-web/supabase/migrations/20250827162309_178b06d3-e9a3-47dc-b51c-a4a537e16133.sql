-- CALL PERMISSIONS: which contacts the elder can call (future use; keep now for completeness)
CREATE TABLE IF NOT EXISTS public.call_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  elder_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  contact_name TEXT NOT NULL,
  contact_type TEXT CHECK (contact_type IN ('agent','person')) NOT NULL DEFAULT 'agent',
  destination TEXT,  -- e.g., phone or reserved value 'agent'
  allowed BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- CALL AUDIT: UK GDPR accountability (who started, when, outcome)
CREATE TABLE IF NOT EXISTS public.call_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  elder_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  started_by UUID REFERENCES public.profiles(id), -- elder or family_admin
  session_kind TEXT CHECK (session_kind IN ('realtime_agent')) NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  outcome TEXT, -- 'completed','hung_up','error'
  error_detail TEXT
);

-- Enable RLS
ALTER TABLE public.call_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_audit ENABLE ROW LEVEL SECURITY;

-- RLS Policies for call_permissions
CREATE POLICY "elder_read_own_call_permissions"
ON public.call_permissions FOR SELECT
TO authenticated
USING (
  elder_profile_id = auth.uid()
  OR EXISTS(SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role='family_admin' AND p.family_id = (SELECT family_id FROM public.profiles WHERE id=call_permissions.elder_profile_id))
  OR EXISTS(SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role='company_admin')
);

-- RLS Policies for call_audit
CREATE POLICY "elder_read_own_call_audit"
ON public.call_audit FOR SELECT
TO authenticated
USING (
  elder_profile_id = auth.uid()
  OR EXISTS(SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role='family_admin' AND p.family_id = (SELECT family_id FROM public.profiles WHERE id=call_audit.elder_profile_id))
  OR EXISTS(SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role='company_admin')
);

-- Insert policy for call_audit
CREATE POLICY "insert_call_audit_scoped"
ON public.call_audit FOR INSERT
TO authenticated
WITH CHECK (
  (NEW.elder_profile_id = auth.uid())
  OR EXISTS(SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role='family_admin' AND p.family_id = (SELECT family_id FROM public.profiles WHERE id=NEW.elder_profile_id))
  OR EXISTS(SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role='company_admin')
);