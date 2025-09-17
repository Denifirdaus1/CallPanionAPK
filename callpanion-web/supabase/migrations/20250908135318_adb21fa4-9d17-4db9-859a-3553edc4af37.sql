-- Create pairing_tokens table for in-app call device pairing
CREATE TABLE IF NOT EXISTS public.pairing_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  session_id UUID REFERENCES public.call_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on pairing_tokens
ALTER TABLE public.pairing_tokens ENABLE ROW LEVEL SECURITY;

-- Create policies for pairing_tokens
CREATE POLICY "Users can view their own pairing tokens" 
ON public.pairing_tokens 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own pairing tokens" 
ON public.pairing_tokens 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own pairing tokens" 
ON public.pairing_tokens 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Create index for performance
CREATE INDEX idx_pairing_tokens_session_id ON public.pairing_tokens(session_id);
CREATE INDEX idx_pairing_tokens_user_id ON public.pairing_tokens(user_id);
CREATE INDEX idx_pairing_tokens_expires_at ON public.pairing_tokens(expires_at);

-- Add push notification tokens table for FCM and VoIP
CREATE TABLE IF NOT EXISTS public.push_notification_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  token TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('android', 'ios')),
  device_id TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, token, platform)
);

-- Enable RLS on push_notification_tokens
ALTER TABLE public.push_notification_tokens ENABLE ROW LEVEL SECURITY;

-- Create policies for push_notification_tokens
CREATE POLICY "Users can manage their own push tokens" 
ON public.push_notification_tokens 
FOR ALL 
USING (auth.uid() = user_id);

-- Create index for performance
CREATE INDEX idx_push_tokens_user_id ON public.push_notification_tokens(user_id);
CREATE INDEX idx_push_tokens_active ON public.push_notification_tokens(is_active);

-- Add notification history table
CREATE TABLE IF NOT EXISTS public.notification_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'pending')),
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on notification_history
ALTER TABLE public.notification_history ENABLE ROW LEVEL SECURITY;

-- Create policies for notification_history
CREATE POLICY "Users can view their own notification history" 
ON public.notification_history 
FOR SELECT 
USING (auth.uid() = user_id);

-- Create index for performance
CREATE INDEX idx_notification_history_user_id ON public.notification_history(user_id);
CREATE INDEX idx_notification_history_sent_at ON public.notification_history(sent_at);

-- Enable realtime for call logs and call sessions
ALTER TABLE public.call_logs REPLICA IDENTITY FULL;
ALTER TABLE public.call_sessions REPLICA IDENTITY FULL;

-- Add tables to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.call_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.call_sessions;