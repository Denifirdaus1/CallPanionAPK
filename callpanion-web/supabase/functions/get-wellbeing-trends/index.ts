import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
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
    const { relative_id, days = 7 } = await req.json();

    console.log('Getting wellbeing trends for relative:', { relative_id, days });

    if (!relative_id) {
      throw new Error('relative_id is required');
    }

    const supabase = serviceClient();

    // Get recent wellbeing logs
    const { data: logs, error } = await supabase
      .from('wellbeing_logs')
      .select('*')
      .eq('relative_id', relative_id)
      .gte('logged_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
      .order('logged_at', { ascending: false });

    if (error) {
      console.error('Error fetching wellbeing logs:', error);
      throw error;
    }

    // Calculate trends and averages
    const totalLogs = logs.length;
    
    if (totalLogs === 0) {
      return new Response(JSON.stringify({
        success: true,
        summary: 'No recent wellbeing data available',
        total_entries: 0,
        trends: {}
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const averages = {
      mood: logs.reduce((sum, log) => sum + (log.mood_rating || 0), 0) / totalLogs,
      energy: logs.reduce((sum, log) => sum + (log.energy_level || 0), 0) / totalLogs,
      pain: logs.reduce((sum, log) => sum + (log.pain_level || 0), 0) / totalLogs,
      sleep: logs.reduce((sum, log) => sum + (log.sleep_quality || 0), 0) / totalLogs
    };

    // Generate summary based on trends
    let summary = '';
    if (averages.mood >= 7) summary += 'Mood has been good. ';
    else if (averages.mood <= 4) summary += 'Mood has been concerning. ';
    
    if (averages.energy >= 7) summary += 'Energy levels are healthy. ';
    else if (averages.energy <= 4) summary += 'Energy levels are low. ';
    
    if (averages.pain >= 6) summary += 'Pain levels are high and need attention. ';
    
    if (averages.sleep <= 2) summary += 'Sleep quality has been poor. ';

    if (!summary) summary = 'Overall wellbeing appears stable.';

    console.log('Wellbeing trends calculated:', { averages, totalLogs });

    return new Response(JSON.stringify({
      success: true,
      summary: summary.trim(),
      total_entries: totalLogs,
      period_days: days,
      averages: {
        mood_rating: Math.round(averages.mood * 10) / 10,
        energy_level: Math.round(averages.energy * 10) / 10,
        pain_level: Math.round(averages.pain * 10) / 10,
        sleep_quality: Math.round(averages.sleep * 10) / 10
      },
      recent_logs: logs.slice(0, 5) // Latest 5 entries
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in get-wellbeing-trends:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});