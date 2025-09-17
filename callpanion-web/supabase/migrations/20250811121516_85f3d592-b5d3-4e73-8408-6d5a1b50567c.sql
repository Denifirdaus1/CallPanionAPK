-- Admin foundation: roles, org users, audit log, core entities, RLS, and domain allow-list

-- 1) Enums
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('SUPER_ADMIN','SUPPORT','AGENT','USER');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_status') THEN
    CREATE TYPE public.user_status AS ENUM ('INVITED','ACTIVE','SUSPENDED');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'consent_type') THEN
    CREATE TYPE public.consent_type AS ENUM ('AI_CALLS','FAMILY_SHARING','WEARABLE_INGESTION');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'consent_status') THEN
    CREATE TYPE public.consent_status AS ENUM ('GRANTED','REVOKED');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'alert_severity') THEN
    CREATE TYPE public.alert_severity AS ENUM ('LOW','MEDIUM','HIGH','CRITICAL');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'alert_status') THEN
    CREATE TYPE public.alert_status AS ENUM ('OPEN','IN_PROGRESS','RESOLVED','CLOSED');
  END IF;
END $$;

-- 2) org_users: internal admins/support directory
CREATE TABLE IF NOT EXISTS public.org_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE,
  email text UNIQUE NOT NULL,
  role public.app_role NOT NULL,
  status public.user_status NOT NULL DEFAULT 'INVITED',
  last_login timestamptz,
  mfa_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.org_users ENABLE ROW LEVEL SECURITY;

-- 3) Audit log
CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid,
  actor_email text,
  action text NOT NULL,
  entity_type text,
  entity_id text,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- 4) Customers (minimal for now)
CREATE TABLE IF NOT EXISTS public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  email text,
  phone text,
  status text,
  risk_flag boolean NOT NULL DEFAULT false,
  plan text,
  device_status text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- 5) Consents
CREATE TABLE IF NOT EXISTS public.consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  type public.consent_type NOT NULL,
  status public.consent_status NOT NULL,
  captured_by uuid,
  evidence_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.consents ENABLE ROW LEVEL SECURITY;

-- 6) Alerts
CREATE TABLE IF NOT EXISTS public.alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  type text NOT NULL,
  severity public.alert_severity NOT NULL,
  opened_at timestamptz NOT NULL DEFAULT now(),
  status public.alert_status NOT NULL DEFAULT 'OPEN',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

-- 7) Case notes (append-only)
CREATE TABLE IF NOT EXISTS public.case_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  author_user_id uuid,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.case_notes ENABLE ROW LEVEL SECURITY;

-- 8) Helper functions
-- Get current user's role (if any)
CREATE OR REPLACE FUNCTION public.get_current_user_role(_uid uuid)
RETURNS public.app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  select ou.role
  from public.org_users ou
  where ou.user_id = _uid
  limit 1;
$$;

-- Is SUPER_ADMIN
CREATE OR REPLACE FUNCTION public.is_super_admin(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  select coalesce((select ou.role = 'SUPER_ADMIN' from public.org_users ou where ou.user_id = _uid limit 1), false);
$$;

-- Admin access gate (domain allow-list handled at signup; MFA can be toggled via org_users.mfa_enabled)
CREATE OR REPLACE FUNCTION public.has_admin_access(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  select exists (
    select 1 from public.org_users ou
    where ou.user_id = _uid
      and ou.status = 'ACTIVE'
      and ou.role in ('SUPER_ADMIN','SUPPORT')
  );
$$;

-- Audit writer bypassing RLS for inserts
CREATE OR REPLACE FUNCTION public.log_audit(
  _actor_user_id uuid,
  _actor_email text,
  _action text,
  _entity_type text,
  _entity_id text,
  _details jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_log (actor_user_id, actor_email, action, entity_type, entity_id, details)
  VALUES (_actor_user_id, _actor_email, _action, _entity_type, _entity_id, _details);
END;
$$;

-- 9) RLS policies
-- org_users: only admins can read/manage
DROP POLICY IF EXISTS "Admins can read org_users" ON public.org_users;
CREATE POLICY "Admins can read org_users" ON public.org_users FOR SELECT USING (public.has_admin_access(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage org_users" ON public.org_users;
CREATE POLICY "Admins can manage org_users" ON public.org_users FOR ALL USING (public.has_admin_access(auth.uid())) WITH CHECK (public.has_admin_access(auth.uid()));

-- audit_log: admins can read; inserts via function only
DROP POLICY IF EXISTS "Admins can read audit_log" ON public.audit_log;
CREATE POLICY "Admins can read audit_log" ON public.audit_log FOR SELECT USING (public.has_admin_access(auth.uid()));

-- customers
DROP POLICY IF EXISTS "Admins can read customers" ON public.customers;
CREATE POLICY "Admins can read customers" ON public.customers FOR SELECT USING (public.has_admin_access(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage customers" ON public.customers;
CREATE POLICY "Admins can manage customers" ON public.customers FOR ALL USING (public.has_admin_access(auth.uid())) WITH CHECK (public.has_admin_access(auth.uid()));

-- consents
DROP POLICY IF EXISTS "Admins can read consents" ON public.consents;
CREATE POLICY "Admins can read consents" ON public.consents FOR SELECT USING (public.has_admin_access(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage consents" ON public.consents;
CREATE POLICY "Admins can manage consents" ON public.consents FOR ALL USING (public.has_admin_access(auth.uid())) WITH CHECK (public.has_admin_access(auth.uid()));

-- alerts
DROP POLICY IF EXISTS "Admins can read alerts" ON public.alerts;
CREATE POLICY "Admins can read alerts" ON public.alerts FOR SELECT USING (public.has_admin_access(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage alerts" ON public.alerts;
CREATE POLICY "Admins can manage alerts" ON public.alerts FOR ALL USING (public.has_admin_access(auth.uid())) WITH CHECK (public.has_admin_access(auth.uid()));

-- case_notes: append-only (no updates/deletes)
DROP POLICY IF EXISTS "Admins can read case_notes" ON public.case_notes;
CREATE POLICY "Admins can read case_notes" ON public.case_notes FOR SELECT USING (public.has_admin_access(auth.uid()));

DROP POLICY IF EXISTS "Admins can insert case_notes" ON public.case_notes;
CREATE POLICY "Admins can insert case_notes" ON public.case_notes FOR INSERT WITH CHECK (public.has_admin_access(auth.uid()));

-- 10) Append-only enforcement for case_notes
CREATE OR REPLACE FUNCTION public.prevent_case_notes_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Case notes are append-only; updates/deletes are not allowed.';
END;
$$;

DROP TRIGGER IF EXISTS trg_case_notes_prevent_update ON public.case_notes;
CREATE TRIGGER trg_case_notes_prevent_update
BEFORE UPDATE ON public.case_notes
FOR EACH ROW EXECUTE FUNCTION public.prevent_case_notes_mutation();

DROP TRIGGER IF EXISTS trg_case_notes_prevent_delete ON public.case_notes;
CREATE TRIGGER trg_case_notes_prevent_delete
BEFORE DELETE ON public.case_notes
FOR EACH ROW EXECUTE FUNCTION public.prevent_case_notes_mutation();

-- 11) Masked list view for customers
CREATE OR REPLACE VIEW public.customers_list_masked AS
SELECT
  id,
  full_name,
  CASE WHEN email IS NULL THEN NULL ELSE regexp_replace(email, '(^.).*(@.*$)', '\\1***\\2') END AS email_masked,
  CASE WHEN phone IS NULL THEN NULL ELSE '***' || right(phone, 2) END AS phone_masked,
  status,
  risk_flag,
  plan,
  device_status,
  created_at
FROM public.customers;

-- 12) Timestamps triggers
DROP TRIGGER IF EXISTS trg_org_users_updated_at ON public.org_users;
CREATE TRIGGER trg_org_users_updated_at
BEFORE UPDATE ON public.org_users
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_customers_updated_at ON public.customers;
CREATE TRIGGER trg_customers_updated_at
BEFORE UPDATE ON public.customers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_consents_updated_at ON public.consents;
CREATE TRIGGER trg_consents_updated_at
BEFORE UPDATE ON public.consents
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_alerts_updated_at ON public.alerts;
CREATE TRIGGER trg_alerts_updated_at
BEFORE UPDATE ON public.alerts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 13) Domain allow-list & profile bootstrap on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Enforce domain allow-list
  IF position('@callpanion.co.uk' in NEW.email) = 0 THEN
    RAISE EXCEPTION 'Signups are restricted to @callpanion.co.uk domain.';
  END IF;

  -- Ensure profile row exists
  INSERT INTO public.profiles (id, display_name, role)
  VALUES (NEW.id, coalesce(NEW.raw_user_meta_data ->> 'display_name', ''), coalesce(NEW.raw_user_meta_data ->> 'role', NULL))
  ON CONFLICT (id) DO NOTHING;

  -- Upsert org_users entry for this email/user
  INSERT INTO public.org_users (email, user_id, role, status)
  VALUES (NEW.email, NEW.id, 'SUPPORT', 'ACTIVE')
  ON CONFLICT (email)
  DO UPDATE SET user_id = EXCLUDED.user_id, status = 'ACTIVE', updated_at = now();

  -- Audit
  PERFORM public.log_audit(NEW.id, NEW.email, 'user_signup', 'auth.users', NEW.id::text, jsonb_build_object('email', NEW.email));

  RETURN NEW;
END;
$$;

-- Create trigger if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created'
  ) THEN
    CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
  END IF;
END $$;

-- 14) Helpful indexes
CREATE INDEX IF NOT EXISTS idx_org_users_email ON public.org_users (email);
CREATE INDEX IF NOT EXISTS idx_org_users_role ON public.org_users (role);
CREATE INDEX IF NOT EXISTS idx_org_users_status ON public.org_users (status);

CREATE INDEX IF NOT EXISTS idx_customers_status ON public.customers (status);
CREATE INDEX IF NOT EXISTS idx_customers_risk_plan ON public.customers (risk_flag, plan);

CREATE INDEX IF NOT EXISTS idx_alerts_status_severity ON public.alerts (status, severity);
