import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.54.0";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SupportTicketRequest {
  subject: string;
  message: string;
  priority: 'P1' | 'P2' | 'P3';
  category: string;
  contact_email?: string;
  contact_phone?: string;
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

    // Get user from authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Authentication failed' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const ticketData: SupportTicketRequest = await req.json();

    // Validate required fields
    if (!ticketData.subject || !ticketData.message || !ticketData.priority) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: subject, message, priority' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create support ticket
    const { data: ticket, error: ticketError } = await supabaseClient
      .from('support_tickets')
      .insert({
        user_id: user.id,
        subject: ticketData.subject,
        description: ticketData.message,
        priority: ticketData.priority,
        contact_email: ticketData.contact_email || user.email,
        contact_phone: ticketData.contact_phone,
        status: 'OPEN'
      })
      .select()
      .single();

    if (ticketError) {
      console.error('Error creating ticket:', ticketError);
      return new Response(
        JSON.stringify({ error: 'Failed to create support ticket' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Add initial message
    const { error: messageError } = await supabaseClient
      .from('support_messages')
      .insert({
        ticket_id: ticket.id,
        sender_id: user.id,
        sender_type: 'USER',
        message: ticketData.message
      });

    if (messageError) {
      console.error('Error adding message:', messageError);
    }

    // Send auto-acknowledgment email
    try {
      const priorityText = {
        'P1': 'Critical (1 hour response)',
        'P2': 'High (4 hour response)', 
        'P3': 'Normal (24 hour response)'
      };

      await resend.emails.send({
        from: 'CallPanion Support <support@callpanion.co.uk>',
        to: [ticketData.contact_email || user.email!],
        subject: `Support Ticket Created: ${ticket.ticket_number}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #333; border-bottom: 2px solid #e74c3c; padding-bottom: 10px;">
              Support Ticket Confirmation
            </h2>
            
            <p>Dear valued customer,</p>
            
            <p>Thank you for contacting CallPanion support. We've received your support request and created ticket <strong>${ticket.ticket_number}</strong>.</p>
            
            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #495057;">Ticket Details</h3>
              <p><strong>Ticket Number:</strong> ${ticket.ticket_number}</p>
              <p><strong>Subject:</strong> ${ticketData.subject}</p>
              <p><strong>Priority:</strong> ${priorityText[ticketData.priority]}</p>
              <p><strong>Created:</strong> ${new Date().toLocaleString('en-GB')}</p>
            </div>
            
            <h3 style="color: #333;">What happens next?</h3>
            <ul>
              <li>Our support team will review your request</li>
              <li>You'll receive a response within our priority timeframe</li>
              <li>We'll keep you updated on progress via email</li>
              <li>You can reply to this email to add more information</li>
            </ul>
            
            <div style="background-color: #e8f5e8; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h4 style="margin-top: 0; color: #28a745;">📞 24/7 Support Available</h4>
              <p style="margin-bottom: 0;">For critical issues outside business hours, our on-call team will be automatically notified.</p>
            </div>
            
            <p>Thank you for choosing CallPanion. We're here to help!</p>
            
            <div style="border-top: 1px solid #dee2e6; padding-top: 15px; margin-top: 30px; color: #6c757d; font-size: 14px;">
              <p>CallPanion Support Team<br>
              Email: support@callpanion.co.uk<br>
              Business Hours: Monday-Friday, 9:00-17:00 UK Time</p>
            </div>
          </div>
        `,
      });
    } catch (emailError) {
      console.error('Error sending acknowledgment email:', emailError);
      // Don't fail the request if email fails
    }

    // Check if escalation is needed for high priority tickets outside business hours
    const now = new Date();
    const ukTime = new Date(now.toLocaleString("en-US", {timeZone: "Europe/London"}));
    const isBusinessHours = ukTime.getDay() >= 1 && ukTime.getDay() <= 5 && 
                           ukTime.getHours() >= 9 && ukTime.getHours() < 17;

    if ((ticketData.priority === 'P1' || ticketData.priority === 'P2') && !isBusinessHours) {
      // Trigger escalation via support-dispatch function
      try {
        await supabaseClient.functions.invoke('support-dispatch', {
          body: {
            ticket_id: ticket.id,
            priority: ticketData.priority,
            subject: ticketData.subject
          }
        });
      } catch (dispatchError) {
        console.error('Error triggering escalation:', dispatchError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        ticket: {
          id: ticket.id,
          ticket_number: ticket.ticket_number,
          status: ticket.status,
          priority: ticket.priority,
          created_at: ticket.created_at
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 201,
      }
    );

  } catch (error) {
    console.error('Error in support-create-ticket:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});