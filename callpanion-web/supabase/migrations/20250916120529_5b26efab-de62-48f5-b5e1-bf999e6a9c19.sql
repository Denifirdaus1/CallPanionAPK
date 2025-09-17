-- Fix call_logs user_id constraint for in-app calls
-- Add trigger to auto-populate user_id from relative_id for in-app calls

CREATE OR REPLACE FUNCTION public.ensure_call_log_user_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- For in-app calls, ensure user_id is set to relative_id if not already set
  IF NEW.call_type = 'in_app_call' AND NEW.user_id IS NULL AND NEW.relative_id IS NOT NULL THEN
    NEW.user_id := NEW.relative_id;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger to auto-fix user_id before insert/update
DROP TRIGGER IF EXISTS ensure_call_log_user_id_trigger ON public.call_logs;
CREATE TRIGGER ensure_call_log_user_id_trigger
  BEFORE INSERT OR UPDATE ON public.call_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_call_log_user_id();

-- Also add index for better performance on call_logs lookups
CREATE INDEX IF NOT EXISTS idx_call_logs_session_provider 
ON public.call_logs (session_id, provider, call_type);

-- Update any existing call_logs with null user_id for in-app calls
UPDATE public.call_logs 
SET user_id = relative_id 
WHERE call_type = 'in_app_call' 
  AND user_id IS NULL 
  AND relative_id IS NOT NULL;