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

    const { household_id, relative_id, title, message, priority = 'medium', notification_type = 'general' } = await req.json();

    console.log('Family notification request:', { title, priority });

    if (!household_id || !title || !message) {
      throw new Error('household_id, title, and message are required');
    }

    const supabase = serviceClient();
    
    // Get user from token for authorization
    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Authentication failed');
      return new Response(JSON.stringify({ error: 'Authentication failed' }), {
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
      return new Response(JSON.stringify({ error: 'Unauthorized access' }), {
        status: 403,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      });
    }

    // Get all household members to notify
    const { data: members, error: membersError } = await supabase
      .from('household_members')
      .select('user_id')
      .eq('household_id', household_id);

    if (membersError) {
      console.error('Error fetching household members:', membersError);
      throw membersError;
    }

    const userIds = members.map(m => m.user_id);

    // Insert family notification
    const { data, error } = await supabase
      .from('family_notifications')
      .insert({
        household_id,
        relative_id,
        title,
        message,
        priority,
        notification_type,
        sent_to_user_ids: userIds
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating family notification:', error);
      throw error;
    }

    console.log('Family notification created successfully');

    return new Response(JSON.stringify({
      success: true,
      id: data.id,
      message: 'Family notified successfully',
      notified_users: userIds.length
    }), {
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in notify-family:', error.message);
    return new Response(JSON.stringify({
      success: false,
      error: 'Family notification failed'
    }), {
      status: 500,
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' }
    });
  }
});