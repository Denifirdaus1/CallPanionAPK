-- Remove the problematic trigger and function that references non-existent missed_calls table
DROP TRIGGER IF EXISTS check_missed_calls_trigger ON public.call_logs;
DROP FUNCTION IF EXISTS public.check_missed_calls();