import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Plus, Shield, Eye, UserCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useFamilyRole } from '@/hooks/useFamilyRole';
import RelativeNavigation from '@/components/RelativeNavigation';

interface FamilyMember {
  id: string;
  user_id: string;
  role: 'admin' | 'member';
  can_view_family_health: boolean;
  created_at: string;
  profiles?: {
    full_name: string;
    email: string;
  };
}

const FamilyMembers = () => {
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSettingUpAdmin, setIsSettingUpAdmin] = useState(false);
  const { isAdmin, familyId, loading: roleLoading } = useFamilyRole();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (!familyId) return;

    const fetchMembers = async () => {
      try {
        const { data, error } = await supabase
          .from('family_members')
          .select(`
            id,
            user_id,
            role,
            can_view_family_health,
            created_at
          `)
          .eq('family_id', familyId);

        if (error) throw error;

        // Fetch profiles separately since the join might not work
        const userIds = data?.map(m => m.user_id) || [];
        let profilesData: any[] = [];
        
        if (userIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .in('id', userIds);
          profilesData = profiles || [];
        }

        // Combine the data
        const membersWithProfiles = data?.map(member => ({
          ...member,
          profiles: profilesData.find(p => p.id === member.user_id) || { full_name: 'Unknown', email: 'Unknown' }
        })) || [];

        setMembers(membersWithProfiles);
      } catch (error) {
        console.error('Error fetching family members:', error);
        toast({
          title: "Error",
          description: "Failed to load family members",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };

    fetchMembers();
  }, [familyId, toast]);

  const updateMemberRole = async (memberId: string, newRole: 'admin' | 'member') => {
    try {
      const { error } = await supabase
        .from('family_members')
        .update({ role: newRole })
        .eq('id', memberId);

      if (error) throw error;

      setMembers(prev => prev.map(member => 
        member.id === memberId ? { ...member, role: newRole } : member
      ));

      toast({
        title: "Success",
        description: `Member role updated to ${newRole}`,
      });
    } catch (error) {
      console.error('Error updating member role:', error);
      toast({
        title: "Error",
        description: "Failed to update member role",
        variant: "destructive"
      });
    }
  };

  const toggleHealthAccess = async (memberId: string, currentAccess: boolean) => {
    try {
      const { error } = await supabase
        .from('family_members')
        .update({ can_view_family_health: !currentAccess })
        .eq('id', memberId);

      if (error) throw error;

      setMembers(prev => prev.map(member => 
        member.id === memberId ? { ...member, can_view_family_health: !currentAccess } : member
      ));

      toast({
        title: "Success",
        description: `Health access ${!currentAccess ? 'granted' : 'revoked'}`,
      });
    } catch (error) {
      console.error('Error updating health access:', error);
      toast({
        title: "Error",
        description: "Failed to update health access",
        variant: "destructive"
      });
    }
  };

  const handleBecomeAdmin = async () => {
    setIsSettingUpAdmin(true);
    try {
      const { data, error } = await supabase.rpc('ensure_family_admin_for_current_user');
      
      if (error) throw error;
      
      const response = data as { success: boolean; message?: string; error?: string };
      
      if (response.success) {
        toast({
          title: "Success",
          description: response.message,
        });
        // Refresh the page to update role state
        window.location.reload();
      } else {
        toast({
          title: "Notice",
          description: response.error,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error setting up admin:', error);
      toast({
        title: "Error",
        description: "Failed to set up family administrator",
        variant: "destructive",
      });
    } finally {
      setIsSettingUpAdmin(false);
    }
  };

  if (!roleLoading && !isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-comfort/20">
        <RelativeNavigation />
        <div className="max-w-4xl mx-auto px-4 py-8">
          <Card>
            <CardContent className="pt-6 text-center">
              <UserCheck className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Administrator Access Required</h3>
              <p className="text-muted-foreground mb-6">
                Only family administrators can manage members and their permissions.
              </p>
              <Button 
                onClick={handleBecomeAdmin}
                disabled={isSettingUpAdmin}
                className="h-12 px-8"
              >
                <Shield className="h-5 w-5 mr-2" />
                {isSettingUpAdmin ? "Setting up..." : "Become Administrator"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-comfort/20">
      <RelativeNavigation />
      
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Family Members</h1>
            <p className="text-muted-foreground">
              Manage your family members and their permissions
            </p>
          </div>
          <Button 
            onClick={() => navigate('/family/invite')}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Member
          </Button>
        </div>

        {loading ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-center">Loading family members...</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {members.map((member) => (
              <Card key={member.id}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                        <Users className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold">
                          {member.profiles?.full_name || 'Unknown'}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {member.profiles?.email}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <Badge 
                        variant={member.role === 'admin' ? 'default' : 'secondary'}
                        className="flex items-center gap-1"
                      >
                        <Shield className="h-3 w-3" />
                        {member.role}
                      </Badge>
                      
                      {member.can_view_family_health && (
                        <Badge variant="outline" className="flex items-center gap-1">
                          <Eye className="h-3 w-3" />
                          Health Access
                        </Badge>
                      )}
                      
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateMemberRole(member.id, member.role === 'admin' ? 'member' : 'admin')}
                        >
                          {member.role === 'admin' ? 'Remove Admin' : 'Make Admin'}
                        </Button>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleHealthAccess(member.id, member.can_view_family_health)}
                        >
                          {member.can_view_family_health ? 'Revoke Health' : 'Grant Health'}
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FamilyMembers;