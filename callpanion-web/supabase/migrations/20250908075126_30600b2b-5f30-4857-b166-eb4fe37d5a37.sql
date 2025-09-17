-- Setup cron jobs for in-app call management

-- Create cron job for session cleanup (every 30 minutes)
SELECT cron.schedule(
  'callpanion-cleanup-sessions',
  '*/30 * * * *',
  $$
    SELECT net.http_post(
      url := 'https://umjtepmdwfyfhdzbkyli.supabase.co/functions/v1/cleanup-sessions',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtanRlcG1kd2Z5ZmhkemJreWxpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MDUyNTksImV4cCI6MjA3MDQ4MTI1OX0.BhMkFrAOfeGw2ImHDXSTVmgM6P--L3lq9pNKDX3XzWE'
      ),
      body := jsonb_build_object('source', 'pg_cron')
    );
  $$
);

-- Create cron job for call session monitoring (every 10 minutes)
SELECT cron.schedule(
  'callpanion-monitor-sessions',
  '*/10 * * * *',
  $$
    SELECT net.http_post(
      url := 'https://umjtepmdwfyfhdzbkyli.supabase.co/functions/v1/monitor-call-sessions',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtanRlcG1kd2Z5ZmhkemJreWxpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MDUyNTksImV4cCI6MjA3MDQ4MTI1OX0.BhMkFrAOfeGw2ImHDXSTVmgM6P--L3lq9pNKDX3XzWE'
      ),
      body := jsonb_build_object('source', 'pg_cron')
    );
  $$
);

-- Add missing alerts table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_by UUID,
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on alerts table
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for alerts
CREATE POLICY "Household members can view alerts" ON public.alerts
FOR SELECT USING (
  household_id IN (
    SELECT household_id FROM public.household_members 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Household admins can manage alerts" ON public.alerts
FOR ALL USING (
  household_id IN (
    SELECT household_id FROM public.household_members 
    WHERE user_id = auth.uid() AND role = 'FAMILY_PRIMARY'
  )
);

CREATE POLICY "Service role can manage alerts" ON public.alerts
FOR ALL USING (is_service_role());

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_alerts_household_id ON public.alerts(household_id);
CREATE INDEX IF NOT EXISTS idx_alerts_type ON public.alerts(type);
CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON public.alerts(created_at);

-- Add trigger for updated_at
CREATE TRIGGER update_alerts_updated_at
  BEFORE UPDATE ON public.alerts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();