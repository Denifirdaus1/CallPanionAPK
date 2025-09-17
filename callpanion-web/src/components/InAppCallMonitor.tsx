import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { Activity, Phone, Clock, AlertCircle, CheckCircle, XCircle, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCallMethodAccess } from "@/hooks/useCallMethodAccess";

interface CallLog {
  id: string;
  relative_id: string;
  household_id: string;
  call_outcome: string;
  call_duration?: number;
  timestamp: string;
  session_id?: string;
  relatives: {
    first_name: string;
    last_name: string;
  };
}

interface CallSession {
  id: string;
  relative_id: string;
  status: string;
  scheduled_time: string;
  started_at?: string;
  ended_at?: string;
  duration_seconds?: number;
  relatives: {
    first_name: string;
    last_name: string;
  };
}

export const InAppCallMonitor = () => {
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [activeSessions, setActiveSessions] = useState<CallSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { hasInAppCallAccess, isLoading: accessLoading } = useCallMethodAccess();

  useEffect(() => {
    if (hasInAppCallAccess) {
      loadInAppCallData();
    }
  }, [hasInAppCallAccess]);

  const loadInAppCallData = async () => {
    try {
      // Get user's households
      const { data: householdData, error: householdError } = await supabase
        .from('household_members')
        .select('household_id')
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id);

      if (householdError) throw householdError;

      const householdIds = householdData?.map(h => h.household_id) || [];

      if (householdIds.length === 0) {
        setCallLogs([]);
        setActiveSessions([]);
        return;
      }

      // Get recent in-app call logs
      const { data: logsData, error: logsError } = await supabase
        .from('call_logs')
        .select(`
          *,
          relatives(first_name, last_name)
        `)
        .in('household_id', householdIds)
        .eq('call_type', 'in_app_call')
        .order('timestamp', { ascending: false })
        .limit(20);

      if (logsError) throw logsError;
      setCallLogs(logsData || []);

      // Get active sessions
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('call_sessions')
        .select(`
          *,
          relatives(first_name, last_name)
        `)
        .in('household_id', householdIds)
        .eq('call_type', 'in_app_call')
        .in('status', ['scheduled', 'active'])
        .order('scheduled_time', { ascending: true });

      if (sessionsError) throw sessionsError;
      setActiveSessions(sessionsData || []);

    } catch (error: any) {
      console.error('Error loading in-app call data:', error);
      toast({
        title: "Error",
        description: "Failed to load in-app call data",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getOutcomeIcon = (outcome: string) => {
    switch (outcome) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'missed':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      case 'scheduled':
        return <Clock className="h-4 w-4 text-blue-600" />;
      default:
        return <Activity className="h-4 w-4 text-gray-600" />;
    }
  };

  const getOutcomeBadge = (outcome: string) => {
    switch (outcome) {
      case 'completed':
        return <Badge variant="default" className="bg-green-100 text-green-800">Completed</Badge>;
      case 'missed':
        return <Badge variant="destructive" className="bg-red-100 text-red-800">Missed</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      case 'scheduled':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800">Scheduled</Badge>;
      case 'expired':
        return <Badge variant="secondary" className="bg-gray-100 text-gray-800">Expired</Badge>;
      default:
        return <Badge variant="outline">{outcome}</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'scheduled':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800">Scheduled</Badge>;
      case 'active':
        return <Badge variant="default" className="bg-green-100 text-green-800">Active</Badge>;
      case 'completed':
        return <Badge variant="outline" className="bg-gray-100 text-gray-800">Completed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return 'N/A';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatRelativeTime = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffMs = now.getTime() - time.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return time.toLocaleDateString();
  };

  if (accessLoading || isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Activity className="h-5 w-5" />
            <span>In-App Call Monitor</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
            <p className="text-muted-foreground mt-2">Loading call data...</p>
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
            <Activity className="h-5 w-5" />
            <span>In-App Call Monitor</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              In-app call monitoring is only available for households with in-app call access.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Active Sessions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <Activity className="h-5 w-5" />
                <span>Active Sessions</span>
              </CardTitle>
              <CardDescription>
                Currently scheduled and active in-app calls
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={loadInAppCallData}
              className="flex items-center space-x-1"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Refresh</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {activeSessions.length === 0 ? (
            <div className="text-center py-6">
              <Activity className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No active sessions</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeSessions.map((session) => (
                <div key={session.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h3 className="font-medium">
                        {session.relatives.first_name} {session.relatives.last_name}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Scheduled: {new Date(session.scheduled_time).toLocaleString()}
                      </p>
                    </div>
                    {getStatusBadge(session.status)}
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Status</p>
                      <p className="font-medium">{session.status}</p>
                    </div>
                    {session.started_at && (
                      <div>
                        <p className="text-muted-foreground">Started</p>
                        <p className="font-medium">{new Date(session.started_at).toLocaleTimeString()}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-muted-foreground">Duration</p>
                      <p className="font-medium">{formatDuration(session.duration_seconds)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Call History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Phone className="h-5 w-5" />
            <span>Call History</span>
          </CardTitle>
          <CardDescription>
            Recent in-app call activity and outcomes
          </CardDescription>
        </CardHeader>
        <CardContent>
          {callLogs.length === 0 ? (
            <div className="text-center py-6">
              <Phone className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No call history available</p>
            </div>
          ) : (
            <div className="space-y-2">
              {callLogs.map((log) => (
                <div key={log.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/20">
                  <div className="flex items-center space-x-3">
                    {getOutcomeIcon(log.call_outcome)}
                    <div>
                      <p className="font-medium">
                        {log.relatives.first_name} {log.relatives.last_name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {formatRelativeTime(log.timestamp)} • {formatDuration(log.call_duration)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {getOutcomeBadge(log.call_outcome)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};