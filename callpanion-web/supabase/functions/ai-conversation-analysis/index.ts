import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { serviceClient } from '../_shared/client.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = serviceClient();
    const { sessionId, transcript, relativeId, analysisType } = await req.json();

    if (!transcript || !sessionId) {
      throw new Error('Missing required fields: transcript, sessionId');
    }

    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Analyze conversation with GPT for health and wellbeing insights
    const analysisPrompt = `
You are a healthcare AI assistant analyzing a conversation between an elderly person and their AI companion. 

Conversation transcript:
"${transcript}"

Analyze this conversation and provide a JSON response with the following structure:
{
  "mood_score": (1-10, where 1=very sad, 10=very happy),
  "health_concerns": ["concern1", "concern2"],
  "wellbeing_indicators": {
    "social_engagement": (1-10),
    "cognitive_clarity": (1-10),
    "physical_comfort": (1-10)
  },
  "key_topics": ["topic1", "topic2"],
  "summary": "Brief summary of the conversation",
  "alerts": ["urgent_alert1"] // only if serious concerns detected
}

Focus on:
- Emotional tone and mood
- Mentions of pain, discomfort, or health issues
- Social isolation or loneliness indicators
- Cognitive function and clarity
- Daily activity levels
- Any urgent concerns requiring family notification
`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { 
            role: 'system', 
            content: 'You are a healthcare AI that analyzes elderly conversations for wellbeing insights. Always respond with valid JSON.' 
          },
          { role: 'user', content: analysisPrompt }
        ],
        temperature: 0.3,
        max_tokens: 1000
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const analysisText = aiResponse.choices[0]?.message?.content;

    let analysis;
    try {
      analysis = JSON.parse(analysisText);
    } catch (parseError) {
      console.error('Failed to parse AI analysis:', analysisText);
      // Fallback analysis
      analysis = {
        mood_score: 5,
        health_concerns: [],
        wellbeing_indicators: {
          social_engagement: 5,
          cognitive_clarity: 5,
          physical_comfort: 5
        },
        key_topics: ['general conversation'],
        summary: 'Conversation analysis failed, manual review may be needed',
        alerts: []
      };
    }

    // Store analysis in database
    const { error: analysisError } = await supabase
      .from('call_analysis')
      .insert({
        call_log_id: null, // Will be linked later when call log is created
        user_id: relativeId,
        transcript: transcript,
        summary: analysis.summary,
        mood_score: analysis.mood_score,
        health_flag: analysis.health_concerns.length > 0,
        urgent_flag: analysis.alerts && analysis.alerts.length > 0
      });

    if (analysisError) {
      console.error('Failed to store analysis:', analysisError);
    }

    // Create detailed insights record for dashboard
    const { error: insightError } = await supabase
      .from('conversation_insights')
      .insert({
        session_id: sessionId,
        relative_id: relativeId,
        analysis_type: analysisType || 'wellbeing_check',
        mood_score: analysis.mood_score,
        wellbeing_indicators: analysis.wellbeing_indicators,
        health_concerns: analysis.health_concerns,
        key_topics: analysis.key_topics,
        alerts: analysis.alerts || [],
        raw_analysis: analysis,
        transcript_summary: analysis.summary
      });

    if (insightError) {
      console.error('Failed to store insights:', insightError);
    }

    // If there are urgent alerts, notify family
    if (analysis.alerts && analysis.alerts.length > 0) {
      try {
        await supabase.functions.invoke('notify-family', {
          body: {
            relativeId,
            alertType: 'health_concern',
            message: `Urgent concern detected in conversation: ${analysis.alerts.join(', ')}`,
            conversationSummary: analysis.summary
          }
        });
      } catch (alertError) {
        console.error('Failed to send family alert:', alertError);
      }
    }

    console.log('Conversation analysis completed:', {
      sessionId,
      mood_score: analysis.mood_score,
      health_concerns: analysis.health_concerns.length,
      alerts: analysis.alerts?.length || 0
    });

    return new Response(JSON.stringify({
      success: true,
      analysis: analysis,
      insights_stored: !insightError,
      alerts_sent: analysis.alerts?.length > 0
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in ai-conversation-analysis function:', error);
    return new Response(JSON.stringify({ 
      error: 'analysis_failed',
      message: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});