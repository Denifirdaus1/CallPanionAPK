-- Update schedule ke waktu sekarang + 2 menit
UPDATE schedules 
SET afternoon_time = (NOW() AT TIME ZONE 'Asia/Jakarta' + interval '2 minutes')::time
WHERE id = '84413772-d986-46e7-bddf-8d0252a9692b';

-- Test RPC function
SELECT * FROM rpc_find_due_schedules_next_min();