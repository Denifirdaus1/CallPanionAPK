-- Clear all user data to start fresh
-- First, delete from public schema tables that reference users
DELETE FROM public.household_members;
DELETE FROM public.households;
DELETE FROM public.relatives;
DELETE FROM public.schedules;
DELETE FROM public.call_logs;
DELETE FROM public.call_summaries;
DELETE FROM public.invites;
DELETE FROM public.profiles;
DELETE FROM public.customers;
DELETE FROM public.subscriptions;
DELETE FROM public.trial_activations;
DELETE FROM public.audit_log;
DELETE FROM public.webhook_events;
DELETE FROM public.quotas;
DELETE FROM public.alerts;
DELETE FROM public.consents;
DELETE FROM public.devices;
DELETE FROM public.case_notes;
DELETE FROM public.support_tickets;
DELETE FROM public.ai_call_sessions;
DELETE FROM public.ai_companion_profiles;
DELETE FROM public.companion_sessions;
DELETE FROM public.companion_alerts;
DELETE FROM public.companion_family_links;
DELETE FROM public.endpoint_access_logs;
DELETE FROM public.rate_limits;
DELETE FROM public.cron_heartbeat;

-- Clear all users from auth schema (this will cascade delete related auth data)
DELETE FROM auth.users;

-- Reset any sequences if needed
-- This ensures clean IDs when we start adding data again
SELECT setval(pg_get_serial_sequence('public.households', 'id'), 1, false);
SELECT setval(pg_get_serial_sequence('public.profiles', 'id'), 1, false);