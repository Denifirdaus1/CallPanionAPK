import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface UserRole {
  role: string;
  familyId?: string;
  householdId?: string;
  permissions: {
    canViewHealth: boolean;
    canManageElders: boolean;
    canManageFamily: boolean;
    isAdmin: boolean;
  };
}

export const useUserRole = () => {
  const { user } = useAuth();
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setUserRole(null);
      setLoading(false);
      return;
    }

    const fetchUserRole = async () => {
      try {
        // First check profiles table for basic role
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, display_name')
          .eq('id', user.id)
          .single();

        if (profile?.role) {
          // User has a direct role (elder, company_admin, etc.)
          const permissions = {
            canViewHealth: profile.role === 'company_admin',
            canManageElders: ['company_admin', 'family_admin'].includes(profile.role),
            canManageFamily: ['company_admin', 'family_admin'].includes(profile.role),
            isAdmin: profile.role === 'company_admin'
          };

          setUserRole({
            role: profile.role,
            permissions
          });
        } else {
          // Check family membership
          const { data: familyMember } = await supabase
            .from('family_members')
            .select('family_id, role, can_view_family_health')
            .eq('user_id', user.id)
            .single();

          if (familyMember) {
            const role = familyMember.role === 'admin' ? 'family_admin' : 'family_member';
            const permissions = {
              canViewHealth: familyMember.can_view_family_health || familyMember.role === 'admin',
              canManageElders: familyMember.role === 'admin',
              canManageFamily: familyMember.role === 'admin',
              isAdmin: false
            };

            setUserRole({
              role,
              familyId: familyMember.family_id,
              permissions
            });
          } else {
            // Check household membership
            const { data: householdMember } = await supabase
              .from('household_members')
              .select('household_id, role')
              .eq('user_id', user.id)
              .single();

            if (householdMember) {
              const role = householdMember.role === 'FAMILY_PRIMARY' ? 'family_admin' : 'family_member';
              const permissions = {
                canViewHealth: householdMember.role === 'FAMILY_PRIMARY',
                canManageElders: householdMember.role === 'FAMILY_PRIMARY',
                canManageFamily: householdMember.role === 'FAMILY_PRIMARY',
                isAdmin: false
              };

              setUserRole({
                role,
                householdId: householdMember.household_id,
                permissions
              });
            }
          }
        }
      } catch (error) {
        console.error('Error fetching user role:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserRole();
  }, [user]);

  return {
    userRole,
    loading,
    isElder: userRole?.role === 'elder',
    isFamilyAdmin: userRole?.role === 'family_admin',
    isFamilyMember: ['family_admin', 'family_member'].includes(userRole?.role || ''),
    isCompanyAdmin: userRole?.role === 'company_admin'
  };
};