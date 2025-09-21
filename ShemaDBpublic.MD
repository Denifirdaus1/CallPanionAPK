-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.ai_call_sessions (
id uuid NOT NULL DEFAULT gen_random_uuid(),
relative_id uuid NOT NULL,
session_status text DEFAULT 'active'::text CHECK (session_status = ANY (ARRAY['active'::text, 'completed'::text, 'interrupted'::text])),
started_at timestamp with time zone DEFAULT now(),
ended_at timestamp with time zone,
duration_seconds integer,
conversation_summary text,
wellbeing_extracted jsonb,
emergency_detected boolean DEFAULT false,
follow_up_scheduled boolean DEFAULT false,
next_call_scheduled_for timestamp with time zone,
CONSTRAINT ai_call_sessions_pkey PRIMARY KEY (id)
);
CREATE TABLE public.ai_companion_profiles (
id uuid NOT NULL DEFAULT gen_random_uuid(),
user_id uuid UNIQUE,
full_name text NOT NULL,
dob date,
locale text DEFAULT 'en-GB'::text,
consent_ts timestamp with time zone,
guardian_user_id uuid,
created_at timestamp with time zone DEFAULT now(),
CONSTRAINT ai_companion_profiles_pkey PRIMARY KEY (id),
CONSTRAINT ai_companion_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
CONSTRAINT ai_companion_profiles_guardian_user_id_fkey FOREIGN KEY (guardian_user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.alert_rules (
id uuid NOT NULL DEFAULT gen_random_uuid(),
household_id uuid NOT NULL,
rule_name text NOT NULL,
rule_type text NOT NULL CHECK (rule_type = ANY (ARRAY['missed_calls'::text, 'health_concern'::text, 'emergency'::text, 'custom'::text])),
conditions jsonb NOT NULL,
actions jsonb NOT NULL,
is_active boolean NOT NULL DEFAULT true,
created_by uuid NOT NULL,
created_at timestamp with time zone NOT NULL DEFAULT now(),
updated_at timestamp with time zone NOT NULL DEFAULT now(),
CONSTRAINT alert_rules_pkey PRIMARY KEY (id)
);
CREATE TABLE public.alerts (
id uuid NOT NULL DEFAULT gen_random_uuid(),
customer_id uuid NOT NULL,
type text NOT NULL,
severity USER-DEFINED NOT NULL,
opened_at timestamp with time zone NOT NULL DEFAULT now(),
status USER-DEFINED NOT NULL DEFAULT 'OPEN'::alert_status,
created_at timestamp with time zone NOT NULL DEFAULT now(),
updated_at timestamp with time zone NOT NULL DEFAULT now(),
household_id uuid,
title text,
message text,
data jsonb DEFAULT '{}'::jsonb,
acknowledged boolean DEFAULT false,
acknowledged_by uuid,
acknowledged_at timestamp with time zone,
CONSTRAINT alerts_pkey PRIMARY KEY (id),
CONSTRAINT alerts_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id),
CONSTRAINT alerts_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id)
);
CREATE TABLE public.app_settings (
id uuid NOT NULL DEFAULT gen_random_uuid(),
setting_key text NOT NULL UNIQUE,
setting_value jsonb NOT NULL,
is_encrypted boolean NOT NULL DEFAULT false,
updated_by uuid,
created_at timestamp with time zone NOT NULL DEFAULT now(),
updated_at timestamp with time zone NOT NULL DEFAULT now(),
CONSTRAINT app_settings_pkey PRIMARY KEY (id)
);
CREATE TABLE public.audit_log (
id uuid NOT NULL DEFAULT gen_random_uuid(),
actor_user_id uuid,
actor_email text,
action text NOT NULL,
entity_type text,
entity_id text,
details jsonb,
created_at timestamp with time zone NOT NULL DEFAULT now(),
CONSTRAINT audit_log_pkey PRIMARY KEY (id)
);
CREATE TABLE public.batch_call_mappings (
id uuid NOT NULL DEFAULT gen_random_uuid(),
batch_id text NOT NULL,
batch_name text,
household_id uuid NOT NULL,
relative_id uuid NOT NULL,
phone_number text NOT NULL,
scheduled_time_unix bigint NOT NULL,
created_at timestamp with time zone NOT NULL DEFAULT now(),
resolved_at timestamp with time zone,
provider_call_id text,
CONSTRAINT batch_call_mappings_pkey PRIMARY KEY (id),
CONSTRAINT batch_call_mappings_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id),
CONSTRAINT batch_call_mappings_relative_id_fkey FOREIGN KEY (relative_id) REFERENCES public.relatives(id)
);
CREATE TABLE public.call_analysis (
id uuid NOT NULL DEFAULT gen_random_uuid(),
user_id uuid NOT NULL,
call_log_id uuid,
timestamp timestamp with time zone NOT NULL DEFAULT now(),
mood_score integer CHECK (mood_score >= 1 AND mood_score <= 5),
health_flag boolean NOT NULL DEFAULT false,
urgent_flag boolean NOT NULL DEFAULT false,
transcript text,
summary text,
created_at timestamp with time zone NOT NULL DEFAULT now(),
updated_at timestamp with time zone NOT NULL DEFAULT now(),
CONSTRAINT call_analysis_pkey PRIMARY KEY (id),
CONSTRAINT call_analysis_call_log_id_fkey FOREIGN KEY (call_log_id) REFERENCES public.call_logs(id)
);
CREATE TABLE public.call_audit (
id uuid NOT NULL DEFAULT gen_random_uuid(),
elder_profile_id uuid NOT NULL,
started_by uuid,
session_kind text NOT NULL CHECK (session_kind = 'realtime_agent'::text),
started_at timestamp with time zone NOT NULL DEFAULT now(),
ended_at timestamp with time zone,
outcome text,
error_detail text,
CONSTRAINT call_audit_pkey PRIMARY KEY (id),
CONSTRAINT call_audit_elder_profile_id_fkey FOREIGN KEY (elder_profile_id) REFERENCES public.profiles(id),
CONSTRAINT call_audit_started_by_fkey FOREIGN KEY (started_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.call_logs (
id uuid NOT NULL DEFAULT gen_random_uuid(),
user_id uuid NOT NULL,
timestamp timestamp with time zone NOT NULL DEFAULT now(),
call_outcome text NOT NULL CHECK (call_outcome = ANY (ARRAY['completed'::text, 'missed'::text, 'failed'::text, 'no_answer'::text, 'busy'::text, 'initiated'::text, 'answered'::text])),
call_duration integer,
daily_api_room_id text,
audio_recording_url text,
created_at timestamp with time zone NOT NULL DEFAULT now(),
updated_at timestamp with time zone NOT NULL DEFAULT now(),
session_id text,
ai_conversation_state jsonb DEFAULT '{}'::jsonb,
conversation_summary text,
mood_assessment text,
health_concerns_detected boolean DEFAULT false,
emergency_flag boolean DEFAULT false,
provider text DEFAULT 'elevenlabs'::text CHECK (provider = ANY (ARRAY['elevenlabs'::text, 'webrtc'::text, 'flutter_app'::text, 'daily'::text])),
provider_call_id text,
household_id uuid,
relative_id uuid,
call_type text CHECK (call_type = ANY (ARRAY['batch_call'::text, 'in_app_call'::text])),
CONSTRAINT call_logs_pkey PRIMARY KEY (id),
CONSTRAINT call_logs_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id),
CONSTRAINT call_logs_relative_id_fkey FOREIGN KEY (relative_id) REFERENCES public.relatives(id)
);
CREATE TABLE public.call_permissions (
id uuid NOT NULL DEFAULT gen_random_uuid(),
elder_profile_id uuid NOT NULL,
contact_name text NOT NULL,
contact_type text NOT NULL DEFAULT 'agent'::text CHECK (contact_type = ANY (ARRAY['agent'::text, 'person'::text])),
destination text,
allowed boolean NOT NULL DEFAULT true,
created_at timestamp with time zone DEFAULT now(),
CONSTRAINT call_permissions_pkey PRIMARY KEY (id),
CONSTRAINT call_permissions_elder_profile_id_fkey FOREIGN KEY (elder_profile_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.call_rooms (
id uuid NOT NULL DEFAULT gen_random_uuid(),
household_id uuid NOT NULL,
relative_id uuid NOT NULL,
room_name text NOT NULL UNIQUE,
room_url text NOT NULL,
scheduled_time timestamp with time zone NOT NULL,
status text NOT NULL DEFAULT 'scheduled'::text,
created_at timestamp with time zone NOT NULL DEFAULT now(),
started_at timestamp with time zone,
ended_at timestamp with time zone,
participants jsonb DEFAULT '[]'::jsonb,
CONSTRAINT call_rooms_pkey PRIMARY KEY (id)
);
CREATE TABLE public.call_sessions (
id uuid NOT NULL DEFAULT gen_random_uuid(),
household_id uuid NOT NULL,
relative_id uuid NOT NULL,
room_id text,
room_url text,
status text NOT NULL DEFAULT 'scheduled'::text,
call_type text NOT NULL DEFAULT 'in_app_call'::text,
provider text NOT NULL DEFAULT 'webrtc'::text,
scheduled_time timestamp with time zone NOT NULL,
started_at timestamp with time zone,
ended_at timestamp with time zone,
duration_seconds integer,
participant_count integer DEFAULT 0,
call_log_id uuid,
created_at timestamp with time zone NOT NULL DEFAULT now(),
updated_at timestamp with time zone NOT NULL DEFAULT now(),
call_uuid text,
CONSTRAINT call_sessions_pkey PRIMARY KEY (id),
CONSTRAINT fk_call_sessions_household FOREIGN KEY (household_id) REFERENCES public.households(id),
CONSTRAINT fk_call_sessions_relative FOREIGN KEY (relative_id) REFERENCES public.relatives(id),
CONSTRAINT fk_call_sessions_call_log FOREIGN KEY (call_log_id) REFERENCES public.call_logs(id)
);
CREATE TABLE public.call_summaries (
id uuid NOT NULL DEFAULT gen_random_uuid(),
household_id uuid NOT NULL,
relative_id uuid NOT NULL,
call_log_id uuid,
provider text NOT NULL DEFAULT 'elevenlabs'::text,
provider_call_id text,
mood text,
mood_score integer CHECK (mood_score >= 1 AND mood_score <= 10),
key_points jsonb DEFAULT '{}'::jsonb,
transcript_url text,
tl_dr text,
created_at timestamp with time zone NOT NULL DEFAULT now(),
CONSTRAINT call_summaries_pkey PRIMARY KEY (id),
CONSTRAINT call_summaries_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id),
CONSTRAINT call_summaries_relative_id_fkey FOREIGN KEY (relative_id) REFERENCES public.relatives(id),
CONSTRAINT call_summaries_call_log_id_fkey FOREIGN KEY (call_log_id) REFERENCES public.call_logs(id)
);
CREATE TABLE public.case_notes (
id uuid NOT NULL DEFAULT gen_random_uuid(),
customer_id uuid NOT NULL,
author_user_id uuid,
content text NOT NULL,
created_at timestamp with time zone NOT NULL DEFAULT now(),
CONSTRAINT case_notes_pkey PRIMARY KEY (id),
CONSTRAINT case_notes_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id)
);
CREATE TABLE public.check_ins (
id uuid NOT NULL DEFAULT gen_random_uuid(),
elder_id uuid NOT NULL,
status text NOT NULL CHECK (status = ANY (ARRAY['good'::text, 'ok'::text, 'not_ok'::text, 'missed'::text, 'pending'::text])),
notes text,
created_at timestamp with time zone NOT NULL DEFAULT now(),
updated_at timestamp with time zone NOT NULL DEFAULT now(),
CONSTRAINT check_ins_pkey PRIMARY KEY (id),
CONSTRAINT check_ins_elder_id_fkey FOREIGN KEY (elder_id) REFERENCES auth.users(id)
);
CREATE TABLE public.checkin_alerts (
id uuid NOT NULL DEFAULT gen_random_uuid(),
elder_id uuid NOT NULL,
check_in_id uuid NOT NULL,
message text NOT NULL,
resolved boolean NOT NULL DEFAULT false,
created_at timestamp with time zone NOT NULL DEFAULT now(),
resolved_at timestamp with time zone,
CONSTRAINT checkin_alerts_pkey PRIMARY KEY (id),
CONSTRAINT checkin_alerts_elder_id_fkey FOREIGN KEY (elder_id) REFERENCES auth.users(id),
CONSTRAINT checkin_alerts_check_in_id_fkey FOREIGN KEY (check_in_id) REFERENCES public.check_ins(id)
);
CREATE TABLE public.companion_agent_memory (
id uuid NOT NULL DEFAULT gen_random_uuid(),
profile_id uuid NOT NULL,
fact_text text NOT NULL,
last_used_at timestamp with time zone,
CONSTRAINT companion_agent_memory_pkey PRIMARY KEY (id),
CONSTRAINT companion_agent_memory_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.ai_companion_profiles(id)
);
CREATE TABLE public.companion_alerts (
id uuid NOT NULL DEFAULT gen_random_uuid(),
profile_id uuid NOT NULL,
ts timestamp with time zone NOT NULL DEFAULT now(),
level USER-DEFINED NOT NULL,
message text NOT NULL,
acknowledged_by uuid,
acknowledged_at timestamp with time zone,
CONSTRAINT companion_alerts_pkey PRIMARY KEY (id),
CONSTRAINT companion_alerts_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.ai_companion_profiles(id),
CONSTRAINT companion_alerts_acknowledged_by_fkey FOREIGN KEY (acknowledged_by) REFERENCES auth.users(id)
);
CREATE TABLE public.companion_family_links (
id uuid NOT NULL DEFAULT gen_random_uuid(),
profile_id uuid NOT NULL,
user_id uuid NOT NULL,
role USER-DEFINED NOT NULL,
CONSTRAINT companion_family_links_pkey PRIMARY KEY (id),
CONSTRAINT companion_family_links_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.ai_companion_profiles(id),
CONSTRAINT companion_family_links_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.companion_game_sessions (
id uuid NOT NULL DEFAULT gen_random_uuid(),
profile_id uuid NOT NULL,
game_id text NOT NULL,
ts timestamp with time zone NOT NULL DEFAULT now(),
score smallint,
duration_seconds integer,
notes text,
CONSTRAINT companion_game_sessions_pkey PRIMARY KEY (id),
CONSTRAINT companion_game_sessions_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.ai_companion_profiles(id)
);
CREATE TABLE public.companion_interests (
id uuid NOT NULL DEFAULT gen_random_uuid(),
profile_id uuid NOT NULL,
topic text NOT NULL,
notes text,
source text,
created_at timestamp with time zone DEFAULT now(),
CONSTRAINT companion_interests_pkey PRIMARY KEY (id),
CONSTRAINT companion_interests_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.ai_companion_profiles(id)
);
CREATE TABLE public.companion_mood_checkins (
id uuid NOT NULL DEFAULT gen_random_uuid(),
profile_id uuid NOT NULL,
session_id uuid,
ts timestamp with time zone NOT NULL DEFAULT now(),
phq2 ARRAY CHECK (cardinality(phq2) = 2 AND phq2[1] >= 0 AND phq2[1] <= 3 AND phq2[2] >= 0 AND phq2[2] <= 3),
energy smallint CHECK (energy >= 0 AND energy <= 3),
loneliness smallint CHECK (loneliness >= 0 AND loneliness <= 3),
orientation boolean,
recall2 smallint CHECK (recall2 >= 0 AND recall2 <= 2),
notes text,
overall_score smallint CHECK (overall_score >= 0 AND overall_score <= 10),
CONSTRAINT companion_mood_checkins_pkey PRIMARY KEY (id),
CONSTRAINT companion_mood_checkins_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.ai_companion_profiles(id),
CONSTRAINT companion_mood_checkins_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.companion_sessions(id)
);
CREATE TABLE public.companion_news_prefs (
profile_id uuid NOT NULL,
topics ARRAY DEFAULT ARRAY[]::text[],
sources ARRAY DEFAULT ARRAY[]::text[],
CONSTRAINT companion_news_prefs_pkey PRIMARY KEY (profile_id),
CONSTRAINT companion_news_prefs_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.ai_companion_profiles(id)
);
CREATE TABLE public.companion_sessions (
id uuid NOT NULL DEFAULT gen_random_uuid(),
profile_id uuid NOT NULL,
started_at timestamp with time zone NOT NULL DEFAULT now(),
ended_at timestamp with time zone,
CONSTRAINT companion_sessions_pkey PRIMARY KEY (id),
CONSTRAINT companion_sessions_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.ai_companion_profiles(id)
);
CREATE TABLE public.companion_transcripts (
id uuid NOT NULL DEFAULT gen_random_uuid(),
session_id uuid NOT NULL,
ts timestamp with time zone NOT NULL DEFAULT now(),
speaker text CHECK (speaker = ANY (ARRAY['user'::text, 'agent'::text])),
text text NOT NULL,
pii_masked_text text,
CONSTRAINT companion_transcripts_pkey PRIMARY KEY (id),
CONSTRAINT companion_transcripts_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.companion_sessions(id)
);
CREATE TABLE public.companion_wellbeing_signals (
id uuid NOT NULL DEFAULT gen_random_uuid(),
profile_id uuid NOT NULL,
ts timestamp with time zone NOT NULL DEFAULT now(),
signal_type text NOT NULL,
value text,
severity USER-DEFINED NOT NULL,
rationale text,
CONSTRAINT companion_wellbeing_signals_pkey PRIMARY KEY (id),
CONSTRAINT companion_wellbeing_signals_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.ai_companion_profiles(id)
);
CREATE TABLE public.consents (
id uuid NOT NULL DEFAULT gen_random_uuid(),
customer_id uuid NOT NULL,
type USER-DEFINED NOT NULL,
status USER-DEFINED NOT NULL,
captured_by uuid,
evidence_url text,
created_at timestamp with time zone NOT NULL DEFAULT now(),
updated_at timestamp with time zone NOT NULL DEFAULT now(),
CONSTRAINT consents_pkey PRIMARY KEY (id),
CONSTRAINT consents_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id)
);
CREATE TABLE public.conversation_insights (
id uuid NOT NULL DEFAULT gen_random_uuid(),
session_id uuid,
relative_id uuid,
analysis_type text NOT NULL DEFAULT 'wellbeing_check'::text,
mood_score integer CHECK (mood_score >= 1 AND mood_score <= 10),
wellbeing_indicators jsonb DEFAULT '{}'::jsonb,
health_concerns ARRAY DEFAULT ARRAY[]::text[],
key_topics ARRAY DEFAULT ARRAY[]::text[],
alerts ARRAY DEFAULT ARRAY[]::text[],
raw_analysis jsonb DEFAULT '{}'::jsonb,
transcript_summary text,
created_at timestamp with time zone DEFAULT now(),
updated_at timestamp with time zone DEFAULT now(),
CONSTRAINT conversation_insights_pkey PRIMARY KEY (id),
CONSTRAINT conversation_insights_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.call_sessions(id),
CONSTRAINT conversation_insights_relative_id_fkey FOREIGN KEY (relative_id) REFERENCES public.relatives(id)
);
CREATE TABLE public.cron_heartbeat (
id uuid NOT NULL DEFAULT gen_random_uuid(),
job_name text NOT NULL UNIQUE,
last_run timestamp with time zone NOT NULL DEFAULT now(),
status text NOT NULL DEFAULT 'success'::text,
details jsonb DEFAULT '{}'::jsonb,
CONSTRAINT cron_heartbeat_pkey PRIMARY KEY (id)
);
CREATE TABLE public.customers (
id uuid NOT NULL DEFAULT gen_random_uuid(),
full_name text NOT NULL,
email text,
phone text,
status text,
risk_flag boolean NOT NULL DEFAULT false,
plan text,
device_status text,
created_at timestamp with time zone NOT NULL DEFAULT now(),
updated_at timestamp with time zone NOT NULL DEFAULT now(),
created_by uuid,
preferred_name text,
timezone text,
address_line text,
city text,
postcode text,
country text,
preferences jsonb,
CONSTRAINT customers_pkey PRIMARY KEY (id)
);
CREATE TABLE public.daily_call_tracking (
id uuid NOT NULL DEFAULT gen_random_uuid(),
household_id uuid NOT NULL,
relative_id uuid NOT NULL,
call_date date NOT NULL DEFAULT CURRENT_DATE,
morning_called boolean DEFAULT false,
afternoon_called boolean DEFAULT false,
evening_called boolean DEFAULT false,
created_at timestamp with time zone DEFAULT now(),
updated_at timestamp with time zone DEFAULT now(),
CONSTRAINT daily_call_tracking_pkey PRIMARY KEY (id)
);
CREATE TABLE public.device_pairs (
id uuid NOT NULL DEFAULT gen_random_uuid(),
household_id uuid NOT NULL,
code_6 text NOT NULL,
pair_token text NOT NULL UNIQUE,
device_label text,
expires_at timestamp with time zone NOT NULL,
created_by uuid NOT NULL,
claimed_at timestamp with time zone,
claimed_by uuid,
created_at timestamp with time zone NOT NULL DEFAULT now(),
updated_at timestamp with time zone NOT NULL DEFAULT now(),
relative_id uuid,
device_info jsonb DEFAULT '{}'::jsonb,
CONSTRAINT device_pairs_pkey PRIMARY KEY (id),
CONSTRAINT device_pairs_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id),
CONSTRAINT device_pairs_relative_id_fkey FOREIGN KEY (relative_id) REFERENCES public.relatives(id)
);
CREATE TABLE public.devices (
id uuid NOT NULL DEFAULT gen_random_uuid(),
customer_id uuid NOT NULL,
serial text UNIQUE,
type USER-DEFINED NOT NULL,
status USER-DEFINED NOT NULL DEFAULT 'PENDING'::device_status,
last_sync timestamp with time zone,
metadata jsonb,
created_at timestamp with time zone NOT NULL DEFAULT now(),
updated_at timestamp with time zone NOT NULL DEFAULT now(),
push_token text,
platform text,
push_token_updated_at timestamp with time zone,
CONSTRAINT devices_pkey PRIMARY KEY (id),
CONSTRAINT devices_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id)
);
CREATE TABLE public.elder_access (
elder_id uuid NOT NULL,
user_id uuid NOT NULL,
can_view_health boolean NOT NULL DEFAULT false,
CONSTRAINT elder_access_pkey PRIMARY KEY (user_id, elder_id),
CONSTRAINT elder_access_elder_id_fkey FOREIGN KEY (elder_id) REFERENCES public.elders(id),
CONSTRAINT elder_access_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.elderly_household_connections (
id uuid NOT NULL DEFAULT gen_random_uuid(),
elderly_user_id uuid NOT NULL,
household_id uuid NOT NULL,
relative_id uuid NOT NULL,
connected_at timestamp with time zone NOT NULL DEFAULT now(),
created_at timestamp with time zone NOT NULL DEFAULT now(),
updated_at timestamp with time zone NOT NULL DEFAULT now(),
CONSTRAINT elderly_household_connections_pkey PRIMARY KEY (id),
CONSTRAINT elderly_household_connections_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id),
CONSTRAINT elderly_household_connections_relative_id_fkey FOREIGN KEY (relative_id) REFERENCES public.relatives(id)
);
CREATE TABLE public.elders (
id uuid NOT NULL DEFAULT gen_random_uuid(),
family_id uuid NOT NULL,
full_name text NOT NULL,
dob date,
notes text,
created_at timestamp with time zone DEFAULT now(),
can_receive_calls boolean NOT NULL DEFAULT true,
can_make_calls boolean NOT NULL DEFAULT false,
quiet_hours_start text,
quiet_hours_end text,
allowed_contacts jsonb NOT NULL DEFAULT '[]'::jsonb,
status text NOT NULL DEFAULT 'active'::text,
relative_id uuid,
CONSTRAINT elders_pkey PRIMARY KEY (id),
CONSTRAINT elders_family_id_fkey FOREIGN KEY (family_id) REFERENCES public.families(id),
CONSTRAINT elders_relative_id_fkey FOREIGN KEY (relative_id) REFERENCES public.relatives(id)
);
CREATE TABLE public.endpoint_access_logs (
id uuid NOT NULL DEFAULT gen_random_uuid(),
endpoint text NOT NULL,
ip_address text,
user_agent text,
origin text,
request_data jsonb,
response_status integer,
blocked boolean DEFAULT false,
block_reason text,
created_at timestamp with time zone DEFAULT now(),
CONSTRAINT endpoint_access_logs_pkey PRIMARY KEY (id)
);
CREATE TABLE public.events (
id uuid NOT NULL DEFAULT gen_random_uuid(),
family_id uuid NOT NULL,
elder_id uuid,
title text NOT NULL,
description text,
starts_at timestamp with time zone NOT NULL,
ends_at timestamp with time zone,
created_by uuid,
created_at timestamp with time zone DEFAULT now(),
CONSTRAINT events_pkey PRIMARY KEY (id),
CONSTRAINT events_family_id_fkey FOREIGN KEY (family_id) REFERENCES public.families(id),
CONSTRAINT events_elder_id_fkey FOREIGN KEY (elder_id) REFERENCES public.elders(id),
CONSTRAINT events_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);
CREATE TABLE public.families (
id uuid NOT NULL DEFAULT gen_random_uuid(),
name text NOT NULL,
created_by uuid,
created_at timestamp with time zone DEFAULT now(),
CONSTRAINT families_pkey PRIMARY KEY (id),
CONSTRAINT families_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);
CREATE TABLE public.family_invites (
id uuid NOT NULL DEFAULT gen_random_uuid(),
family_id uuid NOT NULL,
email text NOT NULL,
role USER-DEFINED NOT NULL DEFAULT 'member'::member_role,
can_view_family_health boolean NOT NULL DEFAULT false,
token text NOT NULL,
expires_at timestamp with time zone NOT NULL,
accepted_by uuid,
created_at timestamp with time zone DEFAULT now(),
CONSTRAINT family_invites_pkey PRIMARY KEY (id),
CONSTRAINT family_invites_family_id_fkey FOREIGN KEY (family_id) REFERENCES public.families(id),
CONSTRAINT family_invites_accepted_by_fkey FOREIGN KEY (accepted_by) REFERENCES auth.users(id)
);
CREATE TABLE public.family_links (
id uuid NOT NULL DEFAULT gen_random_uuid(),
elder_id uuid NOT NULL,
family_id uuid NOT NULL,
relationship text,
created_at timestamp with time zone NOT NULL DEFAULT now(),
CONSTRAINT family_links_pkey PRIMARY KEY (id),
CONSTRAINT family_links_elder_id_fkey FOREIGN KEY (elder_id) REFERENCES auth.users(id),
CONSTRAINT family_links_family_id_fkey FOREIGN KEY (family_id) REFERENCES auth.users(id)
);
CREATE TABLE public.family_members (
id uuid NOT NULL DEFAULT gen_random_uuid(),
family_id uuid NOT NULL,
user_id uuid NOT NULL,
role USER-DEFINED NOT NULL DEFAULT 'member'::member_role,
can_view_family_health boolean NOT NULL DEFAULT false,
created_at timestamp with time zone DEFAULT now(),
CONSTRAINT family_members_pkey PRIMARY KEY (id),
CONSTRAINT family_members_family_id_fkey FOREIGN KEY (family_id) REFERENCES public.families(id),
CONSTRAINT family_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.family_messages (
id uuid NOT NULL DEFAULT gen_random_uuid(),
household_id uuid,
sender_id uuid,
content text NOT NULL,
message_type text NOT NULL DEFAULT 'text'::text,
scheduled_for timestamp with time zone,
status text NOT NULL DEFAULT 'sent'::text,
created_at timestamp with time zone NOT NULL DEFAULT now(),
updated_at timestamp with time zone NOT NULL DEFAULT now(),
CONSTRAINT family_messages_pkey PRIMARY KEY (id),
CONSTRAINT family_messages_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id),
CONSTRAINT family_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES auth.users(id)
);
CREATE TABLE public.family_notifications (
id uuid NOT NULL DEFAULT gen_random_uuid(),
household_id uuid NOT NULL,
relative_id uuid,
title text NOT NULL,
message text NOT NULL,
priority text DEFAULT 'medium'::text CHECK (priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'emergency'::text])),
notification_type text DEFAULT 'general'::text CHECK (notification_type = ANY (ARRAY['wellbeing_alert'::text, 'emergency_escalation'::text, 'missed_call'::text, 'general'::text])),
sent_to_user_ids ARRAY,
created_at timestamp with time zone DEFAULT now(),
read_by jsonb DEFAULT '{}'::jsonb,
resolved_at timestamp with time zone,
CONSTRAINT family_notifications_pkey PRIMARY KEY (id)
);
CREATE TABLE public.family_photos (
id uuid NOT NULL DEFAULT gen_random_uuid(),
url text NOT NULL,
caption text,
uploaded_by text,
uploaded_at timestamp with time zone NOT NULL DEFAULT now(),
alt text,
likes integer NOT NULL DEFAULT 0,
user_id uuid,
household_id uuid,
storage_path text,
CONSTRAINT family_photos_pkey PRIMARY KEY (id),
CONSTRAINT family_photos_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id)
);
CREATE TABLE public.faqs (
id uuid NOT NULL DEFAULT gen_random_uuid(),
question text NOT NULL,
answer text NOT NULL,
tags ARRAY DEFAULT '{}'::text[],
display_order integer DEFAULT 0,
is_active boolean DEFAULT true,
created_at timestamp with time zone NOT NULL DEFAULT now(),
updated_at timestamp with time zone NOT NULL DEFAULT now(),
CONSTRAINT faqs_pkey PRIMARY KEY (id)
);
CREATE TABLE public.health_consents (
id uuid NOT NULL DEFAULT gen_random_uuid(),
relative_id uuid NOT NULL,
granted_to_user_id uuid NOT NULL,
can_view_detailed_health boolean NOT NULL DEFAULT false,
can_view_call_recordings boolean NOT NULL DEFAULT false,
can_view_transcripts boolean NOT NULL DEFAULT false,
granted_at timestamp with time zone,
revoked_at timestamp with time zone,
created_at timestamp with time zone NOT NULL DEFAULT now(),
updated_at timestamp with time zone NOT NULL DEFAULT now(),
CONSTRAINT health_consents_pkey PRIMARY KEY (id),
CONSTRAINT health_consents_relative_id_fkey FOREIGN KEY (relative_id) REFERENCES public.relatives(id)
);
CREATE TABLE public.health_data_access_log (
id uuid NOT NULL DEFAULT gen_random_uuid(),
accessor_user_id uuid NOT NULL,
relative_id uuid NOT NULL,
data_type text NOT NULL,
access_level text NOT NULL,
consent_verified boolean NOT NULL DEFAULT false,
ip_address text,
user_agent text,
created_at timestamp with time zone NOT NULL DEFAULT now(),
CONSTRAINT health_data_access_log_pkey PRIMARY KEY (id)
);
CREATE TABLE public.health_data_consents (
id uuid NOT NULL DEFAULT gen_random_uuid(),
relative_id uuid NOT NULL,
granted_to_user_id uuid NOT NULL,
consent_type USER-DEFINED NOT NULL,
granted boolean NOT NULL DEFAULT false,
granted_at timestamp with time zone,
revoked_at timestamp with time zone,
created_at timestamp with time zone NOT NULL DEFAULT now(),
updated_at timestamp with time zone NOT NULL DEFAULT now(),
CONSTRAINT health_data_consents_pkey PRIMARY KEY (id),
CONSTRAINT health_data_consents_relative_id_fkey FOREIGN KEY (relative_id) REFERENCES public.relatives(id)
);
CREATE TABLE public.health_insights (
id uuid NOT NULL DEFAULT gen_random_uuid(),
elder_id uuid NOT NULL,
measured_at timestamp with time zone NOT NULL DEFAULT now(),
payload jsonb NOT NULL,
CONSTRAINT health_insights_pkey PRIMARY KEY (id),
CONSTRAINT health_insights_elder_id_fkey FOREIGN KEY (elder_id) REFERENCES public.elders(id)
);
CREATE TABLE public.household_members (
id uuid NOT NULL DEFAULT gen_random_uuid(),
household_id uuid NOT NULL,
user_id uuid,
customer_id uuid,
role USER-DEFINED NOT NULL,
added_by uuid,
created_at timestamp with time zone NOT NULL DEFAULT now(),
health_access_level USER-DEFINED DEFAULT 'SUMMARY_ONLY'::health_access_level,
can_view_calendar boolean NOT NULL DEFAULT false,
can_post_updates boolean NOT NULL DEFAULT false,
CONSTRAINT household_members_pkey PRIMARY KEY (id),
CONSTRAINT household_members_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id),
CONSTRAINT household_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
CONSTRAINT household_members_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id),
CONSTRAINT household_members_added_by_fkey FOREIGN KEY (added_by) REFERENCES auth.users(id)
);
CREATE TABLE public.households (
id uuid NOT NULL DEFAULT gen_random_uuid(),
name text,
timezone text,
address_line text,
city text,
postcode text,
country text,
created_at timestamp with time zone NOT NULL DEFAULT now(),
updated_at timestamp with time zone NOT NULL DEFAULT now(),
created_by uuid,
gdpr_consent_status boolean DEFAULT false,
gdpr_consent_timestamp timestamp with time zone,
call_method_preference text NOT NULL DEFAULT 'batch_call'::text CHECK (call_method_preference = ANY (ARRAY['batch_call'::text, 'in_app_call'::text])),
CONSTRAINT households_pkey PRIMARY KEY (id)
);
CREATE TABLE public.invite_rate_limiter (
email text NOT NULL,
last_sent_at timestamp with time zone NOT NULL DEFAULT now(),
last_ip inet,
CONSTRAINT invite_rate_limiter_pkey PRIMARY KEY (email)
);
CREATE TABLE public.invites (
id uuid NOT NULL DEFAULT gen_random_uuid(),
household_id uuid NOT NULL,
email text NOT NULL,
role text NOT NULL DEFAULT 'viewer'::text,
token text NOT NULL,
invited_by uuid NOT NULL,
expires_at timestamp with time zone NOT NULL DEFAULT (now() + '7 days'::interval),
accepted_at timestamp with time zone,
gdpr_consent_status boolean DEFAULT false,
gdpr_consent_timestamp timestamp with time zone,
relationship_type text,
permissions_metadata jsonb DEFAULT '{}'::jsonb,
display_name text,
metadata jsonb DEFAULT '{}'::jsonb,
CONSTRAINT invites_pkey PRIMARY KEY (id),
CONSTRAINT invites_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id),
CONSTRAINT invites_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES auth.users(id)
);
CREATE TABLE public.legal_acceptances (
id uuid NOT NULL DEFAULT gen_random_uuid(),
user_id uuid NOT NULL,
document_type text NOT NULL,
document_version text NOT NULL,
accepted_at timestamp with time zone NOT NULL DEFAULT now(),
ip_address text,
user_agent text,
subscription_id text,
created_at timestamp with time zone NOT NULL DEFAULT now(),
CONSTRAINT legal_acceptances_pkey PRIMARY KEY (id)
);
CREATE TABLE public.media (
id uuid NOT NULL DEFAULT gen_random_uuid(),
household_id uuid,
title text NOT NULL,
description text,
media_type text NOT NULL CHECK (media_type = ANY (ARRAY['photo'::text, 'video'::text, 'audio'::text])),
url text NOT NULL,
uploaded_by uuid,
created_at timestamp with time zone NOT NULL DEFAULT now(),
CONSTRAINT media_pkey PRIMARY KEY (id)
);
CREATE TABLE public.media_uploads (
id uuid NOT NULL DEFAULT gen_random_uuid(),
uploaded_by uuid NOT NULL,
household_id uuid NOT NULL,
filename text NOT NULL,
original_filename text NOT NULL,
file_size integer NOT NULL,
mime_type text NOT NULL,
storage_path text NOT NULL,
upload_status text NOT NULL DEFAULT 'pending'::text CHECK (upload_status = ANY (ARRAY['pending'::text, 'uploaded'::text, 'processed'::text, 'failed'::text])),
delivery_status text NOT NULL DEFAULT 'pending'::text CHECK (delivery_status = ANY (ARRAY['pending'::text, 'delivered'::text, 'failed'::text])),
delivered_to jsonb DEFAULT '[]'::jsonb,
created_at timestamp with time zone NOT NULL DEFAULT now(),
updated_at timestamp with time zone NOT NULL DEFAULT now(),
CONSTRAINT media_uploads_pkey PRIMARY KEY (id)
);
CREATE TABLE public.notification_history (
id uuid NOT NULL DEFAULT gen_random_uuid(),
user_id uuid NOT NULL,
title text NOT NULL,
body text NOT NULL,
data jsonb DEFAULT '{}'::jsonb,
status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'sent'::text, 'delivered'::text, 'failed'::text])),
sent_at timestamp with time zone,
delivered_at timestamp with time zone,
error_message text,
created_at timestamp with time zone NOT NULL DEFAULT now(),
CONSTRAINT notification_history_pkey PRIMARY KEY (id)
);
CREATE TABLE public.org_users (
id uuid NOT NULL DEFAULT gen_random_uuid(),
user_id uuid UNIQUE,
email text NOT NULL UNIQUE,
role USER-DEFINED NOT NULL,
status USER-DEFINED NOT NULL DEFAULT 'INVITED'::user_status,
last_login timestamp with time zone,
mfa_enabled boolean NOT NULL DEFAULT false,
created_at timestamp with time zone NOT NULL DEFAULT now(),
updated_at timestamp with time zone NOT NULL DEFAULT now(),
CONSTRAINT org_users_pkey PRIMARY KEY (id)
);
CREATE TABLE public.pairing_tokens (
id uuid NOT NULL DEFAULT gen_random_uuid(),
household_id uuid NOT NULL,
relative_id uuid,
token_6_digit text NOT NULL UNIQUE,
device_info jsonb DEFAULT '{}'::jsonb,
status text NOT NULL DEFAULT 'pending'::text,
expires_at timestamp with time zone NOT NULL DEFAULT (now() + '24:00:00'::interval),
used_at timestamp with time zone,
used_by_device_id uuid,
created_at timestamp with time zone NOT NULL DEFAULT now(),
created_by uuid NOT NULL,
CONSTRAINT pairing_tokens_pkey PRIMARY KEY (id),
CONSTRAINT fk_pairing_tokens_household FOREIGN KEY (household_id) REFERENCES public.households(id),
CONSTRAINT fk_pairing_tokens_relative FOREIGN KEY (relative_id) REFERENCES public.relatives(id)
);
CREATE TABLE public.photo_comments (
id uuid NOT NULL DEFAULT gen_random_uuid(),
photo_id uuid NOT NULL,
author text,
text text NOT NULL,
created_at timestamp with time zone NOT NULL DEFAULT now(),
user_id uuid,
CONSTRAINT photo_comments_pkey PRIMARY KEY (id),
CONSTRAINT photo_comments_photo_id_fkey FOREIGN KEY (photo_id) REFERENCES public.family_photos(id)
);
CREATE TABLE public.profiles (
id uuid NOT NULL,
display_name text,
avatar_url text,
role text CHECK (role = ANY (ARRAY['family'::text, 'elderly'::text])),
created_at timestamp with time zone NOT NULL DEFAULT now(),
updated_at timestamp with time zone NOT NULL DEFAULT now(),
preferred_call_times ARRAY DEFAULT ARRAY['09:00'::text, '13:00'::text, '18:00'::text],
mfa_enabled boolean DEFAULT false,
CONSTRAINT profiles_pkey PRIMARY KEY (id),
CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.push_notification_tokens (
id uuid NOT NULL DEFAULT gen_random_uuid(),
user_id uuid NOT NULL,
token text NOT NULL,
platform text NOT NULL CHECK (platform = ANY (ARRAY['ios'::text, 'android'::text, 'web'::text])),
device_info jsonb DEFAULT '{}'::jsonb,
created_at timestamp with time zone NOT NULL DEFAULT now(),
updated_at timestamp with time zone NOT NULL DEFAULT now(),
is_active boolean NOT NULL DEFAULT true,
voip_token text,
CONSTRAINT push_notification_tokens_pkey PRIMARY KEY (id)
);
CREATE TABLE public.push_notifications (
id uuid NOT NULL DEFAULT gen_random_uuid(),
device_id uuid NOT NULL,
title text NOT NULL,
body text NOT NULL,
data jsonb DEFAULT '{}'::jsonb,
sent_at timestamp with time zone,
created_at timestamp with time zone DEFAULT now(),
CONSTRAINT push_notifications_pkey PRIMARY KEY (id),
CONSTRAINT push_notifications_device_id_fkey FOREIGN KEY (device_id) REFERENCES elder.devices(id)
);
CREATE TABLE public.quotas (
household_id uuid NOT NULL,
daily_call_cap integer NOT NULL DEFAULT 3,
monthly_call_cap integer NOT NULL DEFAULT 90,
calls_today integer NOT NULL DEFAULT 0,
last_reset date DEFAULT CURRENT_DATE,
CONSTRAINT quotas_pkey PRIMARY KEY (household_id),
CONSTRAINT quotas_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id)
);
CREATE TABLE public.rate_limits (
id uuid NOT NULL DEFAULT gen_random_uuid(),
identifier text NOT NULL,
endpoint text NOT NULL,
request_count integer DEFAULT 1,
window_start timestamp with time zone DEFAULT now(),
created_at timestamp with time zone DEFAULT now(),
CONSTRAINT rate_limits_pkey PRIMARY KEY (id)
);
CREATE TABLE public.relatives (
id uuid NOT NULL DEFAULT gen_random_uuid(),
household_id uuid NOT NULL,
first_name text,
last_name text,
town text NOT NULL,
county text,
country text NOT NULL DEFAULT 'United Kingdom'::text,
postcode text,
timezone text DEFAULT 'Europe/London'::text,
call_cadence text DEFAULT 'daily'::text,
quiet_hours_start text,
quiet_hours_end text,
escalation_contact_name text,
escalation_contact_email text,
created_at timestamp with time zone DEFAULT now(),
last_active_at timestamp with time zone DEFAULT now(),
inactive_since timestamp with time zone,
phone_e164 text CHECK (phone_e164 IS NULL OR phone_e164 ~ '^\+[1-9]\d{7,14}$'::text),
phone_number text,
call_method text DEFAULT 'phone'::text CHECK (call_method = ANY (ARRAY['phone'::text, 'in-app'::text])),
elderly_user_id uuid,
device_token text,
platform text CHECK (platform = ANY (ARRAY['android'::text, 'ios'::text])),
device_paired_at timestamp with time zone,
last_call_answered_at timestamp with time zone,
app_version text,
CONSTRAINT relatives_pkey PRIMARY KEY (id),
CONSTRAINT relatives_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id),
CONSTRAINT relatives_elderly_user_id_fkey FOREIGN KEY (elderly_user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.scheduled_notifications (
id uuid NOT NULL DEFAULT gen_random_uuid(),
household_id uuid NOT NULL,
relative_id uuid NOT NULL,
schedule_id uuid NOT NULL,
slot_type text NOT NULL CHECK (slot_type = ANY (ARRAY['morning'::text, 'afternoon'::text, 'evening'::text])),
scheduled_for timestamp with time zone NOT NULL,
status text NOT NULL DEFAULT 'queued'::text CHECK (status = ANY (ARRAY['queued'::text, 'sent'::text, 'failed'::text, 'expired'::text])),
device_token text,
platform text,
retry_count integer DEFAULT 0,
last_error text,
created_at timestamp with time zone NOT NULL DEFAULT now(),
executed_at timestamp with time zone,
updated_at timestamp with time zone NOT NULL DEFAULT now(),
CONSTRAINT scheduled_notifications_pkey PRIMARY KEY (id)
);
CREATE TABLE public.schedules (
id uuid NOT NULL DEFAULT gen_random_uuid(),
household_id uuid NOT NULL,
relative_id uuid NOT NULL,
timezone text NOT NULL,
morning_time time without time zone NOT NULL DEFAULT '09:00:00'::time without time zone,
afternoon_time time without time zone NOT NULL DEFAULT '13:00:00'::time without time zone,
evening_time time without time zone NOT NULL DEFAULT '18:00:00'::time without time zone,
active boolean NOT NULL DEFAULT true,
created_at timestamp with time zone NOT NULL DEFAULT now(),
updated_at timestamp with time zone NOT NULL DEFAULT now(),
call_type text NOT NULL DEFAULT 'batch_call'::text CHECK (call_type = ANY (ARRAY['batch_call'::text, 'in_app_call'::text])),
CONSTRAINT schedules_pkey PRIMARY KEY (id),
CONSTRAINT schedules_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id),
CONSTRAINT schedules_relative_id_fkey FOREIGN KEY (relative_id) REFERENCES public.relatives(id)
);
CREATE TABLE public.security_events (
id uuid NOT NULL DEFAULT gen_random_uuid(),
user_id uuid,
event_type text NOT NULL,
ip_address text,
user_agent text,
details jsonb,
created_at timestamp with time zone DEFAULT now(),
CONSTRAINT security_events_pkey PRIMARY KEY (id)
);
CREATE TABLE public.site_content (
id uuid NOT NULL DEFAULT gen_random_uuid(),
key text NOT NULL UNIQUE,
value text,
created_at timestamp with time zone NOT NULL DEFAULT now(),
updated_at timestamp with time zone NOT NULL DEFAULT now(),
CONSTRAINT site_content_pkey PRIMARY KEY (id)
);
CREATE TABLE public.subscribers (
id uuid NOT NULL DEFAULT gen_random_uuid(),
user_id uuid UNIQUE,
email text NOT NULL UNIQUE,
stripe_customer_id text,
subscribed boolean NOT NULL DEFAULT false,
subscription_tier text,
subscription_end timestamp with time zone,
trial_end timestamp with time zone,
updated_at timestamp with time zone NOT NULL DEFAULT now(),
created_at timestamp with time zone NOT NULL DEFAULT now(),
CONSTRAINT subscribers_pkey PRIMARY KEY (id),
CONSTRAINT subscribers_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.subscriptions (
id uuid NOT NULL DEFAULT gen_random_uuid(),
user_id uuid NOT NULL,
household_id uuid,
provider text NOT NULL DEFAULT 'paypal'::text,
provider_subscription_id text UNIQUE,
plan_id text,
status text,
trial_end timestamp with time zone,
current_period_end timestamp with time zone,
created_at timestamp with time zone NOT NULL DEFAULT now(),
updated_at timestamp with time zone NOT NULL DEFAULT now(),
CONSTRAINT subscriptions_pkey PRIMARY KEY (id),
CONSTRAINT subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
CONSTRAINT subscriptions_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id)
);
CREATE TABLE public.support_messages (
id uuid NOT NULL DEFAULT gen_random_uuid(),
ticket_id uuid NOT NULL,
sender_id uuid,
sender_type text NOT NULL DEFAULT 'USER'::text,
message text NOT NULL,
is_internal boolean NOT NULL DEFAULT false,
created_at timestamp with time zone NOT NULL DEFAULT now(),
CONSTRAINT support_messages_pkey PRIMARY KEY (id),
CONSTRAINT support_messages_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.support_tickets(id),
CONSTRAINT support_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES auth.users(id)
);
CREATE TABLE public.support_oncall (
id uuid NOT NULL DEFAULT gen_random_uuid(),
user_id uuid NOT NULL,
start_time timestamp with time zone NOT NULL,
end_time timestamp with time zone NOT NULL,
is_primary boolean NOT NULL DEFAULT true,
contact_method text NOT NULL DEFAULT 'email'::text,
contact_details text NOT NULL,
created_at timestamp with time zone NOT NULL DEFAULT now(),
CONSTRAINT support_oncall_pkey PRIMARY KEY (id),
CONSTRAINT support_oncall_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.support_tickets (
id uuid NOT NULL DEFAULT gen_random_uuid(),
ticket_number text NOT NULL UNIQUE,
user_id uuid,
household_id uuid,
subject text NOT NULL,
description text NOT NULL,
priority USER-DEFINED NOT NULL DEFAULT 'P3'::support_priority,
status USER-DEFINED NOT NULL DEFAULT 'OPEN'::support_status,
channel USER-DEFINED NOT NULL DEFAULT 'APP'::support_channel,
contact_email text,
contact_phone text,
assigned_to uuid,
resolved_at timestamp with time zone,
created_at timestamp with time zone NOT NULL DEFAULT now(),
updated_at timestamp with time zone NOT NULL DEFAULT now(),
CONSTRAINT support_tickets_pkey PRIMARY KEY (id),
CONSTRAINT support_tickets_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
CONSTRAINT support_tickets_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id),
CONSTRAINT support_tickets_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES auth.users(id)
);
CREATE TABLE public.trial_activations (
id uuid NOT NULL DEFAULT gen_random_uuid(),
user_id uuid NOT NULL,
trial_code_id uuid NOT NULL,
activated_at timestamp with time zone DEFAULT now(),
expires_at timestamp with time zone NOT NULL,
is_active boolean DEFAULT true,
CONSTRAINT trial_activations_pkey PRIMARY KEY (id),
CONSTRAINT trial_activations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
CONSTRAINT trial_activations_trial_code_id_fkey FOREIGN KEY (trial_code_id) REFERENCES public.trial_codes(id)
);
CREATE TABLE public.trial_codes (
id uuid NOT NULL DEFAULT gen_random_uuid(),
code text NOT NULL UNIQUE,
description text,
max_uses integer DEFAULT 1,
current_uses integer DEFAULT 0,
trial_duration_days integer DEFAULT 7,
is_active boolean DEFAULT true,
created_by uuid,
created_at timestamp with time zone DEFAULT now(),
expires_at timestamp with time zone,
updated_at timestamp with time zone DEFAULT now(),
CONSTRAINT trial_codes_pkey PRIMARY KEY (id),
CONSTRAINT trial_codes_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);
CREATE TABLE public.waitlist (
id uuid NOT NULL DEFAULT gen_random_uuid(),
email text NOT NULL UNIQUE CHECK (POSITION(('@'::text) IN (email)) > 1),
consent boolean NOT NULL DEFAULT false,
consent_text text,
ip_hash text,
user_agent text,
utm_source text,
utm_medium text,
utm_campaign text,
confirm_token text,
confirmed_at timestamp with time zone,
unsubscribed_at timestamp with time zone,
created_at timestamp with time zone NOT NULL DEFAULT now(),
CONSTRAINT waitlist_pkey PRIMARY KEY (id)
);
CREATE TABLE public.webhook_events (
id uuid NOT NULL DEFAULT gen_random_uuid(),
household_id uuid,
provider text NOT NULL,
provider_call_id text,
payload jsonb NOT NULL,
signature text,
received_at timestamp with time zone NOT NULL DEFAULT now(),
CONSTRAINT webhook_events_pkey PRIMARY KEY (id),
CONSTRAINT webhook_events_household_fk FOREIGN KEY (household_id) REFERENCES public.households(id)
);
CREATE TABLE public.wellbeing_logs (
id uuid NOT NULL DEFAULT gen_random_uuid(),
relative_id uuid NOT NULL,
mood_rating integer CHECK (mood_rating >= 1 AND mood_rating <= 10),
energy_level integer CHECK (energy_level >= 1 AND energy_level <= 10),
pain_level integer CHECK (pain_level >= 0 AND pain_level <= 10),
sleep_quality integer CHECK (sleep_quality >= 1 AND sleep_quality <= 5),
notes text,
logged_at timestamp with time zone DEFAULT now(),
created_at timestamp with time zone DEFAULT now(),
CONSTRAINT wellbeing_logs_pkey PRIMARY KEY (id)
);