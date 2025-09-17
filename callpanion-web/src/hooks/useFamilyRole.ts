import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface FamilyMember {
  family_id: string;
  role: 'admin' | 'member';
  can_view_family_health: boolean;
}

export const useFamilyRole = () => {
  const { user } = useAuth();
  const [familyMember, setFamilyMember] = useState<FamilyMember | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setFamilyMember(null);
      setLoading(false);
      return;
    }

    const fetchFamilyRole = async () => {
      try {
        const { data, error } = await supabase
          .from('family_members')
          .select('family_id, role, can_view_family_health')
          .eq('user_id', user.id)
          .single();

        if (error && error.code !== 'PGRST116') {
          console.error('Error fetching family role:', error);
          return;
        }

        setFamilyMember(data);
      } catch (error) {
        console.error('Error in fetchFamilyRole:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchFamilyRole();
  }, [user]);

  const isAdmin = familyMember?.role === 'admin';
  const canViewFamilyHealth = familyMember?.can_view_family_health || false;
  const familyId = familyMember?.family_id;

  return {
    familyMember,
    isAdmin,
    canViewFamilyHealth,
    familyId,
    loading
  };
};