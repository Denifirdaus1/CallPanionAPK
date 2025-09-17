-- Set up required app settings for cron job to work
INSERT INTO app_settings (setting_key, setting_value) VALUES
('project_url', '"https://umjtepmdwfyfhdzbkyli.supabase.co"'),
('functions_bearer', '"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtanRlcG1kd2Z5ZmhkemJreWxpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MDUyNTksImV4cCI6MjA3MDQ4MTI1OX0.BhMkFrAOfeGw2ImHDXSTVmgM6P--L3lq9pNKDX3XzWE"'),
('cron_secret', '"cron-secret-key-2025"')
ON CONFLICT (setting_key) DO UPDATE SET 
  setting_value = EXCLUDED.setting_value,
  updated_at = now();

-- Update PostgreSQL settings to use these values
SELECT set_config('app.settings.project_url', setting_value::text, false) FROM app_settings WHERE setting_key = 'project_url';
SELECT set_config('app.settings.functions_bearer', setting_value::text, false) FROM app_settings WHERE setting_key = 'functions_bearer';  
SELECT set_config('app.settings.cron_secret', setting_value::text, false) FROM app_settings WHERE setting_key = 'cron_secret';