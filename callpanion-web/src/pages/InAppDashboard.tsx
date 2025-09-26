import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Phone, Users, Clock, Settings, PhoneCall, Calendar, TrendingUp } from "lucide-react";
import { SettingsSidebar } from "@/components/SettingsSidebar";
import { InAppCallScheduleManager } from "@/components/InAppCallScheduleManager";
import { DevicePairingManager } from "@/components/DevicePairingManager";
import { InAppCallScheduleSettings } from "@/components/InAppCallScheduleSettings";
import { PairedDevicesStatus } from "@/components/PairedDevicesStatus";
// ElevenLabsCallInterface removed - now using Flutter native

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

interface CallHistory {
  date: string;
  morning: CallLog | null;
  afternoon: CallLog | null;
  evening: CallLog | null;
}

const InAppDashboard = () => {
  const [households, setHouseholds] = useState<Household[]>([]);
  const [relatives, setRelatives] = useState<Relative[]>([]);
  const [recentCalls, setRecentCalls] = useState<CallLog[]>([]);
  const [callHistory, setCallHistory] = useState<CallHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [currentCall, setCurrentCall] = useState<any>(null);
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
        // Fetch relatives for these households (in-app call method only)
        const { data: relativesData, error: relativesError } = await supabase
          .from('relatives')
          .select('*')
          .in('household_id', householdIds);

        if (relativesError) throw relativesError;

        // Fetch recent call logs (in-app calls only)
        const { data: callLogsData, error: callLogsError } = await supabase
          .from('call_logs')
          .select('*')
          .in('household_id', householdIds)
          .eq('call_type', 'in_app_call')
          .order('timestamp', { ascending: false })
          .limit(10);

        if (callLogsError) throw callLogsError;

        // Generate call history for the last 7 days
        const history = generateCallHistory(callLogsData || [], relativesData || []);

        setHouseholds(householdsData || []);
        setRelatives(relativesData || []);
        setRecentCalls(callLogsData || []);
        setCallHistory(history);
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

  const generateCallHistory = (calls: CallLog[], relatives: Relative[]): CallHistory[] => {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - i);
      return date.toISOString().split('T')[0];
    });

    return last7Days.map(date => {
      const dayCalls = calls.filter(call => call.timestamp.split('T')[0] === date);
      
      return {
        date,
        morning: dayCalls.find(call => {
          const hour = new Date(call.timestamp).getHours();
          return hour >= 6 && hour < 12;
        }) || null,
        afternoon: dayCalls.find(call => {
          const hour = new Date(call.timestamp).getHours();
          return hour >= 12 && hour < 18;
        }) || null,
        evening: dayCalls.find(call => {
          const hour = new Date(call.timestamp).getHours();
          return hour >= 18 && hour < 24;
        }) || null,
      };
    });
  };

  const handleStartCall = async (relativeId: string) => {
    try {
      if (!households.length) {
        throw new Error('No household found');
      }

      const householdId = households[0].id; // Use first household for now
      
      // Create call session first
      const { data: sessionData, error: sessionError } = await supabase
        .from('call_sessions')
        .insert({
          household_id: householdId,
          relative_id: relativeId,
          call_type: 'in_app_call',
          status: 'scheduled',
          scheduled_time: new Date().toISOString()
        })
        .select()
        .single();

      if (sessionError) throw sessionError;

      const { data, error } = await supabase.functions.invoke('elevenlabs-device-call', {
        body: {
          sessionId: sessionData.id,
          action: 'start'
        }
      });

      if (error) throw error;

      if (data && data.signedUrl) {
        setCurrentCall({
          sessionId: data.sessionId,
          signedUrl: data.signedUrl,
          pairingToken: data.pairingToken,
          relativeName: data.relativeName
        });
      }

      toast({
        title: "Call Started",
        description: `Voice call initiated with ${data.relativeName}`,
      });

      // Reload dashboard data to see updated call logs
      setTimeout(() => {
        loadDashboardData();
      }, 1000);

    } catch (error) {
      console.error('Error starting call:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to start call. Please try again.",
        variant: "destructive",
      });
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
          <p className="text-muted-foreground">Loading your in-app call dashboard...</p>
        </div>
      </div>
    );
  }

  const totalCalls = recentCalls.length;
  const successfulCalls = recentCalls.filter(call => call.call_outcome === 'completed').length;
  const successRate = totalCalls > 0 ? Math.round((successfulCalls / totalCalls) * 100) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-warmth/10 via-background to-comfort/20">
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">In-App Call Dashboard</h1>
            <p className="text-muted-foreground">
              Connect with your loved ones through direct voice calls
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
              <PhoneCall className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{relatives.length}</div>
              <p className="text-xs text-muted-foreground">
                People available for calls
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
                Recent voice calls
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
                Connected calls ratio
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-6">
            {/* Households List */}
            <Card>
              <CardHeader>
                <CardTitle>Your Households</CardTitle>
                <CardDescription>
                  Family groups using in-app voice calls
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
                    <Badge variant="secondary">Voice Calls</Badge>
                  </div>
                ))}
                {households.length === 0 && (
                  <p className="text-center text-muted-foreground py-4">
                    No households configured yet
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Relatives List with Call Buttons */}
            <Card>
              <CardHeader>
                <CardTitle>Your Relatives</CardTitle>
                <CardDescription>
                  Start a voice call with your loved ones
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {relatives.map((relative) => (
                  <div key={relative.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <h3 className="font-medium">{relative.first_name} {relative.last_name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {relative.call_cadence} • {relative.timezone}
                      </p>
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        size="sm"
                        onClick={() => handleStartCall(relative.id)}
                      >
                        <Phone className="h-4 w-4 mr-1" />
                        Call
                      </Button>
                      <Badge variant="outline">Online</Badge>
                    </div>
                  </div>
                ))}
                {relatives.length === 0 && (
                  <p className="text-center text-muted-foreground py-4">
                    No relatives configured yet
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Recent Call Activity */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Call Activity</CardTitle>
                <CardDescription>
                  Latest voice calls with your relatives
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
          </div>

          <div className="space-y-6">
            {/* In-App Schedule */}
            <InAppCallScheduleManager />

            {/* In-App Call Schedule Settings */}
            <InAppCallScheduleSettings />

            {/* Device Pairing */}
            <DevicePairingManager />

            {/* Paired Devices Status */}
            <PairedDevicesStatus />

            {/* Call History with Morning, Afternoon, Evening */}
            <Card>
              <CardHeader>
                <CardTitle>Call History</CardTitle>
                <CardDescription>
                  Daily call schedule history (Morning • Afternoon • Evening)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {callHistory.map((day) => (
                    <div key={day.date} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">
                          {new Date(day.date).toLocaleDateString('en-US', { 
                            weekday: 'short', 
                            month: 'short', 
                            day: 'numeric' 
                          })}
                        </h4>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="text-center p-2 border rounded">
                          <p className="text-xs text-muted-foreground mb-1">Morning</p>
                          {day.morning ? (
                            <Badge variant={day.morning.call_outcome === 'completed' ? 'default' : 'destructive'}>
                              {day.morning.call_outcome}
                            </Badge>
                          ) : (
                            <Badge variant="outline">No call</Badge>
                          )}
                        </div>
                        <div className="text-center p-2 border rounded">
                          <p className="text-xs text-muted-foreground mb-1">Afternoon</p>
                          {day.afternoon ? (
                            <Badge variant={day.afternoon.call_outcome === 'completed' ? 'default' : 'destructive'}>
                              {day.afternoon.call_outcome}
                            </Badge>
                          ) : (
                            <Badge variant="outline">No call</Badge>
                          )}
                        </div>
                        <div className="text-center p-2 border rounded">
                          <p className="text-xs text-muted-foreground mb-1">Evening</p>
                          {day.evening ? (
                            <Badge variant={day.evening.call_outcome === 'completed' ? 'default' : 'destructive'}>
                              {day.evening.call_outcome}
                            </Badge>
                          ) : (
                            <Badge variant="outline">No call</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {callHistory.length === 0 && (
                    <p className="text-center text-muted-foreground py-4">
                      No call history available
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Active Call Interface - Now handled by Flutter native app */}
      {currentCall && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center">
          <div className="text-center space-y-4">
            <h3 className="text-lg font-semibold">Call in Progress</h3>
            <p className="text-muted-foreground">
              Voice call with {currentCall.relativeName} is now handled by Flutter native app
            </p>
            <button 
              onClick={() => setCurrentCall(null)}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
            >
              Close
            </button>
          </div>
        </div>
      )}

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

export default InAppDashboard;