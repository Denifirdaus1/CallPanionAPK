import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.54.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    console.log("Starting audio data migration...");

    // Get webhook events that have full_audio but corresponding call_summaries don't have audio_base64
    const { data: webhookEvents, error: webhookError } = await supabase
      .from('webhook_events')
      .select('id, provider_call_id, payload')
      .not('payload->data->full_audio', 'is', null);

    if (webhookError) {
      throw new Error(`Failed to fetch webhook events: ${webhookError.message}`);
    }

    console.log(`Found ${webhookEvents?.length || 0} webhook events with audio`);

    let migratedCount = 0;
    let skippedCount = 0;

    for (const event of webhookEvents || []) {
      const fullAudio = event.payload?.data?.full_audio;
      
      if (!fullAudio || !event.provider_call_id) {
        skippedCount++;
        continue;
      }

      // Check if call_summary already has audio_base64
      const { data: existing } = await supabase
        .from('call_summaries')
        .select('id, key_points')
        .eq('provider_call_id', event.provider_call_id)
        .single();

      if (!existing) {
        console.log(`No call_summary found for ${event.provider_call_id}`);
        skippedCount++;
        continue;
      }

      // Skip if already has audio
      if (existing.key_points?.audio_base64) {
        console.log(`Audio already exists for ${event.provider_call_id}`);
        skippedCount++;
        continue;
      }

      // Update call_summary with audio data
      const updatedKeyPoints = {
        ...existing.key_points,
        audio_base64: fullAudio
      };

      const { error: updateError } = await supabase
        .from('call_summaries')
        .update({ key_points: updatedKeyPoints })
        .eq('provider_call_id', event.provider_call_id);

      if (updateError) {
        console.error(`Failed to update ${event.provider_call_id}:`, updateError);
        continue;
      }

      console.log(`Migrated audio for ${event.provider_call_id}`);
      migratedCount++;
    }

    const result = {
      success: true,
      migrated: migratedCount,
      skipped: skippedCount,
      total: webhookEvents?.length || 0
    };

    console.log("Migration completed:", result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Migration error:', error);
    
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});