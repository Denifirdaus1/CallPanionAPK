import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface UserHousehold {
  id: string;
  name: string;
  role: string;
}

export const useUserHousehold = () => {
  const { user } = useAuth();
  const [household, setHousehold] = useState<UserHousehold | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserHousehold = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        // Get the user's household membership
        const { data: memberData, error: memberError } = await supabase
          .from('household_members')
          .select(`
            household_id,
            role,
            households!inner(
              id,
              name
            )
          `)
          .eq('user_id', user.id)
          .single();

        if (memberError) {
          if (memberError.code === 'PGRST116') {
            // No household found - this is ok, user might not be in a household yet
            setHousehold(null);
          } else {
            throw memberError;
          }
        } else if (memberData) {
          setHousehold({
            id: memberData.household_id,
            name: memberData.households.name || 'My Household',
            role: memberData.role
          });
        }
      } catch (err) {
        console.error('Error fetching user household:', err);
        setError('Failed to load household information');
      } finally {
        setLoading(false);
      }
    };

    fetchUserHousehold();
  }, [user]);

  return { household, loading, error };
};