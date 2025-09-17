import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.54.0"

// Simple in-memory rate limiter (best-effort)
const RATE_LIMIT_PER_MINUTE = Number(Deno.env.get('RATE_LIMIT_PER_MINUTE') ?? '60')
const rateBuckets = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(key: string) {
  const now = Date.now()
  const bucket = rateBuckets.get(key)
  if (!bucket || now > bucket.resetAt) {
    const resetAt = now + 60_000
    rateBuckets.set(key, { count: 1, resetAt })
    return { allowed: true, remaining: RATE_LIMIT_PER_MINUTE - 1, reset: resetAt }
  }
  if (bucket.count >= RATE_LIMIT_PER_MINUTE) {
    return { allowed: false, remaining: 0, reset: bucket.resetAt }
  }
  bucket.count += 1
  return { allowed: true, remaining: RATE_LIMIT_PER_MINUTE - bucket.count, reset: bucket.resetAt }
}

function getAllowedOrigins() {
  const raw = Deno.env.get('ALLOWED_ORIGINS')
  if (!raw) return null // allow all if not configured (non-breaking default)
  return raw.split(',').map(s => s.trim()).filter(Boolean)
}

function isOriginAllowed(origin: string | null) {
  const allowlist = getAllowedOrigins()
  if (!allowlist) return true
  if (!origin) return false
  try {
    const o = new URL(origin)
    return allowlist.includes(o.origin)
  } catch {
    return false
  }
}

function corsHeaders(origin: string | null) {
  const allowed = isOriginAllowed(origin)
  const allowOrigin = allowed && origin ? origin : '*'
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  }
}

interface ChatRequest {
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  elderlyPersonName?: string;
}

serve(async (req) => {
  const origin = req.headers.get('origin')

  if (req.method === 'OPTIONS') {
    // Preflight
    return new Response('ok', { headers: corsHeaders(origin) })
  }

  // Origin allowlist check (if configured)
  if (!isOriginAllowed(origin)) {
    return new Response('Forbidden origin', { status: 403, headers: corsHeaders(origin) })
  }

  // REQUIRED authentication for AI health processing
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response('Unauthorized - Authentication required', { 
      status: 401, 
      headers: corsHeaders(origin) 
    })
  }

  let userId: string | null = null
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase configuration missing')
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData, error: authError } = await supabase.auth.getUser()
    
    if (authError || !userData.user) {
      return new Response('Unauthorized - Invalid token', { 
        status: 401, 
        headers: corsHeaders(origin) 
      })
    }
    
    userId = userData.user.id
  } catch (error) {
    console.error('Authentication error:', error)
    return new Response('Unauthorized - Authentication failed', { 
      status: 401, 
      headers: corsHeaders(origin) 
    })
  }

  // Rate limit per user if available, otherwise by client fingerprint
  const ip = req.headers.get('x-forwarded-for') || ''
  const ua = req.headers.get('user-agent') || ''
  const rateKey = userId ? `user:${userId}` : `public:${origin || ''}:${ip}:${ua.slice(0,64)}`
  const rl = checkRateLimit(rateKey)
  if (!rl.allowed) {
    return new Response('Too Many Requests', {
      status: 429,
      headers: {
        ...corsHeaders(origin),
        'Retry-After': Math.max(0, Math.ceil((rl.reset - Date.now()) / 1000)).toString(),
        'X-RateLimit-Limit': RATE_LIMIT_PER_MINUTE.toString(),
        'X-RateLimit-Remaining': rl.remaining.toString(),
      },
    })
  }

  try {
    const { messages, elderlyPersonName } = await req.json() as ChatRequest

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured')
    }

    // Enhanced system prompt for elderly care
    const systemMessage = {
      role: 'system' as const,
      content: `You are a warm, patient, and caring AI companion designed to have wellness check-in conversations with elderly individuals${elderlyPersonName ? ` like ${elderlyPersonName}` : ''}. 

Your role is to:
- Conduct gentle daily wellness check-ins
- Ask simple, caring questions about their wellbeing
- Listen attentively to their responses
- Show genuine concern and empathy
- Ask follow-up questions when appropriate
- Keep conversations natural and not overly clinical
- Be patient with repetition or confusion
- Encourage them to share their feelings

Important guidelines:
- Keep your responses warm but concise (2-3 sentences max)
- Use simple, clear language
- Show interest in their daily activities and feelings
- Be encouraging and positive
- If they express concerns about health or safety, acknowledge them compassionately
- Don't provide medical advice, but encourage them to speak with their doctor or family if needed

Remember: This is a caring conversation, not an interrogation. Make them feel heard and valued.`,
    }

    const chatMessages = [systemMessage, ...messages]

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-2025-04-14',
        messages: chatMessages,
        temperature: 0.8,
        max_tokens: 300,
        presence_penalty: 0.1,
        frequency_penalty: 0.1,
      }),
    })

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`)
    }

    const data = await response.json()
    const aiResponse = data.choices[0]?.message?.content || 'I understand. How else are you feeling today?'

    return new Response(
      JSON.stringify({ response: aiResponse }),
      { headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in AI chat:', error)
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})