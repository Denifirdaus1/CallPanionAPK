-- Fix phone number that was changed to dummy in previous migration
UPDATE relatives 
SET phone_number = '+62-812-1872-9431' 
WHERE id = '39c8c65d-1d95-459b-82d1-963f9b5d9108';

-- Verify remaining cron jobs
SELECT jobname, schedule FROM cron.job WHERE command LIKE '%schedulerDailyCalls%';