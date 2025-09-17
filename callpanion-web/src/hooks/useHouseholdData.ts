import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface HouseholdAlert {
  id: string;
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED' | 'IN_PROGRESS' | 'CLOSED';
  customer_id: string;
  created_at: string;
  opened_at: string;
  customer?: {
    full_name: string;
  };
}

export interface CallAnalytics {
  day: string;
  mood: number;
  engagement: number;
  callDuration: number;
}

export interface QuickStat {
  title: string;
  value: string;
  trend: 'up' | 'down' | 'stable';
  description: string;
}

export const useHouseholdData = () => {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<HouseholdAlert[]>([]);
  const [callAnalytics, setCallAnalytics] = useState<CallAnalytics[]>([]);
  const [quickStats, setQuickStats] = useState<QuickStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHouseholdAlerts = async () => {
    if (!user) return;

    try {
      // Get user's household through household_members
      const { data: memberData, error: memberError } = await supabase
        .from('household_members')
        .select('household_id')
        .eq('user_id', user.id)
        .single();

      if (memberError) throw memberError;

      // Get all customers in this household
      const { data: householdMembers, error: householdError } = await supabase
        .from('household_members')
        .select('customer_id')
        .eq('household_id', memberData.household_id)
        .not('customer_id', 'is', null);

      if (householdError) throw householdError;

      const customerIds = householdMembers.map(m => m.customer_id);

      if (customerIds.length === 0) {
        setAlerts([]);
        return;
      }

      // Get alerts for all household customers
      const { data: alertsData, error: alertsError } = await supabase
        .from('alerts')
        .select(`
          *,
          customers!inner(full_name)
        `)
        .in('customer_id', customerIds)
        .order('created_at', { ascending: false })
        .limit(20);

      if (alertsError) throw alertsError;

      setAlerts(alertsData || []);
    } catch (err) {
      console.error('Error fetching household alerts:', err);
      setError('Failed to load household alerts');
    }
  };

  const fetchCallAnalytics = async () => {
    if (!user) return;

    try {
      // Get user's household customers
      const { data: memberData, error: memberError } = await supabase
        .from('household_members')
        .select('household_id')
        .eq('user_id', user.id)
        .single();

      if (memberError) throw memberError;

      const { data: householdMembers, error: householdError } = await supabase
        .from('household_members')
        .select('customer_id')
        .eq('household_id', memberData.household_id)
        .not('customer_id', 'is', null);

      if (householdError) throw householdError;

      const customerIds = householdMembers.map(m => m.customer_id);

      if (customerIds.length === 0) {
        setCallAnalytics([]);
        return;
      }

      // Get call logs and analysis for the last 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: callsData, error: callsError } = await supabase
        .from('call_logs')
        .select(`
          *,
          call_analysis(mood_score)
        `)
        .in('user_id', customerIds)
        .gte('timestamp', sevenDaysAgo.toISOString())
        .order('timestamp', { ascending: true });

      if (callsError) throw callsError;

      // Group by day and calculate averages
      const dayData: { [key: string]: { mood: number[], duration: number[], count: number } } = {};
      
      callsData?.forEach(call => {
        const day = new Date(call.timestamp).toLocaleDateString('en-US', { weekday: 'short' });
        
        if (!dayData[day]) {
          dayData[day] = { mood: [], duration: [], count: 0 };
        }
        
        dayData[day].count++;
        if (call.call_duration) dayData[day].duration.push(call.call_duration / 60); // Convert to minutes
        if (call.call_analysis?.[0]?.mood_score) dayData[day].mood.push(call.call_analysis[0].mood_score);
      });

      const analytics = Object.entries(dayData).map(([day, data]) => ({
        day,
        mood: data.mood.length ? data.mood.reduce((a, b) => a + b, 0) / data.mood.length : 0,
        engagement: Math.min(data.count * 2, 10), // Simple engagement metric
        callDuration: data.duration.length ? data.duration.reduce((a, b) => a + b, 0) / data.duration.length : 0
      }));

      setCallAnalytics(analytics);
    } catch (err) {
      console.error('Error fetching call analytics:', err);
      setError('Failed to load call analytics');
    }
  };

  const calculateQuickStats = async () => {
    if (!user) return;

    try {
      // Get user's household customers
      const { data: memberData, error: memberError } = await supabase
        .from('household_members')
        .select('household_id')
        .eq('user_id', user.id)
        .single();

      if (memberError) throw memberError;

      const { data: householdMembers, error: householdError } = await supabase
        .from('household_members')
        .select('customer_id')
        .eq('household_id', memberData.household_id)
        .not('customer_id', 'is', null);

      if (householdError) throw householdError;

      const customerIds = householdMembers.map(m => m.customer_id);

      if (customerIds.length === 0) {
        setQuickStats([]);
        return;
      }

      // Get recent call completion rate
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: recentCalls, error: callsError } = await supabase
        .from('call_logs')
        .select('call_outcome, call_analysis(mood_score)')
        .in('user_id', customerIds)
        .gte('timestamp', sevenDaysAgo.toISOString());

      if (callsError) throw callsError;

      const totalCalls = recentCalls?.length || 0;
      const answeredCalls = recentCalls?.filter(call => call.call_outcome === 'answered').length || 0;
      const completionRate = totalCalls > 0 ? Math.round((answeredCalls / totalCalls) * 100) : 0;

      // Calculate average mood
      const moodScores = recentCalls?.map(call => call.call_analysis?.[0]?.mood_score).filter(Boolean) || [];
      const avgMood = moodScores.length > 0 
        ? (moodScores.reduce((a, b) => a + b, 0) / moodScores.length).toFixed(1)
        : '0.0';

      // Get urgent alerts count
      const urgentAlerts = alerts.filter(alert => alert.severity === 'HIGH' && alert.status === 'OPEN').length;

      const stats: QuickStat[] = [
        {
          title: "Daily Call Completion",
          value: `${completionRate}%`,
          trend: completionRate >= 80 ? "up" : "down",
          description: completionRate >= 80 ? "Good consistency this week" : "Needs attention"
        },
        {
          title: "Average Mood Score",
          value: `${avgMood}/10`,
          trend: parseFloat(avgMood) >= 7 ? "up" : parseFloat(avgMood) >= 5 ? "stable" : "down",
          description: parseFloat(avgMood) >= 7 ? "Above baseline, showing positivity" : "Monitoring mood patterns"
        },
        {
          title: "Active Alerts",
          value: urgentAlerts.toString(),
          trend: urgentAlerts === 0 ? "up" : "down",
          description: urgentAlerts === 0 ? "No urgent alerts" : `${urgentAlerts} alerts need attention`
        },
        {
          title: "Weekly Calls",
          value: totalCalls.toString(),
          trend: totalCalls >= 7 ? "up" : "stable",
          description: `${totalCalls} calls completed this week`
        }
      ];

      setQuickStats(stats);
    } catch (err) {
      console.error('Error calculating quick stats:', err);
      setError('Failed to calculate statistics');
    }
  };

  const acknowledgeAlert = async (alertId: string) => {
    try {
      const { error } = await supabase
        .from('alerts')
        .update({ status: 'RESOLVED' })
        .eq('id', alertId);

      if (error) throw error;

      // Update local state
      setAlerts(prev => prev.map(alert => 
        alert.id === alertId ? { ...alert, status: 'RESOLVED' as const } : alert
      ));
    } catch (err) {
      console.error('Error acknowledging alert:', err);
      throw new Error('Failed to acknowledge alert');
    }
  };

  const refreshData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      await Promise.all([
        fetchHouseholdAlerts(),
        fetchCallAnalytics(),
        calculateQuickStats()
      ]);
    } catch (err) {
      console.error('Error refreshing data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      refreshData();
    }
  }, [user]);

  return {
    alerts,
    callAnalytics,
    quickStats,
    loading,
    error,
    acknowledgeAlert,
    refreshData
  };
};