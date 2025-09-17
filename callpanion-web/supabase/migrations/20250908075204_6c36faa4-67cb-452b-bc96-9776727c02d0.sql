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

-- Add household_id column to alerts table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'alerts' 
    AND column_name = 'household_id'
  ) THEN
    ALTER TABLE public.alerts ADD COLUMN household_id UUID REFERENCES public.households(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add title column to alerts table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'alerts' 
    AND column_name = 'title'
  ) THEN
    ALTER TABLE public.alerts ADD COLUMN title TEXT;
  END IF;
END $$;

-- Add message column to alerts table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'alerts' 
    AND column_name = 'message'
  ) THEN
    ALTER TABLE public.alerts ADD COLUMN message TEXT;
  END IF;
END $$;

-- Add data column to alerts table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'alerts' 
    AND column_name = 'data'
  ) THEN
    ALTER TABLE public.alerts ADD COLUMN data JSONB DEFAULT '{}';
  END IF;
END $$;

-- Add acknowledged columns if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'alerts' 
    AND column_name = 'acknowledged'
  ) THEN
    ALTER TABLE public.alerts ADD COLUMN acknowledged BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'alerts' 
    AND column_name = 'acknowledged_by'
  ) THEN
    ALTER TABLE public.alerts ADD COLUMN acknowledged_by UUID;
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'alerts' 
    AND column_name = 'acknowledged_at'
  ) THEN
    ALTER TABLE public.alerts ADD COLUMN acknowledged_at TIMESTAMP WITH TIME ZONE;
  END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_alerts_household_id ON public.alerts(household_id);
CREATE INDEX IF NOT EXISTS idx_alerts_type ON public.alerts(type);
CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON public.alerts(created_at);