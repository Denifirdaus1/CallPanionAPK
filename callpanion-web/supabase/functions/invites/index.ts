import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serviceClient } from "../_shared/client.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface InviteMemberRequest {
  name: string;
  relationship: string;
  email?: string;
  phone?: string;
  role: 'FAMILY_MEMBER' | 'FAMILY_PRIMARY';
  permissions: {
    health_access_level: 'NO_ACCESS' | 'SUMMARY_ONLY' | 'FULL_ACCESS';
    can_view_calendar: boolean;
    can_post_updates: boolean;
  };
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { 
      status: 405, 
      headers: corsHeaders 
    });
  }

  try {
    console.log('[INVITES] Function started');
    
    // Get user from authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      console.log('[INVITES] No authorization header');
      return new Response(JSON.stringify({ error: 'Authorization required' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    console.log('[INVITES] Authorization header found');

    // Create user client for authentication
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase configuration missing');
    }

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await supabaseUser.auth.getUser();
    const user = userData?.user;
    if (userError || !user) {
      console.log('[INVITES] User verification failed:', userError?.message || 'no user');
      return new Response(JSON.stringify({ error: 'Invalid authentication' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    console.log('[INVITES] User authenticated:', { userId: user.id, email: user.email });

    // Create service client for operations
    const supabase = serviceClient();

    // Get request body
    const body: InviteMemberRequest = await req.json();
    console.log('[INVITES] Request body received:', { 
      name: body.name, 
      email: body.email, 
      role: body.role 
    });
    
    // Validate required fields
    if (!body.name || (!body.email && !body.phone)) {
      return new Response(JSON.stringify({ error: 'Name and email/phone are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Get user's household and verify they are an admin using user client for authorization
    const { data: userMembership, error: membershipError } = await supabaseUser
      .from('household_members')
      .select('household_id, role')
      .eq('user_id', user.id)
      .single();

    if (membershipError || !userMembership || userMembership.role !== 'FAMILY_PRIMARY') {
      console.log('[INVITES] User not authorized:', { membershipError, userMembership });
      return new Response(JSON.stringify({ error: 'Only household administrators can invite members' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    console.log('[INVITES] User authorized as household admin:', userMembership);

    // Generate invite token
    const inviteToken = crypto.randomUUID().replace(/-/g, '');
    
    // Create invite with metadata
    const { data: invite, error: inviteError } = await supabase
      .from('invites')
      .insert({
        household_id: userMembership.household_id,
        email: body.email || `${body.phone}@placeholder.email`,
        role: body.role,
        token: inviteToken,
        invited_by: user.id,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
        metadata: {
          name: body.name,
          relationship: body.relationship,
          phone: body.phone,
          health_access_level: body.permissions.health_access_level,
          can_view_calendar: body.permissions.can_view_calendar,
          can_post_updates: body.permissions.can_post_updates
        }
      })
      .select()
      .single();

    if (inviteError) {
      console.error('Invite creation error:', inviteError);
      return new Response(JSON.stringify({ error: 'Failed to create invite' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Get updated member list
    const { data: members, error: membersError } = await supabase
      .from('household_members')
      .select(`
        id,
        user_id,
        role,
        health_access_level,
        can_view_calendar,
        can_post_updates,
        created_at,
        profiles!inner(
          id,
          display_name,
          email
        )
      `)
      .eq('household_id', userMembership.household_id);

    // Get pending invites
    const { data: pendingInvites, error: invitesError } = await supabase
      .from('invites')
      .select('*')
      .eq('household_id', userMembership.household_id)
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString());

    const response = {
      success: true,
      invite: {
        id: invite.id,
        token: inviteToken,
        email: body.email,
        name: body.name,
        relationship: body.relationship,
        status: 'pending'
      },
      members: members || [],
      pendingInvites: pendingInvites || []
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (error) {
    console.error('[INVITES] Error in invites function:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: 'Internal server error', details: errorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
};

serve(handler);