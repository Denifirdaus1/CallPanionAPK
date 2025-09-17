-- Temporarily disable the HubSpot sync trigger to fix household creation
-- This prevents the JSON parsing error during household creation

DROP TRIGGER IF EXISTS sync_household_to_hubspot ON public.households;
DROP TRIGGER IF EXISTS trigger_sync_household_to_hubspot ON public.households;

-- Create a simple trigger that just logs instead of causing errors
CREATE OR REPLACE FUNCTION public.log_household_creation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Just log that a household was created
  RAISE NOTICE 'Household created with ID: %', NEW.id;
  RETURN NEW;
END;
$$;

-- Add simple logging trigger
CREATE TRIGGER log_household_creation_trigger
  AFTER INSERT ON public.households
  FOR EACH ROW
  EXECUTE FUNCTION log_household_creation();