
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const useSubscription = () => {
  const { user } = useAuth();
  const [isSubscriber, setIsSubscriber] = useState<boolean | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [subscriptionData, setSubscriptionData] = useState<any>(null);
  const [hasActiveTrial, setHasActiveTrial] = useState<boolean>(false);
  const [trialExpiresAt, setTrialExpiresAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkSubscription = async () => {
      if (!user) {
        setIsSubscriber(false);
        setUserRole(null);
        setSubscriptionData(null);
        setIsLoading(false);
        return;
      }

      try {
        // First check the profiles table for role
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        if (profileError && profileError.code !== 'PGRST116') {
          console.error('Error checking profile:', profileError);
        }

        const role = profileData?.role || 'free';
        setUserRole(role);

        // Check active subscription - use lowercase 'active' and 'trialing'
        const { data: subscriptionData, error: subscriptionError } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('user_id', user.id)
          .in('status', ['active', 'trialing'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (subscriptionError && subscriptionError.code !== 'PGRST116') {
          console.error('Error checking subscription:', subscriptionError);
        }

        // Check for active trial codes
        const { data: trialData, error: trialError } = await supabase
          .from('trial_activations')
          .select('expires_at')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .gte('expires_at', new Date().toISOString())
          .order('expires_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (trialError && trialError.code !== 'PGRST116') {
          console.error('Error checking trial:', trialError);
        }

        const hasActiveTrial = trialData && new Date(trialData.expires_at) > new Date();
        setHasActiveTrial(!!hasActiveTrial);
        setTrialExpiresAt(trialData?.expires_at || null);

        // Also check Stripe subscription status via edge function
        let stripeSubscriptionActive = false;
        try {
          const { data: stripeData, error: stripeError } = await supabase.functions.invoke('check-subscription', {
            headers: {
              Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            },
          });

          if (stripeData && !stripeError) {
            stripeSubscriptionActive = stripeData.subscribed || false;
          }
        } catch (error) {
          console.log('Stripe subscription check not available:', error);
        }

        // User is a subscriber if they have an active subscription OR if their profile role indicates it OR they have an active trial OR they have active Stripe subscription
        const hasActiveSubscription = subscriptionData && ['active', 'trialing'].includes(subscriptionData.status);
        const hasSubscriberRole = role === 'subscriber' || role === 'admin';
        
        setIsSubscriber(hasActiveSubscription || hasSubscriberRole || hasActiveTrial || stripeSubscriptionActive);
        setSubscriptionData(subscriptionData);

      } catch (error) {
        console.error('Error checking subscription:', error);
        setIsSubscriber(false);
        setUserRole('free');
        setSubscriptionData(null);
      } finally {
        setIsLoading(false);
      }
  };

  useEffect(() => {
    checkSubscription();
  }, [user]);

  return { 
    isSubscriber, 
    userRole, 
    subscriptionData, 
    hasActiveTrial,
    trialExpiresAt,
    isLoading,
    refetch: () => checkSubscription() // Allow manual refetch after trial activation
  };
};
