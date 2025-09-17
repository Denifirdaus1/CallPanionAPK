-- Clear all user data in correct order to avoid foreign key violations
-- Start with tables that don't have dependencies

-- Clear companion and AI related tables first
DELETE FROM public.companion_transcripts;
DELETE FROM public.companion_wellbeing_signals;
DELETE FROM public.companion_mood_checkins;
DELETE FROM public.companion_interests;
DELETE FROM public.companion_game_sessions;
DELETE FROM public.companion_agent_memory;
DELETE FROM public.companion_alerts;
DELETE FROM public.companion_family_links;
DELETE FROM public.companion_sessions;
DELETE FROM public.ai_call_sessions;
DELETE FROM public.ai_companion_profiles;

-- Clear call related tables
DELETE FROM public.call_summaries;
DELETE FROM public.call_logs;
DELETE FROM public.call_analysis;
DELETE FROM public.call_audit;
DELETE FROM public.call_permissions;

-- Clear family and household related tables
DELETE FROM public.schedules;
DELETE FROM public.webhook_events;
DELETE FROM public.quotas;
DELETE FROM public.checkin_alerts;
DELETE FROM public.check_ins;
DELETE FROM public.devices;
DELETE FROM public.consents;
DELETE FROM public.case_notes;
DELETE FROM public.alerts;
DELETE FROM public.elder_access;
DELETE FROM public.elders;
DELETE FROM public.family_invites;
DELETE FROM public.family_members;
DELETE FROM public.family_links;
DELETE FROM public.families;
DELETE FROM public.events;
DELETE FROM public.invites;
DELETE FROM public.household_members;
DELETE FROM public.relatives;
DELETE FROM public.households;

-- Clear user related tables
DELETE FROM public.customers;
DELETE FROM public.subscriptions;
DELETE FROM public.trial_activations;
DELETE FROM public.profiles;

-- Clear audit and logging tables
DELETE FROM public.audit_log;
DELETE FROM public.endpoint_access_logs;
DELETE FROM public.rate_limits;
DELETE FROM public.cron_heartbeat;
DELETE FROM public.support_tickets;

-- Finally delete auth users
DELETE FROM auth.users;