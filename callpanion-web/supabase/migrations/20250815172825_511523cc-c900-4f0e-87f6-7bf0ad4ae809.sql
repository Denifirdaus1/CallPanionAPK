-- Add call session tracking and AI conversation fields
-- Fix the syntax by using separate ALTER TABLE statements

ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS session_id text;
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS ai_conversation_state jsonb DEFAULT '{}';
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS conversation_summary text;
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS mood_assessment text;
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS health_concerns_detected boolean DEFAULT false;
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS emergency_flag boolean DEFAULT false;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_call_logs_session_id ON call_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_emergency_flag ON call_logs(emergency_flag) WHERE emergency_flag = true;
CREATE INDEX IF NOT EXISTS idx_call_logs_health_concerns ON call_logs(health_concerns_detected) WHERE health_concerns_detected = true;