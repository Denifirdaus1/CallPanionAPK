import { useState, useEffect } from "react";
import { Camera, Keyboard, CheckCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface ElderPairingProps {
  onPaired: (session: any, deviceId: string, householdId: string) => void;
}

export const ElderPairing = ({ onPaired }: ElderPairingProps) => {
  const [pairingCode, setPairingCode] = useState("");
  const [pairToken, setPairToken] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [deviceFingerprint, setDeviceFingerprint] = useState("");
  const { toast } = useToast();

  // Generate device fingerprint on mount
  useEffect(() => {
    const generateFingerprint = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      ctx!.textBaseline = 'top';
      ctx!.font = '14px Arial';
      ctx!.fillText('Device fingerprint', 2, 2);
      
      const fingerprint = [
        navigator.userAgent,
        navigator.language,
        screen.width + 'x' + screen.height,
        new Date().getTimezoneOffset(),
        canvas.toDataURL()
      ].join('|');
      
      return btoa(fingerprint).slice(0, 32);
    };

    setDeviceFingerprint(generateFingerprint());
  }, []);

  // Handle QR code scanning (URL parsing)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const code = urlParams.get('code');
    
    if (token && code) {
      setPairToken(token);
      setPairingCode(code);
      // Auto-attempt pairing
      handlePairing(code, token);
    }
  }, []);

  const handlePairing = async (code?: string, token?: string) => {
    const finalCode = code || pairingCode;
    const finalToken = token || pairToken;

    if (!finalCode || !finalToken) {
      toast({
        title: "Missing information",
        description: "Please enter both the 6-digit code and scan the QR code, or enter both manually.",
        variant: "destructive",
      });
      return;
    }

    setIsConnecting(true);
    try {
      // Step 1: Claim the device and get credentials
      const { data, error } = await supabase.functions.invoke('pair-claim', {
        body: {
          code: finalCode,
          pairToken: finalToken,
          device_fingerprint: deviceFingerprint
        }
      });

      if (error) throw error;

      // Step 2: Sign in with the returned credentials
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: data.device_email,
        password: data.temp_password
      });

      if (signInError) throw signInError;

      toast({
        title: "Device paired successfully!",
        description: "This device is now connected to the household.",
      });

      // Store device info securely (Supabase client handles session persistence)
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('callpanion_device_id', data.device_id);
          localStorage.setItem('callpanion_household_id', data.household_id);
        } catch (error) {
          console.warn('Failed to store device info locally:', error);
        }
      }

      // Pass the actual signed-in session
      onPaired(signInData.session, data.device_id, data.household_id);

    } catch (error: any) {
      console.error('Pairing failed:', error);
      toast({
        title: "Pairing failed",
        description: error.message || "Invalid code or QR token. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleManualPairing = () => {
    handlePairing();
  };

  // Simulate camera scanning (in a real app, integrate with @capacitor/camera)
  const handleCameraScan = () => {
    toast({
      title: "Camera not available",
      description: "Please use manual entry for now. In production, this would open the camera.",
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-comfort/20 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Connect to CallPanion</CardTitle>
          <CardDescription>
            Pair this device with your family's CallPanion household
          </CardDescription>
          <div className="mt-4 p-3 bg-muted/50 rounded-lg text-left">
            <p className="text-sm font-medium text-foreground mb-2">Setup Steps:</p>
            <ol className="text-xs text-muted-foreground space-y-1">
              <li>1. Get the 6-digit code and pair token from your family member</li>
              <li>2. Enter both values below or scan the QR code they shared</li>
            </ol>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="camera" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="camera" className="flex items-center gap-2">
                <Camera className="h-4 w-4" />
                QR Scan
              </TabsTrigger>
              <TabsTrigger value="manual" className="flex items-center gap-2">
                <Keyboard className="h-4 w-4" />
                Manual
              </TabsTrigger>
            </TabsList>

            <TabsContent value="camera" className="space-y-4">
              <div className="text-center space-y-4">
                <div className="aspect-square bg-muted/50 rounded-lg border-2 border-dashed border-muted-foreground/50 flex items-center justify-center">
                  <div className="text-center space-y-2">
                    <Camera className="h-12 w-12 mx-auto text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Camera view would appear here
                    </p>
                  </div>
                </div>
                <Button onClick={handleCameraScan} className="w-full" disabled={isConnecting}>
                  {isConnecting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <Camera className="h-4 w-4 mr-2" />
                      Open Camera
                    </>
                  )}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="manual" className="space-y-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="pairing-code">6-Digit Code</Label>
                  <Input
                    id="pairing-code"
                    placeholder="123456"
                    value={pairingCode}
                    onChange={(e) => setPairingCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="text-center text-2xl font-mono tracking-wider"
                    maxLength={6}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pair-token">Pair Token (from QR code)</Label>
                  <Input
                    id="pair-token"
                    placeholder="Token from family member"
                    value={pairToken}
                    onChange={(e) => setPairToken(e.target.value)}
                  />
                </div>
                <Button 
                  onClick={handleManualPairing} 
                  className="w-full" 
                  disabled={isConnecting || !pairingCode || !pairToken}
                >
                  {isConnecting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Connect Device
                    </>
                  )}
                </Button>
              </div>
            </TabsContent>
          </Tabs>

          <div className="mt-6 text-center text-xs text-muted-foreground">
            This device will be securely connected to your family's CallPanion household.
          </div>
        </CardContent>
      </Card>
    </div>
  );
};