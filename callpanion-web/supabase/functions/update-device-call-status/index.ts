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
    const { sessionId, status, action, callUuid, duration, pairingToken, deviceToken } = await req.json();

    if (!sessionId || !status) {
      throw new Error('sessionId and status are required');
    }

    console.log(`Updating call status for device session ${sessionId}: ${status}`);

    const supabase = serviceClient();

    // Get session details to verify device access
    const { data: session, error: sessionError } = await supabase
      .from('call_sessions')
      .select(`
        *,
        relatives (
          id,
          household_id,
          device_token
        )
      `)
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      throw new Error('Session not found');
    }

    // Verify device access using pairing token or device token
    let hasAccess = false;
    
    if (pairingToken) {
      const { data: devicePair, error: pairError } = await supabase
        .from('device_pairs')
        .select('household_id, relative_id')
        .eq('pair_token', pairingToken)
        .eq('household_id', session.relatives.household_id)
        .single();
      
      if (!pairError && devicePair) {
        hasAccess = true;
      }
    }
    
    if (!hasAccess && deviceToken) {
      // Check if device token matches the relative's device
      if (session.relatives.device_token === deviceToken) {
        hasAccess = true;
      }
    }

    if (!hasAccess) {
      throw new Error('Device not authorized for this call');
    }

    // Update call session status
    const { data: updatedSession, error: updateError } = await supabase
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

    if (updateError) {
      console.error('Error updating call session:', updateError);
      throw updateError;
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
          .eq('household_id', session.relatives.household_id);

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
                  householdId: session.relatives.household_id,
                  relativeId: session.relatives.id
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

    console.log(`Successfully updated call status for device session ${sessionId}`);

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
    console.error('Error updating device call status:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});