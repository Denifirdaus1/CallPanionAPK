// /functions/record-mood/index.ts
// Receives JSON { profile_id, session_id?, phq2:[n,n], energy, loneliness, orientation, recall2, notes }
// Writes to companion_mood_checkins and conditionally to companion_alerts.

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface Payload {
  profile_id: string;
  session_id?: string;
  phq2: [number, number];
  energy: number;        // 0–3
  loneliness: number;    // 0–3
  orientation?: boolean; // true if correct date/day
  recall2?: number;      // 0–2
  notes?: string;
}

function getAllowedOrigins() {
  const raw = Deno.env.get('ALLOWED_ORIGINS');
  if (!raw) return ['https://umjtepmdwfyfhdzbkyli.supabase.co', 'https://loving-goldfinch-e42fd2.lovableproject.com'];
  return raw.split(',').map(s => s.trim()).filter(Boolean);
}

function isOriginAllowed(origin: string | null) {
  if (!origin) return false;
  const allowlist = getAllowedOrigins();
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
  };
}

function bad(msg: string, code = 400) {
  return new Response(JSON.stringify({ error: msg }), { 
    status: code, 
    headers: { ...corsHeaders(null), "Content-Type": "application/json" }
  });
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders(origin) });
  }
  
  // Origin validation for enhanced security
  if (!isOriginAllowed(origin)) {
    return new Response(JSON.stringify({ error: 'Forbidden origin' }), {
      status: 403,
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' }
    });
  }

  if (req.method !== 'POST') return bad('Use POST');

  let body: Payload;
  try { 
    body = await req.json(); 
  } catch { 
    return bad('Invalid JSON'); 
  }

  const { 
    profile_id, 
    session_id, 
    phq2, 
    energy, 
    loneliness, 
    orientation = null, 
    recall2 = null, 
    notes = '' 
  } = body;

  // Validation
  if (!profile_id) return bad('profile_id required');
  if (!Array.isArray(phq2) || phq2.length !== 2) return bad('phq2 must be [n,n]');

  const inRange = (n: number, min: number, max: number) => Number.isInteger(n) && n >= min && n <= max;
  if (!inRange(phq2[0], 0, 3) || !inRange(phq2[1], 0, 3)) return bad('phq2 values 0–3');
  if (!inRange(energy, 0, 3)) return bad('energy 0–3');
  if (!inRange(loneliness, 0, 3)) return bad('loneliness 0–3');
  if (recall2 !== null && !inRange(recall2, 0, 2)) return bad('recall2 0–2');

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    return bad('Server configuration error', 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    // Compute an overall score (0–10) — simple transparent logic for MVP
    const phq2sum = phq2[0] + phq2[1];      // 0–6
    const score = Math.min(10, phq2sum * 1 + energy * 1 + loneliness * 1 + (recall2 ?? 1));

    console.log('Recording mood checkin:', { profile_id, phq2sum, energy, loneliness, score });

    // Insert mood_checkin
    const { data: inserted, error: insErr } = await supabase
      .from('companion_mood_checkins')
      .insert({
        profile_id,
        session_id: session_id ?? null,
        phq2,
        energy,
        loneliness,
        orientation,
        recall2,
        notes,
        overall_score: score
      })
      .select('id, ts');

    if (insErr) {
      console.error('Insert error:', insErr);
      return bad(`insert failed: ${insErr.message}`, 500);
    }

    const id = inserted?.[0]?.id;
    console.log('Mood checkin recorded with ID:', id);

    // Determine risk level
    let level: 'low' | 'medium' | 'high' | null = null;
    let message = '';

    if (phq2sum >= 3 || loneliness >= 2 || energy <= 1) {
      level = 'medium';
      message = `Mood flags — PHQ2=${phq2sum}, energy=${energy}, loneliness=${loneliness}.`;
      console.log('Medium risk detected:', message);
    }

    // Optional: look back 2 days for persistent low energy
    const sinceISO = new Date(Date.now() - 2*24*60*60*1000).toISOString();
    const { data: recent, error: recErr } = await supabase
      .from('companion_mood_checkins')
      .select('energy, ts')
      .gte('ts', sinceISO)
      .eq('profile_id', profile_id)
      .order('ts', { ascending: false })
      .limit(3);

    if (!recErr && recent) {
      const lows = recent.filter(r => (r.energy ?? 3) <= 1).length;
      if (lows >= 2) {
        level = 'medium';
        message = message ? `${message} Persistent low energy.` : 'Persistent low energy.';
        console.log('Persistent low energy detected');
      }
    }

    let alertId: string | null = null;
    if (level) {
      console.log('Creating alert:', { level, message });
      const { data: a, error: aErr } = await supabase
        .from('companion_alerts')
        .insert({ profile_id, level, message })
        .select('id');
      
      if (!aErr) {
        alertId = a?.[0]?.id ?? null;
        console.log('Alert created with ID:', alertId);
      } else {
        console.error('Alert creation error:', aErr);
      }
    }

    return new Response(JSON.stringify({ 
      ok: true, 
      id, 
      alertId, 
      level: level ?? 'none' 
    }), {
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    return bad('Internal server error', 500);
  }
});