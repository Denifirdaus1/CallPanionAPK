-- 01_schema.sql - Create app schema, extensions, enums, tables, and triggers (fixed enum existence checks per schema)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE SCHEMA IF NOT EXISTS app;

-- Enums (ensure they exist specifically in the app schema)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'profile_role' AND n.nspname = 'app'
  ) THEN
    CREATE TYPE app.profile_role AS ENUM ('family','older_adult','admin');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'household_member_role' AND n.nspname = 'app'
  ) THEN
    CREATE TYPE app.household_member_role AS ENUM ('admin','viewer');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'platform' AND n.nspname = 'app'
  ) THEN
    CREATE TYPE app.platform AS ENUM ('ios','android');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'ai_call_status' AND n.nspname = 'app'
  ) THEN
    CREATE TYPE app.ai_call_status AS ENUM ('scheduled','ringing','accepted','snoozed','declined','missed','completed','failed');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'note_source' AND n.nspname = 'app'
  ) THEN
    CREATE TYPE app.note_source AS ENUM ('ai','manual');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'message_kind' AND n.nspname = 'app'
  ) THEN
    CREATE TYPE app.message_kind AS ENUM ('text','voice','photo');
  END IF;
END $$;

-- Helper: updated_at trigger function in app schema
CREATE OR REPLACE FUNCTION app.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- Tables
CREATE TABLE IF NOT EXISTS app.profiles (
  user_id uuid PRIMARY KEY,
  role app.profile_role,
  full_name text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app.households (
  id uuid PRIMARY KEY,
  name text,
  owner uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app.household_members (
  household_id uuid NOT NULL REFERENCES app.households(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role app.household_member_role NOT NULL,
  is_supported_person boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (household_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_household_members_user ON app.household_members(user_id);

CREATE TABLE IF NOT EXISTS app.consent_settings (
  user_id uuid PRIMARY KEY,
  share_activity boolean NOT NULL DEFAULT true,
  share_hr boolean NOT NULL DEFAULT false,
  share_location boolean NOT NULL DEFAULT false,
  share_transcripts boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_consent_settings_updated_at
BEFORE UPDATE ON app.consent_settings
FOR EACH ROW EXECUTE FUNCTION app.update_updated_at();

CREATE TABLE IF NOT EXISTS app.ai_call_preferences (
  user_id uuid PRIMARY KEY,
  phone_e164 text,
  call_times text[] NOT NULL,
  days text[] NOT NULL DEFAULT ARRAY['Mon','Tue','Wed','Thu','Fri','Sat','Sun']::text[],
  topics text[] NOT NULL DEFAULT ARRAY['gardening','classic TV','local NI news']::text[],
  language text NOT NULL DEFAULT 'en-GB',
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_ai_call_preferences_updated_at
BEFORE UPDATE ON app.ai_call_preferences
FOR EACH ROW EXECUTE FUNCTION app.update_updated_at();

CREATE TABLE IF NOT EXISTS app.device_tokens (
  user_id uuid NOT NULL,
  platform app.platform NOT NULL,
  token text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, token)
);
CREATE INDEX IF NOT EXISTS idx_device_tokens_user ON app.device_tokens(user_id);
CREATE TRIGGER trg_device_tokens_updated_at
BEFORE UPDATE ON app.device_tokens
FOR EACH ROW EXECUTE FUNCTION app.update_updated_at();

CREATE TABLE IF NOT EXISTS app.ai_calls (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id uuid NOT NULL REFERENCES app.households(id) ON DELETE CASCADE,
  supported_user uuid NOT NULL,
  scheduled_for timestamptz,
  started_at timestamptz,
  ended_at timestamptz,
  summary text,
  transcript text,
  mood text,
  room_name text,
  status app.ai_call_status NOT NULL DEFAULT 'scheduled',
  ring_started_at timestamptz,
  accepted_at timestamptz,
  ended_reason text,
  attempt int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_calls_household ON app.ai_calls(household_id);
CREATE INDEX IF NOT EXISTS idx_ai_calls_supported_user ON app.ai_calls(supported_user);
CREATE INDEX IF NOT EXISTS idx_ai_calls_status ON app.ai_calls(status);

CREATE TABLE IF NOT EXISTS app.wellbeing_notes (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id uuid NOT NULL REFERENCES app.households(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  note text NOT NULL,
  source app.note_source NOT NULL DEFAULT 'ai',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wellbeing_notes_household ON app.wellbeing_notes(household_id);

CREATE TABLE IF NOT EXISTS app.messages (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id uuid NOT NULL REFERENCES app.households(id) ON DELETE CASCADE,
  sender uuid NOT NULL,
  kind app.message_kind NOT NULL,
  content text,
  storage_path text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_messages_household ON app.messages(household_id);

-- 02_rls.sql
CREATE OR REPLACE FUNCTION app.is_household_member(hh uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public, auth
AS $$
  SELECT EXISTS (
    SELECT 1 FROM app.household_members hm
    WHERE hm.household_id = hh AND hm.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION app.is_household_admin(hh uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public, auth
AS $$
  SELECT EXISTS (
    SELECT 1 FROM app.household_members hm
    WHERE hm.household_id = hh AND hm.user_id = auth.uid() AND hm.role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION app.can_view_hr(hh uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public, auth
AS $$
  SELECT app.is_household_member(hh);
$$;

ALTER TABLE app.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.households ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.consent_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.ai_call_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.device_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.ai_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.wellbeing_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "household members can select households" ON app.households;
CREATE POLICY "household members can select households"
ON app.households
FOR SELECT
USING (app.is_household_member(id));

DROP POLICY IF EXISTS "members can select household_members" ON app.household_members;
CREATE POLICY "members can select household_members"
ON app.household_members
FOR SELECT
USING (app.is_household_member(household_id));

DROP POLICY IF EXISTS "admins can insert household_members" ON app.household_members;
CREATE POLICY "admins can insert household_members"
ON app.household_members
FOR INSERT
WITH CHECK (app.is_household_admin(household_id));

DROP POLICY IF EXISTS "admins can delete household_members" ON app.household_members;
CREATE POLICY "admins can delete household_members"
ON app.household_members
FOR DELETE
USING (app.is_household_admin(household_id));

DROP POLICY IF EXISTS "members can select messages" ON app.messages;
CREATE POLICY "members can select messages"
ON app.messages
FOR SELECT
USING (app.is_household_member(household_id));

DROP POLICY IF EXISTS "members can insert messages" ON app.messages;
CREATE POLICY "members can insert messages"
ON app.messages
FOR INSERT
WITH CHECK (app.is_household_member(household_id));

DROP POLICY IF EXISTS "members can select wellbeing_notes" ON app.wellbeing_notes;
CREATE POLICY "members can select wellbeing_notes"
ON app.wellbeing_notes
FOR SELECT
USING (app.is_household_member(household_id));

DROP POLICY IF EXISTS "members can insert wellbeing_notes" ON app.wellbeing_notes;
CREATE POLICY "members can insert wellbeing_notes"
ON app.wellbeing_notes
FOR INSERT
WITH CHECK (app.is_household_member(household_id));

DROP POLICY IF EXISTS "members can select ai_calls" ON app.ai_calls;
CREATE POLICY "members can select ai_calls"
ON app.ai_calls
FOR SELECT
USING (app.is_household_member(household_id));

DROP POLICY IF EXISTS "user can select own consent_settings" ON app.consent_settings;
CREATE POLICY "user can select own consent_settings"
ON app.consent_settings
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user can update own consent_settings" ON app.consent_settings;
CREATE POLICY "user can update own consent_settings"
ON app.consent_settings
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user can select own ai_call_preferences" ON app.ai_call_preferences;
CREATE POLICY "user can select own ai_call_preferences"
ON app.ai_call_preferences
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user can update own ai_call_preferences" ON app.ai_call_preferences;
CREATE POLICY "user can update own ai_call_preferences"
ON app.ai_call_preferences
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user can select own device_tokens" ON app.device_tokens;
CREATE POLICY "user can select own device_tokens"
ON app.device_tokens
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user can insert own device_tokens" ON app.device_tokens;
CREATE POLICY "user can insert own device_tokens"
ON app.device_tokens
FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user can delete own device_tokens" ON app.device_tokens;
CREATE POLICY "user can delete own device_tokens"
ON app.device_tokens
FOR DELETE
USING (auth.uid() = user_id);
