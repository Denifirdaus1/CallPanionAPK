import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Mail, 
  Shield, 
  ShieldCheck, 
  Crown, 
  UserMinus, 
  Plus, 
  Copy, 
  ExternalLink,
  Trash2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface HouseholdMember {
  id: string;
  user_id: string;
  role: string;
  health_access_level: string;
  created_at: string;
  display_name?: string;
}

interface PendingInvite {
  id: string;
  email: string;
  role: string;
  token: string;
  expires_at: string;
  household_id: string;
  invited_by: string;
  display_name?: string;
  relationship_type?: string;
  permissions_metadata?: any; // Use any for JSON type from Supabase
}

interface HouseholdMembersManagerProps {
  householdId: string;
  currentUserRole: string;
}

const HouseholdMembersManager: React.FC<HouseholdMembersManagerProps> = ({ 
  householdId, 
  currentUserRole 
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('FAMILY_MEMBER');
  const [showInviteForm, setShowInviteForm] = useState(false);

  const isPrimaryUser = currentUserRole === 'FAMILY_PRIMARY';

  useEffect(() => {
    loadMembersAndInvites();
  }, [householdId]);

  const loadMembersAndInvites = async () => {
    try {
      // Load household members (only family members, not elderly)
      const { data: membersData, error: membersError } = await supabase
        .from('household_members')
        .select('id, user_id, role, health_access_level, created_at')
        .eq('household_id', householdId)
        .not('user_id', 'is', null)
        .in('role', ['FAMILY_PRIMARY', 'FAMILY_MEMBER']);

      if (membersError) throw membersError;

      // Get profile names for each member
      const enrichedMembers = await Promise.all(
        (membersData || []).map(async (member) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('display_name')
            .eq('id', member.user_id)
            .single();
          
          return {
            ...member,
            display_name: profile?.display_name || 'Unknown User'
          };
        })
      );

      setMembers(enrichedMembers);

      // Load pending invites
      const { data: invitesData, error: invitesError } = await supabase
        .from('invites')
        .select('id, email, role, token, expires_at, household_id, invited_by, metadata')
        .eq('household_id', householdId)
        .is('accepted_at', null)
        .gt('expires_at', new Date().toISOString());

      if (!invitesError) {
        const mappedInvites: PendingInvite[] = (invitesData || []).map((inv: any) => ({
          id: inv.id,
          email: inv.email,
          role: inv.role,
          token: inv.token,
          expires_at: inv.expires_at,
          household_id: inv.household_id,
          invited_by: inv.invited_by,
          display_name: inv.metadata?.name ?? undefined,
          relationship_type: inv.metadata?.relationship ?? undefined,
          permissions_metadata: {
            viewHealthInsights: (inv.metadata?.health_access_level ?? 'NO_ACCESS') === 'FULL_ACCESS',
            viewCalendar: !!inv.metadata?.can_view_calendar,
            postUpdates: !!inv.metadata?.can_post_updates,
          },
        }));
        setPendingInvites(mappedInvites);
      }

    } catch (error) {
      console.error('Error loading members and invites:', error);
      toast({
        title: 'Error',
        description: 'Failed to load household members',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleRole = async (memberId: string, currentRole: string) => {
    try {
      const newRole = currentRole === 'FAMILY_PRIMARY' ? 'FAMILY_MEMBER' : 'FAMILY_PRIMARY';
      
      // Don't allow demoting the last admin
      if (currentRole === 'FAMILY_PRIMARY') {
        const adminCount = members.filter(m => m.role === 'FAMILY_PRIMARY').length;
        if (adminCount <= 1) {
          toast({
            title: 'Cannot demote',
            description: 'At least one family administrator is required',
            variant: 'destructive'
          });
          return;
        }
      }

      const { error } = await supabase
        .from('household_members')
        .update({ role: newRole })
        .eq('id', memberId);

      if (error) throw error;

      setMembers(prev => prev.map(member => 
        member.id === memberId ? { ...member, role: newRole } : member
      ));

      toast({
        title: 'Role updated',
        description: `Member ${newRole === 'FAMILY_PRIMARY' ? 'promoted to' : 'demoted from'} administrator`
      });

    } catch (error) {
      console.error('Error updating role:', error);
      toast({
        title: 'Error',
        description: 'Failed to update member role',
        variant: 'destructive'
      });
    }
  };

  const toggleHealthAccess = async (memberId: string, currentLevel: string) => {
    try {
      const newLevel = currentLevel === 'FULL_ACCESS' ? 'SUMMARY_ONLY' : 'FULL_ACCESS';
      
      const { error } = await supabase
        .from('household_members')
        .update({ health_access_level: newLevel })
        .eq('id', memberId);

      if (error) throw error;

      setMembers(prev => prev.map(member => 
        member.id === memberId ? { ...member, health_access_level: newLevel } : member
      ));

      toast({
        title: 'Access updated',
        description: `Health access level changed to ${newLevel.replace('_', ' ').toLowerCase()}`
      });

    } catch (error) {
      console.error('Error updating health access:', error);
      toast({
        title: 'Error',
        description: 'Failed to update health access level',
        variant: 'destructive'
      });
    }
  };

  const removeMember = async (memberId: string, memberRole: string) => {
    try {
      // Don't allow removing the last admin
      if (memberRole === 'FAMILY_PRIMARY') {
        const adminCount = members.filter(m => m.role === 'FAMILY_PRIMARY').length;
        if (adminCount <= 1) {
          toast({
            title: 'Cannot remove',
            description: 'At least one family administrator is required',
            variant: 'destructive'
          });
          return;
        }
      }

      const { error } = await supabase
        .from('household_members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;

      setMembers(prev => prev.filter(member => member.id !== memberId));

      toast({
        title: 'Member removed',
        description: 'Household member has been removed successfully'
      });

    } catch (error) {
      console.error('Error removing member:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove household member',
        variant: 'destructive'
      });
    }
  };

  const createInvite = async () => {
    try {
      if (!inviteEmail.trim()) {
        toast({
          title: 'Email required',
          description: 'Please enter an email address',
          variant: 'destructive'
        });
        return;
      }

      // Generate secure token
      const token = Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      const { error } = await supabase
        .from('invites')
        .insert({
          household_id: householdId,
          email: inviteEmail.trim(),
          role: inviteRole,
          token,
          invited_by: user?.id,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        });

      if (error) throw error;

      setInviteEmail('');
      setShowInviteForm(false);
      await loadMembersAndInvites();

      toast({
        title: 'Invite sent',
        description: `Invitation sent to ${inviteEmail}`
      });

    } catch (error) {
      console.error('Error creating invite:', error);
      toast({
        title: 'Error',
        description: 'Failed to create invitation',
        variant: 'destructive'
      });
    }
  };

  const copyInviteLink = async (token: string) => {
    try {
      const link = `${window.location.origin}/accept-invite?token=${token}`;
      await navigator.clipboard.writeText(link);
      toast({
        title: 'Link copied',
        description: 'Invitation link copied to clipboard'
      });
    } catch (error) {
      toast({
        title: 'Copy failed',
        description: 'Please copy the link manually',
        variant: 'destructive'
      });
    }
  };

  const revokeInvite = async (inviteId: string) => {
    try {
      // Since we can't delete, we'll expire the invite
      const { error } = await supabase
        .from('invites')
        .update({ expires_at: new Date(Date.now() - 60000).toISOString() })
        .eq('id', inviteId);

      if (error) throw error;

      setPendingInvites(prev => prev.filter(invite => invite.id !== inviteId));

      toast({
        title: 'Invite revoked',
        description: 'Invitation has been revoked successfully'
      });

    } catch (error) {
      console.error('Error revoking invite:', error);
      toast({
        title: 'Error',
        description: 'Failed to revoke invitation',
        variant: 'destructive'
      });
    }
  };

  const getRoleIcon = (role: string) => {
    return role === 'FAMILY_PRIMARY' ? <Crown className="w-4 h-4" /> : <Users className="w-4 h-4" />;
  };

  const getHealthAccessIcon = (level: string) => {
    return level === 'FULL_ACCESS' ? <ShieldCheck className="w-4 h-4" /> : <Shield className="w-4 h-4" />;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Household Members & Access</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Household Members & Access
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Manage who can access your family's care network
          </p>
        </div>
        {isPrimaryUser && (
          <Button onClick={() => setShowInviteForm(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Invite Member
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Members */}
        <div className="space-y-3">
          <h4 className="font-medium text-foreground">Current Members</h4>
          {members.map((member) => (
            <div key={member.id} className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                  {getRoleIcon(member.role)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">
                      {member.display_name || 'Unknown User'}
                    </span>
                    {member.user_id === user?.id && (
                      <Badge variant="outline" className="text-xs">You</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant={member.role === 'FAMILY_PRIMARY' ? 'default' : 'secondary'}>
                      {member.role === 'FAMILY_PRIMARY' ? 'Administrator' : 'Member'}
                    </Badge>
                    <Badge variant={member.health_access_level === 'FULL_ACCESS' ? 'default' : 'outline'}>
                      {member.health_access_level === 'FULL_ACCESS' ? 'Full Health Access' : 'Summary Only'}
                    </Badge>
                  </div>
                </div>
              </div>
              
              {isPrimaryUser && member.user_id !== user?.id && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleRole(member.id, member.role)}
                  >
                    {member.role === 'FAMILY_PRIMARY' ? 'Demote' : 'Promote'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleHealthAccess(member.id, member.health_access_level)}
                  >
                    {getHealthAccessIcon(member.health_access_level)}
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" className="text-destructive">
                        <UserMinus className="w-4 h-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove Member</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to remove this member from the household? 
                          They will lose access to all family care information.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={() => removeMember(member.id, member.role)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Remove
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Pending Invites */}
        {pendingInvites.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-medium text-foreground">Pending Invitations</h4>
            {pendingInvites.map((invite) => (
              <div key={invite.id} className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                    <Mail className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {invite.display_name || invite.email}
                      </span>
                      {invite.relationship_type && (
                        <Badge variant="outline" className="text-xs capitalize">
                          {invite.relationship_type}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{invite.email}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline">
                        {invite.role === 'FAMILY_PRIMARY' ? 'Co-Administrator' : 'Family Member'}
                      </Badge>
                      {invite.permissions_metadata && typeof invite.permissions_metadata === 'object' && (
                        <div className="flex gap-1">
                          {invite.permissions_metadata.viewHealthInsights && (
                            <Badge variant="secondary" className="text-xs">Health</Badge>
                          )}
                          {invite.permissions_metadata.viewCalendar && (
                            <Badge variant="secondary" className="text-xs">Calendar</Badge>
                          )}
                          {invite.permissions_metadata.postUpdates && (
                            <Badge variant="secondary" className="text-xs">Updates</Badge>
                          )}
                        </div>
                      )}
                      <span className="text-xs text-muted-foreground">
                        Expires {new Date(invite.expires_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
                
                {isPrimaryUser && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyInviteLink(invite.token)}
                    >
                      <Copy className="w-4 h-4 mr-1" />
                      Copy Link
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(`${window.location.origin}/accept-invite?token=${invite.token}`, '_blank')}
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => revokeInvite(invite.id)}
                      className="text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Invite Form */}
        {showInviteForm && (
          <div className="border rounded-lg p-4 bg-muted/50">
            <h4 className="font-medium mb-4">Invite New Member</h4>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <Label htmlFor="invite-email">Email Address</Label>
                <Input
                  id="invite-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="Enter email address"
                />
              </div>
              <div>
                <Label htmlFor="invite-role">Role</Label>
                <Select value={inviteRole} onValueChange={setInviteRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FAMILY_MEMBER">Family Member</SelectItem>
                    <SelectItem value="FAMILY_PRIMARY">Administrator</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button onClick={createInvite} className="flex-1">
                  Send Invitation
                </Button>
                <Button variant="outline" onClick={() => setShowInviteForm(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default HouseholdMembersManager;