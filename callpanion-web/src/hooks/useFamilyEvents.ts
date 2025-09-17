import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useFamilyRole } from './useFamilyRole';

export interface FamilyEvent {
  id: string;
  title: string;
  description?: string;
  starts_at: string;
  ends_at?: string;
  elder_id?: string;
  family_id: string;
  created_by?: string;
  created_at: string;
}

export const useFamilyEvents = () => {
  const { user } = useAuth();
  const { familyId, loading: familyLoading } = useFamilyRole();
  const [events, setEvents] = useState<FamilyEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || familyLoading || !familyId) {
      setLoading(familyLoading);
      return;
    }

    const fetchEvents = async () => {
      try {
        const { data, error } = await supabase
          .from('events')
          .select('*')
          .eq('family_id', familyId)
          .order('starts_at', { ascending: true });

        if (error) {
          console.error('Error fetching events:', error);
          setError(error.message);
          return;
        }

        setEvents(data || []);
      } catch (err) {
        console.error('Error in fetchEvents:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch events');
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();

    // Set up realtime subscription
    const channel = supabase
      .channel(`events_${familyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'events',
          filter: `family_id=eq.${familyId}`
        },
        () => {
          fetchEvents();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, familyId, familyLoading]);

  const createEvent = async (eventData: Omit<FamilyEvent, 'id' | 'created_at' | 'family_id' | 'created_by'>) => {
    if (!familyId) throw new Error('No family ID available');

    const { data, error } = await supabase
      .from('events')
      .insert({
        ...eventData,
        family_id: familyId,
        created_by: user?.id
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  };

  const updateEvent = async (id: string, updates: Partial<FamilyEvent>) => {
    const { data, error } = await supabase
      .from('events')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  };

  const deleteEvent = async (id: string) => {
    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', id);

    if (error) throw error;
  };

  return {
    events,
    loading,
    error,
    createEvent,
    updateEvent,
    deleteEvent
  };
};