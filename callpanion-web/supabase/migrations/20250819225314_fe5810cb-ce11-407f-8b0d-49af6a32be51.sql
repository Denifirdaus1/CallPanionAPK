-- Insert a test trial code for demonstration
INSERT INTO public.trial_codes (
  code,
  description,
  max_uses,
  current_uses,
  trial_duration_days,
  is_active,
  expires_at
) VALUES (
  'TEST2025',
  'Test trial code for demonstration',
  100,
  0,
  7,
  true,
  now() + interval '30 days'
);