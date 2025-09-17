
import React from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, Phone, Heart, Shield, Users, Clock, Headphones } from "lucide-react";
import StripeSubscription from "@/components/StripeSubscription";
import { useAuth } from "@/contexts/AuthContext";
import { useStripeSubscription } from "@/hooks/useStripeSubscription";

const Subscription = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { subscriptionData, isLoading, openCustomerPortal, isSubscriber } = useStripeSubscription();

  const handleSubscriptionSuccess = () => {
    // Redirect to family dashboard after successful subscription
    navigate('/family/dashboard');
  };

  const features = [
    { icon: Phone, text: "Daily AI companion calls" },
    { icon: Heart, text: "Health monitoring & alerts" },
    { icon: Users, text: "Family dashboard access" },
    { icon: Shield, text: "Emergency response system" },
    { icon: Clock, text: "Flexible call scheduling" },
    { icon: Headphones, text: "24/7 support included" }
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">
            Start Your CallPanion Journey
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Begin with a 7-day free trial, then just £15/month for complete peace of mind
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          <Card className="relative overflow-hidden border-2 border-primary/20">
            <div className="absolute top-0 left-1/2 transform -translate-x-1/2">
              <Badge className="bg-primary text-primary-foreground px-6 py-1 rounded-b-lg">
                Most Popular
              </Badge>
            </div>
            
            <CardHeader className="text-center pt-12 pb-8">
              <CardTitle className="text-3xl mb-2">CallPanion Membership</CardTitle>
              <CardDescription className="text-lg mb-6">
                Complete care and connection solution
              </CardDescription>
              
              <div className="flex items-center justify-center gap-2 mb-4">
                <span className="text-4xl font-bold">£15</span>
                <div className="text-left">
                  <div className="text-muted-foreground">/month</div>
                  <div className="text-sm text-primary font-medium">after 7-day free trial</div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-8">
              <div className="grid md:grid-cols-2 gap-4">
                {features.map((feature, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="bg-primary/10 p-2 rounded-full">
                      <feature.icon className="h-4 w-4 text-primary" />
                    </div>
                    <span className="text-sm">{feature.text}</span>
                  </div>
                ))}
              </div>

              <div className="bg-muted/50 rounded-lg p-6">
                {isSubscriber ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                      <p className="text-green-800 font-medium text-center">
                        ✓ You're subscribed to CallPanion
                      </p>
                      {subscriptionData?.subscription_tier && (
                        <p className="text-sm text-green-600 mt-1 text-center">
                          Plan: {subscriptionData.subscription_tier}
                        </p>
                      )}
                      {subscriptionData?.trial_end && (
                        <p className="text-sm text-green-600 mt-1 text-center">
                          Trial ends: {new Date(subscriptionData.trial_end).toLocaleDateString()}
                        </p>
                      )}
                      {subscriptionData?.subscription_end && !subscriptionData?.is_trial && (
                        <p className="text-sm text-green-600 mt-1 text-center">
                          Next billing: {new Date(subscriptionData.subscription_end).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <Button 
                      onClick={openCustomerPortal}
                      variant="outline"
                      className="w-full"
                    >
                      Manage Subscription
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                      <p className="text-sm font-semibold text-yellow-800 mb-2">⚠️ Auto-Renewal Notice:</p>
                      <p className="text-sm text-yellow-700">
                        After your 7-day free trial, your subscription will automatically renew monthly at £15.00 
                        until cancelled. You can cancel anytime through Stripe or by contacting support - no penalty fees.
                      </p>
                    </div>
                    
                    <h3 className="font-semibold mb-4 text-center">Subscribe with Stripe</h3>
                    <StripeSubscription onSuccess={handleSubscriptionSuccess} />
                  </>
                )}
                
                <div className="text-xs text-muted-foreground mt-4 text-center">
                  <p>By subscribing, you agree to our <a href="/membership-terms" className="text-primary hover:underline">Membership Terms</a> and <a href="/privacy" className="text-primary hover:underline">Privacy Policy</a></p>
                  <p>14-day cooling-off period applies for UK consumers</p>
                </div>
              </div>

              <div className="text-center text-sm text-muted-foreground">
                <p>
                  ✓ Start your free 7-day trial today<br/>
                  ✓ Cancel anytime, no questions asked<br/>
                  ✓ Secure payment processing with Stripe
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="mt-12 max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold text-center mb-8">Frequently Asked Questions</h2>
            
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold mb-2">How does the free trial work?</h3>
                <p className="text-muted-foreground">
                  You get full access to all CallPanion features for 7 days at no cost. 
                  After the trial, you'll be charged £15/month unless you cancel.
                </p>
              </div>
              
                <div>
                  <h3 className="font-semibold mb-2">Can I cancel my subscription?</h3>
                  <p className="text-muted-foreground">
                    Yes, you can cancel your subscription at any time through the Stripe customer portal 
                    or by contacting our support team. No cancellation fees apply.
                  </p>
                </div>
                
                <div>
                  <h3 className="font-semibold mb-2">What payment methods do you accept?</h3>
                  <p className="text-muted-foreground">
                    We accept all major payment methods through Stripe, including credit cards, 
                    debit cards, and digital wallets like Apple Pay and Google Pay.
                  </p>
                </div>
                
                <div>
                  <h3 className="font-semibold mb-2">Is my payment information secure?</h3>
                  <p className="text-muted-foreground">
                    Absolutely. All payments are processed securely through Stripe's 
                    industry-leading payment platform. We never store your payment details.
                  </p>
                </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Subscription;
