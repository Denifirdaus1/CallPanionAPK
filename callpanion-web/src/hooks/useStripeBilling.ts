import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface StripeBillingData {
  hasStripeCustomer: boolean;
  customer?: {
    id: string;
    email: string;
    name: string;
  };
  subscription?: {
    id: string;
    status: string;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
    price: {
      amount: number;
      currency: string;
      interval: string;
    };
    product: {
      name: string;
    };
  };
  invoices: Array<{
    id: string;
    number: string;
    status: string;
    amount: number;
    currency: string;
    created: Date;
    paid: boolean;
    hostedInvoiceUrl: string;
    invoicePdf: string;
  }>;
  paymentMethod?: {
    type: string;
    card?: {
      brand: string;
      last4: string;
      expMonth: number;
      expYear: number;
    };
  };
}

export const useStripeBilling = () => {
  const { user } = useAuth();
  const [billingData, setBillingData] = useState<StripeBillingData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBillingData = async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const { data, error: functionError } = await supabase.functions.invoke('get-stripe-customer-data', {
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });

      if (functionError) {
        throw new Error(functionError.message);
      }

      // Convert date strings back to Date objects
      if (data.subscription) {
        data.subscription.currentPeriodStart = new Date(data.subscription.currentPeriodStart);
        data.subscription.currentPeriodEnd = new Date(data.subscription.currentPeriodEnd);
      }

      if (data.invoices) {
        data.invoices = data.invoices.map((invoice: any) => ({
          ...invoice,
          created: new Date(invoice.created)
        }));
      }

      setBillingData(data);
    } catch (err) {
      console.error('Error fetching billing data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch billing data');
    } finally {
      setIsLoading(false);
    }
  };

  const openCustomerPortal = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal', {
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      // Open customer portal in new tab
      window.open(data.url, '_blank');
    } catch (err) {
      console.error('Error opening customer portal:', err);
      throw err;
    }
  };

  useEffect(() => {
    fetchBillingData();
  }, [user]);

  return {
    billingData,
    isLoading,
    error,
    refetch: fetchBillingData,
    openCustomerPortal,
  };
};