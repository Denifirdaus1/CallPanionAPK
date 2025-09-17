import { supabase } from "@/integrations/supabase/client";

export interface FamilyMessage {
  id: string;
  household_id: string;
  sender_id: string;
  content: string;
  message_type: 'text' | 'voice' | 'photo';
  scheduled_for?: string;
  status: 'sent' | 'pending' | 'delivered';
  created_at: string;
  updated_at: string;
}

export const sendMessage = async (message: {
  content: string;
  message_type: 'text' | 'voice' | 'photo';
  household_id: string;
  scheduled_for?: string;
}): Promise<FamilyMessage> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('family_messages')
    .insert({
      household_id: message.household_id,
      sender_id: user.id,
      content: message.content,
      message_type: message.message_type,
      scheduled_for: message.scheduled_for ? new Date(message.scheduled_for).toISOString() : null,
      status: message.scheduled_for ? 'pending' : 'sent'
    })
    .select()
    .single();

  if (error) throw error;
  
  return {
    ...data,
    message_type: data.message_type as 'text' | 'voice' | 'photo',
    status: data.status as 'sent' | 'pending' | 'delivered',
    scheduled_for: message.scheduled_for || 'Immediate'
  };
};

export const getMessages = async (household_id: string): Promise<FamilyMessage[]> => {
  const { data, error } = await supabase
    .from('family_messages')
    .select('*')
    .eq('household_id', household_id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  
  return data.map(msg => ({
    ...msg,
    message_type: msg.message_type as 'text' | 'voice' | 'photo',
    status: msg.status as 'sent' | 'pending' | 'delivered',
    scheduled_for: msg.scheduled_for || 'Immediate'
  }));
};

export const deleteMessage = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('family_messages')
    .delete()
    .eq('id', id);

  if (error) throw error;
};

export const subscribeToMessages = (
  household_id: string,
  callback: (messages: FamilyMessage[]) => void
) => {
  const channel = supabase
    .channel('family_messages_changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'family_messages',
        filter: `household_id=eq.${household_id}`,
      },
      () => {
        // Refetch messages when any change occurs
        getMessages(household_id).then(callback).catch(console.error);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};