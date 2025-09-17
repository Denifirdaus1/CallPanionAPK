import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Heart, 
  Users, 
  Camera, 
  MessageSquare, 
  Calendar, 
  Activity, 
  Phone,
  Plus,
  Settings,
  TrendingUp,
  Smartphone,
  Clock,
  Globe,
  Moon,
  UserPlus
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import RelativeNavigation from '@/components/RelativeNavigation';
import WarmCard from '@/components/WarmCard';
import HouseholdMembersManager from '@/components/HouseholdMembersManager';
import AddFamilyMemberDialog from '@/components/AddFamilyMemberDialog';

interface HouseholdMember {
  id: string;
  role: string;
  user_id: string;
  health_access_level?: string;
  can_view_calendar?: boolean;
  can_post_updates?: boolean;
  profiles?: {
    display_name?: string;
    email?: string;
  };
}

interface Relative {
  id: string;
  first_name: string;
  last_name: string;
  town: string;
  county: string;
  country: string;
  call_cadence: string;
  timezone: string;
  quiet_hours_start: string;
  quiet_hours_end: string;
  last_active_at: string;
  created_at: string;
}

interface QuickStat {
  title: string;
  value: string;
  trend: 'up' | 'down' | 'stable';
  description: string;
}

const FamilyDashboard: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [currentUserRole, setCurrentUserRole] = useState<string>('FAMILY_MEMBER');
  const [currentHouseholdId, setCurrentHouseholdId] = useState<string>('');
  const [relatives, setRelatives] = useState<Relative[]>([]);
  const [quickStats, setQuickStats] = useState<QuickStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [householdMembers, setHouseholdMembers] = useState<HouseholdMember[]>([]);
  const [userPermissions, setUserPermissions] = useState({
    can_view_calendar: false,
    can_post_updates: false,
    health_access_level: 'NO_ACCESS'
  });

  useEffect(() => {
    loadDashboardData();
  }, []);

  // Show toast when navigating from add relative
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    if (urlParams.get('relative_added') === 'true') {
      toast({
        title: "✅ Relative added successfully!",
        description: "Your relative has been added to the care network",
        duration: 4000
      });
      // Clean up URL
      navigate('/family', { replace: true });
    }
  }, [location.search, navigate, toast]);

  const loadDashboardData = async () => {
    try {
      // Get current user's role
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/family-login');
        return;
      }

      // Get user's household and role with permissions
      const { data: memberData, error: memberError } = await supabase
        .from('household_members')
        .select(`
          role, 
          household_id,
          health_access_level,
          can_view_calendar,
          can_post_updates
        `)
        .eq('user_id', user.id)
        .maybeSingle();

      if (memberError || !memberData) {
        console.error('Error fetching member data:', memberError);
        setLoading(false);
        return;
      }

      setCurrentUserRole(memberData.role);
      setCurrentHouseholdId(memberData.household_id);
      setUserPermissions({
        can_view_calendar: memberData.can_view_calendar || false,
        can_post_updates: memberData.can_post_updates || false,
        health_access_level: memberData.health_access_level || 'NO_ACCESS'
      });

      // Get relatives for this household using secure RPC
      const { data: relativesData, error: relativesError } = await supabase
        .rpc('get_relatives_secure', { household_id_param: memberData.household_id });

      if (!relativesError && relativesData) {
        setRelatives(relativesData);
      } else {
        console.error('Error fetching relatives:', relativesError);
      }

      // Get household members with user profiles
      const { data: membersData, error: membersError } = await supabase
        .from('household_members')
        .select(`
          id,
          user_id,
          role,
          health_access_level,
          can_view_calendar,
          can_post_updates,
          created_at
        `)
        .eq('household_id', memberData.household_id);

      if (membersError) {
        console.error('Error fetching household members:', membersError);
      } else {
        // Transform data to match interface
        const membersWithProfiles = (membersData || []).map(member => ({
          ...member,
          profiles: {
            display_name: 'Family Member',
            email: 'No email available'
          }
        }));
        setHouseholdMembers(membersWithProfiles);
      }

      // Get call statistics for quick stats
      const { data: callLogs, error: callError } = await supabase
        .from('call_logs')
        .select('call_outcome, created_at, health_concerns_detected, emergency_flag')
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

      if (!callError && callLogs) {
        const totalCalls = callLogs.length;
        const completedCalls = callLogs.filter(call => call.call_outcome === 'completed').length;
        const healthConcerns = callLogs.filter(call => call.health_concerns_detected).length;
        const emergencies = callLogs.filter(call => call.emergency_flag).length;

        setQuickStats([
          {
            title: 'Total Calls This Week',
            value: totalCalls.toString(),
            trend: 'stable',
            description: `${completedCalls} completed successfully`
          },
          {
            title: 'Health Check Score',
            value: emergencies === 0 ? 'Good' : 'Attention',
            trend: emergencies === 0 ? 'up' : 'down',
            description: `${healthConcerns} concerns noted`
          },
          {
            title: 'Active Relatives',
            value: relatives.length.toString(),
            trend: 'stable',
            description: 'Connected to your care'
          },
          {
            title: 'System Status',
            value: 'Online',
            trend: 'up',
            description: 'All systems operational'
          }
        ]);
      }

    } catch (error) {
      console.error('Error loading dashboard:', error);
      toast({
        title: "Error",
        description: "Failed to load dashboard data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getTrendIcon = (trend: string) => {
    if (trend === 'up') return <TrendingUp className="w-4 h-4 text-green-600" />;
    if (trend === 'down') return <TrendingUp className="w-4 h-4 text-red-600 rotate-180" />;
    return <div className="w-4 h-4" />;
  };

  const isPrimaryUser = currentUserRole === 'FAMILY_PRIMARY';

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-comfort/20">
        <RelativeNavigation />
        <div className="max-w-6xl mx-auto p-6">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-comfort/20">
      <RelativeNavigation />
      
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-foreground mb-2">Family Care Dashboard</h1>
          <p className="text-muted-foreground">
            {isPrimaryUser ? 'Manage your family\'s care network' : 'Stay connected with your loved ones'}
          </p>
          <Badge variant="outline" className="mt-2">
            {currentUserRole === 'FAMILY_PRIMARY' ? 'Family Administrator' : 'Family Member'}
          </Badge>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickStats.map((stat, index) => (
            <WarmCard key={index} className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-muted-foreground">{stat.title}</span>
                {getTrendIcon(stat.trend)}
              </div>
              <div className="text-2xl font-bold text-foreground">{stat.value}</div>
              <p className="text-xs text-muted-foreground">{stat.description}</p>
            </WarmCard>
          ))}
        </div>

        {/* Family Members Management */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-semibold">Family Members</h2>
            {isPrimaryUser && (
              <div data-testid="admin-actions">
                <AddFamilyMemberDialog 
                  householdId={currentHouseholdId} 
                  onMemberAdded={loadDashboardData}
                  trigger={
                    <Button data-testid="add-family-btn" className="flex items-center gap-2">
                      <UserPlus className="w-4 h-4" />
                      Add Family Member
                    </Button>
                  }
                />
              </div>
            )}
          </div>
          
          <div data-testid="member-list" className="space-y-4">
            {householdMembers.map((member) => (
              <Card key={member.id} data-testid="member-row">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">
                        {member.profiles?.display_name || member.profiles?.email || 'Unknown User'}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {member.profiles?.email}
                      </p>
                      <div className="flex gap-2 mt-2">
                        <Badge variant={member.role === 'FAMILY_PRIMARY' ? 'default' : 'secondary'}>
                          {member.role === 'FAMILY_PRIMARY' ? 'Administrator' : 'Member'}
                        </Badge>
                        {member.health_access_level && member.health_access_level !== 'NO_ACCESS' && (
                          <Badge variant="outline">Health Access</Badge>
                        )}
                        {member.can_view_calendar && (
                          <Badge variant="outline">Calendar</Badge>
                        )}
                        {member.can_post_updates && (
                          <Badge variant="outline">Posts</Badge>
                        )}
                      </div>
                    </div>
                    <Badge data-testid="invite-status" variant="outline">
                      Active
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
            
            {!isPrimaryUser && householdMembers.length === 0 && (
              <div data-testid="no-permission" className="text-center text-muted-foreground py-8">
                You don't have permission to view other family members.
              </div>
            )}
          </div>
        </section>

        {/* Your Relatives */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Your Relatives</CardTitle>
              <p className="text-sm text-muted-foreground">Family members connected to your care network</p>
            </div>
            <Button onClick={() => navigate('/family/add-relative')}>
              <Plus className="w-4 h-4 mr-2" />
              Add Relative
            </Button>
          </CardHeader>
          <CardContent>
            {relatives.length === 0 ? (
              <div className="text-center py-8">
                <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">No relatives added yet</h3>
                <p className="text-muted-foreground mb-4">
                  Add your first elderly relative to start using CallPanion
                </p>
                <Button onClick={() => navigate('/family/add-relative')}>
                  Add Your First Relative
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {relatives.map((relative) => (
                  <WarmCard key={relative.id} className="p-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                        <Heart className="w-6 h-6 text-primary" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-foreground">
                          {relative.first_name} {relative.last_name}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {relative.town}, {relative.county}
                          {relative.country && `, ${relative.country}`}
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          {relative.timezone && (
                            <div className="flex items-center gap-1">
                              <Globe className="w-3 h-3" />
                              {relative.timezone}
                            </div>
                          )}
                          {relative.call_cadence && (
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {relative.call_cadence}
                            </div>
                          )}
                          {relative.quiet_hours_start && relative.quiet_hours_end && (
                            <div className="flex items-center gap-1">
                              <Moon className="w-3 h-3" />
                              {relative.quiet_hours_start}-{relative.quiet_hours_end}
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Last active: {relative.last_active_at 
                            ? new Date(relative.last_active_at).toLocaleDateString() 
                            : 'Never'
                          }
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Button 
                        size="sm" 
                        onClick={() => navigate(`/test-ai-call?relative=${relative.id}`)}
                        className="flex-1"
                      >
                        <Phone className="w-4 h-4 mr-1" />
                        Start AI Call
                      </Button>
                    </div>
                  </WarmCard>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {userPermissions.can_post_updates && (
            <div onClick={() => navigate('/family/memories')}>
              <WarmCard 
                data-testid="post-composer"
                gradient="love" 
                className="p-6 text-center cursor-pointer hover:shadow-lg transition-shadow"
              >
                <Camera className="w-12 h-12 text-white mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">Share Memories</h3>
                <p className="text-white/80">Upload photos and create beautiful moments</p>
              </WarmCard>
            </div>
          )}

          <div onClick={() => navigate('/family/messages')}>
            <WarmCard 
              gradient="warmth" 
              className="p-6 text-center cursor-pointer hover:shadow-lg transition-shadow"
            >
              <MessageSquare className="w-12 h-12 text-white mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">Send Messages</h3>
              <p className="text-white/80">Stay in touch with loving messages</p>
            </WarmCard>
          </div>

          {userPermissions.health_access_level !== 'NO_ACCESS' && (
            <div onClick={() => navigate('/family/health')}>
              <WarmCard 
                data-testid="health-insights-panel"
                gradient="peace" 
                className="p-6 text-center cursor-pointer hover:shadow-lg transition-shadow"
              >
                <Activity className="w-12 h-12 text-white mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">Health Insights</h3>
                <p className="text-white/80">Monitor wellness and mood trends</p>
              </WarmCard>
            </div>
          )}

          {userPermissions.can_view_calendar && (
            <div onClick={() => navigate('/family/calendar')}>
              <WarmCard 
                data-testid="calendar-panel"
                gradient="warmth" 
                className="p-6 text-center cursor-pointer hover:shadow-lg transition-shadow"
              >
                <Calendar className="w-12 h-12 text-white mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">Manage Schedule</h3>
                <p className="text-white/80">Set up calls and appointments</p>
              </WarmCard>
            </div>
          )}

          {isPrimaryUser && (
            <>
              <div onClick={() => navigate('/family/pair-device')}>
                <WarmCard 
                  gradient="warmth" 
                  className="p-6 text-center cursor-pointer hover:shadow-lg transition-shadow"
                >
                  <Smartphone className="w-12 h-12 text-white mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-white mb-2">Pair Elder Device</h3>
                  <p className="text-white/80">Connect a new device for your relative</p>
                </WarmCard>
              </div>

              <div onClick={() => navigate('/family/elderly-access')}>
                <WarmCard 
                  gradient="peace" 
                  className="p-6 text-center cursor-pointer hover:shadow-lg transition-shadow"
                >
                  <Settings className="w-12 h-12 text-white mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-white mb-2">Access Management</h3>
                  <p className="text-white/80">Control what relatives can see</p>
                </WarmCard>
              </div>
            </>
          )}
        </div>

        {/* Test AI Call CTA */}
        {relatives.length > 0 && (
          <WarmCard gradient="love" className="p-6 text-center">
            <Phone className="w-16 h-16 text-white mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Try the AI Calling System</h2>
            <p className="text-white/80 mb-4">
              Test our AI companion with automated wellness calls to your relatives
            </p>
            <Button 
              size="lg" 
              className="bg-white text-primary hover:bg-white/90"
              onClick={() => navigate('/test-ai-call')}
            >
              Test AI Call System
            </Button>
          </WarmCard>
        )}
      </div>
    </div>
  );
};

export default FamilyDashboard;