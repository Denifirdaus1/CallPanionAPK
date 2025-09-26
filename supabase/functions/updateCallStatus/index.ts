import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { serviceClient } from '../_shared/client.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sessionId, status, action, callUuid, duration } = await req.json();

    if (!sessionId || !status) {
      throw new Error('sessionId and status are required');
    }

    console.log(`Updating call status for session ${sessionId}: ${status}`);

    const supabase = serviceClient();

    // Update call session status
    const { data: session, error: sessionError } = await supabase
      .from('call_sessions')
      .update({
        status: status,
        ...(status === 'active' && { started_at: new Date().toISOString() }),
        ...(status === 'completed' && { 
          ended_at: new Date().toISOString(),
          duration_seconds: duration || null
        }),
        ...(callUuid && { call_uuid: callUuid }),
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId)
      .select()
      .single();

    if (sessionError) {
      console.error('Error updating call session:', sessionError);
      throw sessionError;
    }

    // Update corresponding call log
    let callOutcome = 'initiated';
    switch (status) {
      case 'active':
        callOutcome = 'in_progress';
        break;
      case 'completed':
        callOutcome = 'completed';
        break;
      case 'missed':
        callOutcome = 'missed';
        break;
      case 'declined':
        callOutcome = 'declined';
        break;
    }

    const { error: logError } = await supabase
      .from('call_logs')
      .update({
        call_outcome: callOutcome,
        ...(duration && { call_duration: duration }),
        updated_at: new Date().toISOString()
      })
      .eq('session_id', sessionId);

    if (logError) {
      console.error('Error updating call log:', logError);
    }

    // If call was accepted or completed, notify family members
    if (status === 'active' || status === 'completed') {
      try {
        // Get household members for notification
        const { data: familyMembers, error: familyError } = await supabase
          .from('household_members')
          .select('user_id')
          .eq('household_id', session.household_id);

        if (!familyError && familyMembers) {
          const notificationTitle = status === 'active' ? 
            'Call Started' : 'Call Completed';
          const notificationBody = status === 'active' ? 
            'Call is now in progress' : 
            `Call completed${duration ? ` (${Math.floor(duration / 60)}m ${duration % 60}s)` : ''}`;

          for (const member of familyMembers) {
            await supabase.functions.invoke('send-push-notification', {
              body: {
                userId: member.user_id,
                title: notificationTitle,
                body: notificationBody,
                data: {
                  type: 'call_update',
                  sessionId: sessionId,
                  status: status,
                  householdId: session.household_id,
                  relativeId: session.relative_id
                }
              }
            });
          }
        }
      } catch (notifyError) {
        console.error('Error sending family notifications:', notifyError);
        // Don't fail the whole request for notification issues
      }
    }

    console.log(`Successfully updated call status for session ${sessionId}`);

    return new Response(JSON.stringify({
      success: true,
      sessionId,
      status,
      callOutcome,
      message: 'Call status updated successfully'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error updating call status:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});