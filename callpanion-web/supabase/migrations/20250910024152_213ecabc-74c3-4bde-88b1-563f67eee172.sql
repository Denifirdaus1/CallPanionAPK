-- Add call_uuid column to call_sessions for CallKit tracking
ALTER TABLE public.call_sessions 
ADD COLUMN IF NOT EXISTS call_uuid TEXT;

-- Add voip_token column to push_notification_tokens for iOS VoIP
ALTER TABLE public.push_notification_tokens 
ADD COLUMN IF NOT EXISTS voip_token TEXT;

-- Add index on call_uuid for faster lookups
CREATE INDEX IF NOT EXISTS idx_call_sessions_call_uuid 
ON public.call_sessions(call_uuid);

-- Add index on voip_token for iOS VoIP token lookups
CREATE INDEX IF NOT EXISTS idx_push_tokens_voip_token 
ON public.push_notification_tokens(voip_token) 
WHERE voip_token IS NOT NULL;