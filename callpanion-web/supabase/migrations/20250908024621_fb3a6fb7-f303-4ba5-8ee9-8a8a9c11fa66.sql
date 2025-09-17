-- Phase 1: Database Foundation - Hard Call Method Segregation

-- 1) Add call_method_preference to households table
ALTER TABLE public.households
  ADD COLUMN call_method_preference TEXT NOT NULL DEFAULT 'batch_call'
  CHECK (call_method_preference IN ('batch_call','in_app_call'));

-- 2) Add call_type to schedules table  
ALTER TABLE public.schedules
  ADD COLUMN call_type TEXT NOT NULL DEFAULT 'batch_call'
  CHECK (call_type IN ('batch_call','in_app_call'));

-- 3) Add call_type to call_logs for analytics
ALTER TABLE public.call_logs
  ADD COLUMN call_type TEXT CHECK (call_type IN ('batch_call','in_app_call'));

-- 4) Create enforcement trigger function
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
END; $$ LANGUAGE plpgsql;

-- 5) Create trigger to enforce schedule call type
DROP TRIGGER IF EXISTS trg_enforce_schedule_call_type ON public.schedules;
CREATE TRIGGER trg_enforce_schedule_call_type
BEFORE INSERT OR UPDATE ON public.schedules
FOR EACH ROW EXECUTE FUNCTION public.enforce_schedule_call_type();

-- 6) Backfill existing schedules to match household preferences
UPDATE public.schedules s
SET call_type = h.call_method_preference
FROM public.households h
WHERE s.household_id = h.id;

-- 7) Backfill existing call_logs as batch_call (since that's what exists now)
UPDATE public.call_logs 
SET call_type = 'batch_call' 
WHERE call_type IS NULL;