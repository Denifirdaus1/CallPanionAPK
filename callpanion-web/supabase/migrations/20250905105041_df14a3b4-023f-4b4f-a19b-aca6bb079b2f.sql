-- Delete excessive cron jobs (keeping only one every 5 minutes)
SELECT cron.unschedule('scheduler-daily-calls-every-minute');
SELECT cron.unschedule('callpanion-scheduler');