-- CallPanion AI Voice Companion Schema v0.1
-- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;         -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS vector;           -- pgvector for agent_memory

-- Profiles (one per elder user)
CREATE TABLE IF NOT EXISTS ai_companion_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  dob DATE,
  locale TEXT DEFAULT 'en-GB',
  consent_ts TIMESTAMPTZ,
  guardian_user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Family links (who can see which elder)
CREATE TYPE companion_family_role AS ENUM ('elder','admin','viewer');
CREATE TABLE IF NOT EXISTS companion_family_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES ai_companion_profiles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role companion_family_role NOT NULL,
  UNIQUE(profile_id, user_id)
);

-- Interests & news prefs
CREATE TABLE IF NOT EXISTS companion_interests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES ai_companion_profiles(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  notes TEXT,
  source TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS companion_news_prefs (
  profile_id UUID PRIMARY KEY REFERENCES ai_companion_profiles(id) ON DELETE CASCADE,
  topics TEXT[] DEFAULT ARRAY[]::TEXT[],
  sources TEXT[] DEFAULT ARRAY[]::TEXT[]
);

-- Voice sessions & transcripts
CREATE TABLE IF NOT EXISTS companion_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES ai_companion_profiles(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS companion_transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES companion_sessions(id) ON DELETE CASCADE,
  ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  speaker TEXT CHECK (speaker IN ('user','agent')),
  text TEXT NOT NULL,
  pii_masked_text TEXT
);

-- Mood & wellbeing
CREATE TABLE IF NOT EXISTS companion_mood_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES ai_companion_profiles(id) ON DELETE CASCADE,
  session_id UUID REFERENCES companion_sessions(id) ON DELETE SET NULL,
  ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  phq2 SMALLINT[] CHECK (cardinality(phq2)=2 AND phq2[1] BETWEEN 0 AND 3 AND phq2[2] BETWEEN 0 AND 3),
  energy SMALLINT CHECK (energy BETWEEN 0 AND 3),
  loneliness SMALLINT CHECK (loneliness BETWEEN 0 AND 3),
  orientation BOOLEAN,
  recall2 SMALLINT CHECK (recall2 BETWEEN 0 AND 2),
  notes TEXT,
  overall_score SMALLINT CHECK (overall_score BETWEEN 0 AND 10)
);

CREATE TYPE companion_signal_severity AS ENUM ('low','medium','high');
CREATE TABLE IF NOT EXISTS companion_wellbeing_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES ai_companion_profiles(id) ON DELETE CASCADE,
  ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  signal_type TEXT NOT NULL,
  value TEXT,
  severity companion_signal_severity NOT NULL,
  rationale TEXT
);

CREATE TABLE IF NOT EXISTS companion_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES ai_companion_profiles(id) ON DELETE CASCADE,
  ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  level companion_signal_severity NOT NULL,
  message TEXT NOT NULL,
  acknowledged_by UUID REFERENCES auth.users(id),
  acknowledged_at TIMESTAMPTZ
);

-- Agent memory (vector search)
CREATE TABLE IF NOT EXISTS companion_agent_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES ai_companion_profiles(id) ON DELETE CASCADE,
  embedding vector(768),
  fact_text TEXT NOT NULL,
  last_used_at TIMESTAMPTZ
);

-- Game sessions
CREATE TABLE IF NOT EXISTS companion_game_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES ai_companion_profiles(id) ON DELETE CASCADE,
  game_id TEXT NOT NULL,
  ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  score SMALLINT,
  duration_seconds INT,
  notes TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_companion_mood_profile_ts ON companion_mood_checkins(profile_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_companion_alerts_profile_ts ON companion_alerts(profile_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_companion_sessions_profile_ts ON companion_sessions(profile_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_companion_memory_profile ON companion_agent_memory(profile_id);

-- Enable RLS
ALTER TABLE ai_companion_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE companion_family_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE companion_interests ENABLE ROW LEVEL SECURITY;
ALTER TABLE companion_news_prefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE companion_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE companion_transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE companion_mood_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE companion_wellbeing_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE companion_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE companion_agent_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE companion_game_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies: allow access if user is the elder OR linked in family_links

CREATE POLICY "profiles_owner_or_linked_select" ON ai_companion_profiles
FOR SELECT USING (
  auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM companion_family_links fl 
    WHERE fl.profile_id = ai_companion_profiles.id AND fl.user_id = auth.uid()
  )
);

CREATE POLICY "family_links_self_select" ON companion_family_links
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "interests_select" ON companion_interests
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM ai_companion_profiles p 
    WHERE p.id = companion_interests.profile_id AND (
      p.user_id = auth.uid() OR EXISTS (
        SELECT 1 FROM companion_family_links fl 
        WHERE fl.profile_id = p.id AND fl.user_id = auth.uid()
      )
    )
  )
);

CREATE POLICY "news_prefs_select" ON companion_news_prefs
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM ai_companion_profiles p 
    WHERE p.id = companion_news_prefs.profile_id AND (
      p.user_id = auth.uid() OR EXISTS (
        SELECT 1 FROM companion_family_links fl 
        WHERE fl.profile_id = p.id AND fl.user_id = auth.uid()
      )
    )
  )
);

CREATE POLICY "sessions_select" ON companion_sessions
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM ai_companion_profiles p 
    WHERE p.id = companion_sessions.profile_id AND (
      p.user_id = auth.uid() OR EXISTS (
        SELECT 1 FROM companion_family_links fl 
        WHERE fl.profile_id = p.id AND fl.user_id = auth.uid()
      )
    )
  )
);

CREATE POLICY "transcripts_select" ON companion_transcripts
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM companion_sessions s 
    JOIN ai_companion_profiles p ON p.id = s.profile_id 
    WHERE s.id = companion_transcripts.session_id AND (
      p.user_id = auth.uid() OR EXISTS (
        SELECT 1 FROM companion_family_links fl 
        WHERE fl.profile_id = p.id AND fl.user_id = auth.uid()
      )
    )
  )
);

CREATE POLICY "mood_checkins_select" ON companion_mood_checkins
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM ai_companion_profiles p 
    WHERE p.id = companion_mood_checkins.profile_id AND (
      p.user_id = auth.uid() OR EXISTS (
        SELECT 1 FROM companion_family_links fl 
        WHERE fl.profile_id = p.id AND fl.user_id = auth.uid()
      )
    )
  )
);

CREATE POLICY "wellbeing_signals_select" ON companion_wellbeing_signals
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM ai_companion_profiles p 
    WHERE p.id = companion_wellbeing_signals.profile_id AND (
      p.user_id = auth.uid() OR EXISTS (
        SELECT 1 FROM companion_family_links fl 
        WHERE fl.profile_id = p.id AND fl.user_id = auth.uid()
      )
    )
  )
);

CREATE POLICY "alerts_select" ON companion_alerts
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM ai_companion_profiles p 
    WHERE p.id = companion_alerts.profile_id AND (
      p.user_id = auth.uid() OR EXISTS (
        SELECT 1 FROM companion_family_links fl 
        WHERE fl.profile_id = p.id AND fl.user_id = auth.uid()
      )
    )
  )
);

CREATE POLICY "agent_memory_select" ON companion_agent_memory
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM ai_companion_profiles p 
    WHERE p.id = companion_agent_memory.profile_id AND (
      p.user_id = auth.uid() OR EXISTS (
        SELECT 1 FROM companion_family_links fl 
        WHERE fl.profile_id = p.id AND fl.user_id = auth.uid()
      )
    )
  )
);

CREATE POLICY "game_sessions_select" ON companion_game_sessions
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM ai_companion_profiles p 
    WHERE p.id = companion_game_sessions.profile_id AND (
      p.user_id = auth.uid() OR EXISTS (
        SELECT 1 FROM companion_family_links fl 
        WHERE fl.profile_id = p.id AND fl.user_id = auth.uid()
      )
    )
  )
);

-- Service role policies for writes
CREATE POLICY "service_can_manage_profiles" ON ai_companion_profiles
FOR ALL USING (is_service_role()) WITH CHECK (is_service_role());

CREATE POLICY "service_can_manage_family_links" ON companion_family_links
FOR ALL USING (is_service_role()) WITH CHECK (is_service_role());

CREATE POLICY "service_can_manage_interests" ON companion_interests
FOR ALL USING (is_service_role()) WITH CHECK (is_service_role());

CREATE POLICY "service_can_manage_news_prefs" ON companion_news_prefs
FOR ALL USING (is_service_role()) WITH CHECK (is_service_role());

CREATE POLICY "service_can_manage_sessions" ON companion_sessions
FOR ALL USING (is_service_role()) WITH CHECK (is_service_role());

CREATE POLICY "service_can_manage_transcripts" ON companion_transcripts
FOR ALL USING (is_service_role()) WITH CHECK (is_service_role());

CREATE POLICY "service_can_manage_mood_checkins" ON companion_mood_checkins
FOR ALL USING (is_service_role()) WITH CHECK (is_service_role());

CREATE POLICY "service_can_manage_wellbeing_signals" ON companion_wellbeing_signals
FOR ALL USING (is_service_role()) WITH CHECK (is_service_role());

CREATE POLICY "service_can_manage_alerts" ON companion_alerts
FOR ALL USING (is_service_role()) WITH CHECK (is_service_role());

CREATE POLICY "service_can_manage_agent_memory" ON companion_agent_memory
FOR ALL USING (is_service_role()) WITH CHECK (is_service_role());

CREATE POLICY "service_can_manage_game_sessions" ON companion_game_sessions
FOR ALL USING (is_service_role()) WITH CHECK (is_service_role());