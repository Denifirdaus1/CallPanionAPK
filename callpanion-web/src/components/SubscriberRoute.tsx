
import React, { useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { useTrialCode } from "@/hooks/useTrialCode";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Crown, ArrowRight, Gift, Sparkles } from "lucide-react";

const SubscriberRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, isLoading: authLoading } = useAuth();
  const { isSubscriber, isLoading: subscriptionLoading, refetch } = useSubscription();
  const { activateTrialCode, isLoading: isActivatingTrial } = useTrialCode();
  const [trialCode, setTrialCode] = useState("");

  if (authLoading || subscriptionLoading) {
    return (
      <div className="min-h-[40vh] w-full flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/family-login" replace />;
  }

  const handleTrialActivation = async () => {
    const success = await activateTrialCode(trialCode);
    if (success) {
      setTrialCode("");
      refetch(); // Refresh subscription status
    }
  };

  if (!isSubscriber) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Crown className="w-6 h-6 text-primary" />
            </div>
            <CardTitle>Subscription Required</CardTitle>
            <CardDescription>
              You need an active subscription to access this feature.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Choose a subscription plan to access the full CallPanion experience.
            </p>
            
            {/* Trial Code Section with Special Highlight */}
            <div className="space-y-3 p-4 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2 justify-center">
                <Sparkles className="w-4 h-4 text-purple-600" />
                <span className="text-sm font-semibold text-purple-800">Free 30-Day Trial Available!</span>
              </div>
              <div className="text-xs text-purple-700 bg-purple-100 px-2 py-1 rounded font-mono">
                Try code: WELCOME-30D
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter trial code"
                  value={trialCode}
                  onChange={(e) => setTrialCode(e.target.value)}
                  className="text-sm"
                />
                <Button 
                  onClick={handleTrialActivation}
                  disabled={isActivatingTrial || !trialCode.trim()}
                  size="sm"
                >
                  {isActivatingTrial ? "..." : "Activate"}
                </Button>
              </div>
            </div>
            
            <Link to="/billing">
              <Button className="w-full">
                Go to Subscription Plans
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
            <Button 
              variant="outline"
              onClick={() => window.location.href = 'mailto:support@callpanion.co.uk'}
              className="w-full"
            >
              Contact Support
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
};

export default SubscriberRoute;
