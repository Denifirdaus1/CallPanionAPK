import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserHousehold } from './useUserHousehold';

export interface HealthMetric {
  name: string;
  value: number;
  trend: 'up' | 'down' | 'stable';
}

export interface Alert {
  id: string;
  type: 'concern' | 'positive' | 'warning';
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  created_at: string;
}

export interface MoodActivityData {
  date: string;
  mood: number;
  activity: number;
}

export interface CommunicationData {
  name: string;
  value: number;
  color: string;
}

export const useHealthInsightsData = () => {
  const { user } = useAuth();
  const { household, loading: householdLoading } = useUserHousehold();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [moodActivityData, setMoodActivityData] = useState<MoodActivityData[]>([]);
  const [healthMetrics, setHealthMetrics] = useState<HealthMetric[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [communicationData, setCommunicationData] = useState<CommunicationData[]>([]);
  const [callSummary, setCallSummary] = useState({
    totalCalls: 0,
    completedCalls: 0,
    missedCalls: 0,
    averageDuration: 0,
    lastCallDate: null as string | null
  });

  useEffect(() => {
    if (!user || householdLoading || !household) {
      setLoading(householdLoading);
      return;
    }

    const fetchHealthData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch call logs for the last 7 days
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);

        const { data: callLogs, error: callError } = await supabase
          .from('call_logs')
          .select(`
            *,
            call_analysis (
              mood_score,
              health_flag,
              urgent_flag
            )
          `)
          .gte('timestamp', weekAgo.toISOString())
          .order('timestamp', { ascending: true });

        if (callError) throw callError;

        // Fetch check-ins
        const { data: checkIns, error: checkInError } = await supabase
          .from('check_ins')
          .select('*')
          .gte('created_at', weekAgo.toISOString())
          .order('created_at', { ascending: true });

        if (checkInError) throw checkInError;

        // Fetch family messages
        const { data: messages, error: messagesError } = await supabase
          .from('family_messages')
          .select('*')
          .eq('household_id', household.id)
          .gte('created_at', weekAgo.toISOString());

        if (messagesError) throw messagesError;

        // Process mood and activity data from call analysis
        const weeklyData = processWeeklyMoodActivity(callLogs || []);
        setMoodActivityData(weeklyData);

        // Calculate health metrics
        const metrics = calculateHealthMetrics(callLogs || [], checkIns || [], messages || []);
        setHealthMetrics(metrics);

        // Generate alerts
        const alertsData = generateAlerts(callLogs || [], checkIns || []);
        setAlerts(alertsData);

        // Calculate communication breakdown
        const commData = calculateCommunicationData(callLogs || [], messages || []);
        setCommunicationData(commData);

        // Calculate call summary
        const summary = calculateCallSummary(callLogs || []);
        setCallSummary(summary);

      } catch (err) {
        console.error('Error fetching health insights data:', err);
        setError('Failed to load health insights data');
      } finally {
        setLoading(false);
      }
    };

    fetchHealthData();

    // Set up real-time subscriptions
    const callLogsChannel = supabase
      .channel('call-logs-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'call_logs'
      }, () => {
        fetchHealthData();
      })
      .subscribe();

    const checkInsChannel = supabase
      .channel('check-ins-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'check_ins'
      }, () => {
        fetchHealthData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(callLogsChannel);
      supabase.removeChannel(checkInsChannel);
    };
  }, [user, household, householdLoading]);

  return {
    loading,
    error,
    moodActivityData,
    healthMetrics,
    alerts,
    communicationData,
    callSummary,
    hasData: !loading && !error && (moodActivityData.length > 0 || healthMetrics.length > 0)
  };
};

// Helper functions to process the data
const processWeeklyMoodActivity = (callLogs: any[]): MoodActivityData[] => {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const weeklyData: MoodActivityData[] = [];

  for (let i = 0; i < 7; i++) {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    const dayName = days[date.getDay()];

    const dayLogs = callLogs.filter(log => {
      const logDate = new Date(log.timestamp);
      return logDate.toDateString() === date.toDateString();
    });

    const avgMood = dayLogs.length > 0 
      ? dayLogs.reduce((sum, log) => sum + (log.call_analysis?.[0]?.mood_score || 5), 0) / dayLogs.length
      : 5;

    const activity = dayLogs.length > 0 ? Math.min(dayLogs.length * 2, 10) : 3;

    weeklyData.push({
      date: dayName,
      mood: Math.round(avgMood),
      activity: Math.round(activity)
    });
  }

  return weeklyData;
};

const calculateHealthMetrics = (callLogs: any[], checkIns: any[], messages: any[]): HealthMetric[] => {
  const completedCalls = callLogs.filter(log => log.call_outcome === 'completed').length;
  const totalCalls = callLogs.length;
  const callEngagement = totalCalls > 0 ? (completedCalls / totalCalls) * 100 : 0;

  const recentCheckIns = checkIns.filter(checkIn => {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    return new Date(checkIn.created_at) > threeDaysAgo;
  }).length;

  const socialEngagement = Math.min((messages.length + completedCalls) * 10, 100);

  const avgMoodScore = callLogs.length > 0
    ? callLogs.reduce((sum, log) => sum + (log.call_analysis?.[0]?.mood_score || 5), 0) / callLogs.length
    : 5;

  return [
    {
      name: "Call Engagement",
      value: Math.round(callEngagement),
      trend: completedCalls > 2 ? 'up' : completedCalls < 1 ? 'down' : 'stable'
    },
    {
      name: "Social Activity",
      value: Math.round(socialEngagement),
      trend: messages.length > 5 ? 'up' : 'stable'
    },
    {
      name: "Check-in Frequency",
      value: Math.min(recentCheckIns * 25, 100),
      trend: recentCheckIns > 2 ? 'up' : recentCheckIns < 1 ? 'down' : 'stable'
    },
    {
      name: "Mood Wellbeing",
      value: Math.round((avgMoodScore / 10) * 100),
      trend: avgMoodScore > 7 ? 'up' : avgMoodScore < 5 ? 'down' : 'stable'
    }
  ];
};

const generateAlerts = (callLogs: any[], checkIns: any[]): Alert[] => {
  const alerts: Alert[] = [];
  
  const missedCalls = callLogs.filter(log => log.call_outcome === 'missed').length;
  const recentCheckIns = checkIns.filter(checkIn => {
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    return new Date(checkIn.created_at) > twoDaysAgo;
  }).length;

  const healthFlags = callLogs.filter(log => log.call_analysis?.[0]?.health_flag).length;
  const urgentFlags = callLogs.filter(log => log.call_analysis?.[0]?.urgent_flag).length;

  if (missedCalls > 2) {
    alerts.push({
      id: 'missed-calls',
      type: 'warning',
      title: 'Missed Daily Calls',
      description: `${missedCalls} missed calls in the past week`,
      severity: 'high',
      created_at: new Date().toISOString()
    });
  }

  if (recentCheckIns === 0) {
    alerts.push({
      id: 'no-checkins',
      type: 'concern',
      title: 'No Recent Check-ins',
      description: 'No check-ins recorded in the past 2 days',
      severity: 'medium',
      created_at: new Date().toISOString()
    });
  }

  if (healthFlags > 0) {
    alerts.push({
      id: 'health-concerns',
      type: 'warning',
      title: 'Health Concerns Detected',
      description: `${healthFlags} calls flagged for health review`,
      severity: urgentFlags > 0 ? 'high' : 'medium',
      created_at: new Date().toISOString()
    });
  }

  if (callLogs.length > 0 && alerts.length === 0) {
    alerts.push({
      id: 'positive-engagement',
      type: 'positive',
      title: 'Good Engagement',
      description: 'Regular communication patterns maintained',
      severity: 'low',
      created_at: new Date().toISOString()
    });
  }

  return alerts;
};

const calculateCommunicationData = (callLogs: any[], messages: any[]): CommunicationData[] => {
  const completedCalls = callLogs.filter(log => log.call_outcome === 'completed').length;
  const totalCommunications = completedCalls + messages.length;

  if (totalCommunications === 0) {
    return [
      { name: "No Data", value: 100, color: "hsl(var(--muted))" }
    ];
  }

  return [
    {
      name: "Messages",
      value: Math.round((messages.length / totalCommunications) * 100),
      color: "hsl(var(--primary))"
    },
    {
      name: "Calls",
      value: Math.round((completedCalls / totalCommunications) * 100),
      color: "hsl(var(--love))"
    }
  ];
};

const calculateCallSummary = (callLogs: any[]) => {
  const completed = callLogs.filter(log => log.call_outcome === 'completed');
  const missed = callLogs.filter(log => log.call_outcome === 'missed');
  
  const avgDuration = completed.length > 0
    ? completed.reduce((sum, log) => sum + (log.call_duration || 0), 0) / completed.length
    : 0;

  const lastCall = callLogs.length > 0 
    ? callLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0]
    : null;

  return {
    totalCalls: callLogs.length,
    completedCalls: completed.length,
    missedCalls: missed.length,
    averageDuration: Math.round(avgDuration),
    lastCallDate: lastCall?.timestamp || null
  };
};