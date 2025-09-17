-- Check if we need to add any additional call-related fields
-- Add call session tracking and AI conversation state

ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS 
  session_id text,
  ai_conversation_state jsonb DEFAULT '{}',
  conversation_summary text,
  mood_assessment text,
  health_concerns_detected boolean DEFAULT false,
  emergency_flag boolean DEFAULT false;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_call_logs_session_id ON call_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_emergency_flag ON call_logs(emergency_flag) WHERE emergency_flag = true;
CREATE INDEX IF NOT EXISTS idx_call_logs_health_concerns ON call_logs(health_concerns_detected) WHERE health_concerns_detected = true;