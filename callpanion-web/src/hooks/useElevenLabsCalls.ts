import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface CallLog {
  id: string;
  contact_name: string;
  call_outcome?: string;
  call_duration?: number;
  timestamp: string;
  conversation_summary?: string;
  mood_assessment?: string;
}

export const useElevenLabsCalls = () => {
  const { user } = useAuth();
  const [callHistory, setCallHistory] = useState<CallLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadCallHistory = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('call_logs')
        .select(`
          id,
          call_duration,
          call_outcome,
          timestamp,
          conversation_summary,
          mood_assessment
        `)
        .eq('user_id', user.id)
        .order('timestamp', { ascending: false })
        .limit(50);

      if (error) throw error;

      const formattedHistory: CallLog[] = data?.map(log => ({
        id: log.id,
        contact_name: 'Family Member', // Default since we don't have contact names stored
        call_duration: log.call_duration,
        call_outcome: log.call_outcome,
        timestamp: log.timestamp,
        conversation_summary: log.conversation_summary,
        mood_assessment: log.mood_assessment
      })) || [];

      setCallHistory(formattedHistory);
    } catch (error) {
      console.error('Error loading call history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCallHistory();
  }, [user]);

  return {
    callHistory,
    isLoading,
    refreshHistory: loadCallHistory
  };
};