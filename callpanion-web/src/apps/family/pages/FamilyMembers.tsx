import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Mail, UserCheck, Settings, Loader2 } from 'lucide-react';
import AddFamilyMemberDialog from '@/components/AddFamilyMemberDialog';
import { useUserHousehold } from '@/hooks/useUserHousehold';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { useInviteCooldowns } from '@/hooks/useInviteCooldowns';

interface HouseholdMember {
  id: string;
  user_id: string;
  role: string;
  health_access_level?: string;
  created_at: string;
  profiles?: {
    display_name: string;
  } | null;
}

interface PendingInvite {
  id: string;
  email: string;
  role: string;
  expires_at: string;
}

const DEFAULT_COOLDOWN_MS = 60_000; // 60s fallback
const inflight = new Set<string>(); // single-flight per email

const FamilyMembers = () => {
  const { household } = useUserHousehold();
  const { toast } = useToast();
  const { cooldowns, setCd, remaining } = useInviteCooldowns();
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingEmail, setSendingEmail] = useState<string | null>(null);

  useEffect(() => {
    if (household?.id) {
      loadFamilyData();
    }
  }, [household?.id]);

  const loadFamilyData = async () => {
    if (!household?.id) return;
    
    setLoading(true);
    try {
      // Fetch household members (without joins to avoid 400 errors)
      const { data: membersData, error: membersError } = await supabase
        .from('household_members')
        .select('id, user_id, role, health_access_level, created_at')
        .eq('household_id', household.id);

      if (membersError) throw membersError;

      // Attempt to enrich with profile display names (best-effort)
      let mergedMembers: HouseholdMember[] = membersData || [];
      try {
        const userIds = (membersData || []).map((m: any) => m.user_id).filter(Boolean);
        if (userIds.length > 0) {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('id, display_name')
            .in('id', userIds);

          const nameMap = new Map<string, string>();
          (profileData || []).forEach((p: any) => nameMap.set(p.id, p.display_name));
          mergedMembers = (membersData || []).map((m: any) => ({
            ...m,
            profiles: nameMap.has(m.user_id) ? { display_name: nameMap.get(m.user_id)! } : null,
          }));
        }
      } catch (e) {
        // If profiles query fails due to RLS, continue without names
        mergedMembers = (membersData || []).map((m: any) => ({ ...m, profiles: null }));
      }

      // Fetch pending invites
      const { data: invitesData, error: invitesError } = await supabase
        .from('invites')
        .select('id, email, role, expires_at')
        .eq('household_id', household.id)
        .is('accepted_at', null)
        .gt('expires_at', new Date().toISOString());

      if (invitesError) throw invitesError;

      setMembers(mergedMembers);
      setPendingInvites(invitesData || []);
    } catch (error) {
      console.error('Error loading family data:', error);
      toast({
        title: "Error",
        description: "Failed to load family members",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleMemberAdded = () => {
    // Refresh the data when a new member is added
    loadFamilyData();
  };

  const handleResendInvite = async (inviteId: string, email: string, e?: React.MouseEvent<HTMLButtonElement>) => {
    e?.preventDefault?.();

    // Guard: active cooldown
    if (remaining(email) > 0) {
      const secs = Math.ceil(remaining(email) / 1000);
      toast({
        title: "Too Many Requests",
        description: `You've requested too many invites. Try again in ~${secs}s.`,
        variant: "destructive"
      });
      return;
    }

    // Guard: single-flight per email
    if (inflight.has(email) || sendingEmail) return;

    inflight.add(email);
    setSendingEmail(email);

    try {
      // Get fresh session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        toast({
          title: "Authentication Error",
          description: "Please sign in again",
          variant: "destructive"
        });
        return;
      }
      if (!session?.access_token) {
        toast({
          title: "Authentication Required",
          description: "Please sign in to resend invites",
          variant: "destructive"
        });
        return;
      }

      // First attempt with current token
      let { data, error } = await supabase.functions.invoke("send-invite-email-rl", {
        body: { inviteId },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Cache-Control': 'no-store'
        }
      });

      // If token expired, refresh once and retry
      if (error && error.status === 401) {
        const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError || !refreshed?.session?.access_token) {
          toast({
            title: "Authentication Error",
            description: "Please sign in again",
            variant: "destructive"
          });
          return;
        }

        // Retry with fresh token
        const retry = await supabase.functions.invoke("send-invite-email-rl", {
          body: { inviteId },
          headers: {
            Authorization: `Bearer ${refreshed.session.access_token}`,
            'Cache-Control': 'no-store'
          }
        });
        
        data = retry.data;
        error = retry.error;
      }

      if (error) {
        // When supabase-js v2 gets non-2xx, it often throws; but if we reach here with error, treat it similarly.
        throw error;
      }

      toast({
        title: "Invite Resent",
        description: "Invitation has been resent to " + email,
      });
      setCd(email, Date.now() + DEFAULT_COOLDOWN_MS);
    } catch (err: any) {
      // Normalise Supabase Functions errors
      let status: number | undefined;
      let retryAfterSec: number | undefined;
      let message: string | undefined;

      try {
        // supabase-js FunctionsHttpError usually carries the Response at err.context.response
        const resp = err?.context?.response;
        status = resp?.status ?? err?.status;
        retryAfterSec = Number(resp?.headers?.get?.("Retry-After")) || undefined;

        // Try to parse JSON body for a clearer message
        if (resp?.json) {
          const body = await resp.json().catch(() => null);
          message = body?.message || body?.error || err?.message;
        } else {
          message = err?.message;
        }
      } catch {
        message = err?.message || "Unknown error";
      }

      // Debug: log everything so we can see the exact status/body
      console.error("[send-invite-email-rl] error", {
        name: err?.name,
        status,
        retryAfterSec,
        message,
        raw: err,
      });

      if (status === 429) {
        const cooldownMs = (retryAfterSec ? retryAfterSec * 1000 : DEFAULT_COOLDOWN_MS);
        setCd(email, Date.now() + cooldownMs);
        const secs = Math.ceil(cooldownMs / 1000);
        toast({
          title: "Too Many Requests",
          description: `Too many requests. Try again in ~${secs}s.`,
          variant: "destructive"
        });
      } else {
        toast({
          title: "Error",
          description: message || "Failed to resend invite.",
          variant: "destructive"
        });
      }
    } finally {
      inflight.delete(email);
      setSendingEmail(null);
    }
  };

  const handleCancelInvite = async (inviteId: string) => {
    try {
      const { error } = await supabase
        .from('invites')
        .delete()
        .eq('id', inviteId);

      if (error) throw error;

      toast({
        title: "Invite Cancelled",
        description: "The invitation has been cancelled",
      });
      
      loadFamilyData();
    } catch (error) {
      console.error('Error cancelling invite:', error);
      toast({
        title: "Error",
        description: "Failed to cancel invitation",
        variant: "destructive"
      });
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'FAMILY_PRIMARY':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      case 'FAMILY_MEMBER':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'elderly':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'FAMILY_PRIMARY': return 'Primary Admin';
      case 'FAMILY_MEMBER': return 'Family Member';
      case 'elderly': return 'Elder';
      default: return role;
    }
  };

  const getHealthAccessColor = (level: string) => {
    switch (level) {
      case 'FULL_ACCESS': return 'text-green-600';
      case 'SUMMARY_ONLY': return 'text-yellow-600';
      case 'NO_ACCESS': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading family members...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Family Members</h1>
          <p className="text-muted-foreground">
            Manage family members and their access permissions
          </p>
        </div>
        {household && (
          <AddFamilyMemberDialog 
            householdId={household.id} 
            onMemberAdded={handleMemberAdded}
            trigger={
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Invite Family Member
              </Button>
            }
          />
        )}
      </div>

      {/* Active Members */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5" />
            Active Members ({members.length})
          </CardTitle>
          <CardDescription>
            Family members who have accepted their invitations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {members.map((member) => (
              <div key={member.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold">{member.profiles?.display_name || 'Unknown User'}</h3>
                    <Badge className={getRoleColor(member.role)}>
                      {getRoleDisplayName(member.role)}
                    </Badge>
                    <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                      active
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    Added: {new Date(member.created_at).toLocaleDateString()}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className={`text-xs ${getHealthAccessColor(member.health_access_level || 'NO_ACCESS')}`}>
                      Health Access: {member.health_access_level?.replace('_', ' ') || 'No Access'}
                    </Badge>
                    {member.role === 'FAMILY_PRIMARY' && (
                      <Badge variant="outline" className="text-xs">
                        Full Management
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    <Settings className="h-4 w-4 mr-1" />
                    Edit Permissions
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Pending Invites */}
      {pendingInvites.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Pending Invites ({pendingInvites.length})
            </CardTitle>
            <CardDescription>
              Invitations that have been sent but not yet accepted
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {pendingInvites.map((invite) => (
                <div key={invite.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold">{invite.email}</h3>
                      <Badge className={getRoleColor(invite.role)}>
                        {getRoleDisplayName(invite.role)}
                      </Badge>
                      <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300">
                        pending
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Expires: {new Date(invite.expires_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={(ev) => handleResendInvite(invite.id, invite.email, ev)}
                      disabled={
                        sendingEmail === invite.email ||
                        remaining(invite.email) > 0
                      }
                      title={remaining(invite.email) > 0 ? `Please wait ${Math.ceil(remaining(invite.email)/1000)}s` : "Resend invite"}
                    >
                      {sendingEmail === invite.email ? "Sending..." : "Resend Invite"}
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleCancelInvite(invite.id)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {members.length === 0 && pendingInvites.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <UserCheck className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <div className="space-y-2 mb-4">
                <h3 className="text-lg font-semibold">No family members yet</h3>
                <p className="text-muted-foreground">
                  Invite family members to help care for your loved ones
                </p>
              </div>
              {household && (
                <AddFamilyMemberDialog 
                  householdId={household.id} 
                  onMemberAdded={handleMemberAdded}
                  trigger={
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Invite First Member
                    </Button>
                  }
                />
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default FamilyMembers;