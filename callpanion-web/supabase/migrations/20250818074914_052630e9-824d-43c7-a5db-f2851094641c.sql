-- Create support ticket system tables
CREATE TYPE support_priority AS ENUM ('P1', 'P2', 'P3');
CREATE TYPE support_status AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');
CREATE TYPE support_channel AS ENUM ('APP', 'EMAIL', 'PHONE');

-- Support tickets table
CREATE TABLE public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number TEXT NOT NULL UNIQUE,
  user_id UUID REFERENCES auth.users(id),
  household_id UUID REFERENCES public.households(id),
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  priority support_priority NOT NULL DEFAULT 'P3',
  status support_status NOT NULL DEFAULT 'OPEN',
  channel support_channel NOT NULL DEFAULT 'APP',
  contact_email TEXT,
  contact_phone TEXT,
  assigned_to UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Support messages table for ticket threads
CREATE TABLE public.support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES auth.users(id),
  sender_type TEXT NOT NULL DEFAULT 'USER', -- 'USER', 'STAFF', 'SYSTEM'
  message TEXT NOT NULL,
  is_internal BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- On-call rota table
CREATE TABLE public.support_oncall (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT true,
  contact_method TEXT NOT NULL DEFAULT 'email',
  contact_details TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Generate unique ticket numbers
CREATE OR REPLACE FUNCTION generate_ticket_number()
RETURNS TEXT AS $$
BEGIN
  RETURN 'CS-' || TO_CHAR(now(), 'YYYYMMDD') || '-' || LPAD(nextval('ticket_sequence')::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

CREATE SEQUENCE ticket_sequence START 1000;

-- Trigger to auto-generate ticket numbers
CREATE OR REPLACE FUNCTION set_ticket_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ticket_number IS NULL THEN
    NEW.ticket_number := generate_ticket_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_ticket_number
  BEFORE INSERT ON public.support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION set_ticket_number();

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_support_ticket_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_support_ticket_timestamp
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION update_support_ticket_timestamp();

-- RLS Policies
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_oncall ENABLE ROW LEVEL SECURITY;

-- Users can view their own tickets
CREATE POLICY "Users can view own tickets" ON public.support_tickets
  FOR SELECT USING (user_id = auth.uid() OR household_id IN (
    SELECT household_id FROM public.household_members WHERE user_id = auth.uid()
  ));

-- Admins can view all tickets
CREATE POLICY "Admins can manage all tickets" ON public.support_tickets
  FOR ALL USING (has_admin_access_with_mfa(auth.uid()));

-- Users can create tickets
CREATE POLICY "Users can create tickets" ON public.support_tickets
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Support message policies
CREATE POLICY "Users can view messages for their tickets" ON public.support_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.support_tickets st 
      WHERE st.id = ticket_id 
      AND (st.user_id = auth.uid() OR st.household_id IN (
        SELECT household_id FROM public.household_members WHERE user_id = auth.uid()
      ))
    ) OR has_admin_access_with_mfa(auth.uid())
  );

CREATE POLICY "Users can add messages to their tickets" ON public.support_messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.support_tickets st 
      WHERE st.id = ticket_id 
      AND (st.user_id = auth.uid() OR st.household_id IN (
        SELECT household_id FROM public.household_members WHERE user_id = auth.uid()
      ))
    )
  );

CREATE POLICY "Admins can manage all messages" ON public.support_messages
  FOR ALL USING (has_admin_access_with_mfa(auth.uid()));

-- On-call rota policies (admin only)
CREATE POLICY "Admins can manage on-call rota" ON public.support_oncall
  FOR ALL USING (has_admin_access_with_mfa(auth.uid()));

-- Function to get current on-call person
CREATE OR REPLACE FUNCTION get_current_oncall()
RETURNS TABLE(user_id UUID, contact_method TEXT, contact_details TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT so.user_id, so.contact_method, so.contact_details
  FROM public.support_oncall so
  WHERE now() BETWEEN so.start_time AND so.end_time
    AND so.is_primary = true
  ORDER BY so.created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;