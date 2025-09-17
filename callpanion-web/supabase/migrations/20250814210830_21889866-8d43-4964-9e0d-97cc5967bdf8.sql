-- Update the hero headline in site_content table
INSERT INTO public.site_content (key, value) 
VALUES ('hero_headline', 'Near, when you are far.')
ON CONFLICT (key) 
DO UPDATE SET 
  value = EXCLUDED.value,
  updated_at = now();