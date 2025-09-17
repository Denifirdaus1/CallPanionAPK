import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  AlertTriangle, 
  Bell, 
  CheckCircle, 
  Clock, 
  Mail, 
  MessageSquare, 
  Phone, 
  X,
  Filter,
  Eye,
  AlertCircle
} from 'lucide-react';

interface FamilyNotification {
  id: string;
  household_id: string;
  relative_id?: string;
  title: string;
  message: string;
  notification_type: string;
  priority: string;
  created_at: string;
  resolved_at?: string;
  sent_to_user_ids: any; // JSON from Supabase
  read_by: any; // JSON from Supabase
}

interface AlertEscalation {
  id: string;
  household_id: string;
  relative_id?: string;
  alert_type: string;
  escalation_level: number;
  attempts: number;
  last_attempt_at: string;
  resolved_at?: string;
  created_at: string;
}

export const AlertCenterDashboard: React.FC = () => {
  const [notifications, setNotifications] = useState<FamilyNotification[]>([]);
  const [escalations, setEscalations] = useState<AlertEscalation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unresolved' | 'high_priority'>('unresolved');

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      // Load family notifications
      let notificationQuery = supabase
        .from('family_notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (filter === 'unresolved') {
        notificationQuery = notificationQuery.is('resolved_at', null);
      } else if (filter === 'high_priority') {
        notificationQuery = notificationQuery.in('priority', ['high', 'critical']);
      }

      const { data: notificationsData, error: notificationsError } = await notificationQuery;

      if (notificationsError) throw notificationsError;

      setNotifications(notificationsData || []);

      // Note: Escalations table would need to be created in a future migration
      // For now, we'll simulate escalation data
      const simulatedEscalations = notificationsData
        ?.filter(n => n.priority === 'critical' && !n.resolved_at)
        .slice(0, 5)
        .map(n => ({
          id: `esc-${n.id}`,
          household_id: n.household_id,
          relative_id: n.relative_id,
          alert_type: n.notification_type,
          escalation_level: 1,
          attempts: 1,
          last_attempt_at: n.created_at,
          resolved_at: n.resolved_at,
          created_at: n.created_at
        })) || [];

      setEscalations(simulatedEscalations);

    } catch (error) {
      console.error('Error loading alert data:', error);
      toast.error('Failed to load alert data');
    } finally {
      setIsLoading(false);
    }
  };

  const resolveNotification = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('family_notifications')
        .update({ resolved_at: new Date().toISOString() })
        .eq('id', notificationId);

      if (error) throw error;

      toast.success('Notification resolved');
      loadData();
    } catch (error) {
      console.error('Error resolving notification:', error);
      toast.error('Failed to resolve notification');
    }
  };

  const sendTestAlert = async (type: 'missed_call' | 'health_concern' | 'emergency') => {
    try {
      const { error } = await supabase.functions.invoke('process-alert-rules', {
        body: {
          type,
          household_id: 'test-household',
          relative_id: 'test-relative',
          data: {
            consecutive_missed: type === 'missed_call' ? 3 : 0,
            health_score: type === 'health_concern' ? 4 : 8,
            emergency_type: type === 'emergency' ? 'fall_detected' : null
          }
        }
      });

      if (error) throw error;

      toast.success(`Test ${type.replace('_', ' ')} alert triggered`);
      setTimeout(loadData, 2000); // Reload data after 2 seconds
    } catch (error) {
      console.error('Error sending test alert:', error);
      toast.error('Failed to send test alert');
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'alert': return <AlertTriangle className="h-4 w-4" />;
      case 'missed_call': return <Phone className="h-4 w-4" />;
      case 'health_concern': return <AlertCircle className="h-4 w-4" />;
      case 'emergency': return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default: return <Bell className="h-4 w-4" />;
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Alert Center Header */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Alert Center Dashboard
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Monitor and manage family alerts and notifications
              </p>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => sendTestAlert('missed_call')}
              >
                <Phone className="h-4 w-4 mr-2" />
                Test Missed Call
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => sendTestAlert('emergency')}
              >
                <AlertTriangle className="h-4 w-4 mr-2" />
                Test Emergency
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-sm font-medium">Active Alerts</p>
                <p className="text-2xl font-bold">
                  {notifications.filter(n => !n.resolved_at).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <div>
                <p className="text-sm font-medium">Critical</p>
                <p className="text-2xl font-bold">
                  {notifications.filter(n => n.priority === 'critical' && !n.resolved_at).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-orange-500" />
              <div>
                <p className="text-sm font-medium">Escalations</p>
                <p className="text-2xl font-bold">{escalations.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <div>
                <p className="text-sm font-medium">Resolved Today</p>
                <p className="text-2xl font-bold">
                  {notifications.filter(n => 
                    n.resolved_at && 
                    new Date(n.resolved_at).toDateString() === new Date().toDateString()
                  ).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Controls */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            <span className="text-sm font-medium">Filter:</span>
            <div className="flex gap-2">
              {(['all', 'unresolved', 'high_priority'] as const).map((filterOption) => (
                <Button
                  key={filterOption}
                  variant={filter === filterOption ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter(filterOption)}
                >
                  {filterOption.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Escalations Section */}
      {escalations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <Clock className="h-5 w-5" />
              Active Escalations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {escalations.map((escalation) => (
                <div key={escalation.id} className="p-3 border border-red-200 rounded-lg bg-red-50">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-red-800">
                        {escalation.alert_type.replace('_', ' ').toUpperCase()} - Level {escalation.escalation_level}
                      </p>
                      <p className="text-sm text-red-600">
                        {escalation.attempts} attempt(s) • Last: {formatTimeAgo(escalation.last_attempt_at)}
                      </p>
                    </div>
                    <Badge variant="destructive">
                      Escalated
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notifications List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Recent Notifications ({notifications.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-96">
            {notifications.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No notifications found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {notifications.map((notification) => (
                  <div 
                    key={notification.id} 
                    className={`p-4 border rounded-lg transition-colors ${
                      notification.resolved_at ? 'bg-muted/50' : 'bg-background'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="mt-1">
                          {getTypeIcon(notification.notification_type)}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-medium">{notification.title}</h3>
                            <Badge className={getPriorityColor(notification.priority)}>
                              {notification.priority}
                            </Badge>
                            {notification.resolved_at && (
                              <Badge variant="outline" className="text-green-600">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Resolved
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">
                            {notification.message}
                          </p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>{formatTimeAgo(notification.created_at)}</span>
                            <span>Sent to {notification.sent_to_user_ids?.length || 0} users</span>
                            {notification.resolved_at && (
                              <span>Resolved {formatTimeAgo(notification.resolved_at)}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {!notification.resolved_at && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => resolveNotification(notification.id)}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Resolve
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};