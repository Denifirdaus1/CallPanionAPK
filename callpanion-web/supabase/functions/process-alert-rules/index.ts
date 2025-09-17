import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.54.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AlertEvent {
  type: 'missed_call' | 'health_concern' | 'emergency'
  household_id: string
  relative_id?: string
  data: Record<string, any>
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { type, household_id, relative_id, data }: AlertEvent = await req.json()

    if (!type || !household_id) {
      throw new Error('Missing required fields: type, household_id')
    }

    console.log(`Processing alert event: ${type} for household ${household_id}`)

    // Get active alert rules for this household
    const { data: rules, error: rulesError } = await supabase
      .from('alert_rules')
      .select('*')
      .eq('household_id', household_id)
      .eq('rule_type', type)
      .eq('is_active', true)

    if (rulesError) {
      throw rulesError
    }

    if (!rules?.length) {
      console.log(`No alert rules found for ${type} in household ${household_id}`)
      return new Response(
        JSON.stringify({ success: true, rules_processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let triggeredRules = 0

    for (const rule of rules) {
      const conditions = rule.conditions
      const actions = rule.actions
      let shouldTrigger = false

      // Check rule conditions based on type
      switch (type) {
        case 'missed_call':
          if (conditions.missed_calls && data.consecutive_missed >= conditions.missed_calls) {
            shouldTrigger = true
          }
          break
        
        case 'health_concern':
          if (conditions.health_score && data.health_score <= conditions.health_score) {
            shouldTrigger = true
          }
          break
        
        case 'emergency':
          shouldTrigger = true // Emergency alerts always trigger
          break
      }

      if (shouldTrigger) {
        console.log(`Triggering rule: ${rule.rule_name}`)
        triggeredRules++

        // Execute actions
        if (actions.notify_users?.length) {
          await supabase.functions.invoke('send-push-notification', {
            body: {
              user_ids: actions.notify_users,
              title: actions.notification_title || `${rule.rule_name} Alert`,
              body: actions.notification_body || `Alert triggered for rule: ${rule.rule_name}`,
              data: {
                type: 'alert_rule',
                rule_id: rule.id,
                household_id,
                relative_id: relative_id || null,
                alert_type: type
              }
            }
          })
        }

        if (actions.send_sms && actions.sms_recipients?.length) {
          // TODO: Implement SMS sending
          console.log('SMS sending not yet implemented')
        }

        if (actions.send_email && actions.email_recipients?.length) {
          // TODO: Implement email sending
          console.log('Email sending not yet implemented')
        }

        // Create family notification
        await supabase
          .from('family_notifications')
          .insert({
            household_id,
            relative_id,
            title: actions.notification_title || `${rule.rule_name} Alert`,
            message: actions.notification_body || `Alert triggered: ${rule.rule_name}`,
            notification_type: 'alert',
            priority: actions.priority || 'high',
            sent_to_user_ids: actions.notify_users || []
          })
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        rules_processed: triggeredRules,
        total_rules: rules.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Alert processing error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})