import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { Smartphone, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCallMethodAccess } from "@/hooks/useCallMethodAccess";
import { InAppCallScheduleManager } from "./InAppCallScheduleManager";
import { DevicePairingManager } from "./DevicePairingManager";
import { InAppCallMonitor } from "./InAppCallMonitor";
import { InAppCallSummaryViewer } from "./InAppCallSummaryViewer";
import { ConversationInsightsDashboard } from "./ConversationInsightsDashboard";

interface InAppCallStats {
  total_sessions: number;
  completed_calls: number;
  missed_calls: number;
  active_devices: number;
}

export const InAppCallDashboard = () => {
  const [stats, setStats] = useState<InAppCallStats>({
    total_sessions: 0,
    completed_calls: 0,
    missed_calls: 0,
    active_devices: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { hasInAppCallAccess, isLoading: accessLoading } = useCallMethodAccess();

  useEffect(() => {
    if (hasInAppCallAccess) {
      loadInAppCallStats();
    }
  }, [hasInAppCallAccess]);

  const loadInAppCallStats = async () => {
    try {
      // Get user's households
      const { data: householdData, error: householdError } = await supabase
        .from('household_members')
        .select('household_id')
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id);

      if (householdError) throw householdError;

      const householdIds = householdData?.map(h => h.household_id) || [];

      if (householdIds.length === 0) {
        setStats({
          total_sessions: 0,
          completed_calls: 0,
          missed_calls: 0,
          active_devices: 0
        });
        return;
      }

      // Get call statistics
      const { data: callLogsData, error: logsError } = await supabase
        .from('call_logs')
        .select('call_outcome')
        .in('household_id', householdIds)
        .eq('call_type', 'in_app_call');

      if (logsError) throw logsError;

      // Get active devices count
      const { data: devicesData, error: devicesError } = await supabase
        .from('device_pairs')
        .select('id')
        .in('household_id', householdIds)
        .not('claimed_at', 'is', null);

      if (devicesError) throw devicesError;

      // Calculate stats
      const totalSessions = callLogsData?.length || 0;
      const completedCalls = callLogsData?.filter(log => log.call_outcome === 'answered').length || 0;
      const missedCalls = callLogsData?.filter(log => ['missed', 'failed', 'busy'].includes(log.call_outcome)).length || 0;
      const activeDevices = devicesData?.length || 0;

      setStats({
        total_sessions: totalSessions,
        completed_calls: completedCalls,
        missed_calls: missedCalls,
        active_devices: activeDevices
      });

    } catch (error: any) {
      console.error('Error loading in-app call stats:', error);
      toast({
        title: "Error",
        description: "Failed to load in-app call statistics",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (accessLoading || isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Smartphone className="h-5 w-5" />
            <span>In-App Call Dashboard</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
            <p className="text-muted-foreground mt-2">Loading dashboard...</p>
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
            <Smartphone className="h-5 w-5" />
            <span>In-App Call Dashboard</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Your household is not configured for in-app calls. This feature allows family members to schedule calls that are delivered directly to your relatives' mobile devices through the CallPanion app instead of traditional phone calls.
              <br /><br />
              Contact support to enable in-app calling for your household.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm bg-card/50 backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Sessions</p>
                <p className="text-2xl font-bold text-foreground mt-1">{stats.total_sessions}</p>
              </div>
              <div className="h-8 w-8 bg-primary/10 rounded-full flex items-center justify-center">
                <Smartphone className="h-4 w-4 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-0 shadow-sm bg-card/50 backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Completed</p>
                <p className="text-2xl font-bold text-foreground mt-1">{stats.completed_calls}</p>
              </div>
              <div className="h-8 w-8 bg-green-500/10 rounded-full flex items-center justify-center">
                <Smartphone className="h-4 w-4 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-0 shadow-sm bg-card/50 backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Missed</p>
                <p className="text-2xl font-bold text-foreground mt-1">{stats.missed_calls}</p>
              </div>
              <div className="h-8 w-8 bg-red-500/10 rounded-full flex items-center justify-center">
                <Smartphone className="h-4 w-4 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-0 shadow-sm bg-card/50 backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Active Devices</p>
                <p className="text-2xl font-bold text-foreground mt-1">{stats.active_devices}</p>
              </div>
              <div className="h-8 w-8 bg-blue-500/10 rounded-full flex items-center justify-center">
                <Smartphone className="h-4 w-4 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Dashboard Content */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Smartphone className="h-5 w-5" />
            <span>In-App Call Management</span>
          </CardTitle>
          <CardDescription>
            Manage device pairing, monitor call sessions, and track in-app call activity
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="insights" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="insights">AI Insights</TabsTrigger>
              <TabsTrigger value="summaries">Call Results</TabsTrigger>
              <TabsTrigger value="monitor">Monitor</TabsTrigger>
              <TabsTrigger value="pairing">Device Pairing</TabsTrigger>
              <TabsTrigger value="sessions">Sessions</TabsTrigger>
            </TabsList>
            
            <TabsContent value="insights" className="mt-6">
              <ConversationInsightsDashboard />
            </TabsContent>
            
            <TabsContent value="summaries" className="mt-6">
              <InAppCallSummaryViewer />
            </TabsContent>
            
            <TabsContent value="monitor" className="mt-6">
              <InAppCallMonitor />
            </TabsContent>
            
            <TabsContent value="pairing" className="mt-6">
              <DevicePairingManager />
            </TabsContent>
            
            <TabsContent value="sessions" className="mt-6">
              <InAppCallScheduleManager />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};