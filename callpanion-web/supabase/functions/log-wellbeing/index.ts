import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { serviceClient } from "../_shared/client.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { relative_id, mood_rating, energy_level, pain_level, sleep_quality, notes } = await req.json();

    console.log('Logging wellbeing for relative:', { relative_id, mood_rating, energy_level });

    if (!relative_id) {
      throw new Error('relative_id is required');
    }

    const supabase = serviceClient();

    // Insert wellbeing log
    const { data, error } = await supabase
      .from('wellbeing_logs')
      .insert({
        relative_id,
        mood_rating,
        energy_level,
        pain_level,
        sleep_quality,
        notes,
        logged_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Error inserting wellbeing log:', error);
      throw error;
    }

    console.log('Wellbeing logged successfully:', data.id);

    return new Response(JSON.stringify({
      success: true,
      id: data.id,
      message: 'Wellbeing logged successfully'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in log-wellbeing:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});