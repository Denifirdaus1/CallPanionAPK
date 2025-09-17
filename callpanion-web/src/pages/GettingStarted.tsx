
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { UserPlus, MessageCircle, Heart, Crown, ArrowRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import StripeSubscription from '@/components/StripeSubscription';

const GettingStarted = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isSubscriber, isLoading } = useSubscription();

  const handleAddRelative = () => {
    // Mark onboarding as complete when they start adding relatives
    localStorage.setItem('onboardingComplete', 'true');
    navigate('/add-relative');
  };

  const handleContinueToApp = () => {
    localStorage.setItem('onboardingComplete', 'true');
    navigate('/home');
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-warmth/10 via-background to-comfort/20 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <p>Please sign in to continue</p>
            <Link to="/family-login">
              <Button className="mt-4">Sign In</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-warmth/10 via-background to-comfort/20">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4 text-foreground">
              Welcome to CallPanion! 👋
            </h1>
            <p className="text-xl text-muted-foreground">
              Let's get you set up to start connecting with your loved ones
            </p>
          </div>

          {/* Subscription Status */}
          {!isLoading && !isSubscriber && (
            <Card className="mb-8 border-primary/20 bg-primary/5">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Crown className="w-5 h-5 text-primary" />
                  <CardTitle className="text-lg">Start Your Free Trial</CardTitle>
                </div>
                <CardDescription>
                  Get 7 days free, then £15/month for complete peace of mind
                </CardDescription>
              </CardHeader>
              <CardContent>
                <StripeSubscription onSuccess={() => window.location.reload()} />
                <p className="text-xs text-muted-foreground mt-4 text-center">
                  Cancel anytime • No setup fees • 14-day cooling-off period
                </p>
              </CardContent>
            </Card>
          )}

          {isSubscriber && (
            <Card className="mb-8 border-green-200 bg-green-50">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 text-green-800">
                  <Crown className="w-5 h-5" />
                  <span className="font-medium">✓ You're subscribed to CallPanion</span>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid md:grid-cols-3 gap-6 mb-8">
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader className="text-center">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <UserPlus className="w-6 h-6 text-primary" />
                </div>
                <CardTitle className="text-lg">Add Your First Relative</CardTitle>
                <CardDescription>
                  Set up a profile for your loved one to start their AI companion journey
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  onClick={handleAddRelative}
                  className="w-full"
                  disabled={!isSubscriber && !isLoading}
                >
                  Add Relative
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader className="text-center">
                <div className="w-12 h-12 bg-comfort/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <MessageCircle className="w-6 h-6 text-comfort" />
                </div>
                <CardTitle className="text-lg">Send Messages</CardTitle>
                <CardDescription>
                  Stay connected with warm messages and updates from your family
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  variant="outline" 
                  className="w-full"
                  disabled={!isSubscriber && !isLoading}
                  onClick={() => navigate('/messages')}
                >
                  Family Messages
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader className="text-center">
                <div className="w-12 h-12 bg-warmth/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Heart className="w-6 h-6 text-warmth" />
                </div>
                <CardTitle className="text-lg">Share Memories</CardTitle>
                <CardDescription>
                  Upload photos and create beautiful memory collections together
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  variant="outline" 
                  className="w-full"
                  disabled={!isSubscriber && !isLoading}
                  onClick={() => navigate('/memories')}
                >
                  Family Memories
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="text-center">
            <p className="text-muted-foreground mb-4">
              Already have relatives set up?
            </p>
            <Button 
              variant="ghost" 
              onClick={handleContinueToApp}
              disabled={!isSubscriber && !isLoading}
            >
              Continue to Dashboard
            </Button>
          </div>

          <div className="mt-12 text-center">
            <p className="text-sm text-muted-foreground">
              Need help getting started?{' '}
              <Link to="/family-help" className="text-primary hover:underline">
                Visit our help center
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GettingStarted;
