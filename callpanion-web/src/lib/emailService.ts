import { supabase } from "@/integrations/supabase/client";

interface SendInviteEmailRequest {
  email: string;
  token: string;
  household_id: string;
  household_name?: string;
  inviter_name?: string;
}

export const sendInviteEmail = async (params: SendInviteEmailRequest) => {
  try {
    const { data, error } = await supabase.functions.invoke('send-invite-email', {
      body: params
    });

    if (error) {
      console.error('Error sending invite email:', error);
      throw new Error(error.message || 'Failed to send invite email');
    }

    return data;
  } catch (error) {
    console.error('Email service error:', error);
    throw error;
  }
};

// Generate a cryptographically secure random string
export const generateInviteToken = (length: number = 32): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, byte => chars[byte % chars.length]).join('');
};