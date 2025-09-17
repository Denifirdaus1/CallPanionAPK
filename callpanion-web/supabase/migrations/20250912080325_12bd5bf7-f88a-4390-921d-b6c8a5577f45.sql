-- Fix the daily_call_tracking table unique constraint for upsert
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_call_tracking_unique 
ON daily_call_tracking (relative_id, household_id, call_date);

-- Fix call_logs call_outcome constraint - add 'initiated' to allowed values
ALTER TABLE call_logs DROP CONSTRAINT IF EXISTS call_logs_call_outcome_check;
ALTER TABLE call_logs ADD CONSTRAINT call_logs_call_outcome_check 
CHECK (call_outcome IN ('initiated', 'completed', 'missed', 'declined', 'failed', 'busy', 'no_answer'));