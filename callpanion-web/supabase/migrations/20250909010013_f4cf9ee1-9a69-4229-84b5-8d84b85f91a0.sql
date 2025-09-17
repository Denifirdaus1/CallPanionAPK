-- Pastikan call_logs menggunakan household_id dan relative_id konsisten
-- untuk in-app calls dan batch calls

-- Update call_logs untuk in-app calls agar konsisten
ALTER TABLE call_logs 
ADD CONSTRAINT check_household_relative_consistency 
CHECK (
  (household_id IS NOT NULL AND relative_id IS NOT NULL) OR
  (provider = 'elevenlabs' AND provider_call_id IS NOT NULL)
);

-- Function untuk memastikan in-app call logs memiliki household context
CREATE OR REPLACE FUNCTION ensure_call_log_household_context()
RETURNS TRIGGER AS $$
BEGIN
  -- Untuk in-app calls, pastikan household_id dan relative_id diisi
  IF NEW.provider = 'webrtc' AND NEW.call_type = 'in_app_call' THEN
    IF NEW.household_id IS NULL OR NEW.relative_id IS NULL THEN
      RAISE EXCEPTION 'In-app calls must have household_id and relative_id';
    END IF;
    
    -- Validasi bahwa relative benar-benar ada di household tersebut
    IF NOT EXISTS (
      SELECT 1 FROM relatives r 
      WHERE r.id = NEW.relative_id 
      AND r.household_id = NEW.household_id
    ) THEN
      RAISE EXCEPTION 'Invalid relative_id for household_id';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger untuk validasi
CREATE TRIGGER validate_call_log_context
  BEFORE INSERT OR UPDATE ON call_logs
  FOR EACH ROW
  EXECUTE FUNCTION ensure_call_log_household_context();

-- Perbaiki RLS policy untuk call_logs agar lebih ketat untuk in-app calls
DROP POLICY IF EXISTS "call_logs_safe_household_access" ON call_logs;

CREATE POLICY "call_logs_household_access_v2" ON call_logs
FOR SELECT USING (
  has_admin_access_with_mfa(auth.uid()) OR
  is_service_role() OR
  is_edge_function_request() OR
  -- Untuk batch calls via relatives table
  (provider = 'elevenlabs' AND EXISTS (
    SELECT 1 FROM relatives r
    JOIN household_members hm ON hm.household_id = r.household_id
    WHERE r.id = call_logs.user_id AND hm.user_id = auth.uid()
  )) OR
  -- Untuk in-app calls via household_id langsung
  (provider = 'webrtc' AND call_type = 'in_app_call' AND 
   call_logs.household_id IN (
     SELECT household_id FROM household_members 
     WHERE user_id = auth.uid()
   ))
);