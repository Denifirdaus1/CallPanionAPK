import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Smartphone, QrCode as QrCodeIcon, Copy, RefreshCw, CheckCircle, AlertCircle, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCallMethodAccess } from "@/hooks/useCallMethodAccess";
import QRCode from "react-qr-code";

interface PairingToken {
  id: string;
  pair_token: string;
  code_6: string;
  relative_id?: string;
  expires_at: string;
  claimed_at?: string;
  created_at: string;
  device_label?: string;
}

interface Relative {
  id: string;
  first_name: string;
  last_name: string;
  household_id: string;
}

export const DevicePairingManager = () => {
  const [relatives, setRelatives] = useState<Relative[]>([]);
  const [pairingTokens, setPairingTokens] = useState<PairingToken[]>([]);
  const [selectedRelative, setSelectedRelative] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedTokenForQR, setSelectedTokenForQR] = useState<PairingToken | null>(null);
  const { toast } = useToast();
  const { hasInAppCallAccess, isLoading: accessLoading } = useCallMethodAccess();

  useEffect(() => {
    if (hasInAppCallAccess) {
      loadData();
    }
  }, [hasInAppCallAccess]);

  const loadData = async () => {
    try {
      // Get user's households and relatives
      const { data: householdData, error: householdError } = await supabase
        .from('household_members')
        .select('household_id')
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id);

      if (householdError) throw householdError;

      const householdIds = householdData?.map(h => h.household_id) || [];

      if (householdIds.length === 0) {
        setRelatives([]);
        setPairingTokens([]);
        return;
      }

      // Get relatives with household_id
      const { data: relativesData, error: relativesError } = await supabase
        .from('relatives')
        .select('id, first_name, last_name, household_id')
        .in('household_id', householdIds);

      if (relativesError) throw relativesError;
      setRelatives(relativesData || []);

      // Get recent pairing tokens from device_pairs table
      const { data: tokensData, error: tokensError } = await supabase
        .from('device_pairs')
        .select('*')
        .eq('created_by', (await supabase.auth.getUser()).data.user?.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (tokensError) throw tokensError;
      setPairingTokens(tokensData || []);

    } catch (error: any) {
      console.error('Error loading pairing data:', error);
      toast({
        title: "Error",
        description: "Failed to load pairing data",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const generatePairingToken = async () => {
    if (!selectedRelative) {
      toast({
        title: "Error",
        description: "Please select a relative first",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);
    try {
      const relative = relatives.find(r => r.id === selectedRelative);
      if (!relative) throw new Error('Relative not found');

      // Create device pair directly
      const pairToken = Math.random().toString(36).substring(2, 8).toUpperCase();
      const code6 = Math.random().toString().substring(2, 8);
      
      const { data, error } = await supabase
        .from('device_pairs')
        .insert({
          household_id: relative.household_id,
          relative_id: selectedRelative,
          pair_token: pairToken,
          code_6: code6,
          expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // Permanent (1 year)
          created_by: (await supabase.auth.getUser()).data.user?.id,
          device_label: `${relative.first_name}'s Device`
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Pairing Token Generated",
        description: `Token generated for ${relative.first_name} ${relative.last_name}`,
      });

      setIsDialogOpen(false);
      setSelectedRelative("");
      loadData(); // Reload to show new token

    } catch (error: any) {
      console.error('Error generating pairing token:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to generate pairing token",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied",
        description: "Token copied to clipboard",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy token",
        variant: "destructive"
      });
    }
  };

  const isTokenExpired = (token: PairingToken) => {
    return false; // Tokens are now permanent
  };

  const getTokenStatus = (token: PairingToken) => {
    if (token.claimed_at) {
      return { label: "Used", color: "bg-green-100 text-green-800" };
    }
    return { label: "Active", color: "bg-blue-100 text-blue-800" };
  };

  const showQRCodeDialog = (token: PairingToken) => {
    setSelectedTokenForQR(token);
  };

  const getRelativeName = (relativeId?: string) => {
    if (!relativeId) return 'Unknown';
    const relative = relatives.find(r => r.id === relativeId);
    return relative ? `${relative.first_name} ${relative.last_name}` : 'Unknown';
  };

  if (accessLoading || isLoading) {
    return (
      <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <QrCodeIcon className="h-5 w-5" />
          <span>Device Pairing</span>
        </CardTitle>
      </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
            <p className="text-muted-foreground mt-2">Loading pairing data...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!hasInAppCallAccess) {
    return (
      <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <QrCodeIcon className="h-5 w-5" />
          <span>Device Pairing</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Device pairing is only available for households with in-app call access.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}

return (
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center space-x-2">
        <QrCodeIcon className="h-5 w-5" />
        <span>Device Pairing</span>
      </CardTitle>
        <CardDescription>
          Generate permanent pairing tokens to connect elderly devices to the CallPanion app
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* APK Download Section - only show if no pairing tokens yet */}
        {pairingTokens.length === 0 && (
          <Alert>
            <Smartphone className="h-4 w-4" />
            <AlertTitle>First Time Setup?</AlertTitle>
            <AlertDescription className="space-y-2">
              <p className="text-sm">
                Before generating a pairing code, make sure the CallPanion app 
                is installed on your relative's device.
              </p>
              <Button variant="outline" size="sm" asChild>
                <a href="/elderly-app/setup" target="_blank">
                  <Download className="mr-2 h-4 w-4" />
                  Download App & Instructions
                </a>
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Generate New Token */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full">
              <Smartphone className="h-4 w-4 mr-2" />
              Generate Pairing Token
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Generate Pairing Token</DialogTitle>
              <DialogDescription>
                Select a relative to generate a pairing token for their device
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="relative">Select Relative</Label>
                <select
                  id="relative"
                  value={selectedRelative}
                  onChange={(e) => setSelectedRelative(e.target.value)}
                  className="w-full p-2 border rounded-md bg-background"
                >
                  <option value="">Choose a relative...</option>
                  {relatives.map((relative) => (
                    <option key={relative.id} value={relative.id}>
                      {relative.first_name} {relative.last_name}
                    </option>
                  ))}
                </select>
              </div>

              <Button 
                onClick={generatePairingToken}
                disabled={!selectedRelative || isGenerating}
                className="w-full"
              >
              {isGenerating ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                  Generating...
                </>
              ) : (
                <>
                  <QrCodeIcon className="h-4 w-4 mr-2" />
                  Generate Token
                </>
              )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Recent Tokens */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Recent Pairing Tokens</h3>
            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              className="flex items-center space-x-1"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Refresh</span>
            </Button>
          </div>

          {pairingTokens.length === 0 ? (
            <div className="text-center py-6 border border-dashed rounded-lg">
              <QrCodeIcon className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No pairing tokens generated yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {pairingTokens.map((token) => {
                const status = getTokenStatus(token);
                return (
                  <div key={token.id} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${status.color}`}>
                          {status.label}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {new Date(token.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => showQRCodeDialog(token)}
                        >
                          <QrCodeIcon className="h-4 w-4 mr-1" />
                          Show QR
                        </Button>
                        {!token.claimed_at && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyToClipboard(token.code_6)}
                          >
                            <Copy className="h-4 w-4 mr-1" />
                            Copy
                          </Button>
                        )}
                      </div>
                    </div>
                    
                    <div className="bg-muted/30 rounded p-2">
                      <p className="text-xs font-mono break-all text-center">
                        {token.code_6}
                      </p>
                    </div>
                    
                    <div className="text-xs text-muted-foreground">
                      Status: Permanent - No expiry
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Instructions */}
        <Alert>
          <Smartphone className="h-4 w-4" />
          <AlertDescription>
            <strong>How to use:</strong> Generate a pairing token and share it with your elderly relative. 
            They can enter this token manually or scan the QR code in their CallPanion mobile app to connect their device for in-app calls.
          </AlertDescription>
        </Alert>

        {/* QR Code Dialog */}
        <Dialog open={!!selectedTokenForQR} onOpenChange={() => setSelectedTokenForQR(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-center">Scan QR Code to Pair Device</DialogTitle>
              <DialogDescription className="text-center">
                {selectedTokenForQR && (
                  <>Pairing code for {getRelativeName(selectedTokenForQR.relative_id)}</>
                )}
              </DialogDescription>
            </DialogHeader>
            
            {selectedTokenForQR && (
              <div className="space-y-4">
                {/* QR Code Display */}
                <div className="flex justify-center py-6 bg-white rounded-lg border-2">
                  <QRCode 
                    value={selectedTokenForQR.code_6} 
                    size={280}
                    level="H"
                  />
                </div>
                
                {/* Token Code Display */}
                <div className="text-center space-y-2">
                  <p className="text-sm text-muted-foreground">Or enter this code manually:</p>
                  <div className="bg-muted/50 rounded-lg p-4">
                    <p className="text-2xl font-mono font-bold tracking-wider">
                      {selectedTokenForQR.code_6}
                    </p>
                  </div>
                </div>

                {/* Copy Button */}
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    copyToClipboard(selectedTokenForQR.code_6);
                  }}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Pairing Code
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};