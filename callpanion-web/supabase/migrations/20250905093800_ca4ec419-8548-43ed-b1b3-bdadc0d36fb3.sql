-- Update schedule to be due soon for testing (10:40 London time / 16:40 Jakarta time)
UPDATE schedules 
SET morning_time = '10:40:00'
WHERE id = '8df87ec9-dcd7-4315-aefe-0d2ec2044969';

-- Test the RPC function to see if it picks up the due schedule
SELECT * FROM rpc_find_due_schedules_next_min();