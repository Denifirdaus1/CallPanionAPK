import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Phone, Heart, Camera, HelpCircle, CheckCircle, LogOut, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import ElderUpcomingEvents from "@/components/ElderUpcomingEvents";

const ElderHome = () => {
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [lastSeen, setLastSeen] = useState<Date>(new Date());
  const [isOnline, setIsOnline] = useState(true);
  const { toast } = useToast();
  const { user, session, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to pairing if not signed in
    if (!session || !user) {
      navigate('/pair');
      return;
    }

    // Load stored device info
    try {
      const storedDeviceId = localStorage.getItem('callpanion_device_id');
      const storedHouseholdId = localStorage.getItem('callpanion_household_id');
      
      if (storedDeviceId && storedHouseholdId) {
        setDeviceId(storedDeviceId);
        setHouseholdId(storedHouseholdId);
      } else {
        // If no device info but signed in, redirect to pairing
        navigate('/pair');
        return;
      }
    } catch (error) {
      console.warn('Failed to load stored device info:', error);
      navigate('/pair');
      return;
    }

    // Set up heartbeat to update last_seen_at
    const updateHeartbeat = async () => {
      setLastSeen(new Date());
      // In production, this would update last_seen_at in the devices table
      try {
        // This could be implemented as an edge function call or RPC
        console.log('Heartbeat updated:', new Date().toISOString());
      } catch (error) {
        console.warn('Heartbeat update failed:', error);
        setIsOnline(false);
      }
    };

    updateHeartbeat(); // Initial heartbeat
    const heartbeatInterval = setInterval(updateHeartbeat, 30000); // Every 30 seconds

    // Optional: Set up realtime subscription to device channel
    let realtimeChannel;
    if (deviceId) {
      realtimeChannel = supabase
        .channel(`device:${deviceId}`)
        .on('broadcast', { event: 'ping' }, () => {
          console.log('Received ping from family');
        })
        .subscribe();
    }

    return () => {
      clearInterval(heartbeatInterval);
      if (realtimeChannel) {
        supabase.removeChannel(realtimeChannel);
      }
    };
  }, [session, user, navigate, deviceId]);

  const handleHelpTrigger = () => {
    toast({
      title: "Help request sent",
      description: "Your family has been notified that you need assistance.",
    });
    // In production, this would trigger a family alert
  };

  const simulateIncomingCall = () => {
    toast({
      title: "Incoming CallPanion call",
      description: "Your daily wellbeing check is starting...",
    });
    // In production, this would handle the AI call
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      // Clear device info
      localStorage.removeItem('callpanion_device_id');
      localStorage.removeItem('callpanion_household_id');
      navigate('/pair');
    } catch (error) {
      console.error('Sign out failed:', error);
    }
  };

  if (!session || !deviceId) {
    return null; // Will redirect via useEffect
  }

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
                <div className="flex items-center gap-2">
                  {isOnline ? (
                    <CheckCircle className="h-6 w-6 text-success" />
                  ) : (
                    <Wifi className="h-6 w-6 text-warning" />
                  )}
                  <div>
                    <h3 className="font-semibold">
                      {isOnline ? 'Connected' : 'Reconnecting...'}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Last seen: {lastSeen.toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              </div>
              <div className="text-right">
                {deviceId && (
                  <div className="text-xs text-muted-foreground">
                    Device: {deviceId.slice(0, 8)}...
                  </div>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSignOut}
                  className="mt-1 text-xs w-auto px-2 py-1 h-auto shrink-0"
                >
                  <LogOut className="h-3 w-3 mr-1" />
                  Sign Out
                </Button>
              </div>
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

        {/* Upcoming Events */}
        <ElderUpcomingEvents />

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

        {/* Status Info */}
        <div className="text-center text-xs text-muted-foreground pt-6 space-y-1">
          <div>Elder Device Interface - Connected to Household</div>
          {user?.email && (
            <div>Device Account: {user.email}</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ElderHome;