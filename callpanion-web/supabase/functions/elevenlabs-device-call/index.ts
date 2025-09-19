import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { serviceClient } from '../_shared/client.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Retry configuration for API calls
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 5000,  // 5 seconds
  timeout: 10000   // 10 seconds
};

// Enhanced error types
enum ConversationErrorType {
  TOKEN_GENERATION_FAILED = 'TOKEN_GENERATION_FAILED',
  DEVICE_NOT_AUTHORIZED = 'DEVICE_NOT_AUTHORIZED',
  SESSION_NOT_FOUND = 'SESSION_NOT_FOUND',
  NETWORK_ERROR = 'NETWORK_ERROR',
  CONVERSATION_CREATION_FAILED = 'CONVERSATION_CREATION_FAILED',
  WEBHOOK_CORRELATION_FAILED = 'WEBHOOK_CORRELATION_FAILED'
}

class ConversationError extends Error {
  constructor(
    public type: ConversationErrorType,
    message: string,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = 'ConversationError';
  }
}

// Utility function for retry with exponential backoff
async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  config = RETRY_CONFIG
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Operation timeout')), config.timeout);
      });

      return await Promise.race([operation(), timeoutPromise]);
    } catch (error) {
      lastError = error as Error;

      if (attempt === config.maxRetries) break;

      // Calculate delay with exponential backoff
      const delay = Math.min(
        config.baseDelay * Math.pow(2, attempt),
        config.maxDelay
      );

      console.warn(`Attempt ${attempt + 1} failed, retrying in ${delay}ms:`, error.message);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}

// Generate ElevenLabs conversation token with retry
async function generateConversationToken(agentId: string, apiKey: string): Promise<string> {
  return retryWithBackoff(async () => {
    const tokenUrl = `https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=${agentId}`;

    const response = await fetch(tokenUrl, {
      method: 'GET',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('ElevenLabs token API error:', errorData);
      throw new ConversationError(
        ConversationErrorType.TOKEN_GENERATION_FAILED,
        `Failed to get ElevenLabs WebRTC token: ${response.status} ${response.statusText}`,
        response.status >= 500 // Retry on server errors
      );
    }

    const data = await response.json();

    if (!data.token) {
      throw new ConversationError(
        ConversationErrorType.TOKEN_GENERATION_FAILED,
        'No conversation token received from ElevenLabs',
        false
      );
    }

    return data.token;
  });
}

// Create conversation record for tracking and webhook correlation
async function createConversationRecord(
  supabase: any,
  sessionData: any,
  conversationToken: string
): Promise<any> {
  try {
    const conversationConfig = {
      agent_id: Deno.env.get('ELEVEN_AGENT_ID_IN_APP'),
      session_id: sessionData.id,
      household_id: sessionData.relatives.household_id,
      relative_id: sessionData.relatives.id,
      relative_name: `${sessionData.relatives.first_name} ${sessionData.relatives.last_name}`,
      call_type: 'in_app_call',
      device_call: true,
      dynamic_variables: {
        user_name: `${sessionData.relatives.first_name} ${sessionData.relatives.last_name}`,
        household_name: sessionData.households?.name || 'Your Family',
        session_context: 'in_app_scheduled_call',
        custom_instructions: `This is a scheduled call with ${sessionData.relatives.first_name}`,
        secret__household_id: sessionData.relatives.household_id,
        secret__relative_id: sessionData.relatives.id,
        secret__session_id: sessionData.id
      }
    };

    const { data: conversation, error: conversationError } = await supabase
      .from('conversations')
      .insert({
        session_id: conversationToken,
        user_id: sessionData.relatives.id,
        status: 'active',
        conversation_config: conversationConfig,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (conversationError) {
      console.error('Error creating conversation record:', conversationError);
      throw new ConversationError(
        ConversationErrorType.CONVERSATION_CREATION_FAILED,
        `Failed to create conversation record: ${conversationError.message}`,
        false
      );
    }

    return conversation;
  } catch (error) {
    if (error instanceof ConversationError) throw error;

    throw new ConversationError(
      ConversationErrorType.CONVERSATION_CREATION_FAILED,
      `Unexpected error creating conversation: ${error.message}`,
      false
    );
  }
}

// Broadcast real-time update to dashboard
async function broadcastToHousehold(
  supabase: any,
  householdId: string,
  eventType: string,
  payload: any
): Promise<void> {
  try {
    const channel = supabase.channel(`household:${householdId}`);
    await channel.send({
      type: 'broadcast',
      event: eventType,
      payload: {
        ...payload,
        timestamp: new Date().toISOString(),
        household_id: householdId
      }
    });

    console.log(`Broadcasted ${eventType} to household ${householdId}`);
  } catch (error) {
    console.warn('Failed to broadcast to household:', error.message);
    // Don't throw - broadcasting is non-critical
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = serviceClient();

    // Read request body once and destructure all needed fields
    const payload = await req.json();
    const {
      sessionId, action, pairingToken, deviceToken,
      callLogId, conversationId, conversationSummary, duration, outcome
    } = payload;

    if (!sessionId) {
      throw new ConversationError(
        ConversationErrorType.SESSION_NOT_FOUND,
        'sessionId is required',
        false
      );
    }

    console.log(`[ElevenLabs-Device-Call] Processing action: ${action} for session: ${sessionId}`);

    // Get session details with enhanced error handling
    const { data: session, error: sessionError } = await supabase
      .from('call_sessions')
      .select(`
        *,
        relatives (
          id,
          first_name,
          last_name,
          household_id,
          device_token
        ),
        households (
          id,
          name
        )
      `)
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      console.error('Session lookup error:', sessionError);
      throw new ConversationError(
        ConversationErrorType.SESSION_NOT_FOUND,
        `Session not found: ${sessionId}`,
        false
      );
    }

    // Enhanced device authentication
    let hasAccess = false;
    let authMethod = 'none';

    if (pairingToken) {
      const { data: devicePair, error: pairError } = await supabase
        .from('device_pairs')
        .select('household_id, relative_id, claimed_by')
        .eq('pair_token', pairingToken)
        .eq('household_id', session.relatives.household_id)
        .single();

      if (!pairError && devicePair) {
        hasAccess = true;
        authMethod = 'pairing_token';
        console.log(`Device authenticated via pairing token for household: ${session.relatives.household_id}`);
      }
    }

    if (!hasAccess && deviceToken) {
      // Check if device token matches the relative's device
      if (session.relatives.device_token === deviceToken) {
        hasAccess = true;
        authMethod = 'device_token';
        console.log(`Device authenticated via device token for relative: ${session.relatives.id}`);
      }
    }

    if (!hasAccess) {
      console.error(`Device authentication failed for session: ${sessionId}`, {
        hasPairingToken: !!pairingToken,
        hasDeviceToken: !!deviceToken,
        relativeDeviceToken: session.relatives.device_token
      });

      throw new ConversationError(
        ConversationErrorType.DEVICE_NOT_AUTHORIZED,
        'Device not authorized for this call - invalid pairing or device token',
        false
      );
    }

    // Validate environment configuration
    const elevenLabsApiKey = Deno.env.get('ELEVENLABS_API_KEY');
    const agentId = Deno.env.get('ELEVEN_AGENT_ID_IN_APP');

    if (!elevenLabsApiKey) {
      throw new ConversationError(
        ConversationErrorType.TOKEN_GENERATION_FAILED,
        'ELEVENLABS_API_KEY not configured',
        false
      );
    }
    if (!agentId) {
      throw new ConversationError(
        ConversationErrorType.TOKEN_GENERATION_FAILED,
        'ELEVEN_AGENT_ID_IN_APP not configured',
        false
      );
    }

    console.log(`[ElevenLabs-Device-Call] Session validated - Auth method: ${authMethod}`);

    if (action === 'start') {
      console.log(`[ElevenLabs-Device-Call] Starting WebRTC call for session: ${sessionId}`);

      // Generate conversation token with retry mechanism
      const conversationToken = await generateConversationToken(agentId, elevenLabsApiKey);

      console.log(`[ElevenLabs-Device-Call] Conversation token generated successfully`);

      // Create conversation record for tracking and webhook correlation
      const conversation = await createConversationRecord(supabase, session, conversationToken);

      console.log(`[ElevenLabs-Device-Call] Conversation record created: ${conversation.id}`);

      // Update session status with conversation tracking
      await supabase
        .from('call_sessions')
        .update({
          status: 'in_progress',
          started_at: new Date().toISOString(),
          provider_session_id: conversationToken
        })
        .eq('id', sessionId);

      // Create enhanced call log entry
      const { data: callLog, error: callLogError } = await supabase
        .from('call_logs')
        .insert({
          user_id: session.relatives.id,
          household_id: session.relatives.household_id,
          relative_id: session.relatives.id,
          call_outcome: 'in_progress',
          provider: 'elevenlabs',
          call_type: 'in_app_call',
          session_id: sessionId,
          provider_session_id: conversationToken,
          conversation_id: conversation.id,
          started_at: new Date().toISOString()
        })
        .select()
        .single();

      if (callLogError) {
        console.error('Error creating call log:', callLogError);
        throw new ConversationError(
          ConversationErrorType.CONVERSATION_CREATION_FAILED,
          `Failed to create call log: ${callLogError.message}`,
          false
        );
      }

      // Broadcast call started event to dashboard
      await broadcastToHousehold(
        supabase,
        session.relatives.household_id,
        'call_started',
        {
          relative_id: session.relatives.id,
          relative_name: `${session.relatives.first_name} ${session.relatives.last_name}`,
          session_id: sessionId,
          call_log_id: callLog.id,
          conversation_id: conversation.id,
          call_type: 'in_app_call'
        }
      );

      console.log(`[ElevenLabs-Device-Call] Call started successfully:`, {
        sessionId,
        conversationId: conversation.id,
        callLogId: callLog.id,
        relativeId: session.relatives.id,
        householdId: session.relatives.household_id
      });

      // Return enhanced response with dynamic variables for Flutter
      return new Response(JSON.stringify({
        success: true,
        sessionId,
        conversationToken,
        agentId,
        conversationId: conversation.id,
        callLogId: callLog.id,
        householdId: session.relatives.household_id,
        relativeId: session.relatives.id,
        relativeName: `${session.relatives.first_name} ${session.relatives.last_name}`,
        // Dynamic variables for ElevenLabs agent context
        dynamicVariables: conversation.conversation_config.dynamic_variables,
        // Webhook correlation metadata
        webhookMetadata: {
          conversation_id: conversation.id,
          call_log_id: callLog.id,
          household_id: session.relatives.household_id,
          relative_id: session.relatives.id,
          session_id: sessionId
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else if (action === 'update_conversation_id') {
      console.log(`[ElevenLabs-Device-Call] Updating conversation ID for session: ${sessionId}`);

      if (!callLogId || !conversationId) {
        throw new ConversationError(
          ConversationErrorType.WEBHOOK_CORRELATION_FAILED,
          'callLogId and conversationId are required for webhook correlation',
          false
        );
      }

      try {
        // Update multiple tables for proper webhook correlation
        await Promise.all([
          // Update call log with ElevenLabs conversation ID
          supabase
            .from('call_logs')
            .update({
              provider_call_id: conversationId,
              updated_at: new Date().toISOString()
            })
            .eq('id', callLogId),

          // Update call session
          supabase
            .from('call_sessions')
            .update({
              provider_session_id: conversationId,
              updated_at: new Date().toISOString()
            })
            .eq('id', sessionId),

          // Update conversation record for webhook correlation
          supabase
            .from('conversations')
            .update({
              status: 'active',
              updated_at: new Date().toISOString()
            })
            .eq('session_id', conversationId)
        ]);

        // Log conversation event for tracking
        await supabase
          .from('conversation_events')
          .insert({
            conversation_id: conversationId,
            event_type: 'conversation_started',
            event_data: {
              session_id: sessionId,
              call_log_id: callLogId,
              relative_id: session.relatives.id,
              household_id: session.relatives.household_id,
              started_at: new Date().toISOString()
            },
            sequence_number: 1
          });

        // Broadcast conversation started event
        await broadcastToHousehold(
          supabase,
          session.relatives.household_id,
          'conversation_connected',
          {
            relative_id: session.relatives.id,
            session_id: sessionId,
            conversation_id: conversationId,
            call_log_id: callLogId
          }
        );

        console.log(`[ElevenLabs-Device-Call] Conversation ID updated successfully: ${conversationId}`);

        return new Response(JSON.stringify({
          success: true,
          sessionId,
          callLogId,
          conversationId,
          message: 'Conversation ID updated and webhook correlation established'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      } catch (error) {
        console.error('Error updating conversation ID:', error);
        throw new ConversationError(
          ConversationErrorType.WEBHOOK_CORRELATION_FAILED,
          `Failed to update conversation ID: ${error.message}`,
          true
        );
      }

    } else if (action === 'end') {
      console.log(`[ElevenLabs-Device-Call] Ending WebRTC call for session: ${sessionId}`);

      const endTime = new Date().toISOString();
      const finalOutcome = outcome || 'completed';

      try {
        // Update session status
        await supabase
          .from('call_sessions')
          .update({
            status: 'completed',
            ended_at: endTime,
            duration_seconds: duration,
            summary: conversationSummary,
            updated_at: endTime
          })
          .eq('id', sessionId);

        // Get call log for this session
        const { data: callLogs, error: callLogFetchError } = await supabase
          .from('call_logs')
          .select('id, provider_call_id, conversation_id')
          .eq('session_id', sessionId)
          .eq('provider', 'elevenlabs');

        if (callLogFetchError) {
          console.error('Error fetching call logs:', callLogFetchError);
          throw new ConversationError(
            ConversationErrorType.CONVERSATION_CREATION_FAILED,
            `Failed to fetch call logs: ${callLogFetchError.message}`,
            false
          );
        }

        if (callLogs && callLogs.length > 0) {
          const callLog = callLogs[0];

          // Update call log with completion data
          await supabase
            .from('call_logs')
            .update({
              call_outcome: finalOutcome,
              call_duration: duration,
              conversation_summary: conversationSummary,
              ended_at: endTime,
              updated_at: endTime
            })
            .eq('id', callLog.id);

          // Update conversation status
          if (callLog.provider_call_id) {
            await Promise.all([
              // Update conversations table
              supabase
                .from('conversations')
                .update({
                  status: 'completed',
                  ended_at: endTime,
                  updated_at: endTime
                })
                .eq('session_id', callLog.provider_call_id),

              // Log conversation end event
              supabase
                .from('conversation_events')
                .insert({
                  conversation_id: callLog.provider_call_id,
                  event_type: 'conversation_ended',
                  event_data: {
                    session_id: sessionId,
                    call_log_id: callLog.id,
                    duration_seconds: duration,
                    outcome: finalOutcome,
                    summary: conversationSummary,
                    ended_at: endTime
                  },
                  sequence_number: 999 // High number to indicate end
                })
            ]);
          }

          // Create enhanced conversation summary for family dashboard
          if (conversationSummary) {
            await supabase
              .from('call_summaries')
              .insert({
                call_log_id: callLog.id,
                household_id: session.relatives.household_id,
                relative_id: session.relatives.id,
                provider_call_id: callLog.provider_call_id,
                summary_text: conversationSummary,
                mood_score: 7, // Default positive score, will be updated by AI analysis
                key_topics: [],
                action_items: [],
                health_indicators: {},
                escalation_needed: false,
                created_at: endTime
              });
          }

          // Broadcast call completion to dashboard
          await broadcastToHousehold(
            supabase,
            session.relatives.household_id,
            'call_completed',
            {
              relative_id: session.relatives.id,
              relative_name: `${session.relatives.first_name} ${session.relatives.last_name}`,
              session_id: sessionId,
              call_log_id: callLog.id,
              conversation_id: callLog.conversation_id,
              duration_seconds: duration,
              outcome: finalOutcome,
              summary: conversationSummary,
              ended_at: endTime
            }
          );

          console.log(`[ElevenLabs-Device-Call] Call ended successfully:`, {
            sessionId,
            callLogId: callLog.id,
            conversationId: callLog.provider_call_id,
            duration,
            outcome: finalOutcome
          });

          return new Response(JSON.stringify({
            success: true,
            sessionId,
            callLogId: callLog.id,
            conversationId: callLog.provider_call_id,
            outcome: finalOutcome,
            duration,
            summary: conversationSummary,
            message: 'Call ended successfully and data processed'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });

        } else {
          // No call log found - still mark as successful
          console.warn(`No call log found for session: ${sessionId}`);

          return new Response(JSON.stringify({
            success: true,
            sessionId,
            outcome: finalOutcome,
            duration,
            message: 'Session ended (no call log found)'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

      } catch (error) {
        console.error('Error ending call:', error);
        throw new ConversationError(
          ConversationErrorType.CONVERSATION_CREATION_FAILED,
          `Failed to end call properly: ${error.message}`,
          true
        );
      }

    } else {
      throw new ConversationError(
        ConversationErrorType.CONVERSATION_CREATION_FAILED,
        `Invalid action: ${action}. Supported actions: start, update_conversation_id, end`,
        false
      );
    }

  } catch (error) {
    console.error(`[ElevenLabs-Device-Call] Error processing request:`, {
      error: error.message,
      type: error instanceof ConversationError ? error.type : 'UNKNOWN_ERROR',
      retryable: error instanceof ConversationError ? error.retryable : false,
      action: (await req.json())?.action || 'unknown'
    });

    // Enhanced error response based on error type
    if (error instanceof ConversationError) {
      const statusCode = getStatusCodeForError(error.type);

      return new Response(JSON.stringify({
        success: false,
        error: error.type,
        message: error.message,
        retryable: error.retryable,
        timestamp: new Date().toISOString()
      }), {
        status: statusCode,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fallback for unexpected errors
    return new Response(JSON.stringify({
      success: false,
      error: 'OPERATION_FAILED',
      message: 'An unexpected error occurred during call processing',
      retryable: true,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Map error types to HTTP status codes
function getStatusCodeForError(errorType: ConversationErrorType): number {
  switch (errorType) {
    case ConversationErrorType.DEVICE_NOT_AUTHORIZED:
      return 403;
    case ConversationErrorType.SESSION_NOT_FOUND:
      return 404;
    case ConversationErrorType.TOKEN_GENERATION_FAILED:
      return 503; // Service Unavailable
    case ConversationErrorType.NETWORK_ERROR:
      return 502; // Bad Gateway
    case ConversationErrorType.CONVERSATION_CREATION_FAILED:
    case ConversationErrorType.WEBHOOK_CORRELATION_FAILED:
      return 500; // Internal Server Error
    default:
      return 500;
  }
}