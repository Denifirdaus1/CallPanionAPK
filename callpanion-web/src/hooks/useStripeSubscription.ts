import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface SubscriptionData {
  subscribed: boolean;
  subscription_tier?: string;
  subscription_end?: string;
  trial_end?: string;
  is_trial?: boolean;
}

export const useStripeSubscription = () => {
  const { user } = useAuth();
  const [subscriptionData, setSubscriptionData] = useState<SubscriptionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkSubscription = async () => {
    if (!user) {
      setSubscriptionData(null);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('check-subscription', {
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });

      if (error) {
        console.error('Error checking subscription:', error);
        setSubscriptionData({ subscribed: false });
      } else {
        setSubscriptionData(data);
      }
    } catch (error) {
      console.error('Subscription check error:', error);
      setSubscriptionData({ subscribed: false });
    } finally {
      setIsLoading(false);
    }
  };

  const openCustomerPortal = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase.functions.invoke('customer-portal', {
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });

      if (error) {
        console.error('Error opening customer portal:', error);
        return;
      }

      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (error) {
      console.error('Customer portal error:', error);
    }
  };

  useEffect(() => {
    checkSubscription();
  }, [user]);

  return {
    subscriptionData,
    isLoading,
    checkSubscription,
    openCustomerPortal,
    isSubscriber: subscriptionData?.subscribed || false,
    isTrial: subscriptionData?.is_trial || false,
    subscriptionTier: subscriptionData?.subscription_tier,
    subscriptionEnd: subscriptionData?.subscription_end,
    trialEnd: subscriptionData?.trial_end,
  };
};