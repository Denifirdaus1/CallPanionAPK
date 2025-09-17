import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Phone, Users, Clock, Heart, Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { SettingsSidebar } from "@/components/SettingsSidebar";
import CallScheduleManager from "@/components/CallScheduleManager";
import CallSummaryDashboard from "@/components/CallSummaryDashboard";
import { InAppCallDashboard } from "@/components/InAppCallDashboard";
import { useCallMethodAccess } from "@/hooks/useCallMethodAccess";

interface Household {
  id: string;
  name: string;
  city?: string;
  country?: string;
}

interface Relative {
  id: string;
  first_name: string;
  last_name: string;
  town?: string;
  county?: string;
  country?: string;
}

interface CallLog {
  id: string;
  timestamp: string;
  call_outcome: string;
  call_duration?: number;
  relative_id: string;
}

const Dashboard = () => {
  const [households, setHouseholds] = useState<Household[]>([]);
  const [relatives, setRelatives] = useState<Relative[]>([]);
  const [recentCalls, setRecentCalls] = useState<CallLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  
  const { user } = useAuth();
  const navigate = useNavigate();
  const { callMethod, hasInAppCallAccess, hasBatchCallAccess } = useCallMethodAccess();

  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [user]);

  const loadDashboardData = async () => {
    try {
      // Load households
      const { data: householdsData, error: householdsError } = await supabase
        .from('household_members')
        .select(`
          household:households(
            id,
            name,
            city,
            country
          )
        `)
        .eq('user_id', user?.id);

      if (householdsError) throw householdsError;

      const householdsList = householdsData
        ?.map(item => item.household)
        .filter(Boolean) as Household[];
      
      setHouseholds(householdsList);

      if (householdsList.length > 0) {
        const householdIds = householdsList.map(h => h.id);
        
        // Load relatives
        const { data: relativesData, error: relativesError } = await supabase
          .from('relatives')
          .select('*')
          .in('household_id', householdIds);

        if (relativesError) throw relativesError;
        setRelatives(relativesData || []);

        // Load recent calls
        const { data: callsData, error: callsError } = await supabase
          .from('call_logs')
          .select('*')
          .in('household_id', householdIds)
          .order('timestamp', { ascending: false })
          .limit(10);

        if (callsError) throw callsError;
        setRecentCalls(callsData || []);
      }

    } catch (err: any) {
      console.error('Error loading dashboard data:', err);
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  const formatCallOutcome = (outcome: string) => {
    switch (outcome) {
      case 'answered':
        return <Badge variant="default" className="bg-green-100 text-green-800">Answered</Badge>;
      case 'completed':
        return <Badge variant="default" className="bg-green-100 text-green-800">Completed</Badge>;
      case 'missed':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Missed</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      case 'busy':
        return <Badge variant="secondary" className="bg-orange-100 text-orange-800">Busy</Badge>;
      default:
        return <Badge variant="outline">{outcome}</Badge>;
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return 'N/A';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider defaultOpen={false}>
      <div className="min-h-screen bg-background w-full flex">
        <div className="flex-1">
          <div className="container max-w-7xl mx-auto px-6 py-8">
            {/* Header */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-2">
                <h1 className="text-2xl font-semibold text-foreground">
                  Family Dashboard
                </h1>
                <SidebarTrigger className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md hover:bg-accent hover:text-accent-foreground">
                  <Settings className="h-4 w-4" />
                  Settings
                </SidebarTrigger>
              </div>
              <p className="text-sm text-muted-foreground">
                Keep track of your loved ones with ease and peace of mind.
              </p>
            </div>

            {error && (
              <Alert variant="destructive" className="mb-6">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Stats Overview */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <Card className="border-0 shadow-sm bg-card/50 backdrop-blur-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Households</p>
                      <p className="text-2xl font-bold text-foreground mt-1">{households.length}</p>
                    </div>
                    <div className="h-8 w-8 bg-primary/10 rounded-full flex items-center justify-center">
                      <Users className="h-4 w-4 text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="border-0 shadow-sm bg-card/50 backdrop-blur-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Relatives</p>
                      <p className="text-2xl font-bold text-foreground mt-1">{relatives.length}</p>
                    </div>
                    <div className="h-8 w-8 bg-primary/10 rounded-full flex items-center justify-center">
                      <Heart className="h-4 w-4 text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="border-0 shadow-sm bg-card/50 backdrop-blur-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Calls</p>
                      <p className="text-2xl font-bold text-foreground mt-1">{recentCalls.length}</p>
                    </div>
                    <div className="h-8 w-8 bg-primary/10 rounded-full flex items-center justify-center">
                      <Phone className="h-4 w-4 text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="border-0 shadow-sm bg-card/50 backdrop-blur-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Successful</p>
                      <p className="text-2xl font-bold text-foreground mt-1">
                        {recentCalls.filter(call => ['answered', 'completed'].includes(call.call_outcome)).length}
                      </p>
                    </div>
                    <div className="h-8 w-8 bg-primary/10 rounded-full flex items-center justify-center">
                      <Clock className="h-4 w-4 text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Main Content Grid */}
            <div className="space-y-8">
              {/* Call Summaries Dashboard */}
              <CallSummaryDashboard />

              {/* In-App Call Dashboard - only show if user has in-app call access */}
              {hasInAppCallAccess && <InAppCallDashboard />}

              {/* Regular Call Schedule Management - show for batch calls or when no specific access */}
              {(hasBatchCallAccess || (!hasInAppCallAccess && !hasBatchCallAccess)) && <CallScheduleManager />}
              
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Households */}
                <Card className="border-0 shadow-sm bg-card/50 backdrop-blur-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg font-medium">Households</CardTitle>
                    <CardDescription className="text-sm">
                      Family households you manage
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {households.length === 0 ? (
                      <div className="text-center py-6">
                        <Users className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">No households yet</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {households.map((household) => (
                          <div key={household.id} className="flex items-start gap-3 p-3 rounded-lg bg-background/50 border border-border/50">
                            <div className="h-2 w-2 rounded-full bg-primary/60 mt-2" />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm text-foreground">{household.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {[household.city, household.country].filter(Boolean).join(', ')}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Recent Activity */}
                <Card className="border-0 shadow-sm bg-card/50 backdrop-blur-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg font-medium">Recent Activity</CardTitle>
                    <CardDescription className="text-sm">
                      Latest call activity
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {recentCalls.length === 0 ? (
                      <div className="text-center py-6">
                        <Phone className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">No calls yet</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {recentCalls.slice(0, 4).map((call) => {
                          const relative = relatives.find(r => r.id === call.relative_id);
                          return (
                            <div key={call.id} className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-border/50">
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm text-foreground truncate">
                                  {relative ? `${relative.first_name} ${relative.last_name}` : 'Unknown'}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {new Date(call.timestamp).toLocaleDateString()}
                                </p>
                              </div>
                              <div className="ml-2">
                                {formatCallOutcome(call.call_outcome)}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Relatives */}
                <Card className="border-0 shadow-sm bg-card/50 backdrop-blur-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg font-medium">Your Relatives</CardTitle>
                    <CardDescription className="text-sm">
                      People you care for
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {relatives.length === 0 ? (
                      <div className="text-center py-6">
                        <Heart className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">No relatives added</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {relatives.slice(0, 4).map((relative) => (
                          <div key={relative.id} className="flex items-start gap-3 p-3 rounded-lg bg-background/50 border border-border/50">
                            <div className="h-2 w-2 rounded-full bg-primary/60 mt-2" />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm text-foreground">
                                {relative.first_name} {relative.last_name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {[relative.town, relative.county, relative.country]
                                  .filter(Boolean)
                                  .join(', ')}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
        
        <SettingsSidebar onClose={() => {}} />
      </div>
    </SidebarProvider>
  );
};

export default Dashboard;