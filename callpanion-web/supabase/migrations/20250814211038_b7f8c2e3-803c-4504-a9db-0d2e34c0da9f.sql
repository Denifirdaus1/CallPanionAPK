-- Remove the "backed by UK innovation grants & advisors" text
UPDATE public.site_content 
SET value = '', updated_at = now()
WHERE key = 'social_proof_text';