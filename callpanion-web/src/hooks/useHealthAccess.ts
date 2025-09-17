import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useFamilyRole } from './useFamilyRole';

export const useHealthAccess = () => {
  const { user } = useAuth();
  const { isAdmin, canViewFamilyHealth, loading: familyLoading } = useFamilyRole();
  const [hasElderAccess, setHasElderAccess] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || familyLoading) {
      setLoading(familyLoading);
      return;
    }

    const checkElderAccess = async () => {
      try {
        if (isAdmin || canViewFamilyHealth) {
          setHasElderAccess(true);
          setLoading(false);
          return;
        }

        // Check if user has specific elder access
        const { data, error } = await supabase
          .from('elder_access')
          .select('can_view_health')
          .eq('user_id', user.id)
          .eq('can_view_health', true)
          .limit(1);

        if (error) {
          console.error('Error checking elder access:', error);
          setHasElderAccess(false);
        } else {
          setHasElderAccess(data && data.length > 0);
        }
      } catch (error) {
        console.error('Error in checkElderAccess:', error);
        setHasElderAccess(false);
      } finally {
        setLoading(false);
      }
    };

    checkElderAccess();
  }, [user, isAdmin, canViewFamilyHealth, familyLoading]);

  const canViewHealthInsights = isAdmin || canViewFamilyHealth || hasElderAccess;

  return {
    canViewHealthInsights,
    loading
  };
};