-- Update jadwal ke jam 18:40 WIB (jam sekarang + 6 menit untuk test)
UPDATE schedules 
SET afternoon_time = '18:40:00' 
WHERE relative_id = 'fe2b4f72-9ec6-4afb-bf98-253560178c62';

-- Test RPC function untuk cek apakah schedule terdeteksi
SELECT * FROM rpc_find_due_schedules_next_min();