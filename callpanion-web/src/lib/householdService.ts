
import { supabase } from "@/integrations/supabase/client";
import { sendInviteEmail } from "./emailService";

interface CreateHouseholdFormData {
  householdName?: string;
  firstName: string;
  lastName: string;
  town: string;
  county?: string;
  country?: string;
  postcode?: string;
  timezone?: string;
  callCadence?: string;
  qhStart?: string;
  qhEnd?: string;
  escName: string;
  escEmail: string;
  inviteEmail?: string;
}

interface AddRelativeRpcResponse {
  success: boolean;
  relative_id?: string;
  invite_token?: string;
  error?: string;
}

interface CreateHouseholdRpcResponse {
  success: boolean;
  household_id?: string;
  relative_id?: string;
  invite_token?: string;
  error?: string;
}

// Type guard to validate RPC response
const isValidRpcResponse = (data: unknown): data is AddRelativeRpcResponse => {
  if (!data || typeof data !== 'object') {
    console.error('RPC data is not an object:', data);
    return false;
  }
  const obj = data as any;
  return typeof obj.success === 'boolean';
};

// Type guard for household creation response
const isValidHouseholdRpcResponse = (data: unknown): data is CreateHouseholdRpcResponse => {
  if (!data || typeof data !== 'object') {
    console.error('Household RPC data is not an object:', data);
    return false;
  }
  const obj = data as any;
  return typeof obj.success === 'boolean';
};

// Normalize RPC response that may come as an array (RETURNS TABLE) or object (json/jsonb)
const normalizeRpcResponse = (data: unknown): AddRelativeRpcResponse | null => {
  const payload = Array.isArray(data) ? (data as any[])[0] : data;
  return isValidRpcResponse(payload) ? (payload as AddRelativeRpcResponse) : null;
};

// Normalize household RPC response
const normalizeHouseholdRpcResponse = (data: unknown): CreateHouseholdRpcResponse | null => {
  const payload = Array.isArray(data) ? (data as any[])[0] : data;
  return isValidHouseholdRpcResponse(payload) ? (payload as CreateHouseholdRpcResponse) : null;
};

export const addRelativeToExistingHousehold = async (form: CreateHouseholdFormData) => {
  try {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error('User not authenticated');

    // Get user's existing household
    const { data: memberData, error: memberError } = await supabase
      .from('household_members')
      .select('household_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (memberError || !memberData) {
      throw new Error('User is not part of any household');
    }

    const householdId = memberData.household_id;

    // Use simple RPC to add relative (and optionally create invite)
    const { data: rpcData, error: rpcError } = await supabase.rpc('add_relative_simple', {
      household_id_param: householdId,
      first_name_param: form.firstName,
      last_name_param: form.lastName,
      town_param: form.town || null,
      county_param: form.county || null,
      country_param: form.country || 'United Kingdom',
      call_cadence_param: form.callCadence || 'daily',
      timezone_param: form.timezone || 'Europe/London',
      quiet_hours_start_param: form.qhStart || null,
      quiet_hours_end_param: form.qhEnd || null,
      invite_email_param: form.inviteEmail?.trim() || null,
      gdpr_consent_param: false
    });

    if (rpcError) {
      console.error('RPC add_relative_simple error:', rpcError);
      throw new Error(rpcError.message || 'Failed to add relative');
    }

    // SECURITY FIX: Remove sensitive data logging to prevent PII exposure

    const response = normalizeRpcResponse(rpcData);
    if (!response) {
      console.error('Invalid RPC response structure:', rpcData);
      throw new Error('Invalid response from database function');
    }
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to add relative');
    }

    // If an invite was requested and token created by RPC, send the email
    if (form.inviteEmail?.trim() && response.invite_token) {
      try {
        const { data: household } = await supabase
          .from('households')
          .select('name')
          .eq('id', householdId)
          .single();

        await sendInviteEmail({
          email: form.inviteEmail.trim(),
          token: response.invite_token,
          household_id: householdId,
          household_name: household?.name || 'your household',
          inviter_name: user.user_metadata?.display_name || 'A family member'
        });
      } catch (emailError) {
        console.error('Failed to send invite email (continuing):', emailError);
      }
    }

    return { id: householdId };
  } catch (error) {
    console.error('Error adding relative to household:', error);
    const errorDetails = error as any;
    const detailedMessage = `Failed to add relative: ${errorDetails.message || 'Unknown error'}${
      errorDetails.code ? ` (Code: ${errorDetails.code})` : ''
    }${errorDetails.details ? ` Details: ${errorDetails.details}` : ''}${
      errorDetails.hint ? ` Hint: ${errorDetails.hint}` : ''
    }`;
    throw new Error(detailedMessage);
  }
};

export const createHouseholdWithRelative = async (form: CreateHouseholdFormData) => {
  try {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error('User not authenticated');

    // Use the new secure RPC that creates household and adds relative in one atomic operation
    const { data: rpcData, error: rpcError } = await supabase.rpc('create_household_and_relative_simple', {
      household_name_param: form.householdName || null,
      first_name_param: form.firstName,
      last_name_param: form.lastName,
      town_param: form.town || null,
      county_param: form.county || null,
      country_param: form.country || 'United Kingdom',
      call_cadence_param: form.callCadence || 'daily',
      timezone_param: form.timezone || 'Europe/London',
      quiet_hours_start_param: form.qhStart || null,
      quiet_hours_end_param: form.qhEnd || null,
      invite_email_param: form.inviteEmail?.trim() || null,
      gdpr_consent_param: false
    });

    if (rpcError) {
      console.error('RPC create_household_and_relative_simple error:', rpcError);
      throw new Error(rpcError.message || 'Failed to create household and add relative');
    }

    // SECURITY FIX: Remove sensitive data logging to prevent PII exposure

    const response = normalizeHouseholdRpcResponse(rpcData);
    if (!response) {
      console.error('Invalid household RPC response structure:', rpcData);
      throw new Error('Invalid response from database function');
    }
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to create household and add relative');
    }

    // If an invite was created by RPC, send the invite email
    if (form.inviteEmail?.trim() && response.invite_token) {
      try {
        await sendInviteEmail({
          email: form.inviteEmail.trim(),
          token: response.invite_token,
          household_id: response.household_id!,
          household_name: form.householdName || 'your household',
          inviter_name: user.user_metadata?.display_name || 'A family member'
        });
      } catch (emailError) {
        console.error('Failed to send invite email (continuing):', emailError);
      }
    }

    return { id: response.household_id };
  } catch (error) {
    console.error('Error creating household and relative:', error);
    const errorDetails = error as any;
    const detailedMessage = `Failed to create household: ${errorDetails.message || 'Unknown error'}${
      errorDetails.code ? ` (Code: ${errorDetails.code})` : ''
    }${errorDetails.details ? ` Details: ${errorDetails.details}` : ''}${
      errorDetails.hint ? ` Hint: ${errorDetails.hint}` : ''
    }`;
    throw new Error(detailedMessage);
  }
};
