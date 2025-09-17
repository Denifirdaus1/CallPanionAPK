import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Phone, PhoneOff, AlertTriangle, Heart, Smile, Meh, Frown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

interface CallLog {
  id: string;
  user_id: string;
  timestamp: string;
  call_outcome: string;
  call_duration?: number;
  call_analysis?: {
    mood_score: number;
    health_flag: boolean;
    urgent_flag: boolean;
    summary: string;
  }[];
  profiles?: {
    display_name?: string;
  } | null;
}

const CallHistoryDashboard: React.FC = () => {
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<CallLog[]>([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchCallHistory();
  }, []);

  useEffect(() => {
    applyFilter();
  }, [callLogs, filter]);

  const fetchCallHistory = async () => {
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data, error } = await supabase
        .from('call_logs')
        .select(`
          *,
          call_analysis (
            mood_score,
            health_flag,
            urgent_flag,
            summary
          ),
          profiles (
            display_name
          )
        `)
        .gte('timestamp', sevenDaysAgo.toISOString())
        .order('timestamp', { ascending: false });

      if (error) {
        console.error('Error fetching call history:', error);
        toast({
          title: "Error",
          description: "Failed to fetch call history",
          variant: "destructive",
        });
        return;
      }

      setCallLogs((data as any) || []);
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Error",
        description: "Failed to fetch call history",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const applyFilter = () => {
    let filtered = callLogs;

    switch (filter) {
      case 'answered':
        filtered = callLogs.filter(log => log.call_outcome === 'answered');
        break;
      case 'missed':
        filtered = callLogs.filter(log => log.call_outcome === 'missed');
        break;
      case 'urgent':
        filtered = callLogs.filter(log => log.call_analysis && log.call_analysis[0]?.urgent_flag);
        break;
      default:
        filtered = callLogs;
    }

    setFilteredLogs(filtered);
  };

  const getMoodIcon = (moodScore: number) => {
    if (moodScore >= 4) return <Smile className="h-4 w-4 text-green-600" />;
    if (moodScore >= 3) return <Meh className="h-4 w-4 text-yellow-600" />;
    return <Frown className="h-4 w-4 text-red-600" />;
  };

  const getCallOutcomeIcon = (outcome: string) => {
    switch (outcome) {
      case 'answered':
        return <Phone className="h-4 w-4 text-green-600" />;
      case 'missed':
        return <PhoneOff className="h-4 w-4 text-red-600" />;
      default:
        return <PhoneOff className="h-4 w-4 text-gray-600" />;
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '-';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Call History (Last 7 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64">
            <div className="text-muted-foreground">Loading call history...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Call History (Last 7 Days)</CardTitle>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter calls" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Calls</SelectItem>
              <SelectItem value="answered">Answered</SelectItem>
              <SelectItem value="missed">Missed</SelectItem>
              <SelectItem value="urgent">Urgent Flags</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {filteredLogs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No calls found for the selected filter.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date & Time</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Mood</TableHead>
                <TableHead>Flags</TableHead>
                <TableHead>Summary</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>
                    {new Date(log.timestamp).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    {log.profiles?.display_name || 'Unknown User'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getCallOutcomeIcon(log.call_outcome)}
                      <span className="capitalize">{log.call_outcome}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {formatDuration(log.call_duration)}
                  </TableCell>
                  <TableCell>
                    {log.call_analysis && log.call_analysis[0]?.mood_score ? (
                      <div className="flex items-center gap-2">
                        {getMoodIcon(log.call_analysis[0].mood_score)}
                        <span>{log.call_analysis[0].mood_score}/5</span>
                      </div>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {log.call_analysis && log.call_analysis[0]?.health_flag && (
                        <Badge variant="outline" className="text-orange-600 border-orange-600">
                          <Heart className="h-3 w-3 mr-1" />
                          Health
                        </Badge>
                      )}
                      {log.call_analysis && log.call_analysis[0]?.urgent_flag && (
                        <Badge variant="destructive">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Urgent
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-xs">
                    <div className="truncate" title={log.call_analysis && log.call_analysis[0]?.summary}>
                      {log.call_analysis && log.call_analysis[0]?.summary || '-'}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

export default CallHistoryDashboard;