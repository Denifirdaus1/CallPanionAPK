
-- Seed a guaranteed working trial code for testing
-- Only inserts if the code does not already exist
INSERT INTO public.trial_codes (
  code,
  description,
  is_active,
  trial_duration_days,
  max_uses,
  current_uses,
  expires_at,
  created_at,
  updated_at
)
SELECT
  'WELCOME-30D',
  '30-day premium trial (test code)',
  true,
  30,
  100,
  0,
  now() + interval '90 days',
  now(),
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM public.trial_codes WHERE code = 'WELCOME-30D'
);
