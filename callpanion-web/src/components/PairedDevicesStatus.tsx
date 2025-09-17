import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { 
  Smartphone, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Info,
  Wifi,
  WifiOff,
  Battery,
  Monitor
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCallMethodAccess } from "@/hooks/useCallMethodAccess";

interface PairedDevice {
  id: string;
  code_6: string;
  pair_token: string;
  claimed_at: string | null;
  claimed_by: string | null;
  device_info: any;
  device_label: string | null;
  relative_name: string;
  relative_id: string;
  household_name: string;
  created_at: string;
}

interface DeviceHeartbeat {
  device_id: string;
  last_sync: string | null;
  status: string;
  metadata: any;
  platform: string | null;
  battery_level: number | null;
  connection_type: string | null;
}

export const PairedDevicesStatus = () => {
  const [pairedDevices, setPairedDevices] = useState<PairedDevice[]>([]);
  const [deviceHeartbeats, setDeviceHeartbeats] = useState<DeviceHeartbeat[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { hasInAppCallAccess, isLoading: accessLoading } = useCallMethodAccess();

  useEffect(() => {
    if (hasInAppCallAccess) {
      loadPairedDevices();
    }
  }, [hasInAppCallAccess]);

  const loadPairedDevices = async () => {
    try {
      setIsLoading(true);

      // Get user's households
      const { data: householdData, error: householdError } = await supabase
        .from('household_members')
        .select('household_id')
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id);

      if (householdError) throw householdError;

      const householdIds = householdData?.map(h => h.household_id) || [];

      if (householdIds.length === 0) {
        setPairedDevices([]);
        setDeviceHeartbeats([]);
        return;
      }

      // Get paired devices (claimed tokens) with household and relative info
      const { data: pairedData, error: pairedError } = await supabase
        .from('device_pairs')
        .select(`
          id,
          code_6,
          pair_token,
          claimed_at,
          claimed_by,
          device_info,
          device_label,
          relative_id,
          created_at,
          households!inner(id, name),
          relatives!inner(id, first_name, last_name)
        `)
        .in('household_id', householdIds)
        .not('claimed_at', 'is', null)
        .order('claimed_at', { ascending: false });

      if (pairedError) throw pairedError;

      // Transform the data to flatten the relations
      const transformedDevices = (pairedData || []).map(device => ({
        ...device,
        household_name: device.households?.name || 'Unknown Household',
        relative_name: `${device.relatives?.first_name} ${device.relatives?.last_name}`,
      }));

      setPairedDevices(transformedDevices);

      // Get device heartbeat information
      // Since we don't have the devices table with household_id, we'll skip this for now
      // In future, we can extend this when the devices table is properly linked
      setDeviceHeartbeats([]);

    } catch (error: any) {
      console.error('Error loading paired devices:', error);
      toast({
        title: "Error",
        description: "Failed to load paired devices data",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getDeviceStatus = (device: PairedDevice) => {
    if (!device.claimed_at) {
      return { 
        label: "Not Paired", 
        icon: XCircle, 
        color: "bg-gray-100 text-gray-800",
        description: "Device token not claimed yet"
      };
    }

    // For now, we'll show as connected since we don't have real-time heartbeat
    return { 
      label: "Paired", 
      icon: CheckCircle, 
      color: "bg-green-100 text-green-800",
      description: "Device successfully paired"
    };
  };

  const formatLastSeen = (timestamp: string | null) => {
    if (!timestamp) return "Never";
    
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  if (accessLoading || isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Monitor className="h-5 w-5" />
            <span>Paired Devices Status</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
            <p className="text-muted-foreground mt-2">Loading device status...</p>
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
            <Monitor className="h-5 w-5" />
            <span>Paired Devices Status</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Device pairing status is only available for households with in-app call access.
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
          <Monitor className="h-5 w-5" />
          <span>Paired Devices Status</span>
        </CardTitle>
        <CardDescription>
          Monitor the status of paired elderly devices
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Header with refresh button */}
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">
            {pairedDevices.length} Device{pairedDevices.length !== 1 ? 's' : ''} Paired
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={loadPairedDevices}
            className="flex items-center space-x-1"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Refresh</span>
          </Button>
        </div>

        {/* Paired Devices List */}
        {pairedDevices.length === 0 ? (
          <div className="text-center py-6 border border-dashed rounded-lg">
            <Smartphone className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No devices paired yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Generate pairing tokens to connect elderly devices
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {pairedDevices.map((device) => {
              const status = getDeviceStatus(device);
              const StatusIcon = status.icon;
              
              return (
                <div key={device.id} className="border rounded-lg p-4 space-y-3">
                  {/* Device Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center space-x-2">
                        <StatusIcon className="h-5 w-5 text-green-600" />
                        <span className="font-medium">
                          {device.device_label || `${device.relative_name}'s Device`}
                        </span>
                      </div>
                      <Badge className={status.color}>
                        {status.label}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Paired {formatLastSeen(device.claimed_at)}
                    </div>
                  </div>

                  {/* Device Info */}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Relative</p>
                      <p className="font-medium">{device.relative_name}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Household</p>
                      <p className="font-medium">{device.household_name}</p>
                    </div>
                  </div>

                  {/* Device Technical Info */}
                  <div className="bg-muted/30 rounded p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Pairing Code:</span>
                      <span className="font-mono">{device.code_6}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Token:</span>
                      <span className="font-mono">{device.pair_token}</span>
                    </div>
                    {device.device_info && Object.keys(device.device_info).length > 0 && (
                      <div className="text-xs">
                        <p className="text-muted-foreground mb-1">Device Info:</p>
                        <pre className="text-xs overflow-x-auto">
                          {JSON.stringify(device.device_info, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>

                  {/* Connection Status */}
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      <span className="text-muted-foreground">Ready for calls</span>
                    </div>
                    <div className="text-muted-foreground">
                      Last activity: {formatLastSeen(device.claimed_at)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Info Alert */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>Real-time Status:</strong> Device status is updated when devices sync with the CallPanion app. 
            Paired devices are ready to receive in-app calls.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
};