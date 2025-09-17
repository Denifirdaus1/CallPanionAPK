-- Create call_logs table first
CREATE TABLE public.call_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  call_outcome TEXT NOT NULL CHECK (call_outcome IN ('answered', 'missed', 'failed', 'busy')),
  call_duration INTEGER, -- seconds
  daily_api_room_id TEXT,
  audio_recording_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create call_analysis table for storing conversation analysis
CREATE TABLE public.call_analysis (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  call_log_id UUID REFERENCES public.call_logs(id),
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  mood_score INTEGER CHECK (mood_score >= 1 AND mood_score <= 5),
  health_flag BOOLEAN NOT NULL DEFAULT false,
  urgent_flag BOOLEAN NOT NULL DEFAULT false,
  transcript TEXT,
  summary TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add user preferences for call times
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preferred_call_times TEXT[] DEFAULT ARRAY['09:00', '13:00', '18:00'];

-- Enable RLS
ALTER TABLE public.call_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for call_logs
CREATE POLICY "Users can view their own call logs" ON public.call_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Family can view call logs for household members" ON public.call_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.household_members hm1
      JOIN public.household_members hm2 ON hm1.household_id = hm2.household_id
      WHERE hm1.user_id = auth.uid() AND hm2.user_id = call_logs.user_id
    )
  );

CREATE POLICY "Service can manage call logs" ON public.call_logs
  FOR ALL USING (true);

-- RLS policies for call_analysis  
CREATE POLICY "Users can view their own call analysis" ON public.call_analysis
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Family can view call analysis for household members" ON public.call_analysis
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.household_members hm1
      JOIN public.household_members hm2 ON hm1.household_id = hm2.household_id
      WHERE hm1.user_id = auth.uid() AND hm2.user_id = call_analysis.user_id
    )
  );

CREATE POLICY "Service can manage call analysis" ON public.call_analysis
  FOR ALL USING (true);

-- Create function to check for missed calls
CREATE OR REPLACE FUNCTION public.check_missed_calls()
RETURNS TRIGGER AS $$
BEGIN
  -- If the call was missed, check for consecutive missed calls
  IF NEW.call_outcome = 'missed' THEN
    PERFORM pg_notify('missed_call_alert', 
      json_build_object(
        'user_id', NEW.user_id,
        'timestamp', NEW.timestamp
      )::text
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for missed call checking
CREATE TRIGGER check_missed_calls_trigger
  AFTER INSERT ON public.call_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.check_missed_calls();

-- Add updated_at triggers
CREATE TRIGGER update_call_analysis_updated_at
  BEFORE UPDATE ON public.call_analysis
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_call_logs_updated_at
  BEFORE UPDATE ON public.call_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();