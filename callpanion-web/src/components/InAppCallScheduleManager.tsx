import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { Smartphone, Play, Pause, AlertCircle, CheckCircle, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCallMethodAccess } from "@/hooks/useCallMethodAccess";

interface InAppCallSession {
  id: string;
  relative_id: string;
  household_id: string;
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

export const InAppCallScheduleManager = () => {
  const [sessions, setSessions] = useState<InAppCallSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isStartingCall, setIsStartingCall] = useState<string | null>(null);
  const { toast } = useToast();
  const { hasInAppCallAccess, isLoading: accessLoading } = useCallMethodAccess();

  useEffect(() => {
    if (hasInAppCallAccess) {
      loadInAppCallSessions();
    }
  }, [hasInAppCallAccess]);

  const loadInAppCallSessions = async () => {
    try {
      // Get user's households
      const { data: householdData, error: householdError } = await supabase
        .from('household_members')
        .select('household_id')
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id);

      if (householdError) throw householdError;

      const householdIds = householdData?.map(h => h.household_id) || [];

      if (householdIds.length === 0) {
        setSessions([]);
        return;
      }

      // Get in-app call sessions
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('call_sessions')
        .select(`
          *,
          relatives(first_name, last_name)
        `)
        .in('household_id', householdIds)
        .eq('call_type', 'in_app_call')
        .order('scheduled_time', { ascending: false })
        .limit(10);

      if (sessionsError) throw sessionsError;

      setSessions(sessionsData || []);
    } catch (error: any) {
      console.error('Error loading in-app call sessions:', error);
      toast({
        title: "Error",
        description: "Failed to load in-app call sessions",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Call initiation is handled automatically by scheduler - no manual calls allowed

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'scheduled':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800">Scheduled</Badge>;
      case 'active':
        return <Badge variant="default" className="bg-green-100 text-green-800">Active</Badge>;
      case 'completed':
        return <Badge variant="outline" className="bg-gray-100 text-gray-800">Completed</Badge>;
      case 'missed':
        return <Badge variant="destructive" className="bg-red-100 text-red-800">Missed</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
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

  if (accessLoading || isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Smartphone className="h-5 w-5" />
            <span>In-App Call Manager</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
            <p className="text-muted-foreground mt-2">Loading sessions...</p>
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
            <span>In-App Call Manager</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Your household is not configured for in-app calls. Please contact support to enable this feature.
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
          <Smartphone className="h-5 w-5" />
          <span>In-App Call Manager</span>
        </CardTitle>
        <CardDescription>
          Manage and monitor in-app calls to your relatives' devices
        </CardDescription>
      </CardHeader>
      <CardContent>
        {sessions.length === 0 ? (
          <div className="text-center py-8">
            <Smartphone className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No in-app call sessions found.</p>
            <p className="text-sm text-muted-foreground mt-2">
              In-app calls will be automatically scheduled by the system.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {sessions.map((session) => (
              <div key={session.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <h3 className="font-semibold text-lg">
                      {session.relatives.first_name} {session.relatives.last_name}
                    </h3>
                    <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                      <div className="flex items-center space-x-1">
                        <Clock className="h-4 w-4" />
                        <span>
                          Scheduled: {new Date(session.scheduled_time).toLocaleString()}
                        </span>
                      </div>
                      {session.duration_seconds && (
                        <div className="flex items-center space-x-1">
                          <span>Duration: {formatDuration(session.duration_seconds)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {getStatusBadge(session.status)}
                    {session.status === 'scheduled' && (
                      <div className="text-sm text-muted-foreground">
                        Calls are initiated automatically by schedule
                      </div>
                    )}
                  </div>
                </div>

                {/* Call Details */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2 border-t">
                  <div>
                    <p className="text-xs text-muted-foreground">Status</p>
                    <p className="text-sm font-medium">{session.status}</p>
                  </div>
                  {session.started_at && (
                    <div>
                      <p className="text-xs text-muted-foreground">Started</p>
                      <p className="text-sm font-medium">
                        {new Date(session.started_at).toLocaleTimeString()}
                      </p>
                    </div>
                  )}
                  {session.ended_at && (
                    <div>
                      <p className="text-xs text-muted-foreground">Ended</p>
                      <p className="text-sm font-medium">
                        {new Date(session.ended_at).toLocaleTimeString()}
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-muted-foreground">Duration</p>
                    <p className="text-sm font-medium">{formatDuration(session.duration_seconds)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};