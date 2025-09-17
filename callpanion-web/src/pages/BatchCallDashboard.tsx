import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Phone, Users, Calendar, TrendingUp, Settings } from "lucide-react";
import CallSummaryDashboard from "@/components/CallSummaryDashboard";
import { CallScheduleManager } from "@/components/CallScheduleManager";
import { SettingsSidebar } from "@/components/SettingsSidebar";


interface Household {
  id: string;
  name: string;
  city: string;
  country: string;
  call_method_preference: string;
}

interface Relative {
  id: string;
  first_name: string;
  last_name: string;
  phone_e164: string | null;
  call_cadence: string;
  timezone: string;
}

interface CallLog {
  id: string;
  timestamp: string;
  call_outcome: string;
  call_duration: number | null;
  relative_id: string;
  provider: string;
  call_type: string;
}

const BatchCallDashboard = () => {
  const [households, setHouseholds] = useState<Household[]>([]);
  const [relatives, setRelatives] = useState<Relative[]>([]);
  const [recentCalls, setRecentCalls] = useState<CallLog[]>([]);
  const [allCallLogs, setAllCallLogs] = useState<CallLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [user]);

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);

      // Fetch households
      const { data: householdsData, error: householdsError } = await supabase
        .from('households')
        .select('*')
        .eq('created_by', user?.id);

      if (householdsError) throw householdsError;

      // Get household IDs
      const householdIds = householdsData?.map(h => h.id) || [];

      if (householdIds.length > 0) {
        // Fetch relatives for these households (batch call method only)
        const { data: relativesData, error: relativesError } = await supabase
          .from('relatives')
          .select('*')
          .in('household_id', householdIds);

        if (relativesError) throw relativesError;

        // Fetch ALL call logs for statistics (including ElevenLabs calls)
        const { data: callLogsData, error: callLogsError } = await supabase
          .from('call_logs')
          .select('*')
          .in('household_id', householdIds)
          .eq('provider', 'elevenlabs')
          .order('timestamp', { ascending: false });

        // Fetch recent calls for display (limited to 10)
        const { data: recentCallsData, error: recentCallsError } = await supabase
          .from('call_logs')
          .select('*')
          .in('household_id', householdIds)
          .eq('provider', 'elevenlabs')
          .order('timestamp', { ascending: false })
          .limit(10);

        if (callLogsError) throw callLogsError;
        if (recentCallsError) throw recentCallsError;

        setHouseholds(householdsData || []);
        setRelatives(relativesData || []);
        setRecentCalls(recentCallsData || []);
        
        // Store all call logs for statistics calculation
        setAllCallLogs(callLogsData || []);
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      toast({
        title: "Error",
        description: "Failed to load dashboard data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatCallOutcome = (outcome: string) => {
    const variants: { [key: string]: "default" | "secondary" | "destructive" | "outline" } = {
      'completed': 'default',
      'missed': 'destructive', 
      'busy': 'secondary',
      'failed': 'destructive'
    };
    return <Badge variant={variants[outcome] || 'outline'}>{outcome}</Badge>;
  };

  const formatDuration = (duration: number | null) => {
    if (!duration) return 'N/A';
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-warmth/10 via-background to-comfort/20 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading your batch call dashboard...</p>
        </div>
      </div>
    );
  }

  // Calculate statistics from ALL call logs, not just recent ones
  const totalCalls = allCallLogs.length;
  const successfulCalls = allCallLogs.filter(call => 
    call.call_outcome === 'answered' || call.call_outcome === 'completed'
  ).length;
  const successRate = totalCalls > 0 ? Math.round((successfulCalls / totalCalls) * 100) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-warmth/10 via-background to-comfort/20">
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">Automated Phone Calls Dashboard</h1>
            <p className="text-muted-foreground">
              Monitor your scheduled AI-powered phone calls to loved ones
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSettings(true)}
          >
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
        </div>

        {/* Overview Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Households</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{households.length}</div>
              <p className="text-xs text-muted-foreground">
                Family groups configured
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Relatives</CardTitle>
              <Phone className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{relatives.length}</div>
              <p className="text-xs text-muted-foreground">
                People receiving calls
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Calls</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalCalls}</div>
              <p className="text-xs text-muted-foreground">
                Recent automated calls
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{successRate}%</div>
              <p className="text-xs text-muted-foreground">
                Completed calls ratio
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-6">
            <CallSummaryDashboard />
            <CallScheduleManager />
          </div>

          <div className="space-y-6">
            {/* Households List */}
            <Card>
              <CardHeader>
                <CardTitle>Your Households</CardTitle>
                <CardDescription>
                  Family groups using automated phone calls
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {households.map((household) => (
                  <div key={household.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <h3 className="font-medium">{household.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {household.city}, {household.country}
                      </p>
                    </div>
                    <Badge variant="secondary">Batch Calls</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Recent Call Activity */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Call Activity</CardTitle>
                <CardDescription>
                  Latest automated phone calls to your relatives
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {recentCalls.slice(0, 5).map((call) => {
                    const relative = relatives.find(r => r.id === call.relative_id);
                    return (
                      <div key={call.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="space-y-1">
                          <p className="font-medium">
                            {relative ? `${relative.first_name} ${relative.last_name}` : 'Unknown'}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(call.timestamp).toLocaleDateString()} at{' '}
                            {new Date(call.timestamp).toLocaleTimeString()}
                          </p>
                        </div>
                        <div className="text-right space-y-1">
                          {formatCallOutcome(call.call_outcome)}
                          <p className="text-xs text-muted-foreground">
                            {formatDuration(call.call_duration)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  {recentCalls.length === 0 && (
                    <p className="text-center text-muted-foreground py-4">
                      No recent calls found
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Relatives List */}
            <Card>
              <CardHeader>
                <CardTitle>Your Relatives</CardTitle>
                <CardDescription>
                  People receiving automated phone calls
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {relatives.map((relative) => (
                  <div key={relative.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <h3 className="font-medium">{relative.first_name} {relative.last_name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {relative.phone_e164 || 'No phone number'} • {relative.call_cadence} • {relative.timezone}
                      </p>
                    </div>
                    <Badge variant="outline">Active</Badge>
                  </div>
                ))}
                {relatives.length === 0 && (
                  <p className="text-center text-muted-foreground py-4">
                    No relatives configured yet
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Settings Sidebar */}
      {showSettings && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
          <div className="fixed right-0 top-0 h-full w-96 bg-background border-l shadow-lg">
            <SettingsSidebar onClose={() => setShowSettings(false)} />
          </div>
        </div>
      )}
    </div>
  );
};

export default BatchCallDashboard;