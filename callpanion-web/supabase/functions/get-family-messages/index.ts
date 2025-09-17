import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { serviceClient } from "../_shared/client.ts";

// Secure CORS configuration
function getAllowedOrigins() {
  const raw = Deno.env.get('ALLOWED_ORIGINS');
  if (!raw) return ['https://umjtepmdwfyfhdzbkyli.supabase.co', 'https://loving-goldfinch-e42fd2.lovableproject.com'];
  return raw.split(',').map(s => s.trim()).filter(Boolean);
}

function corsHeaders(origin: string | null) {
  const allowlist = getAllowedOrigins();
  const isAllowed = origin && allowlist.includes(origin);
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : allowlist[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
  };
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders(origin) });
  }

  try {
    // Extract and validate authorization
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      });
    }

    const { household_id, limit = 5 } = await req.json();

    console.log('Family messages request for household');

    if (!household_id) {
      throw new Error('household_id is required');
    }

    const supabase = serviceClient();
    
    // Get user from token for authorization
    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Authentication failed');
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Authentication failed',
        summary: 'Unable to retrieve family messages right now.'
      }), {
        status: 401,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      });
    }

    // Verify user has access to this household
    const { data: householdCheck, error: householdError } = await supabase.rpc(
      'validate_household_access',
      { _user_id: user.id, _household_id: household_id }
    );

    if (householdError || !householdCheck) {
      console.error('Unauthorized household access attempt');
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Unauthorized access',
        summary: 'Unable to retrieve family messages right now.'
      }), {
        status: 403,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      });
    }

    // Get recent family messages
    const { data: messages, error } = await supabase
      .from('family_messages')
      .select(`
        id,
        content,
        message_type,
        created_at,
        sender_id,
        profiles:sender_id (
          display_name
        )
      `)
      .eq('household_id', household_id)
      .eq('status', 'sent')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching family messages:', error);
      throw error;
    }

    // Format messages for AI consumption
    const formattedMessages = messages.map(msg => ({
      id: msg.id,
      content: msg.content,
      type: msg.message_type,
      from: msg.profiles?.display_name || 'Family Member',
      time: new Date(msg.created_at).toLocaleDateString('en-GB', {
        weekday: 'short',
        month: 'short', 
        day: 'numeric'
      })
    }));

    // Create a summary for the AI
    let summary = '';
    if (formattedMessages.length === 0) {
      summary = 'No recent messages from family.';
    } else {
      summary = `You have ${formattedMessages.length} recent message${formattedMessages.length > 1 ? 's' : ''} from family: `;
      summary += formattedMessages.map(msg => 
        `${msg.from} said "${msg.content}" on ${msg.time}`
      ).join('. ') + '.';
    }

    console.log('Family messages retrieved:', formattedMessages.length);

    return new Response(JSON.stringify({
      success: true,
      summary,
      messages: formattedMessages,
      total_count: formattedMessages.length
    }), {
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in get-family-messages:', error.message);
    return new Response(JSON.stringify({
      success: false,
      error: 'Family messages retrieval failed',
      summary: 'Unable to retrieve family messages right now.'
    }), {
      status: 500,
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' }
    });
  }
});