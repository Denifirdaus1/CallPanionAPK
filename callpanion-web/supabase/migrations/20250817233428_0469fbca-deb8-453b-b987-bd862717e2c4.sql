-- Update pricing FAQ to reflect current £15/month pricing
UPDATE public.faqs 
SET answer = 'CallPanion costs £15 per month for up to 2 family accounts and 1 elderly person. This includes unlimited AI wellbeing calls, family dashboard access, and photo sharing. Additional elderly people can be added for £10/month each.'
WHERE question = 'How much does it cost?' 
AND answer = 'We''ll publish pricing at launch. Join the waitlist for early-access offers.';