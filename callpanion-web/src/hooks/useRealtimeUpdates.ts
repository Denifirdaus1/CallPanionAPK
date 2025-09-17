import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UseRealtimeUpdatesProps {
  onCallLogUpdate?: () => void;
  onCallSessionUpdate?: () => void;
  householdIds?: string[];
}

export const useRealtimeUpdates = ({ 
  onCallLogUpdate, 
  onCallSessionUpdate, 
  householdIds 
}: UseRealtimeUpdatesProps) => {
  useEffect(() => {
    const channels: any[] = [];

    // Subscribe to call logs changes
    if (onCallLogUpdate && householdIds?.length) {
      const callLogsChannel = supabase
        .channel('call-logs-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'call_logs',
            filter: `household_id=in.(${householdIds.join(',')})`
          },
          (payload) => {
            console.log('Call log update:', payload);
            onCallLogUpdate();
          }
        )
        .subscribe();

      channels.push(callLogsChannel);
    }

    // Subscribe to call sessions changes
    if (onCallSessionUpdate && householdIds?.length) {
      const sessionsChannel = supabase
        .channel('call-sessions-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'call_sessions',
            filter: `household_id=in.(${householdIds.join(',')})`
          },
          (payload) => {
            console.log('Call session update:', payload);
            onCallSessionUpdate();
          }
        )
        .subscribe();

      channels.push(sessionsChannel);
    }

    return () => {
      channels.forEach(channel => {
        supabase.removeChannel(channel);
      });
    };
  }, [onCallLogUpdate, onCallSessionUpdate, householdIds]);
};