import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, Activity, Phone, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const FamilyHome = () => {
  const navigate = useNavigate();

  // Real data would come from API calls - showing graceful empty state
  const [stats, setStats] = useState({
    elders: 0,
    recentCalls: 0,
    alerts: 0,
    healthScore: 0
  });

  const [recentActivity, setRecentActivity] = useState<Array<{
    id: string;
    type: string;
    message: string;
    time: string;
    status: string;
  }>>([]);

  useEffect(() => {
    // Load actual family data
    const loadFamilyData = async () => {
      try {
        // In production, these would be real API calls
        // For now, showing how to handle empty states gracefully
        setStats({
          elders: 0,
          recentCalls: 0,
          alerts: 0,
          healthScore: 0
        });
        setRecentActivity([]);
      } catch (error) {
        console.error('Error loading family data:', error);
      }
    };
    
    loadFamilyData();
  }, []);

  const quickActions = [
    {
      title: 'Add Elder',
      description: 'Set up care for a new family member',
      action: () => navigate('/elders'),
      color: 'bg-blue-50 hover:bg-blue-100 border-blue-200'
    },
    {
      title: 'View Call History',
      description: 'See recent calls and check-ins',
      action: () => navigate('/calls'),
      color: 'bg-green-50 hover:bg-green-100 border-green-200'
    },
    {
      title: 'Manage Settings',
      description: 'Update care preferences and contacts',
      action: () => navigate('/settings'),
      color: 'bg-purple-50 hover:bg-purple-100 border-purple-200'
    }
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Family Dashboard</h1>
        <p className="text-muted-foreground">
          Monitor and manage care for your family members
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Family Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.elders}</div>
            <p className="text-xs text-muted-foreground">Active care recipients</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recent Calls</CardTitle>
            <Phone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.recentCalls}</div>
            <p className="text-xs text-muted-foreground">This week</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Health Score</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.healthScore}%</div>
            <p className="text-xs text-muted-foreground">Overall wellbeing</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.alerts}</div>
            <p className="text-xs text-muted-foreground">Needs attention</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.length > 0 ? (
                recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-start space-x-3">
                    <div className={`w-2 h-2 rounded-full mt-2 ${
                      activity.status === 'success' ? 'bg-green-500' :
                      activity.status === 'warning' ? 'bg-orange-500' :
                      'bg-blue-500'
                    }`} />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{activity.message}</p>
                      <p className="text-xs text-muted-foreground">{activity.time}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No recent activity to show.</p>
                  <p className="text-sm mt-1">Activity will appear here once you start using CallPanion.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {quickActions.map((action, index) => (
                <Card 
                  key={index}
                  className={`p-4 cursor-pointer transition-colors ${action.color}`}
                  onClick={action.action}
                >
                  <div>
                    <h4 className="font-medium">{action.title}</h4>
                    <p className="text-sm text-muted-foreground">{action.description}</p>
                  </div>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Emergency Section */}
      <Card className="border-red-200 bg-red-50">
        <CardHeader>
          <CardTitle className="text-red-800">Emergency Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-red-700">
              In case of emergency, family members can always call 999 directly from their devices.
              Emergency contacts are automatically notified when emergency services are contacted.
            </p>
            <div className="flex space-x-4">
              <Button variant="outline" size="sm">
                Update Emergency Contacts
              </Button>
              <Button variant="outline" size="sm">
                Test Emergency System
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default FamilyHome;