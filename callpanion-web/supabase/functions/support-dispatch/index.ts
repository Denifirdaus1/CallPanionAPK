import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.54.0";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DispatchRequest {
  ticket_id: string;
  priority: 'P1' | 'P2' | 'P3';
  subject: string;
}

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Parse request body
    const dispatchData: DispatchRequest = await req.json();

    // Get current on-call support staff
    const { data: onCallData, error: onCallError } = await supabaseClient
      .rpc('get_current_oncall');

    if (onCallError) {
      console.error('Error getting on-call staff:', onCallError);
      return new Response(
        JSON.stringify({ error: 'Failed to get on-call information' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!onCallData || onCallData.length === 0) {
      console.log('No on-call staff available');
      return new Response(
        JSON.stringify({ message: 'No on-call staff available' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const onCallStaff = onCallData[0];

    // Get ticket details
    const { data: ticket, error: ticketError } = await supabaseClient
      .from('support_tickets')
      .select('*, profiles!inner(display_name)')
      .eq('id', dispatchData.ticket_id)
      .single();

    if (ticketError || !ticket) {
      console.error('Error getting ticket details:', ticketError);
      return new Response(
        JSON.stringify({ error: 'Ticket not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const priorityInfo = {
      'P1': { label: 'CRITICAL', sla: '1 hour', emoji: '🚨' },
      'P2': { label: 'HIGH', sla: '4 hours', emoji: '⚠️' },
      'P3': { label: 'NORMAL', sla: '24 hours', emoji: 'ℹ️' }
    };

    const priority = priorityInfo[dispatchData.priority];

    // Send notification based on contact method
    if (onCallStaff.contact_method === 'EMAIL') {
      try {
        await resend.emails.send({
          from: 'CallPanion Alerts <alerts@callpanion.co.uk>',
          to: [onCallStaff.contact_details],
          subject: `${priority.emoji} ${priority.label} Support Ticket: ${ticket.ticket_number}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background-color: ${dispatchData.priority === 'P1' ? '#dc3545' : '#fd7e14'}; color: white; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
                <h2 style="margin: 0; font-size: 24px;">
                  ${priority.emoji} ${priority.label} PRIORITY TICKET
                </h2>
                <p style="margin: 5px 0 0 0; font-size: 16px;">
                  Response required within ${priority.sla}
                </p>
              </div>
              
              <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <h3 style="margin-top: 0; color: #495057;">Ticket Details</h3>
                <p><strong>Ticket Number:</strong> ${ticket.ticket_number}</p>
                <p><strong>Subject:</strong> ${dispatchData.subject}</p>
                <p><strong>Customer:</strong> ${ticket.profiles?.display_name || 'Unknown'}</p>
                <p><strong>Priority:</strong> ${priority.label} (${priority.sla} SLA)</p>
                <p><strong>Created:</strong> ${new Date(ticket.created_at).toLocaleString('en-GB')}</p>
                <p><strong>Contact Email:</strong> ${ticket.contact_email}</p>
                ${ticket.contact_phone ? `<p><strong>Contact Phone:</strong> ${ticket.contact_phone}</p>` : ''}
              </div>
              
              <div style="margin: 20px 0;">
                <a href="https://callpanion.co.uk/admin/support" 
                   style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                  📋 View in Admin Dashboard
                </a>
              </div>
              
              <div style="background-color: #e8f5e8; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <h4 style="margin-top: 0; color: #28a745;">Action Required</h4>
                <ul style="margin-bottom: 0;">
                  <li>Review the ticket immediately</li>
                  <li>Contact the customer within ${priority.sla}</li>
                  <li>Update ticket status in the admin dashboard</li>
                  <li>Escalate if additional expertise needed</li>
                </ul>
              </div>
              
              <div style="border-top: 1px solid #dee2e6; padding-top: 15px; margin-top: 30px; color: #6c757d; font-size: 14px;">
                <p>This is an automated alert from the CallPanion support system.<br>
                You are currently the designated on-call support engineer.</p>
              </div>
            </div>
          `,
        });

        console.log(`Email alert sent to ${onCallStaff.contact_details} for ticket ${ticket.ticket_number}`);
      } catch (emailError) {
        console.error('Error sending email alert:', emailError);
      }
    }

    // TODO: Add SMS/Slack notifications for other contact methods
    if (onCallStaff.contact_method === 'SLACK') {
      // Implement Slack webhook notification
      const slackWebhookUrl = Deno.env.get('SLACK_WEBHOOK_URL');
      if (slackWebhookUrl) {
        try {
          await fetch(slackWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: `${priority.emoji} ${priority.label} Support Ticket: ${ticket.ticket_number}`,
              blocks: [
                {
                  type: "section",
                  text: {
                    type: "mrkdwn",
                    text: `*${priority.emoji} ${priority.label} PRIORITY TICKET*\n*Ticket:* ${ticket.ticket_number}\n*Subject:* ${dispatchData.subject}\n*Customer:* ${ticket.profiles?.display_name || 'Unknown'}\n*SLA:* ${priority.sla}`
                  }
                },
                {
                  type: "actions",
                  elements: [
                    {
                      type: "button",
                      text: {
                        type: "plain_text",
                        text: "📋 View Ticket"
                      },
                      url: "https://callpanion.co.uk/admin/support"
                    }
                  ]
                }
              ]
            })
          });
        } catch (slackError) {
          console.error('Error sending Slack notification:', slackError);
        }
      }
    }

    // Log the dispatch
    const { error: logError } = await supabaseClient
      .from('support_messages')
      .insert({
        ticket_id: dispatchData.ticket_id,
        sender_type: 'SYSTEM',
        message: `Ticket escalated to on-call support (${onCallStaff.contact_method}: ${onCallStaff.contact_details}) due to ${priority.label} priority outside business hours.`
      });

    if (logError) {
      console.error('Error logging dispatch:', logError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'On-call support notified',
        on_call_contact: onCallStaff.contact_method
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in support-dispatch:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});