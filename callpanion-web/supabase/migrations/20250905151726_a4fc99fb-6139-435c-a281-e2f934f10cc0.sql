-- Update existing call log with correct status and enhanced summary data
UPDATE call_logs SET 
  call_outcome = 'failed'
WHERE provider_call_id = 'conv_9101k4d5zcese4sbr968gmgvrk16';

-- Update call summary with detailed ElevenLabs data
UPDATE call_summaries SET
  tl_dr = 'CallPanion initiated a check-in call, inquiring about the user''s well-being and daily activities. The user reported feeling "good" and having had breakfast and fresh air. The agent then engaged the user in a light quiz, which the user initially enjoyed. After a few questions, the user expressed a desire to stop the quiz and ultimately requested to end the call.',
  key_points = jsonb_build_object(
    'detailed_summary', 'CallPanion initiated a check-in call, inquiring about the user''s well-being and daily activities. The user reported feeling "good" and having had breakfast and fresh air. The agent then engaged the user in a light quiz, which the user initially enjoyed. After a few questions, the user expressed a desire to stop the quiz and ultimately requested to end the call.',
    'notes', 'User reported feeling good, participated in a quiz, then requested to end the call.',
    'highlight', 'The user enjoyed a light quiz, answering questions correctly before ending the call.',
    'criteria_evaluation', jsonb_build_object(
      'positive_tone', 'success',
      'closed_warmly', 'success', 
      'avoided_medical_advice', 'success',
      'asked_mood', 'failure'
    ),
    'data_collection', jsonb_build_object(
      'emergency_flag', false,
      'call_duration_secs', 159,
      'activity', null,
      'flag_confused', true,
      'mood_score', null,
      'meal_intake', 'main_meal',
      'flag_fall_risk', false,
      'flag_lonely', false,
      'flag_low_appetite', null
    )
  )
WHERE provider_call_id = 'conv_9101k4d5zcese4sbr968gmgvrk16';