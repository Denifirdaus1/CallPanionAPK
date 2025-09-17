-- Create function to cleanup inactive relatives with secure search_path
CREATE OR REPLACE FUNCTION public.cleanup_inactive_relatives()
RETURNS void 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Mark inactive if last active > 12 months ago
  UPDATE public.relatives
  SET inactive_since = now()
  WHERE inactive_since IS NULL
    AND last_active_at < now() - INTERVAL '12 months';

  -- Delete if inactive > 3 months
  DELETE FROM public.relatives
  WHERE inactive_since < now() - INTERVAL '3 months';
END;
$$;

-- Schedule this to run daily at 3 AM
SELECT cron.schedule('cleanup_inactive_relatives_job', '0 3 * * *', $$SELECT public.cleanup_inactive_relatives();$$);