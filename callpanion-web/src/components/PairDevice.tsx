import { useState, useEffect } from "react";
import { QrCode, Copy, CheckCircle, Clock, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import QRCode from "react-qr-code";

interface PairDeviceProps {
  householdId: string;
  onPaired?: (deviceId: string) => void;
}

interface PairingSession {
  pairToken: string;
  code: string;
  expiresAt: string;
  qrPayload: string;
}

export const PairDevice = ({ householdId, onPaired }: PairDeviceProps) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [pairingSession, setPairingSession] = useState<PairingSession | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [deviceLabel, setDeviceLabel] = useState("Elder Device");
  const [isPaired, setIsPaired] = useState(false);
  const { toast } = useToast();

  // Generate QR code and pairing session
  const initiatePairing = async () => {
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('pair-init', {
        body: {
          household_id: householdId,
          device_label: deviceLabel
        }
      });

      if (error) throw error;

      setPairingSession(data);
      setTimeRemaining(600); // 10 minutes
      toast({
        title: "Pairing session created",
        description: "Show the QR code or share the 6-digit code with the elder device.",
      });

      // Subscribe to pairing completion
      const channel = supabase.channel(`pairing:${householdId}`);
      channel
        .on('broadcast', { event: 'pairing.completed' }, (payload) => {
          setIsPaired(true);
          toast({
            title: "Device paired successfully!",
            description: `${payload.payload.device_name} has been connected.`,
          });
          onPaired?.(payload.payload.device_id);
        })
        .subscribe();

    } catch (error: any) {
      console.error('Pairing initiation failed:', error);
      toast({
        title: "Failed to start pairing",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Countdown timer
  useEffect(() => {
    if (timeRemaining > 0 && !isPaired) {
      const timer = setTimeout(() => {
        setTimeRemaining(timeRemaining - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (timeRemaining === 0 && pairingSession && !isPaired) {
      setPairingSession(null);
      toast({
        title: "Pairing session expired",
        description: "Please start a new pairing session.",
        variant: "destructive",
      });
    }
  }, [timeRemaining, isPaired, pairingSession]);

  // Copy to clipboard
  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied to clipboard",
        description: `${label} copied successfully.`,
      });
    } catch (error) {
      console.error('Copy failed:', error);
    }
  };

  // Format time remaining
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Pair Elder Device
          </CardTitle>
          <CardDescription>
            Connect a new elder device to this household using QR code or 6-digit code pairing.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!pairingSession && !isPaired && (
            <>
              <div className="space-y-2">
                <Label htmlFor="device-label">Device Label</Label>
                <Input
                  id="device-label"
                  value={deviceLabel}
                  onChange={(e) => setDeviceLabel(e.target.value)}
                  placeholder="e.g., Grandma's Tablet"
                />
              </div>
              <Button 
                onClick={initiatePairing} 
                disabled={isGenerating}
                className="w-full"
              >
                {isGenerating ? "Creating pairing session..." : "Start Pairing"}
              </Button>
            </>
          )}

          {pairingSession && !isPaired && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Time remaining:</span>
                </div>
                <span className="font-mono text-lg">{formatTime(timeRemaining)}</span>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                {/* QR Code Section */}
                <Card>
                  <CardHeader className="pb-4">
                    <CardTitle className="text-lg">QR Code</CardTitle>
                    <CardDescription>
                      Open camera app on elder device and scan this code
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-center p-6 bg-background rounded-lg border-2">
                      <QRCode 
                        value={pairingSession.qrPayload}
                        size={128}
                        bgColor="hsl(var(--background))"
                        fgColor="hsl(var(--foreground))"
                      />
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => copyToClipboard(pairingSession.qrPayload, "QR code URL")}
                      className="w-full"
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copy QR URL
                    </Button>
                  </CardContent>
                </Card>

                {/* Manual Pairing Section */}
                <Card>
                  <CardHeader className="pb-4">
                    <CardTitle className="text-lg">Manual Pairing</CardTitle>
                    <CardDescription>
                      For manual setup on the elder device
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      <div>
                        <Label className="text-xs font-medium text-muted-foreground">6-DIGIT CODE</Label>
                        <div className="text-3xl font-mono font-bold tracking-wider p-4 bg-primary/10 rounded-lg border-2 border-primary/20 text-center">
                          {pairingSession.code}
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs font-medium text-muted-foreground">PAIR TOKEN</Label>
                        <div className="text-sm font-mono p-3 bg-muted rounded border break-all">
                          {pairingSession.pairToken}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(pairingSession.code, "6-digit code")}
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        Copy Code
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(pairingSession.pairToken, "Pair token")}
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        Copy Token
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="text-center text-sm text-muted-foreground space-y-2">
                <p>The elder device will connect automatically once the pairing details are entered or QR code is scanned.</p>
                <div className="text-xs border-t pt-3 space-y-1">
                  <p><strong>Elder Pairing URL:</strong></p>
                  <code className="bg-muted px-2 py-1 rounded text-xs break-all">
                    {pairingSession.qrPayload.split('?')[0]}
                  </code>
                  <p className="mt-2">
                    <strong>Instructions:</strong> Open the Elder app, go to pairing, and enter both the 6-digit code and pair token above.
                  </p>
                </div>
              </div>
            </div>
          )}

          {isPaired && (
            <div className="text-center space-y-4">
              <CheckCircle className="h-16 w-16 text-success mx-auto" />
              <div>
                <h3 className="text-lg font-semibold text-success">Device Paired Successfully!</h3>
                <p className="text-muted-foreground">
                  The elder device is now connected to your household.
                </p>
              </div>
              <Button
                onClick={() => {
                  setPairingSession(null);
                  setIsPaired(false);
                  setDeviceLabel("Elder Device");
                }}
                variant="outline"
              >
                Pair Another Device
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};