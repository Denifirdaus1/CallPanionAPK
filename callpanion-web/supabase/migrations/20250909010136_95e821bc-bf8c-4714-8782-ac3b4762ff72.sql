-- Fix function search path security issue
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
      SELECT 1 FROM public.relatives r 
      WHERE r.id = NEW.relative_id 
      AND r.household_id = NEW.household_id
    ) THEN
      RAISE EXCEPTION 'Invalid relative_id for household_id';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';