import { useEffect, useState } from "react";
import { Phone, Heart, Camera, HelpCircle, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

const ElderAppPlaceholder = () => {
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [lastSeen, setLastSeen] = useState<Date>(new Date());
  const { toast } = useToast();

  useEffect(() => {
    // Load stored session data
    try {
      const storedDeviceId = localStorage.getItem('callpanion_device_id');
      const storedHouseholdId = localStorage.getItem('callpanion_household_id');
      
      if (storedDeviceId && storedHouseholdId) {
        setDeviceId(storedDeviceId);
        setHouseholdId(storedHouseholdId);
      }
    } catch (error) {
      console.warn('Failed to load stored session:', error);
    }

    // Update last seen periodically (health check)
    const interval = setInterval(() => {
      setLastSeen(new Date());
      // In real implementation, this would ping the backend
    }, 30000); // Every 30 seconds

    return () => clearInterval(interval);
  }, []);

  const handleHelpTrigger = () => {
    toast({
      title: "Help request sent",
      description: "Your family has been notified that you need assistance.",
    });
    // In real implementation, this would send an alert to family members
  };

  const simulateIncomingCall = () => {
    toast({
      title: "Incoming CallPanion call",
      description: "Your daily wellbeing check is starting...",
    });
    // In real implementation, this would handle the AI call
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-comfort/20 p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl text-comfort">CallPanion</CardTitle>
            <CardDescription>
              Welcome! Your device is connected to your family.
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Connection Status */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-6 w-6 text-success" />
                <div>
                  <h3 className="font-semibold">Connected</h3>
                  <p className="text-sm text-muted-foreground">
                    Last seen: {lastSeen.toLocaleTimeString()}
                  </p>
                </div>
              </div>
              {deviceId && (
                <div className="text-xs text-muted-foreground">
                  Device: {deviceId.slice(0, 8)}...
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Main Actions */}
        <div className="grid gap-4">
          <Card>
            <CardContent className="pt-6">
              <Button 
                onClick={simulateIncomingCall}
                className="w-full h-16 text-lg"
                variant="default"
              >
                <Phone className="h-6 w-6 mr-3" />
                Start Test Call
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <Button 
                onClick={handleHelpTrigger}
                className="w-full h-16 text-lg"
                variant="outline"
              >
                <HelpCircle className="h-6 w-6 mr-3" />
                I Need Help
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Recent Photos from Family */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Family Photos
            </CardTitle>
            <CardDescription>
              Recent photos shared by your family
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3].map((i) => (
                <div 
                  key={i}
                  className="aspect-square bg-muted/50 rounded-lg border flex items-center justify-center"
                >
                  <Heart className="h-6 w-6 text-muted-foreground" />
                </div>
              ))}
            </div>
            <p className="text-sm text-muted-foreground mt-3">
              No new photos yet. Family members can share photos through the CallPanion app.
            </p>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground pt-6">
          This is a demonstration interface. In production, this would be the elder's main CallPanion interface.
        </div>
      </div>
    </div>
  );
};

export default ElderAppPlaceholder;