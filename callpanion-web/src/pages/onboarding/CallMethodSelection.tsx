import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Phone, Smartphone, CheckCircle2, Clock, Globe, Users } from "lucide-react";

const CallMethodSelection = () => {
  const [selectedMethod, setSelectedMethod] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const handleContinue = async () => {
    if (!selectedMethod || !user) return;

    setIsLoading(true);
    try {
      // Get household ID from navigation state or find the most recent household
      let householdId = location.state?.householdId;
      
      if (!householdId) {
        const { data: households } = await supabase
          .from('households')
          .select('id')
          .eq('created_by', user.id)
          .order('created_at', { ascending: false })
          .limit(1);

        if (!households?.[0]) {
          toast({
            title: "Error",
            description: "Missing household information. Please start over from household setup.",
            variant: "destructive",
          });
          navigate('/onboarding/household');
          return;
        }
        householdId = households[0].id;
      }

      const { error } = await supabase
        .from('households')
        .update({ call_method_preference: selectedMethod })
        .eq('id', householdId);

      if (error) throw error;

      toast({
        title: "Call method selected",
        description: `You've chosen ${selectedMethod === 'batch_call' ? 'Automated Phone Calls' : 'In-App Calls'}`,
      });

      navigate('/onboarding/relative', { 
        state: { householdId: householdId }
      });
    } catch (error) {
      console.error('Error updating call method:', error);
      toast({
        title: "Error",
        description: "Failed to save your preference. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-warmth/10 via-background to-comfort/20 flex items-center justify-center p-4">
      <Card className="w-full max-w-3xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Choose Your Call Method</CardTitle>
          <CardDescription className="text-lg">
            Select how you'd like to connect with your loved ones. This choice cannot be changed later.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <RadioGroup value={selectedMethod} onValueChange={setSelectedMethod}>
            
            {/* Batch Call Option */}
            <div className="relative">
              <RadioGroupItem value="batch_call" id="batch_call" className="peer sr-only" />
              <Label 
                htmlFor="batch_call" 
                className="flex cursor-pointer rounded-lg border-2 border-muted bg-popover p-6 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
              >
                <div className="flex-1">
                  <div className="flex items-start space-x-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                      <Phone className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center space-x-2">
                        <h3 className="text-lg font-semibold">Automated Phone Calls</h3>
                        <CheckCircle2 className="h-5 w-5 text-green-600 opacity-0 peer-data-[state=checked]:opacity-100" />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        AI-powered phone calls automatically placed to your loved ones on schedule
                      </p>
                      <div className="grid grid-cols-2 gap-4 mt-4">
                        <div className="flex items-center space-x-2">
                          <Clock className="h-4 w-4 text-primary" />
                          <span className="text-xs">Scheduled calls</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Phone className="h-4 w-4 text-primary" />
                          <span className="text-xs">Regular phone</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Globe className="h-4 w-4 text-primary" />
                          <span className="text-xs">No app needed</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Users className="h-4 w-4 text-primary" />
                          <span className="text-xs">AI conversation</span>
                        </div>
                      </div>
                      <div className="mt-3 p-3 bg-primary/5 rounded-md">
                        <p className="text-xs text-muted-foreground">
                          <strong>Best for:</strong> Seniors who prefer traditional phone calls and don't want to use apps or technology
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </Label>
            </div>

            {/* In-App Call Option */}
            <div className="relative">
              <RadioGroupItem value="in_app_call" id="in_app_call" className="peer sr-only" />
              <Label 
                htmlFor="in_app_call" 
                className="flex cursor-pointer rounded-lg border-2 border-muted bg-popover p-6 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
              >
                <div className="flex-1">
                  <div className="flex items-start space-x-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary/10">
                      <Smartphone className="h-6 w-6 text-secondary" />
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center space-x-2">
                        <h3 className="text-lg font-semibold">In-App Calls</h3>
                        <CheckCircle2 className="h-5 w-5 text-green-600 opacity-0 peer-data-[state=checked]:opacity-100" />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Direct voice calls through the app with instant notifications
                      </p>
                      <div className="grid grid-cols-2 gap-4 mt-4">
                        <div className="flex items-center space-x-2">
                          <Smartphone className="h-4 w-4 text-secondary" />
                          <span className="text-xs">Voice calls</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Clock className="h-4 w-4 text-secondary" />
                          <span className="text-xs">Instant calls</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Users className="h-4 w-4 text-secondary" />
                          <span className="text-xs">Direct contact</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Globe className="h-4 w-4 text-secondary" />
                          <span className="text-xs">High quality</span>
                        </div>
                      </div>
                      <div className="mt-3 p-3 bg-secondary/5 rounded-md">
                        <p className="text-xs text-muted-foreground">
                          <strong>Best for:</strong> Tech-comfortable seniors who prefer using smartphone apps for direct communication
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </Label>
            </div>
          </RadioGroup>

          <div className="pt-4 space-y-4">
            <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                <strong>Important:</strong> This choice is permanent and cannot be changed later. Choose the method that best fits your loved one's comfort level with technology.
              </p>
            </div>
            
            <Button 
              onClick={handleContinue} 
              disabled={!selectedMethod || isLoading}
              className="w-full h-12 text-lg"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving Choice...
                </>
              ) : (
                'Continue to Add Relatives'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CallMethodSelection;