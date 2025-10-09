import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface FamilyMessage {
  id: string;
  household_id: string;
  sender_id: string;
  sender_type: 'family' | 'elderly';
  message: string | null;
  message_type: 'text' | 'image';
  image_url: string | null;
  created_at: string;
  read_at: string | null;
  deleted_at: string | null;
}

export class ChatService {
  private channel: RealtimeChannel | null = null;

  async sendTextMessage(householdId: string, message: string): Promise<FamilyMessage> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    console.log('[ChatService] Sending text message:', { householdId, message, userId: user.id });

    const { data, error } = await supabase.from('chat_messages').insert({
      household_id: householdId,
      sender_id: user.id,
      sender_type: 'family',
      message,
      message_type: 'text',
    }).select().single();

    if (error) {
      console.error('[ChatService] Insert error:', error);
      throw error;
    }

    console.log('[ChatService] Message inserted:', data);
    return data as FamilyMessage;
  }

  async uploadImage(householdId: string, file: File): Promise<string> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const fileExt = file.name.split('.').pop();
    const fileName = `${householdId}/${Date.now()}.${fileExt}`;

    console.log('[ChatService] Uploading image:', fileName);

    const { error: uploadError } = await supabase.storage
      .from('family-chat-media')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      console.error('[ChatService] Upload error:', uploadError);
      throw uploadError;
    }

    // Use public URL (no expiry)
    const { data } = supabase.storage
      .from('family-chat-media')
      .getPublicUrl(fileName);

    console.log('[ChatService] Image uploaded, public URL created');
    return data.publicUrl;
  }

  async sendImageMessage(householdId: string, imageUrl: string, caption?: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    console.log('[ChatService] Sending image message:', { householdId, imageUrl, caption, userId: user.id });

    const { error } = await supabase.from('chat_messages').insert({
      household_id: householdId,
      sender_id: user.id,
      sender_type: 'family',
      image_url: imageUrl,
      message: caption || null,
      message_type: 'image',
    });

    if (error) {
      console.error('[ChatService] Image message insert error:', error);
      throw error;
    }
    
    console.log('[ChatService] Image message sent successfully');
  }

  async getMessages(householdId: string, limit = 50, before?: string): Promise<FamilyMessage[]> {
    console.log('[ChatService] Fetching messages for household:', householdId, 'before:', before);
    
    let query = supabase
      .from('chat_messages')
      .select('*')
      .eq('household_id', householdId)
      .is('deleted_at', null);

    // If before timestamp provided, load messages older than that
    if (before) {
      query = query.lt('created_at', before);
    }

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[ChatService] Fetch error:', error);
      throw error;
    }

    console.log('[ChatService] Fetched messages:', data?.length || 0);
    // Reverse to show oldest first (ascending order for display)
    return (data as FamilyMessage[]).reverse();
  }

  subscribeToMessages(
    householdId: string,
    onNewMessage: (message: FamilyMessage) => void
  ): void {
    console.log('[ChatService] Subscribing to realtime for household:', householdId);
    
    // Remove existing channel if any
    if (this.channel) {
      supabase.removeChannel(this.channel);
    }
    
    this.channel = supabase
      .channel(`family-chat-${householdId}`, {
        config: {
          broadcast: { self: false },
          presence: { key: '' },
        },
      })
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `household_id=eq.${householdId}`,
        },
        (payload) => {
          console.log('[ChatService] Realtime payload received:', payload);
          onNewMessage(payload.new as FamilyMessage);
        }
      )
      .subscribe((status, err) => {
        console.log('[ChatService] Realtime subscription status:', status);
        if (err) {
          console.error('[ChatService] Realtime subscription error:', err);
        }
        if (status === 'SUBSCRIBED') {
          console.log('[ChatService] ✅ Successfully subscribed to realtime updates');
        }
      });
  }

  unsubscribe(): void {
    if (this.channel) {
      supabase.removeChannel(this.channel);
      this.channel = null;
    }
  }

  async markAsRead(messageId: string): Promise<void> {
    const { error } = await supabase
      .from('chat_messages')
      .update({ read_at: new Date().toISOString() })
      .eq('id', messageId)
      .is('read_at', null);

    if (error) throw error;
  }
}

export const chatService = new ChatService();
