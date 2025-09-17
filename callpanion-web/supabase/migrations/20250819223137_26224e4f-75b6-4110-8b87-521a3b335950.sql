-- Create wellbeing_logs table
CREATE TABLE public.wellbeing_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  relative_id UUID NOT NULL,
  mood_rating INTEGER CHECK (mood_rating >= 1 AND mood_rating <= 10),
  energy_level INTEGER CHECK (energy_level >= 1 AND energy_level <= 10),
  pain_level INTEGER CHECK (pain_level >= 0 AND pain_level <= 10),
  sleep_quality INTEGER CHECK (sleep_quality >= 1 AND sleep_quality <= 5),
  notes TEXT,
  logged_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on wellbeing_logs
ALTER TABLE public.wellbeing_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for wellbeing_logs
CREATE POLICY "Users can view wellbeing logs for their household relatives"
ON public.wellbeing_logs FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.relatives r
    JOIN public.household_members hm ON hm.household_id = r.household_id
    WHERE r.id = wellbeing_logs.relative_id
    AND hm.user_id = auth.uid()
  )
);

CREATE POLICY "Service role can insert wellbeing logs"
ON public.wellbeing_logs FOR INSERT
WITH CHECK (is_service_role());

-- Create family_notifications table
CREATE TABLE public.family_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL,
  relative_id UUID,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  priority TEXT CHECK (priority IN ('low', 'medium', 'high', 'emergency')) DEFAULT 'medium',
  notification_type TEXT CHECK (notification_type IN ('wellbeing_alert', 'emergency_escalation', 'missed_call', 'general')) DEFAULT 'general',
  sent_to_user_ids UUID[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  read_by JSONB DEFAULT '{}',
  resolved_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS on family_notifications
ALTER TABLE public.family_notifications ENABLE ROW LEVEL SECURITY;

-- Create policies for family_notifications
CREATE POLICY "Users can view notifications for their household"
ON public.family_notifications FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.household_members hm
    WHERE hm.household_id = family_notifications.household_id
    AND hm.user_id = auth.uid()
  )
);

CREATE POLICY "Service role can insert family notifications"
ON public.family_notifications FOR INSERT
WITH CHECK (is_service_role());

CREATE POLICY "Users can update notifications they can see"
ON public.family_notifications FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.household_members hm
    WHERE hm.household_id = family_notifications.household_id
    AND hm.user_id = auth.uid()
  )
);

-- Create ai_call_sessions table
CREATE TABLE public.ai_call_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  relative_id UUID NOT NULL,
  session_status TEXT CHECK (session_status IN ('active', 'completed', 'interrupted')) DEFAULT 'active',
  started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  ended_at TIMESTAMP WITH TIME ZONE,
  duration_seconds INTEGER,
  conversation_summary TEXT,
  wellbeing_extracted JSONB,
  emergency_detected BOOLEAN DEFAULT false,
  follow_up_scheduled BOOLEAN DEFAULT false,
  next_call_scheduled_for TIMESTAMP WITH TIME ZONE
);

-- Enable RLS on ai_call_sessions
ALTER TABLE public.ai_call_sessions ENABLE ROW LEVEL SECURITY;

-- Create policies for ai_call_sessions
CREATE POLICY "Users can view call sessions for their household relatives"
ON public.ai_call_sessions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.relatives r
    JOIN public.household_members hm ON hm.household_id = r.household_id
    WHERE r.id = ai_call_sessions.relative_id
    AND hm.user_id = auth.uid()
  )
);

CREATE POLICY "Service role can manage call sessions"
ON public.ai_call_sessions FOR ALL
USING (is_service_role());

-- Create indexes for performance
CREATE INDEX idx_wellbeing_logs_relative_logged_at ON public.wellbeing_logs(relative_id, logged_at DESC);
CREATE INDEX idx_family_notifications_household_created ON public.family_notifications(household_id, created_at DESC);
CREATE INDEX idx_ai_call_sessions_relative_started ON public.ai_call_sessions(relative_id, started_at DESC);