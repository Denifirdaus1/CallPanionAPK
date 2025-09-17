-- Fix security warning: Function Search Path Mutable
-- Set search_path for the enforce_schedule_call_type function

CREATE OR REPLACE FUNCTION public.enforce_schedule_call_type()
RETURNS trigger AS $$
DECLARE
  pref TEXT;
BEGIN
  -- Get household preference
  SELECT call_method_preference INTO pref
  FROM public.households WHERE id = NEW.household_id;

  -- Auto-set call_type if not provided
  IF NEW.call_type IS NULL THEN
    NEW.call_type := pref;
  END IF;

  -- Block if call_type doesn't match household preference
  IF NEW.call_type <> pref THEN
    RAISE EXCEPTION 'call_type % does not match household preference %', NEW.call_type, pref
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END; 
$$ LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path TO 'public';