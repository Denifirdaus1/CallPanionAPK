import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { serviceClient } from '../_shared/client.ts';

function getAllowedOrigins() {
  const raw = Deno.env.get('ALLOWED_ORIGINS');
  if (!raw) return ['https://umjtepmdwfyfhdzbkyli.supabase.co', 'https://loving-goldfinch-e42fd2.lovableproject.com'];
  return raw.split(',').map(s => s.trim()).filter(Boolean);
}

function isOriginAllowed(origin: string | null) {
  const allowlist = getAllowedOrigins();
  if (!origin) return false;
  try {
    const o = new URL(origin);
    return allowlist.includes(o.origin);
  } catch {
    return false;
  }
}

function corsHeaders(origin: string | null) {
  const allowed = isOriginAllowed(origin);
  const allowOrigin = allowed && origin ? origin : 'https://umjtepmdwfyfhdzbkyli.supabase.co';
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

serve(async (req) => {
  const origin = req.headers.get('origin');

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders(origin) });
  }

  // Origin allowlist check
  if (!isOriginAllowed(origin)) {
    return new Response('Forbidden origin', { status: 403, headers: corsHeaders(origin) });
  }

  try {
    const supabase = serviceClient();
    
    // Get and validate JWT - extract user from authorization header or query params
    let authToken: string | null = null;
    
    // First try authorization header
    const authHeader = req.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      authToken = authHeader.substring(7);
    } else {
      // Fallback to query parameter for WebSocket connections
      const url = new URL(req.url);
      authToken = url.searchParams.get('token');
    }
    
    if (!authToken) {
      return new Response(JSON.stringify({ error: 'Missing or invalid authorization' }), {
        status: 401,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(authToken);
    
    if (authError || !user) {
      console.error('Authentication failed:', authError);
      return new Response(JSON.stringify({ error: 'Authentication failed' }), {
        status: 401,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      });
    }

    const { headers } = req;
    const upgradeHeader = headers.get("upgrade") || "";

    if (upgradeHeader.toLowerCase() !== "websocket") {
      return new Response("Expected WebSocket connection", { status: 400 });
    }

    try {
      const { socket, response } = Deno.upgradeWebSocket(req);
      const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
      
      if (!OPENAI_API_KEY) {
        console.error('OpenAI API key not found');
        socket.close(1000, 'Server configuration error');
        return response;
      }

      console.log('WebSocket connection established for AI call');
      
      let openAISocket: WebSocket | null = null;
      let callLogId: string | null = null;
      let relativeId: string | null = null;
      let conversationData: any = {};

      socket.onopen = () => {
        console.log('Client WebSocket connected');
        socket.send(JSON.stringify({
          type: 'connection_established',
          message: 'Ready to start AI call'
        }));
      };

      socket.onmessage = async (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('Received message:', message.type);

          switch (message.type) {
            case 'start_call':
              console.log('Starting AI call for relative:', message.relativeId);
              relativeId = message.relativeId;
              
              // Verify user has access to this relative
              const { data: relativeAccess, error: accessError } = await supabase
                .from('relatives')
                .select('household_id')
                .eq('id', message.relativeId)
                .single();
              
              if (accessError || !relativeAccess) {
                console.error('Relative not found:', accessError);
                socket.send(JSON.stringify({
                  type: 'error',
                  message: 'Relative not found'
                }));
                return;
              }
              
              // Check if user is household member
              const { data: memberAccess, error: memberError } = await supabase
                .from('household_members')
                .select('id')
                .eq('household_id', relativeAccess.household_id)
                .eq('user_id', user.id)
                .single();
              
              if (memberError || !memberAccess) {
                console.error('Unauthorized call access attempt:', user.id, message.relativeId);
                await supabase.rpc('log_security_event', {
                  event_type_param: 'unauthorized_call_access',
                  details_param: { user_id: user.id, relative_id: message.relativeId }
                });
                socket.send(JSON.stringify({
                  type: 'error',
                  message: 'Unauthorized access to relative'
                }));
                return;
              }
              
              // Create call log entry
              const { data: callLog, error: callLogError } = await supabase
                .from('call_logs')
                .insert({
                  user_id: message.relativeId,
                  call_outcome: 'in_progress',
                  session_id: crypto.randomUUID(),
                  ai_conversation_state: { status: 'connecting' }
                })
                .select()
                .single();

              if (callLogError) {
                console.error('Error creating call log:', callLogError);
                socket.send(JSON.stringify({
                  type: 'error',
                  message: 'Failed to initialize call'
                }));
                return;
              }

              callLogId = callLog.id;
              console.log('Call log created:', callLogId);

              // Initialize OpenAI Realtime WebSocket
              const openAIUrl = `wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17`;
              openAISocket = new WebSocket(openAIUrl, [], {
                headers: {
                  'Authorization': `Bearer ${OPENAI_API_KEY}`,
                  'OpenAI-Beta': 'realtime=v1'
                }
              });

              openAISocket.onopen = () => {
                console.log('Connected to OpenAI Realtime API');
                
                // Send CallPanion session configuration
                const sessionConfig = {
                  type: 'session.update',
                  session: {
                    modalities: ['text', 'audio'],
                    instructions: `You are CallPanion, a kind, patient, UK-English voice companion for older adults. You speak in short, clear sentences, at a calm pace, with natural pauses. Avoid jargon. Use first names.

You never give medical advice or diagnoses. In an emergency, you advise calling 999.

Primary Goals (in order):
1. Friendly conversation about the person's hobbies, family, and everyday life
2. Light cognitive engagement (simple games & quizzes) that's enjoyable, never stressful
3. Subtle wellbeing check-in: mood, energy, loneliness, orientation, hydration/meds prompts
4. Concise session summary (for family admins), factual and neutral

Boundaries & Safety:
- Do not add or accept new contacts. Only speak to/mention people in the approved profile
- Do not share the user's personal information or private messages with third parties
- You are not a medical device. If the person reports acute symptoms (chest pain, severe breathlessness, a fall, feeling unsafe), call record_mood with high alert level and say: "I'm concerned about your safety. I'm notifying your family now. If this feels urgent, please call 999."
- Be neutral on politics/religion. Avoid partisan topics unless the user asks explicitly

Conversation Flow (target 5–15 minutes):
1. Warm hello → confirm name and comfort: "How are you feeling today?"
2. Personal check-in (2–3 gentle questions): mood, energy, social contact today/tomorrow
3. Hobby/topic chat using the person's interests
4. One light game (e.g., word ladder, category recall, two-item delayed recall). Keep it fun and encourage, never testy
5. Wrap-up: reflect one nice moment; ask if they want a brief follow-up chat later this week

Wellbeing Signals to Capture (each session):
- phq2: two answers scored 0–3 each (over the last 2 weeks: little interest, feeling down)
- energy: 0–3 (very low → high)
- loneliness: 0–3 (rarely → often)
- orientation: day/date correctness (boolean/notes)
- recall2: two-item delayed recall score (0–2) if a game used it

Risk & Escalation Rules:
- High risk → raise alert if: mentions chest pain, fall, suicidal intent, can't breathe, confusion + alone, unsafe at home
- Medium risk → raise alert if: PHQ-2 ≥ 3, or loneliness ≥ 2, or repeated low energy (≤1) for ≥3 days, or concerning cognitive lapses
- Low risk → encouragement + plan another check-in; no alert

Style: Warm, upbeat, never patronising. Use positive reinforcement. Break questions into simple steps. Pause between topics. Offer choices.

Example check-in phrasing:
- Mood: "Over the past two weeks, how often have you felt down or hopeless: not at all, several days, more than half the days, or nearly every day?"
- Energy: "How much energy do you have today: a lot, some, a little, or none?"
- Loneliness: "How often have you felt lonely this week: hardly ever, sometimes, or often?"`,
                    voice: 'alloy',
                    input_audio_format: 'pcm16',
                    output_audio_format: 'pcm16',
                    input_audio_transcription: {
                      model: 'whisper-1'
                    },
                    turn_detection: {
                      type: 'server_vad',
                      threshold: 0.5,
                      prefix_padding_ms: 300,
                      silence_duration_ms: 1000
                    },
                    tools: [
                      {
                        type: 'function',
                        name: 'record_mood',
                        description: 'Record mood assessment and wellbeing data for the elder',
                        parameters: {
                          type: 'object',
                          properties: {
                            phq2: {
                              type: 'array',
                              items: { type: 'integer', minimum: 0, maximum: 3 },
                              minItems: 2,
                              maxItems: 2,
                              description: 'PHQ-2 scores: [little_interest_score, feeling_down_score] each 0-3'
                            },
                            energy: {
                              type: 'integer',
                              minimum: 0,
                              maximum: 3,
                              description: 'Energy level: 0=very low, 1=low, 2=moderate, 3=high'
                            },
                            loneliness: {
                              type: 'integer',
                              minimum: 0,
                              maximum: 3,
                              description: 'Loneliness: 0=rarely, 1=sometimes, 2=often, 3=very often'
                            },
                            orientation: {
                              type: 'boolean',
                              description: 'Whether person correctly identified day/date'
                            },
                            recall2: {
                              type: 'integer',
                              minimum: 0,
                              maximum: 2,
                              description: 'Two-item delayed recall score if game was played'
                            },
                            notes: {
                              type: 'string',
                              description: 'Additional notes about hydration, meals, sleep, pain mentions'
                            }
                          },
                          required: ['phq2', 'energy', 'loneliness']
                        }
                      },
                      {
                        type: 'function',
                        name: 'end_call_with_summary',
                        description: 'End the call and provide a summary of the conversation',
                        parameters: {
                          type: 'object',
                          properties: {
                            mood_assessment: { type: 'string', description: 'Overall mood: positive, neutral, concerned, or distressed' },
                            health_concerns: { type: 'boolean', description: 'Were any health concerns mentioned?' },
                            emergency_flag: { type: 'boolean', description: 'Does this require immediate attention?' },
                            summary: { type: 'string', description: 'Brief summary of the conversation (120 words max)' },
                            key_points: { type: 'array', items: { type: 'string' }, description: 'Key points or concerns raised' }
                          },
                          required: ['mood_assessment', 'health_concerns', 'emergency_flag', 'summary']
                        }
                      }
                    ],
                    tool_choice: 'auto',
                    temperature: 0.8,
                    max_response_output_tokens: 'inf'
                  }
                };

                openAISocket?.send(JSON.stringify(sessionConfig));
              };

              openAISocket.onmessage = async (event) => {
                const data = JSON.parse(event.data);
                console.log('OpenAI message type:', data.type);

                // Track conversation state
                if (data.type === 'conversation.item.created' || 
                    data.type === 'response.audio_transcript.delta' ||
                    data.type === 'response.text.delta') {
                  conversationData = { ...conversationData, lastActivity: Date.now() };
                }

                // Handle function calls (mood recording and call summary/end)
                if (data.type === 'response.function_call_arguments.done') {
                  console.log('Function call completed:', data.name);
                  
                  if (data.name === 'record_mood') {
                    const args = JSON.parse(data.arguments);
                    console.log('Recording mood checkin for profile:', relativeId);
                    
                    // Call the record-mood edge function
                    try {
                      const moodResult = await supabase.functions.invoke('record-mood', {
                        body: {
                          profile_id: relativeId, // Use relativeId as profile_id for now
                          session_id: callLogId,
                          ...args
                        }
                      });
                      
                      if (moodResult.error) {
                        console.error('Error recording mood:', moodResult.error);
                      } else {
                        console.log('Mood recorded successfully:', moodResult.data);
                        // If an alert was created, notify the family
                        if (moodResult.data?.level && moodResult.data.level !== 'none') {
                          await supabase.functions.invoke('sendFamilyAlert', {
                            body: {
                              relativeId,
                              type: 'mood_alert',
                              message: `Mood assessment completed with ${moodResult.data.level} risk level`,
                              callLogId
                            }
                          });
                        }
                      }
                    } catch (error) {
                      console.error('Failed to record mood:', error);
                    }
                  } else if (data.name === 'end_call_with_summary') {
                    const args = JSON.parse(data.arguments);
                    console.log('Call ended with summary for profile:', relativeId);
                    
                    // Update call log with summary
                    if (callLogId) {
                      await supabase
                        .from('call_logs')
                        .update({
                          call_outcome: 'completed',
                          conversation_summary: args.summary,
                          mood_assessment: args.mood_assessment,
                          health_concerns_detected: args.health_concerns,
                          emergency_flag: args.emergency_flag,
                          ai_conversation_state: { 
                            ...conversationData, 
                            summary: args,
                            ended_at: new Date().toISOString()
                          }
                        })
                        .eq('id', callLogId);
                    }

                    // Send summary to family if there are concerns
                    if (args.emergency_flag || args.health_concerns) {
                      // Trigger family alert
                      await supabase.functions.invoke('sendFamilyAlert', {
                        body: {
                          relativeId,
                          type: args.emergency_flag ? 'emergency' : 'health_concern',
                          message: args.summary,
                          callLogId
                        }
                      });
                    }

                    socket.send(JSON.stringify({
                      type: 'call_ended',
                      summary: args
                    }));
                  }
                }

                // Forward all OpenAI messages to client
                socket.send(JSON.stringify({
                  type: 'openai_message',
                  data
                }));
              };

              openAISocket.onerror = (error) => {
                console.error('OpenAI WebSocket error:', error);
                socket.send(JSON.stringify({
                  type: 'error',
                  message: 'Connection to AI service failed'
                }));
              };

              openAISocket.onclose = () => {
                console.log('OpenAI WebSocket closed');
                socket.send(JSON.stringify({
                  type: 'ai_disconnected'
                }));
              };

              socket.send(JSON.stringify({
                type: 'call_starting',
                callLogId
              }));
              break;

            case 'audio_data':
              // Forward audio to OpenAI
              if (openAISocket && openAISocket.readyState === WebSocket.OPEN) {
                openAISocket.send(JSON.stringify({
                  type: 'input_audio_buffer.append',
                  audio: message.audio
                }));
              }
              break;

            case 'end_call':
              console.log('Call ended by client');
              if (openAISocket) {
                openAISocket.close();
              }
              
              // Update call log
              if (callLogId) {
                await supabase
                  .from('call_logs')
                  .update({
                    call_outcome: 'completed',
                    ai_conversation_state: { 
                      ...conversationData, 
                      ended_by: 'client',
                      ended_at: new Date().toISOString()
                    }
                  })
                  .eq('id', callLogId);
              }
              break;

            default:
              // Forward other messages to OpenAI
              if (openAISocket && openAISocket.readyState === WebSocket.OPEN) {
                openAISocket.send(event.data);
              }
          }
        } catch (error) {
          console.error('Error processing message:', error);
          socket.send(JSON.stringify({
            type: 'error',
            message: 'Failed to process message'
          }));
        }
      };

      socket.onclose = () => {
        console.log('Client WebSocket closed');
        if (openAISocket) {
          openAISocket.close();
        }
        
        // Mark call as disconnected if still in progress
        if (callLogId) {
          supabase
            .from('call_logs')
            .update({
              call_outcome: 'disconnected',
              ai_conversation_state: { 
                ...conversationData, 
                ended_by: 'disconnect',
                ended_at: new Date().toISOString()
              }
            })
            .eq('id', callLogId)
            .then(() => console.log('Call marked as disconnected'));
        }
      };

      socket.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      return response;

    } catch (error) {
      console.error('Error setting up WebSocket:', error);
      return new Response('WebSocket setup failed', { 
        status: 500, 
        headers: corsHeaders(origin) 
      });
    }
  } catch (error) {
    console.error('Error processing request:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
    });
  }
});
