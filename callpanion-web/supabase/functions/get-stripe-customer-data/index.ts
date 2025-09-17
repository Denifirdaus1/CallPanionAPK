import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    // Get authenticated user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) {
      throw new Error("User not authenticated or email not available");
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    });

    // Find customer by email
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    if (customers.data.length === 0) {
      return new Response(JSON.stringify({ 
        hasStripeCustomer: false,
        subscription: null,
        invoices: [],
        paymentMethod: null
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const customer = customers.data[0];

    // Get active subscriptions
    const subscriptions = await stripe.subscriptions.list({
      customer: customer.id,
      status: "active",
      limit: 1,
    });

    let subscription = null;
    if (subscriptions.data.length > 0) {
      const sub = subscriptions.data[0];
      const price = sub.items.data[0].price;
      
      subscription = {
        id: sub.id,
        status: sub.status,
        currentPeriodStart: new Date(sub.current_period_start * 1000),
        currentPeriodEnd: new Date(sub.current_period_end * 1000),
        price: {
          amount: price.unit_amount || 0,
          currency: price.currency,
          interval: price.recurring?.interval,
        },
        product: {
          name: sub.items.data[0].price.nickname || 'CallPanion Subscription'
        }
      };
    }

    // Get recent invoices
    const invoices = await stripe.invoices.list({
      customer: customer.id,
      limit: 5,
    });

    const invoiceData = invoices.data.map(inv => ({
      id: inv.id,
      number: inv.number,
      status: inv.status,
      amount: inv.total,
      currency: inv.currency,
      created: new Date(inv.created * 1000),
      paid: inv.paid,
      hostedInvoiceUrl: inv.hosted_invoice_url,
      invoicePdf: inv.invoice_pdf,
    }));

    // Get default payment method
    let paymentMethod = null;
    if (customer.invoice_settings?.default_payment_method) {
      const pm = await stripe.paymentMethods.retrieve(
        customer.invoice_settings.default_payment_method as string
      );
      
      paymentMethod = {
        type: pm.type,
        card: pm.card ? {
          brand: pm.card.brand,
          last4: pm.card.last4,
          expMonth: pm.card.exp_month,
          expYear: pm.card.exp_year,
        } : null,
      };
    }

    return new Response(JSON.stringify({
      hasStripeCustomer: true,
      customer: {
        id: customer.id,
        email: customer.email,
        name: customer.name,
      },
      subscription,
      invoices: invoiceData,
      paymentMethod,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error('Error fetching Stripe customer data:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to fetch billing data',
      message: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});