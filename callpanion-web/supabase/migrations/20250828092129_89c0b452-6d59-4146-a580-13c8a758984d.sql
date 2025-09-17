-- Fix search path security warnings for existing functions
ALTER FUNCTION public.activate_trial_code(text) SET search_path TO 'public';
ALTER FUNCTION public.generate_unsubscribe_token(text) SET search_path TO 'public';