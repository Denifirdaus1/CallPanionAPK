import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    console.log('ElevenLabs call function called - this function is deprecated');
    console.log('Calls are now handled through batch calling in schedulerDailyCalls function');
    
    return new Response(JSON.stringify({
      success: false,
      error: 'This function is deprecated. Calls are now handled through scheduled batch calling.',
      message: 'Please use the scheduled batch calling system instead.'
    }), {
      status: 410, // Gone
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in elevenlabs-call function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});