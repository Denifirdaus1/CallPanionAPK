-- 1) Enums for family/household and devices
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'household_member_role') THEN
    CREATE TYPE public.household_member_role AS ENUM ('FAMILY_PRIMARY','FAMILY_MEMBER','ELDERLY');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'device_type') THEN
    CREATE TYPE public.device_type AS ENUM ('WEARABLE','PHONE','HUB');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'device_status') THEN
    CREATE TYPE public.device_status AS ENUM ('ACTIVE','INACTIVE','PENDING');
  END IF;
END $$;

-- Ensure consent types exist for requested flows
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'consent_type') THEN
    BEGIN
      ALTER TYPE public.consent_type ADD VALUE IF NOT EXISTS 'AI_CALLS';
    EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN
      ALTER TYPE public.consent_type ADD VALUE IF NOT EXISTS 'FAMILY_DATA_SHARING';
    EXCEPTION WHEN duplicate_object THEN NULL; END;
  END IF;
END $$;

-- 2) Households table
CREATE TABLE IF NOT EXISTS public.households (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  timezone text,
  address_line text,
  city text,
  postcode text,
  country text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;

-- Updated at trigger
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_households_updated_at'
  ) THEN
    CREATE TRIGGER update_households_updated_at
    BEFORE UPDATE ON public.households
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- 3) Household members mapping
CREATE TABLE IF NOT EXISTS public.household_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE,
  role public.household_member_role NOT NULL,
  added_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT household_member_one_or_the_other CHECK ((user_id IS NOT NULL) <> (customer_id IS NOT NULL))
);

ALTER TABLE public.household_members ENABLE ROW LEVEL SECURITY;

-- 4) Devices table
CREATE TABLE IF NOT EXISTS public.devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  serial text UNIQUE,
  type public.device_type NOT NULL,
  status public.device_status NOT NULL DEFAULT 'PENDING',
  last_sync timestamptz,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_devices_updated_at'
  ) THEN
    CREATE TRIGGER update_devices_updated_at
    BEFORE UPDATE ON public.devices
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- 5) Add minimal fields to customers for this flow
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE public.customers ADD COLUMN created_by uuid;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'preferred_name'
  ) THEN
    ALTER TABLE public.customers ADD COLUMN preferred_name text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'timezone'
  ) THEN
    ALTER TABLE public.customers ADD COLUMN timezone text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'address_line'
  ) THEN
    ALTER TABLE public.customers ADD COLUMN address_line text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'city'
  ) THEN
    ALTER TABLE public.customers ADD COLUMN city text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'postcode'
  ) THEN
    ALTER TABLE public.customers ADD COLUMN postcode text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'country'
  ) THEN
    ALTER TABLE public.customers ADD COLUMN country text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'preferences'
  ) THEN
    ALTER TABLE public.customers ADD COLUMN preferences jsonb;
  END IF;
END $$;

-- Trigger to set created_by automatically
CREATE OR REPLACE FUNCTION public.set_created_by_customers()
RETURNS trigger AS $$
BEGIN
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public', 'auth';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_created_by_customers_trigger'
  ) THEN
    CREATE TRIGGER set_created_by_customers_trigger
    BEFORE INSERT ON public.customers
    FOR EACH ROW EXECUTE FUNCTION public.set_created_by_customers();
  END IF;
END $$;

-- 6) Helper security-definer functions
CREATE OR REPLACE FUNCTION public.user_is_household_member(_uid uuid, _household_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public','auth' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.household_members hm
    WHERE hm.household_id = _household_id AND hm.user_id = _uid
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_household(_uid uuid, _household_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public','auth' AS $$
  SELECT coalesce(public.has_admin_access_with_mfa(_uid), false)
     OR EXISTS (
       SELECT 1 FROM public.household_members hm
       WHERE hm.household_id = _household_id AND hm.user_id = _uid AND hm.role = 'FAMILY_PRIMARY'
     );
$$;

CREATE OR REPLACE FUNCTION public.has_access_to_customer(_uid uuid, _customer_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public','auth' AS $$
  SELECT coalesce(public.has_admin_access_with_mfa(_uid), false)
     OR EXISTS (
       SELECT 1
       FROM public.household_members hm_user
       JOIN public.household_members hm_cust
         ON hm_user.household_id = hm_cust.household_id
       WHERE hm_user.user_id = _uid
         AND hm_cust.customer_id = _customer_id
     );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_customer(_uid uuid, _customer_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public','auth' AS $$
  SELECT coalesce(public.has_admin_access_with_mfa(_uid), false)
     OR EXISTS (
       SELECT 1
       FROM public.household_members hm_user
       JOIN public.household_members hm_cust
         ON hm_user.household_id = hm_cust.household_id
       WHERE hm_user.user_id = _uid
         AND hm_user.role = 'FAMILY_PRIMARY'
         AND hm_cust.customer_id = _customer_id
     );
$$;

-- 7) RLS policies
-- Households
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='households' AND policyname='Household members can read households'
  ) THEN
    CREATE POLICY "Household members can read households"
    ON public.households FOR SELECT
    USING (public.user_is_household_member(auth.uid(), id) OR public.has_admin_access_with_mfa(auth.uid()));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='households' AND policyname='Authenticated can create households'
  ) THEN
    CREATE POLICY "Authenticated can create households"
    ON public.households FOR INSERT TO authenticated
    WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='households' AND policyname='Primary can manage households'
  ) THEN
    CREATE POLICY "Primary can manage households"
    ON public.households FOR UPDATE TO authenticated
    USING (public.can_manage_household(auth.uid(), id))
    WITH CHECK (public.can_manage_household(auth.uid(), id));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='households' AND policyname='Primary can delete households'
  ) THEN
    CREATE POLICY "Primary can delete households"
    ON public.households FOR DELETE TO authenticated
    USING (public.can_manage_household(auth.uid(), id));
  END IF;
END $$;

-- Household members
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='household_members' AND policyname='Members can read household_members'
  ) THEN
    CREATE POLICY "Members can read household_members"
    ON public.household_members FOR SELECT TO authenticated
    USING (
      (user_id = auth.uid())
      OR public.user_is_household_member(auth.uid(), household_id)
      OR public.has_admin_access_with_mfa(auth.uid())
    );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='household_members' AND policyname='Self or primary can insert members'
  ) THEN
    CREATE POLICY "Self or primary can insert members"
    ON public.household_members FOR INSERT TO authenticated
    WITH CHECK (
      (user_id = auth.uid())
      OR public.can_manage_household(auth.uid(), household_id)
    );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='household_members' AND policyname='Primary can update household_members'
  ) THEN
    CREATE POLICY "Primary can update household_members"
    ON public.household_members FOR UPDATE TO authenticated
    USING (public.can_manage_household(auth.uid(), household_id))
    WITH CHECK (public.can_manage_household(auth.uid(), household_id));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='household_members' AND policyname='Primary can delete household_members'
  ) THEN
    CREATE POLICY "Primary can delete household_members"
    ON public.household_members FOR DELETE TO authenticated
    USING (public.can_manage_household(auth.uid(), household_id));
  END IF;
END $$;

-- Customers: extend policies to families
-- Read access for family members
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='customers' AND policyname='Family can read own customers'
  ) THEN
    CREATE POLICY "Family can read own customers"
    ON public.customers FOR SELECT TO authenticated
    USING (public.has_access_to_customer(auth.uid(), id) OR created_by = auth.uid());
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='customers' AND policyname='Family can insert customers'
  ) THEN
    CREATE POLICY "Family can insert customers"
    ON public.customers FOR INSERT TO authenticated
    WITH CHECK (created_by = auth.uid());
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='customers' AND policyname='Primary can update customers'
  ) THEN
    CREATE POLICY "Primary can update customers"
    ON public.customers FOR UPDATE TO authenticated
    USING (public.can_manage_customer(auth.uid(), id) OR created_by = auth.uid())
    WITH CHECK (public.can_manage_customer(auth.uid(), id) OR created_by = auth.uid());
  END IF;
END $$;

-- Devices policies
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='devices' AND policyname='Family can read devices'
  ) THEN
    CREATE POLICY "Family can read devices"
    ON public.devices FOR SELECT TO authenticated
    USING (public.has_access_to_customer(auth.uid(), customer_id));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='devices' AND policyname='Primary can manage devices'
  ) THEN
    CREATE POLICY "Primary can manage devices"
    ON public.devices FOR ALL TO authenticated
    USING (public.can_manage_customer(auth.uid(), customer_id))
    WITH CHECK (public.can_manage_customer(auth.uid(), customer_id));
  END IF;
END $$;

-- Consents: allow family with access to insert & read
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='consents' AND policyname='Family can read consents for accessible customers'
  ) THEN
    CREATE POLICY "Family can read consents for accessible customers"
    ON public.consents FOR SELECT TO authenticated
    USING (public.has_access_to_customer(auth.uid(), customer_id));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='consents' AND policyname='Family can insert consents for accessible customers'
  ) THEN
    CREATE POLICY "Family can insert consents for accessible customers"
    ON public.consents FOR INSERT TO authenticated
    WITH CHECK (public.has_access_to_customer(auth.uid(), customer_id) AND captured_by = auth.uid());
  END IF;
END $$;
