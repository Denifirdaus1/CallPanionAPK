-- Create a messages table for family communication
CREATE TABLE IF NOT EXISTS public.family_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid REFERENCES public.households(id) ON DELETE CASCADE,
  sender_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  message_type text NOT NULL DEFAULT 'text', -- 'text', 'voice', 'photo'
  scheduled_for timestamp with time zone,
  status text NOT NULL DEFAULT 'sent', -- 'sent', 'pending', 'delivered'
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.family_messages ENABLE ROW LEVEL SECURITY;

-- Create policies for family messages
CREATE POLICY "Household members can view messages" 
ON public.family_messages 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.household_members hm 
    WHERE hm.household_id = family_messages.household_id 
    AND hm.user_id = auth.uid()
  )
);

CREATE POLICY "Household members can send messages" 
ON public.family_messages 
FOR INSERT 
WITH CHECK (
  sender_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.household_members hm 
    WHERE hm.household_id = family_messages.household_id 
    AND hm.user_id = auth.uid()
  )
);

CREATE POLICY "Senders can update their own messages" 
ON public.family_messages 
FOR UPDATE 
USING (sender_id = auth.uid());

CREATE POLICY "Senders can delete their own messages" 
ON public.family_messages 
FOR DELETE 
USING (sender_id = auth.uid());

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_family_messages_household ON public.family_messages(household_id);
CREATE INDEX IF NOT EXISTS idx_family_messages_created_at ON public.family_messages(created_at);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_family_messages_updated_at
BEFORE UPDATE ON public.family_messages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();