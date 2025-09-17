import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Smartphone, QrCode, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

const DevicePairing: React.FC = () => {
  const { user } = useAuth();
  const [relatives, setRelatives] = useState<any[]>([]);
  const [selectedRelative, setSelectedRelative] = useState<string>('');
  const [pairingCode, setPairingCode] = useState<string>('');
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    fetchRelatives();
  }, []);

  const fetchRelatives = async () => {
    try {
      setIsLoading(true);
      
      // Get user's household
      const { data: householdMembers, error: householdError } = await supabase
        .from('household_members')
        .select('household_id')
        .eq('user_id', user?.id)
        .single();

      if (householdError || !householdMembers) {
        throw new Error('No household found');
      }

      // Get relatives in the household
      const { data: relativesData, error: relativesError } = await supabase
        .from('relatives')
        .select('*')
        .eq('household_id', householdMembers.household_id)
        .is('inactive_since', null);

      if (relativesError) {
        throw relativesError;
      }

      setRelatives(relativesData || []);
    } catch (error: any) {
      console.error('Error fetching relatives:', error);
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const generatePairingCode = async () => {
    if (!selectedRelative) {
      toast.error('Please select a relative first');
      return;
    }

    try {
      setIsGeneratingCode(true);
      setError('');

      const relative = relatives.find(r => r.id === selectedRelative);
      if (!relative) throw new Error('Relative not found');

      // Generate code directly in database (same as DevicePairingManager)
      const code6 = Math.floor(100000 + Math.random() * 900000).toString();
      const pairToken = crypto.randomUUID();
      
      const { data, error } = await supabase
        .from('device_pairs')
        .insert({
          household_id: relative.household_id,
          relative_id: selectedRelative,
          pair_token: pairToken,
          code_6: code6,
          expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes
          created_by: user?.id,
          device_label: `${relative.first_name}'s Device`
        })
        .select()
        .single();

      if (error) throw error;

      setPairingCode(code6);
      toast.success('Pairing code generated successfully!');
    } catch (error: any) {
      console.error('Error generating pairing code:', error);
      setError(error.message);
      toast.error('Failed to generate pairing code');
    } finally {
      setIsGeneratingCode(false);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(pairingCode);
      toast.success('Pairing code copied to clipboard!');
    } catch (error) {
      toast.error('Failed to copy to clipboard');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-primary mb-2">Device Pairing</h1>
        <p className="text-muted-foreground">
          Generate a pairing code to connect an elderly device to your household
        </p>
      </div>

      {error && (
        <Alert className="mb-6 border-destructive/50 text-destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-6">
        {/* Step 1: Select Relative */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm">1</span>
              Select Relative
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Label htmlFor="relative-select">Choose the relative who will use this device:</Label>
              <select
                id="relative-select"
                value={selectedRelative}
                onChange={(e) => setSelectedRelative(e.target.value)}
                className="w-full p-3 border rounded-md bg-background"
                disabled={isGeneratingCode}
              >
                <option value="">Select a relative...</option>
                {relatives.map((relative) => (
                  <option key={relative.id} value={relative.id}>
                    {relative.first_name} {relative.last_name}
                    {relative.town && ` (${relative.town})`}
                  </option>
                ))}
              </select>
              
              {relatives.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No relatives found. Please add a relative first in the Relatives section.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Step 2: Generate Code */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm">2</span>
              Generate Pairing Code
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Button
                onClick={generatePairingCode}
                disabled={!selectedRelative || isGeneratingCode}
                className="w-full"
                size="lg"
              >
                {isGeneratingCode ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating Code...
                  </>
                ) : (
                  <>
                    <QrCode className="mr-2 h-4 w-4" />
                    Generate Pairing Code
                  </>
                )}
              </Button>

              {pairingCode && (
                <div className="bg-muted p-6 rounded-lg text-center space-y-4">
                  <div className="flex items-center justify-center gap-2 text-green-600">
                    <CheckCircle className="h-5 w-5" />
                    <span className="font-medium">Code Generated!</span>
                  </div>
                  
                  <div className="bg-background p-4 rounded-md border-2 border-dashed border-muted-foreground/30">
                    <div className="text-4xl font-mono font-bold tracking-wider text-primary">
                      {pairingCode}
                    </div>
                  </div>
                  
                  <Button variant="outline" onClick={copyToClipboard} className="w-full">
                    Copy Code
                  </Button>
                  
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>⏰ This code expires in 10 minutes</p>
                    <p>📱 Share this code with your relative to pair their device</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Step 3: Instructions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm">3</span>
              Instructions for Elderly Device
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <Smartphone className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">On the CallPanion elderly app:</p>
                  <ol className="list-decimal list-inside space-y-1 text-muted-foreground mt-1 ml-4">
                    <li>Open the CallPanion app</li>
                    <li>Tap "Pair Device" when prompted</li>
                    <li>Enter the 6-digit code shown above</li>
                    <li>Tap "Connect Device"</li>
                  </ol>
                </div>
              </div>
              
              <Alert>
                <AlertDescription>
                  <strong>Important:</strong> Make sure the elderly device is connected to the internet 
                  and has the latest version of the CallPanion app installed.
                </AlertDescription>
              </Alert>
            </div>
          </CardContent>
        </Card>

        {/* Refresh Button */}
        <div className="flex justify-center">
          <Button variant="outline" onClick={fetchRelatives} disabled={isLoading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh Relatives
          </Button>
        </div>
      </div>
    </div>
  );
};

export default DevicePairing;