-- Process the missed webhook data for call conv_9101k4d5zcese4sbr968gmgvrk16
INSERT INTO call_logs (
  provider, 
  provider_call_id, 
  user_id, 
  household_id, 
  relative_id, 
  call_outcome, 
  call_duration, 
  emergency_flag, 
  health_concerns_detected, 
  timestamp
) VALUES (
  'elevenlabs',
  'conv_9101k4d5zcese4sbr968gmgvrk16',
  'b1d2b491-a0f9-4ff5-b16a-ba91e8eaea68',
  'ff9180fc-39dd-4c77-a9ab-8a4bcf246ccf',
  'b1d2b491-a0f9-4ff5-b16a-ba91e8eaea68',
  'answered',
  159,
  false,
  false,
  '2025-09-05T14:58:04Z'
)
ON CONFLICT (provider, provider_call_id) DO UPDATE SET
  call_outcome = EXCLUDED.call_outcome,
  call_duration = EXCLUDED.call_duration,
  timestamp = EXCLUDED.timestamp;

-- Also add call summary
INSERT INTO call_summaries (
  provider,
  provider_call_id,
  household_id,
  relative_id,
  mood,
  mood_score,
  key_points,
  tl_dr
) VALUES (
  'elevenlabs',
  'conv_9101k4d5zcese4sbr968gmgvrk16',
  'ff9180fc-39dd-4c77-a9ab-8a4bcf246ccf',
  'b1d2b491-a0f9-4ff5-b16a-ba91e8eaea68',
  'neutral',
  null,
  '{"data_collection": {}, "evaluation": {}}',
  'Call completed successfully'
)
ON CONFLICT (provider_call_id) DO UPDATE SET
  mood = EXCLUDED.mood,
  tl_dr = EXCLUDED.tl_dr;