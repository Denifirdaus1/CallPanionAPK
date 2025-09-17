-- Update dengan nomor telepon real user untuk batch calling
-- Pastikan nomor yang benar digunakan untuk schedule
UPDATE relatives 
SET phone_number = '+62-812-1872-9431' 
WHERE phone_number = '+62-812-1234-5678' OR phone_number LIKE '+62-812-1234%';

-- Cek hasil update
SELECT r.first_name, r.last_name, r.phone_number, s.afternoon_time, s.timezone, s.active 
FROM relatives r 
LEFT JOIN schedules s ON r.id = s.relative_id 
WHERE r.phone_number IS NOT NULL 
ORDER BY r.created_at DESC;