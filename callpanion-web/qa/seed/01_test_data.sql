-- CallPanion Test Data Seed Script
-- Run this script to create comprehensive test data for QA validation

-- First, ensure we're working with clean test data
-- WARNING: This will delete existing test data
DELETE FROM family_photos WHERE household_id IN (
    SELECT id FROM households WHERE name LIKE 'QA Test%'
);
DELETE FROM family_messages WHERE household_id IN (
    SELECT id FROM households WHERE name LIKE 'QA Test%'
);
DELETE FROM call_analysis WHERE user_id IN (
    SELECT r.id FROM relatives r 
    JOIN households h ON r.household_id = h.id 
    WHERE h.name LIKE 'QA Test%'
);
DELETE FROM call_logs WHERE user_id IN (
    SELECT r.id FROM relatives r 
    JOIN households h ON r.household_id = h.id 
    WHERE h.name LIKE 'QA Test%'
);
DELETE FROM invites WHERE household_id IN (
    SELECT id FROM households WHERE name LIKE 'QA Test%'
);
DELETE FROM household_members WHERE household_id IN (
    SELECT id FROM households WHERE name LIKE 'QA Test%'
);
DELETE FROM relatives WHERE household_id IN (
    SELECT id FROM households WHERE name LIKE 'QA Test%'
);
DELETE FROM households WHERE name LIKE 'QA Test%';

-- Create test households
INSERT INTO households (id, name, created_by, timezone, city, country, gdpr_consent_status, gdpr_consent_timestamp, created_at, updated_at) VALUES
('11111111-1111-1111-1111-111111111111', 'QA Test Primary Household', '22222222-2222-2222-2222-222222222222', 'Europe/London', 'Manchester', 'United Kingdom', true, now(), now(), now()),
('33333333-3333-3333-3333-333333333333', 'QA Test Secondary Household', '44444444-4444-4444-4444-444444444444', 'Europe/London', 'Birmingham', 'United Kingdom', true, now(), now(), now());

-- Create household members (roles and permissions)
INSERT INTO household_members (id, household_id, user_id, role, health_access_level, added_by, created_at) VALUES
-- Primary household members
('55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'FAMILY_PRIMARY', 'FULL_ACCESS', '22222222-2222-2222-2222-222222222222', now()),
('66666666-6666-6666-6666-666666666666', '11111111-1111-1111-1111-111111111111', '77777777-7777-7777-7777-777777777777', 'FAMILY_MEMBER', 'SUMMARY_ONLY', '22222222-2222-2222-2222-222222222222', now()),
('88888888-8888-8888-8888-888888888888', '11111111-1111-1111-1111-111111111111', '99999999-9999-9999-9999-999999999999', 'FAMILY_MEMBER', 'NO_ACCESS', '22222222-2222-2222-2222-222222222222', now()),
-- Secondary household members  
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', '44444444-4444-4444-4444-444444444444', 'FAMILY_PRIMARY', 'FULL_ACCESS', '44444444-4444-4444-4444-444444444444', now());

-- Create relatives (elderly users)
INSERT INTO relatives (id, household_id, first_name, last_name, town, county, country, call_cadence, timezone, quiet_hours_start, quiet_hours_end, last_active_at, created_at) VALUES
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', 'Eleanor', 'Johnson', 'Manchester', 'Greater Manchester', 'United Kingdom', 'daily', 'Europe/London', '22:00', '07:00', now() - interval '2 hours', now()),
('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', 'George', 'Smith', 'Oldham', 'Greater Manchester', 'United Kingdom', 'daily', 'Europe/London', '21:30', '08:00', now() - interval '1 day', now()),
('dddddddd-dddd-dddd-dddd-dddddddddddd', '33333333-3333-3333-3333-333333333333', 'Margaret', 'Wilson', 'Birmingham', 'West Midlands', 'United Kingdom', 'daily', 'Europe/London', '22:00', '07:30', now() - interval '3 hours', now());

-- Create pending invites
INSERT INTO invites (id, household_id, email, role, token, invited_by, expires_at, gdpr_consent_status, gdpr_consent_timestamp) VALUES
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '11111111-1111-1111-1111-111111111111', 'pending.test@callpanion.com', 'viewer', 'test-invite-token-12345', '22222222-2222-2222-2222-222222222222', now() + interval '5 days', true, now()),
('ffffffff-ffff-ffff-ffff-ffffffffffff', '11111111-1111-1111-1111-111111111111', 'expired.test@callpanion.com', 'viewer', 'expired-invite-token-67890', '22222222-2222-2222-2222-222222222222', now() - interval '1 day', false, null);

-- Create family messages
INSERT INTO family_messages (id, household_id, sender_id, content, message_type, status, created_at, updated_at) VALUES
('10101010-1010-1010-1010-101010101010', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'Good morning Mum! Hope you''re having a lovely day. The weather is beautiful here in London.', 'text', 'sent', now() - interval '2 hours', now() - interval '2 hours'),
('20202020-2020-2020-2020-202020202020', '11111111-1111-1111-1111-111111111111', '77777777-7777-7777-7777-777777777777', 'Hi Gran! Just wanted to check in and see how you''re doing. Love you lots!', 'text', 'sent', now() - interval '1 day', now() - interval '1 day'),
('30303030-3030-3030-3030-303030303030', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'Remember you have a doctor''s appointment tomorrow at 2pm. Sarah will pick you up at 1:30pm.', 'text', 'sent', now() - interval '3 days', now() - interval '3 days'),
('40404040-4040-4040-4040-404040404040', '11111111-1111-1111-1111-111111111111', '99999999-9999-9999-9999-999999999999', 'The grandchildren are so excited to see you this weekend! They''ve been practicing their piano pieces.', 'text', 'sent', now() - interval '5 days', now() - interval '5 days'),
('50505050-5050-5050-5050-505050505050', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'Happy birthday Mum! We can''t wait to celebrate with you today. See you at 3pm!', 'text', 'sent', now() - interval '1 week', now() - interval '1 week'),
('60606060-6060-6060-6060-606060606060', '11111111-1111-1111-1111-111111111111', '77777777-7777-7777-7777-777777777777', 'Thank you for the lovely birthday card. It made my day! The flowers you sent are beautiful.', 'text', 'sent', now() - interval '10 days', now() - interval '10 days'),
('70707070-7070-7070-7070-707070707070', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'Just a quick reminder about taking your medication with breakfast. Love you!', 'text', 'sent', now() - interval '2 weeks', now() - interval '2 weeks'),
('80808080-8080-8080-8080-808080808080', '11111111-1111-1111-1111-111111111111', '99999999-9999-9999-9999-999999999999', 'The weather forecast shows rain tomorrow, so don''t forget your umbrella if you go out!', 'text', 'sent', now() - interval '3 weeks', now() - interval '3 weeks');

-- Create family photos
INSERT INTO family_photos (id, household_id, user_id, url, caption, alt, storage_path, likes, uploaded_at) VALUES
('a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'https://example.com/photos/family_dinner.jpg', 'Sunday family dinner at home', 'Family gathered around dining table for Sunday roast', 'photos/family_dinner.jpg', 5, now() - interval '1 day'),
('b2b2b2b2-b2b2-b2b2-b2b2-b2b2b2b2b2b2', '11111111-1111-1111-1111-111111111111', '77777777-7777-7777-7777-777777777777', 'https://example.com/photos/grandchildren_park.jpg', 'Kids playing in the park', 'Three children on swings at local playground', 'photos/grandchildren_park.jpg', 8, now() - interval '3 days'),
('c3c3c3c3-c3c3-c3c3-c3c3-c3c3c3c3c3c3', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'https://example.com/photos/birthday_cake.jpg', 'Mum''s 75th birthday celebration', 'Birthday cake with 75 candles surrounded by family', 'photos/birthday_cake.jpg', 12, now() - interval '1 week'),
('d4d4d4d4-d4d4-d4d4-d4d4-d4d4d4d4d4d4', '11111111-1111-1111-1111-111111111111', '99999999-9999-9999-9999-999999999999', 'https://example.com/photos/garden_flowers.jpg', 'Beautiful roses in Mum''s garden', 'Pink and red roses in full bloom in well-tended garden', 'photos/garden_flowers.jpg', 6, now() - interval '10 days'),
('e5e5e5e5-e5e5-e5e5-e5e5-e5e5e5e5e5e5', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'https://example.com/photos/christmas_tree.jpg', 'Christmas morning 2023', 'Family opening presents under decorated Christmas tree', 'photos/christmas_tree.jpg', 15, now() - interval '2 months'),
('f6f6f6f6-f6f6-f6f6-f6f6-f6f6f6f6f6f6', '11111111-1111-1111-1111-111111111111', '77777777-7777-7777-7777-777777777777', 'https://example.com/photos/seaside_trip.jpg', 'Day trip to Brighton', 'Family walking along Brighton pier on sunny day', 'photos/seaside_trip.jpg', 9, now() - interval '1 month'),
('a7a7a7a7-a7a7-a7a7-a7a7-a7a7a7a7a7a7', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'https://example.com/photos/cooking_together.jpg', 'Teaching Gran the new recipe', 'Grandmother and granddaughter baking in kitchen together', 'photos/cooking_together.jpg', 7, now() - interval '5 days'),
('b8b8b8b8-b8b8-b8b8-b8b8-b8b8b8b8b8b8', '11111111-1111-1111-1111-111111111111', '99999999-9999-9999-9999-999999999999', 'https://example.com/photos/pet_cat.jpg', 'Mum''s new kitten Whiskers', 'Orange tabby kitten sleeping on windowsill', 'photos/pet_cat.jpg', 11, now() - interval '2 weeks'),
('c9c9c9c9-c9c9-c9c9-c9c9-c9c9c9c9c9c9', '11111111-1111-1111-1111-111111111111', '77777777-7777-7777-7777-777777777777', 'https://example.com/photos/wedding_anniversary.jpg', 'Mum and Dad''s 50th anniversary', 'Elderly couple renewing vows in church ceremony', 'photos/wedding_anniversary.jpg', 20, now() - interval '3 months'),
('d0d0d0d0-d0d0-d0d0-d0d0-d0d0d0d0d0d0', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'https://example.com/photos/graduation_day.jpg', 'Tommy''s university graduation', 'Young man in graduation cap and gown with proud grandparents', 'photos/graduation_day.jpg', 14, now() - interval '6 months');

-- Create call logs
INSERT INTO call_logs (id, user_id, session_id, call_outcome, call_duration, timestamp, mood_assessment, conversation_summary, health_concerns_detected, emergency_flag, ai_conversation_state, created_at, updated_at) VALUES
('call1111-1111-1111-1111-call11111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'session_001', 'completed', 847, now() - interval '2 hours', 'positive', 'Eleanor was in good spirits today. She mentioned enjoying the family photos and looking forward to the weekend visit. No concerns raised.', false, false, '{"mood": "positive", "topics": ["family", "photos", "weekend"]}', now() - interval '2 hours', now() - interval '2 hours'),
('call2222-2222-2222-2222-call22222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'session_002', 'completed', 623, now() - interval '1 day', 'neutral', 'Regular check-in. Eleanor mentioned feeling a bit tired but nothing concerning. She took her medications on time.', false, false, '{"mood": "neutral", "topics": ["medication", "tiredness"]}', now() - interval '1 day', now() - interval '1 day'),
('call3333-3333-3333-3333-call33333333', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'session_003', 'missed', 0, now() - interval '1 day', null, null, false, false, '{}', now() - interval '1 day', now() - interval '1 day'),
('call4444-4444-4444-4444-call44444444', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'session_004', 'completed', 1205, now() - interval '3 days', 'concerning', 'Eleanor mentioned feeling dizzy yesterday and had trouble sleeping. Recommended contacting family about doctor visit.', true, false, '{"mood": "concerning", "topics": ["dizziness", "sleep", "health"]}', now() - interval '3 days', now() - interval '3 days'),
('call5555-5555-5555-5555-call55555555', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'session_005', 'completed', 756, now() - interval '4 days', 'positive', 'George was happy to share stories about his garden. The roses are blooming well this year.', false, false, '{"mood": "positive", "topics": ["garden", "roses", "stories"]}', now() - interval '4 days', now() - interval '4 days');

-- Create call analysis data
INSERT INTO call_analysis (id, call_log_id, user_id, transcript, summary, mood_score, health_flag, urgent_flag, timestamp, created_at, updated_at) VALUES
('analysis1-1111-1111-1111-analysis1111', 'call1111-1111-1111-1111-call11111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'AI: Good morning Eleanor, how are you feeling today?\nEleanor: Oh hello dear, I''m feeling quite well thank you. I saw the lovely photos the family sent.\nAI: That''s wonderful! What did you think of them?\nEleanor: The children look so grown up. I can''t wait to see them this weekend.', 'Eleanor expressed positive mood and engagement with family content. Looking forward to upcoming visit.', 8, false, false, now() - interval '2 hours', now() - interval '2 hours', now() - interval '2 hours'),
('analysis2-2222-2222-2222-analysis2222', 'call2222-2222-2222-2222-call22222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'AI: Hello Eleanor, how has your day been?\nEleanor: It''s been alright, I''m feeling a bit tired today.\nAI: Have you been taking your medications?\nEleanor: Yes, I took them with breakfast as usual.', 'Routine check-in with mild fatigue reported. Medication compliance confirmed.', 6, false, false, now() - interval '1 day', now() - interval '1 day', now() - interval '1 day'),
('analysis3-3333-3333-3333-analysis3333', 'call4444-4444-4444-4444-call44444444', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'AI: Good morning Eleanor, how are you today?\nEleanor: Not feeling my best, dear. I felt quite dizzy yesterday.\nAI: That sounds concerning. Have you spoken to anyone about this?\nEleanor: Not yet, I didn''t want to worry the family.\nAI: It''s important to let them know. Can I help you contact them?', 'Eleanor reported dizziness and sleep issues. Expressed reluctance to worry family but agreed to contact them.', 3, true, false, now() - interval '3 days', now() - interval '3 days', now() - interval '3 days'),
('analysis4-4444-4444-4444-analysis4444', 'call5555-5555-5555-5555-call55555555', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'AI: Hello George, how are you today?\nGeorge: Very well thank you! The weather''s been perfect for the garden.\nAI: Tell me about your garden.\nGeorge: The roses are absolutely spectacular this year. I must take some photos to show the family.', 'George in excellent spirits discussing his garden. Shows enthusiasm and connection to family.', 9, false, false, now() - interval '4 days', now() - interval '4 days', now() - interval '4 days');

-- Success message
SELECT 'Test data seeded successfully!' as status,
       COUNT(*) as households_created FROM households WHERE name LIKE 'QA Test%'
UNION ALL
SELECT 'Household members created:' as status,
       COUNT(*)::text FROM household_members hm 
       JOIN households h ON h.id = hm.household_id 
       WHERE h.name LIKE 'QA Test%'
UNION ALL  
SELECT 'Relatives created:' as status,
       COUNT(*)::text FROM relatives r
       JOIN households h ON h.id = r.household_id
       WHERE h.name LIKE 'QA Test%'
UNION ALL
SELECT 'Messages created:' as status,
       COUNT(*)::text FROM family_messages fm
       JOIN households h ON h.id = fm.household_id  
       WHERE h.name LIKE 'QA Test%'
UNION ALL
SELECT 'Photos created:' as status,
       COUNT(*)::text FROM family_photos fp
       JOIN households h ON h.id = fp.household_id
       WHERE h.name LIKE 'QA Test%'
UNION ALL
SELECT 'Call logs created:' as status,
       COUNT(*)::text FROM call_logs cl
       JOIN relatives r ON r.id = cl.user_id
       JOIN households h ON h.id = r.household_id
       WHERE h.name LIKE 'QA Test%';