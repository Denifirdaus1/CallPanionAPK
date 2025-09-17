import React, { useState, useEffect } from 'react';
import { Clock, Calendar, Users, Settings } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

interface ScheduledCall {
  id: string;
  user_id: string;
  scheduled_time: string;
  call_type: string;
  status: 'pending' | 'completed' | 'missed';
  relative?: {
    first_name: string;
    last_name: string;
    timezone: string;
    quiet_hours_start?: string;
    quiet_hours_end?: string;
    call_cadence: string;
  };
}

const EnhancedScheduler: React.FC = () => {
  const [scheduledCalls, setScheduledCalls] = useState<ScheduledCall[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchScheduledCalls();
    const interval = setInterval(fetchScheduledCalls, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  const fetchScheduledCalls = async () => {
    try {
      // Get upcoming scheduled calls from the next 24 hours
      const now = new Date();
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      // Get call logs and separately get relatives data
      const { data: callData, error: callError } = await supabase
        .from('call_logs')
        .select('id, user_id, timestamp, call_outcome')
        .gte('timestamp', now.toISOString())
        .lte('timestamp', tomorrow.toISOString())
        .order('timestamp');

      if (callError) throw callError;

      // Get relatives data separately
      const { data: relativesData, error: relativesError } = await supabase
        .from('relatives')
        .select('id, first_name, last_name, timezone, quiet_hours_start, quiet_hours_end, call_cadence');

      if (relativesError) throw relativesError;

      // Create a map of relatives by ID for quick lookup
      const relativesMap = new Map(
        (relativesData || []).map(rel => [rel.id, rel])
      );

      const transformedData = (callData || []).map(call => {
        const relativeData = relativesMap.get(call.user_id);
        const status: 'pending' | 'completed' | 'missed' = 
          call.call_outcome === 'answered' ? 'completed' : 
          call.call_outcome === 'missed' ? 'missed' : 'pending';
        
        return {
          id: call.id,
          user_id: call.user_id,
          scheduled_time: call.timestamp,
          call_type: 'wellbeing',
          status,
          relative: relativeData ? {
            first_name: relativeData.first_name,
            last_name: relativeData.last_name,
            timezone: relativeData.timezone,
            quiet_hours_start: relativeData.quiet_hours_start,
            quiet_hours_end: relativeData.quiet_hours_end,
            call_cadence: relativeData.call_cadence
          } : undefined
        };
      });

      setScheduledCalls(transformedData);
    } catch (error) {
      console.error('Error fetching scheduled calls:', error);
      toast({
        title: "Error",
        description: "Failed to fetch scheduled calls",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timeString: string) => {
    const date = new Date(timeString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatDate = (timeString: string) => {
    const date = new Date(timeString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800">Completed</Badge>;
      case 'missed':
        return <Badge variant="destructive">Missed</Badge>;
      case 'pending':
        return <Badge variant="outline">Pending</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const getTimezoneInfo = (relative?: ScheduledCall['relative']) => {
    if (!relative) return 'UTC';
    return relative.timezone || 'Europe/London';
  };

  const isInQuietHours = (scheduledTime: string, relative?: ScheduledCall['relative']) => {
    if (!relative?.quiet_hours_start || !relative?.quiet_hours_end) return false;
    
    const callTime = new Date(scheduledTime);
    const timeString = callTime.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    
    return timeString >= relative.quiet_hours_start && timeString <= relative.quiet_hours_end;
  };

  const runDailyScheduler = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('schedulerDailyCalls');
      
      if (error) throw error;
      
      toast({
        title: "Scheduler Executed",
        description: `Successfully processed ${data.calls_scheduled || 0} calls`,
      });
      
      // Refresh the scheduled calls
      await fetchScheduledCalls();
    } catch (error) {
      console.error('Error running scheduler:', error);
      toast({
        title: "Error",
        description: "Failed to run daily scheduler",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Enhanced Call Scheduler</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64">
            <div className="text-muted-foreground">Loading scheduler data...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Enhanced Call Scheduler
            </CardTitle>
            <Button onClick={runDailyScheduler} disabled={loading}>
              <Clock className="h-4 w-4 mr-2" />
              Run Scheduler Now
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card className="p-4">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-500" />
                <div>
                  <div className="text-2xl font-bold">
                    {scheduledCalls.filter(call => call.status === 'pending').length}
                  </div>
                  <div className="text-sm text-muted-foreground">Pending Calls</div>
                </div>
              </div>
            </Card>
            
            <Card className="p-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-green-500" />
                <div>
                  <div className="text-2xl font-bold">
                    {scheduledCalls.filter(call => call.status === 'completed').length}
                  </div>
                  <div className="text-sm text-muted-foreground">Completed Today</div>
                </div>
              </div>
            </Card>
            
            <Card className="p-4">
              <div className="flex items-center gap-2">
                <Settings className="h-4 w-4 text-orange-500" />
                <div>
                  <div className="text-2xl font-bold">
                    {scheduledCalls.filter(call => call.status === 'missed').length}
                  </div>
                  <div className="text-sm text-muted-foreground">Missed Calls</div>
                </div>
              </div>
            </Card>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Recipient</TableHead>
                <TableHead>Timezone</TableHead>
                <TableHead>Frequency</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {scheduledCalls.map((call) => (
                <TableRow key={call.id}>
                  <TableCell>{formatDate(call.scheduled_time)}</TableCell>
                  <TableCell className="font-mono">{formatTime(call.scheduled_time)}</TableCell>
                  <TableCell>
                    {call.relative 
                      ? `${call.relative.first_name} ${call.relative.last_name}`
                      : 'Unknown User'
                    }
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {getTimezoneInfo(call.relative)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {call.relative?.call_cadence || 'daily'}
                    </Badge>
                  </TableCell>
                  <TableCell>{getStatusBadge(call.status)}</TableCell>
                  <TableCell>
                    {isInQuietHours(call.scheduled_time, call.relative) && (
                      <Badge variant="outline" className="text-orange-600 border-orange-600">
                        Quiet Hours
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          {scheduledCalls.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No scheduled calls for the next 24 hours.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default EnhancedScheduler;