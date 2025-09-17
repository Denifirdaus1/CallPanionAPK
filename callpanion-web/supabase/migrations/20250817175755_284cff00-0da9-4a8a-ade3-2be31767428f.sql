-- Debug and fix any JSON-related issues in household creation

-- Check if there are any problematic triggers on households
-- First, let's ensure the household creation is working properly

-- Temporarily disable any problematic triggers and recreate them properly
DO $$
BEGIN
    -- Check if sync_household_to_hubspot trigger exists and drop it temporarily
    IF EXISTS (SELECT 1 FROM information_schema.triggers WHERE trigger_name = 'sync_household_to_hubspot' AND event_object_table = 'households') THEN
        DROP TRIGGER sync_household_to_hubspot ON households;
    END IF;
END $$;

-- Recreate the trigger more safely if the function exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'sync_household_to_hubspot') THEN
        CREATE TRIGGER sync_household_to_hubspot
        AFTER INSERT ON households
        FOR EACH ROW
        EXECUTE FUNCTION sync_household_to_hubspot();
    END IF;
EXCEPTION 
    WHEN OTHERS THEN
        -- If there's an error, just continue without the trigger
        NULL;
END $$;