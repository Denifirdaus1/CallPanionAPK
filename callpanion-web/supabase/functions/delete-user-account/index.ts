import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Rate limiting check
    const clientIp = req.headers.get('x-forwarded-for') || 'unknown';
    const { data: rateLimitOk } = await supabase.rpc('check_rate_limit', {
      _identifier: clientIp,
      _endpoint: 'delete-user-account',
      _max_requests: 3,
      _window_minutes: 60
    });

    if (!rateLimitOk) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Require authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const jwt = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    let targetUserId: string;

    // Self-deletion: ignore body userId and use authenticated user
    if (!body.userId || body.userId === user.id) {
      targetUserId = user.id;
      console.log(`Self-deletion requested by user: ${user.id}`);
    } else {
      // Admin deletion: verify admin access with MFA
      const { data: isAdmin, error: adminError } = await supabase.rpc('has_admin_access_with_mfa', {
        user_id: user.id
      });

      if (adminError || !isAdmin) {
        // Log unauthorized attempt
        await supabase
          .from('audit_log')
          .insert({
            actor_user_id: user.id,
            action: 'unauthorized_user_deletion_attempt',
            entity_type: 'user_account',
            entity_id: body.userId,
            details: { attempted_target: body.userId, ip_address: clientIp }
          });

        return new Response(
          JSON.stringify({ error: 'Unauthorized: Admin access with MFA required' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      targetUserId = body.userId;
      console.log(`Admin deletion of user ${targetUserId} by admin: ${user.id}`);
    }

    // Log deletion attempt
    await supabase
      .from('audit_log')
      .insert({
        actor_user_id: user.id,
        action: targetUserId === user.id ? 'self_account_deletion' : 'admin_account_deletion',
        entity_type: 'user_account',
        entity_id: targetUserId,
        details: { 
          deleted_by: user.id,
          target_user: targetUserId,
          ip_address: clientIp,
          user_agent: req.headers.get('user-agent') || 'unknown'
        }
      });

    console.log(`Initiating account deletion for user: ${targetUserId} by ${user.id}`);

    // Delete user data in order (respecting foreign key constraints)
    const deletionSteps = [
      // Delete user-generated content
      { table: 'family_photos', field: 'user_id' },
      { table: 'family_messages', field: 'sender_id' },
      { table: 'content_reports', field: 'reported_by' },
      { table: 'push_notification_tokens', field: 'user_id' },
      
      // Delete household memberships
      { table: 'household_members', field: 'user_id' },
      
      // Delete families where user is creator (cascade will handle members)
      { table: 'families', field: 'created_by' },
      
      // Delete households where user is creator (cascade will handle relatives)
      { table: 'households', field: 'created_by' },
      
      // Delete profiles
      { table: 'profiles', field: 'id' },
    ];

    for (const step of deletionSteps) {
      const { error } = await supabase
        .from(step.table)
        .delete()
        .eq(step.field, targetUserId);
      
      if (error) {
        console.error(`Error deleting from ${step.table}:`, error);
        // Continue with other deletions even if one fails
      } else {
        console.log(`Deleted data from ${step.table}`);
      }
    }

    // Finally, delete the auth user (this will cascade to remaining references)
    const { error: deleteError } = await supabase.auth.admin.deleteUser(targetUserId);
    
    if (deleteError) {
      console.error('Error deleting auth user:', deleteError);
      
      // Log failure
      await supabase
        .from('audit_log')
        .insert({
          actor_user_id: user.id,
          action: 'account_deletion_failed',
          entity_type: 'user_account',
          entity_id: targetUserId,
          details: { error: deleteError.message, target_user: targetUserId }
        });

      return new Response(
        JSON.stringify({ error: 'Failed to delete user account' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log successful deletion
    await supabase
      .from('audit_log')
      .insert({
        actor_user_id: user.id,
        action: 'account_deletion_completed',
        entity_type: 'user_account',
        entity_id: targetUserId,
        details: { 
          deleted_by: user.id,
          target_user: targetUserId,
          deletion_type: targetUserId === user.id ? 'self' : 'admin'
        }
      });

    console.log(`Account deletion completed for user: ${targetUserId} by ${user.id}`);

    return new Response(
      JSON.stringify({ success: true, message: 'Account deleted successfully' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in delete-user-account function:', error);
    
    // Log error
    try {
      await supabase
        .from('audit_log')
        .insert({
          actor_user_id: user?.id || null,
          action: 'account_deletion_error',
          entity_type: 'user_account',
          details: { error: error.message, ip_address: clientIp }
        });
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};

serve(handler);