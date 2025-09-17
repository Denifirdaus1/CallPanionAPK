import { useState, useEffect } from "react";
import { useParams, Navigate } from "react-router-dom";
import { AlertTriangle, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import ElderlyDashboard from "@/components/ElderlyDashboard";

const SimplifiedElderlyInterface = () => {
  const { inviteToken } = useParams<{ inviteToken: string }>();
  const [isValidToken, setIsValidToken] = useState<boolean | null>(null);
  const [elderlyName, setElderlyName] = useState<string>("Dear Friend");
  const { toast } = useToast();
  const { sendFamilyAlert } = usePushNotifications();

  // Validate invite token on mount
  useEffect(() => {
    const validateToken = async () => {
      if (!inviteToken) {
        setIsValidToken(false);
        return;
      }

      try {
        // Call the public function to validate token
        const { data, error } = await supabase
          .rpc('validate_invite_token_public', { token_param: inviteToken });

        if (error || !data || data.length === 0) {
          console.error('Token validation failed:', error);
          setIsValidToken(false);
          return;
        }

        const invite = data[0];
        if (!invite.is_valid) {
          setIsValidToken(false);
          return;
        }

        setIsValidToken(true);
        // Set name based on email or use default
        const emailName = invite.email?.split('@')[0]?.replace(/[^a-zA-Z]/g, '') || "Friend";
        setElderlyName(emailName.charAt(0).toUpperCase() + emailName.slice(1));
        
      } catch (error) {
        console.error('Token validation error:', error);
        setIsValidToken(false);
      }
    };

    validateToken();
  }, [inviteToken]);

  const handleEmergencyHelp = async () => {
    try {
      await sendFamilyAlert(`Emergency help request from elderly interface (Token: ${inviteToken})`);
      toast({
        title: "Emergency Alert Sent",
        description: "Your family has been notified immediately"
      });
    } catch (error) {
      toast({
        title: "Alert Failed",
        description: "Please try calling your family directly",
        variant: "destructive"
      });
    }
  };

  // Loading state
  if (isValidToken === null) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-primary/5 flex items-center justify-center p-4">
        <Card className="p-8 text-center">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-lg text-foreground">Connecting...</p>
        </Card>
      </div>
    );
  }

  // Invalid token state
  if (isValidToken === false) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-primary/5 flex items-center justify-center p-4">
        <Card className="p-8 text-center max-w-md">
          <AlertTriangle className="h-16 w-16 text-destructive mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-foreground mb-4">Access Not Available</h2>
          <p className="text-foreground/80 mb-6 leading-relaxed">
            This link is no longer valid or has expired. Please contact your family member for a new invitation.
          </p>
          <Button 
            onClick={() => window.location.href = '/'}
            className="bg-primary hover:bg-primary/90"
            size="lg"
          >
            <Home className="h-4 w-4 mr-2" />
            Return Home
          </Button>
        </Card>
      </div>
    );
  }

  // Valid token - show dashboard
  return (
    <ElderlyDashboard 
      elderName={elderlyName}
      isTokenAccess={true}
      onEmergencyHelp={handleEmergencyHelp}
    />
  );
};

export default SimplifiedElderlyInterface;