import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serviceClient } from '../_shared/client.ts';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': 'https://umjtepmdwfyfhdzbkyli.supabase.co',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders() });
  }

  try {
    const { user_id, scheduled_for, call_type } = await req.json();

    if (!user_id) {
      throw new Error('user_id is required');
    }

    const supabase = serviceClient();
    
    // Validate JWT for service role only
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Missing or invalid authorization header' }), {
        status: 401,
        headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    // Only allow service role or super admin access
    if (authError || !user) {
      console.error('Authentication failed:', authError);
      return new Response(JSON.stringify({ error: 'Authentication failed' }), {
        status: 401,
        headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
      });
    }

    // Check if the caller is a service role or super admin
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const isServiceCall = token === serviceRoleKey;
    
    const { data: adminCheck, error: adminError } = await supabase.rpc('is_super_admin', {
      _uid: user.id
    });

    if (!isServiceCall && !adminCheck) {
      console.error('Unauthorized wellbeing call initiation:', user.id);
      await supabase.rpc('log_security_event', {
        event_type_param: 'unauthorized_wellbeing_call',
        details_param: { user_id: user.id, target_user_id: user_id }
      });
      return new Response(JSON.stringify({ error: 'Unauthorized: service role required' }), {
        status: 403,
        headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
      });
    }

    // Create Daily.co room for the call
    const DAILY_API_KEY = Deno.env.get('DAILY_API_KEY');
    if (!DAILY_API_KEY) {
      throw new Error('DAILY_API_KEY not configured');
    }

    const roomResponse = await fetch('https://api.daily.co/v1/rooms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DAILY_API_KEY}`,
      },
      body: JSON.stringify({
        name: `wellbeing-call-${user_id}-${Date.now()}`,
        properties: {
          max_participants: 2,
          enable_chat: false,
          enable_screenshare: false,
          start_video_off: true,
          start_audio_off: false,
          exp: Math.round(Date.now() / 1000) + 3600, // 1 hour expiry
        },
      }),
    });

    if (!roomResponse.ok) {
      const error = await roomResponse.text();
      console.error('Daily.co room creation failed:', error);
      throw new Error('Failed to create Daily.co room');
    }

    const roomData = await roomResponse.json();
    console.log('Created Daily.co room:', roomData.name);

    // Log the call attempt
    const { data: callLog, error: logError } = await supabase
      .from('call_logs')
      .insert({
        user_id,
        timestamp: scheduled_for || new Date().toISOString(),
        call_outcome: 'initiated',
        daily_api_room_id: roomData.name,
      })
      .select('id')
      .single();

    if (logError) {
      console.error('Error creating call log:', logError);
      throw new Error('Failed to log call attempt');
    }

    // Start the call monitoring process
    const monitorCall = async () => {
      try {
        // Wait a moment for the call to potentially be answered
        await new Promise(resolve => setTimeout(resolve, 30000)); // 30 seconds

        // Check call status and update accordingly
        const callStatusResponse = await fetch(`https://api.daily.co/v1/rooms/${roomData.name}/presence`, {
          headers: {
            'Authorization': `Bearer ${DAILY_API_KEY}`,
          },
        });

        if (callStatusResponse.ok) {
          const presenceData = await callStatusResponse.json();
          const isAnswered = presenceData.total_count > 0;

          // Update call log
          await supabase
            .from('call_logs')
            .update({
              call_outcome: isAnswered ? 'answered' : 'missed',
              call_duration: isAnswered ? null : 0,
            })
            .eq('id', callLog.id);

          if (isAnswered) {
            console.log(`Call answered for user ${user_id}`);
            // Start recording and analysis process
            await startCallAnalysis(callLog.id, user_id, roomData.name);
          } else {
            console.log(`Call missed for user ${user_id}`);
          }
        }

        // Clean up room after 1 hour
        setTimeout(async () => {
          try {
            await fetch(`https://api.daily.co/v1/rooms/${roomData.name}`, {
              method: 'DELETE',
              headers: {
                'Authorization': `Bearer ${DAILY_API_KEY}`,
              },
            });
            console.log(`Cleaned up room ${roomData.name}`);
          } catch (error) {
            console.error('Error cleaning up room:', error);
          }
        }, 3600000); // 1 hour

      } catch (error) {
        console.error('Error monitoring call:', error);
      }
    };

    // Start monitoring in background
    EdgeRuntime.waitUntil(monitorCall());

    return new Response(JSON.stringify({
      success: true,
      call_log_id: callLog.id,
      room_url: roomData.url,
      room_name: roomData.name,
    }), {
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error initiating wellbeing call:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
    });
  }
});

async function startCallAnalysis(callLogId: string, userId: string, roomName: string) {
  try {
    const supabase = serviceClient();
    
    // Simulate call recording and analysis
    // In a real implementation, you would:
    // 1. Get recording from Daily.co
    // 2. Transcribe with Whisper
    // 3. Analyze with GPT-4o
    
    // For now, we'll create a placeholder analysis
    const mockAnalysis = {
      mood_score: Math.floor(Math.random() * 5) + 1,
      health_flag: Math.random() > 0.8,
      urgent_flag: Math.random() > 0.95,
      transcript: "Mock conversation transcript...",
      summary: "User reported feeling well with no immediate concerns."
    };

    const { error: analysisError } = await supabase
      .from('call_analysis')
      .insert({
        user_id: userId,
        call_log_id: callLogId,
        ...mockAnalysis
      });

    if (analysisError) {
      console.error('Error saving call analysis:', analysisError);
    } else {
      console.log(`Call analysis saved for user ${userId}`);
    }

  } catch (error) {
    console.error('Error in call analysis:', error);
  }
}