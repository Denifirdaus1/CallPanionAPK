-- Hapus schedule lama yang timezone-nya salah (Europe/London)
DELETE FROM schedules 
WHERE id = '8df87ec9-dcd7-4315-aefe-0d2ec2044969'
  AND timezone = 'Europe/London';

-- Pastikan hanya ada 1 schedule aktif untuk relative ini
SELECT s.id, s.afternoon_time, s.timezone, r.first_name, r.phone_number
FROM schedules s 
JOIN relatives r ON r.id = s.relative_id 
WHERE r.phone_number = '+62-812-1872-9431'
  AND s.active = true;