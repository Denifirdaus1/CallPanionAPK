
import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface StripeSubscriptionProps {
  onSuccess?: () => void;
}

const StripeSubscription: React.FC<StripeSubscriptionProps> = ({ onSuccess }) => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubscribe = async () => {
    if (!user) {
      toast.error('Please log in to subscribe');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Create Stripe checkout session
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });

      if (error) {
        throw error;
      }

      if (data?.url) {
        // Open Stripe checkout in a new tab
        const newTab = window.open(data.url, '_blank');
        if (!newTab) {
          // Fallback if popup was blocked
          window.location.href = data.url;
        }
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (error) {
      console.error('Subscription error:', error);
      setError(error instanceof Error ? error.message : 'Failed to start subscription process');
      toast.error('Failed to start subscription. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) {
    return (
      <Card className="p-6 text-center">
        <p className="text-muted-foreground">Please log in to subscribe</p>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6 text-center">
        <p className="text-destructive mb-4">{error}</p>
        <Button onClick={() => window.location.reload()}>
          Try Again
        </Button>
      </Card>
    );
  }

  return (
    <div className="w-full">
      <Button 
        onClick={handleSubscribe}
        disabled={isLoading}
        className="w-full h-12 text-lg font-semibold"
      >
        {isLoading ? (
          <>
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
            Processing...
          </>
        ) : (
          'Subscribe with Stripe'
        )}
      </Button>
    </div>
  );
};

export default StripeSubscription;
