-- ROLES
CREATE TYPE member_role AS ENUM ('admin','member');

-- PROFILES (link to auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  email text UNIQUE,
  created_at timestamp with time zone DEFAULT now()
);

-- FAMILIES (an organisation)
CREATE TABLE IF NOT EXISTS families (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone DEFAULT now()
);

-- FAMILY MEMBERSHIP (user <-> family with role)
CREATE TABLE IF NOT EXISTS family_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role member_role NOT NULL DEFAULT 'member',
  can_view_family_health boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE (family_id, user_id)
);

-- ELDERLY RELATIVES (people being cared for)
CREATE TABLE IF NOT EXISTS elders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  dob date,
  notes text,
  created_at timestamp with time zone DEFAULT now()
);

-- PER-ELDER ACCESS (fine-grained health permission)
CREATE TABLE IF NOT EXISTS elder_access (
  elder_id uuid NOT NULL REFERENCES elders(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  can_view_health boolean NOT NULL DEFAULT false,
  PRIMARY KEY (elder_id, user_id)
);

-- EVENTS for calendar
CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  elder_id uuid REFERENCES elders(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

-- HEALTH INSIGHTS (special category data)
CREATE TABLE IF NOT EXISTS health_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  elder_id uuid NOT NULL REFERENCES elders(id) ON DELETE CASCADE,
  measured_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL
);

-- INVITES (email-based)
CREATE TABLE IF NOT EXISTS family_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  email text NOT NULL,
  role member_role NOT NULL DEFAULT 'member',
  can_view_family_health boolean NOT NULL DEFAULT false,
  token text NOT NULL,
  expires_at timestamptz NOT NULL,
  accepted_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE families ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE elders ENABLE ROW LEVEL SECURITY;
ALTER TABLE elder_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_invites ENABLE ROW LEVEL SECURITY;

-- Helper functions
CREATE OR REPLACE FUNCTION is_member(_family uuid) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM family_members
    WHERE family_id = _family AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION is_admin(_family uuid) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM family_members
    WHERE family_id = _family AND user_id = auth.uid() AND role = 'admin'
  );
$$;

-- RLS POLICIES

-- PROFILES
CREATE POLICY "own profile" ON profiles
FOR SELECT USING (id = auth.uid());

-- FAMILIES
CREATE POLICY "members can select family" ON families
FOR SELECT USING (is_member(id));

CREATE POLICY "admins can insert family" ON families
FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "admins can update family" ON families
FOR UPDATE USING (is_admin(id)) WITH CHECK (is_admin(id));

-- FAMILY MEMBERS
CREATE POLICY "select memberships I can see" ON family_members
FOR SELECT USING (is_member(family_id));

CREATE POLICY "admins insert memberships" ON family_members
FOR INSERT WITH CHECK (is_admin(family_id));

CREATE POLICY "admins update memberships" ON family_members
FOR UPDATE USING (is_admin(family_id)) WITH CHECK (is_admin(family_id));

CREATE POLICY "admins delete memberships" ON family_members
FOR DELETE USING (is_admin(family_id));

-- ELDERS
CREATE POLICY "members see elders" ON elders
FOR SELECT USING (is_member(family_id));

CREATE POLICY "admins insert elders" ON elders
FOR INSERT WITH CHECK (is_admin(family_id));

CREATE POLICY "admins update elders" ON elders
FOR UPDATE USING (is_admin(family_id)) WITH CHECK (is_admin(family_id));

CREATE POLICY "admins delete elders" ON elders
FOR DELETE USING (is_admin(family_id));

-- ELDER ACCESS
CREATE POLICY "view elder access if member" ON elder_access
FOR SELECT USING (EXISTS (
  SELECT 1 FROM elders e WHERE e.id = elder_access.elder_id AND is_member(e.family_id)
));

CREATE POLICY "admins manage elder access insert" ON elder_access
FOR INSERT WITH CHECK (EXISTS (
  SELECT 1 FROM elders e WHERE e.id = elder_access.elder_id AND is_admin(e.family_id)
));

CREATE POLICY "admins manage elder access update" ON elder_access
FOR UPDATE USING (EXISTS (
  SELECT 1 FROM elders e WHERE e.id = elder_access.elder_id AND is_admin(e.family_id)
));

CREATE POLICY "admins manage elder access delete" ON elder_access
FOR DELETE USING (EXISTS (
  SELECT 1 FROM elders e WHERE e.id = elder_access.elder_id AND is_admin(e.family_id)
));

-- EVENTS
CREATE POLICY "members see events" ON events
FOR SELECT USING (is_member(family_id));

CREATE POLICY "members create events" ON events
FOR INSERT WITH CHECK (is_member(family_id));

CREATE POLICY "creator or admin update events" ON events
FOR UPDATE USING (created_by = auth.uid() OR is_admin(family_id))
WITH CHECK (created_by = auth.uid() OR is_admin(family_id));

CREATE POLICY "creator or admin delete events" ON events
FOR DELETE USING (created_by = auth.uid() OR is_admin(family_id));

-- HEALTH INSIGHTS (very strict)
CREATE POLICY "view health when permitted" ON health_insights
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM elders e
    JOIN family_members fm ON fm.family_id = e.family_id AND fm.user_id = auth.uid()
    LEFT JOIN elder_access ea ON ea.elder_id = e.id AND ea.user_id = auth.uid()
    WHERE e.id = health_insights.elder_id
      AND (fm.role = 'admin' OR COALESCE(ea.can_view_health, false) = true
           OR fm.can_view_family_health = true)
  )
);

-- FAMILY INVITES
CREATE POLICY "admins manage invites select" ON family_invites
FOR SELECT USING (is_admin(family_id));

CREATE POLICY "admins manage invites insert" ON family_invites
FOR INSERT WITH CHECK (is_admin(family_id));

CREATE POLICY "admins manage invites update" ON family_invites
FOR UPDATE USING (is_admin(family_id)) WITH CHECK (is_admin(family_id));

CREATE POLICY "admins manage invites delete" ON family_invites
FOR DELETE USING (is_admin(family_id));

-- Trigger to create family on first signup
CREATE OR REPLACE FUNCTION create_family_on_signup()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert into profiles
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, 
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', ''), 
    NEW.email)
  ON CONFLICT (id) DO NOTHING;

  -- Create a family for the user if they don't have one
  IF NOT EXISTS (SELECT 1 FROM family_members WHERE user_id = NEW.id) THEN
    INSERT INTO families (name, created_by)
    VALUES (COALESCE(NEW.raw_user_meta_data ->> 'display_name', 'My Family') || '''s Family', NEW.id);
    
    INSERT INTO family_members (family_id, user_id, role, can_view_family_health)
    SELECT f.id, NEW.id, 'admin', true
    FROM families f
    WHERE f.created_by = NEW.id
    ORDER BY f.created_at DESC
    LIMIT 1;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new users
DROP TRIGGER IF EXISTS on_auth_user_created_family ON auth.users;
CREATE TRIGGER on_auth_user_created_family
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION create_family_on_signup();