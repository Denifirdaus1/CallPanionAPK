import React, { useState, useEffect } from 'react';
import { AlertTriangle, Mail, MessageSquare, Bell, Phone, Check, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

interface AlertNotification {
  id: string;
  type: 'missed_calls' | 'health_flag' | 'urgent_flag' | 'mood_alert';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  recipient_contacts: string[];
  created_at: string;
  sent_at?: string;
  status: 'pending' | 'sent' | 'failed';
  user_name: string;
  user_id: string;
}

interface NotificationSettings {
  sms_enabled: boolean;
  email_enabled: boolean;
  push_enabled: boolean;
  missed_call_threshold: number;
  auto_escalate: boolean;
}

const AlertNotificationSystem: React.FC = () => {
  const [notifications, setNotifications] = useState<AlertNotification[]>([]);
  const [settings, setSettings] = useState<NotificationSettings>({
    sms_enabled: true,
    email_enabled: true,
    push_enabled: false,
    missed_call_threshold: 2,
    auto_escalate: true,
  });
  const [customMessage, setCustomMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchNotifications();
    loadSettings();
  }, []);

  const loadSettings = () => {
    const savedSettings = localStorage.getItem('notification_settings');
    if (savedSettings) {
      setSettings(JSON.parse(savedSettings));
    }
  };

  const saveSettings = async () => {
    try {
      localStorage.setItem('notification_settings', JSON.stringify(settings));
      toast({
        title: "Settings Saved",
        description: "Notification settings have been updated.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save settings.",
        variant: "destructive",
      });
    }
  };

  const fetchNotifications = async () => {
    try {
      // For now, we'll create mock data. In a real implementation,
      // this would fetch from a notifications table
      const mockNotifications: AlertNotification[] = [
        {
          id: '1',
          type: 'missed_calls',
          severity: 'high',
          message: 'Margaret has missed 2 consecutive calls. Last answered call was yesterday at 2:30 PM.',
          recipient_contacts: ['john@example.com', '+447700900123'],
          created_at: new Date().toISOString(),
          status: 'pending',
          user_name: 'Margaret Thompson',
          user_id: '123'
        },
        {
          id: '2',
          type: 'health_flag',
          severity: 'medium',
          message: 'Health concerns detected in conversation. Mentioned feeling "dizzy" and "tired".',
          recipient_contacts: ['sarah@example.com'],
          created_at: new Date(Date.now() - 3600000).toISOString(),
          sent_at: new Date(Date.now() - 3000000).toISOString(),
          status: 'sent',
          user_name: 'Robert Wilson',
          user_id: '456'
        }
      ];
      
      setNotifications(mockNotifications);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const sendNotification = async (notificationId: string) => {
    setLoading(true);
    try {
      // In a real implementation, this would call an edge function
      // that sends actual SMS/email notifications
      
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate API call
      
      setNotifications(prev => 
        prev.map(notification => 
          notification.id === notificationId
            ? { ...notification, status: 'sent' as const, sent_at: new Date().toISOString() }
            : notification
        )
      );
      
      toast({
        title: "Notification Sent",
        description: "Alert has been sent to family contacts.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send notification.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const sendCustomAlert = async () => {
    if (!customMessage.trim()) {
      toast({
        title: "Error",
        description: "Please enter a message.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Create new custom notification
      const newNotification: AlertNotification = {
        id: Date.now().toString(),
        type: 'urgent_flag',
        severity: 'high',
        message: customMessage,
        recipient_contacts: ['family@example.com'],
        created_at: new Date().toISOString(),
        status: 'pending',
        user_name: 'Custom Alert',
        user_id: 'admin'
      };
      
      setNotifications(prev => [newNotification, ...prev]);
      setCustomMessage('');
      
      toast({
        title: "Alert Created",
        description: "Custom alert has been created and is ready to send.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create alert.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <Badge className="bg-red-600 text-white">Critical</Badge>;
      case 'high':
        return <Badge variant="destructive">High</Badge>;
      case 'medium':
        return <Badge className="bg-orange-100 text-orange-800">Medium</Badge>;
      case 'low':
        return <Badge variant="outline">Low</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'missed_calls':
        return <Phone className="h-4 w-4 text-red-500" />;
      case 'health_flag':
        return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      case 'urgent_flag':
        return <Bell className="h-4 w-4 text-red-600" />;
      case 'mood_alert':
        return <MessageSquare className="h-4 w-4 text-blue-500" />;
      default:
        return <Bell className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return <Check className="h-4 w-4 text-green-600" />;
      case 'failed':
        return <X className="h-4 w-4 text-red-600" />;
      case 'pending':
        return <Bell className="h-4 w-4 text-orange-600" />;
      default:
        return <Bell className="h-4 w-4 text-gray-600" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Settings Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notification Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="sms-enabled"
                checked={settings.sms_enabled}
                onCheckedChange={(checked) => setSettings({...settings, sms_enabled: checked})}
              />
              <Label htmlFor="sms-enabled">SMS Alerts</Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch
                id="email-enabled"
                checked={settings.email_enabled}
                onCheckedChange={(checked) => setSettings({...settings, email_enabled: checked})}
              />
              <Label htmlFor="email-enabled">Email Alerts</Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch
                id="push-enabled"
                checked={settings.push_enabled}
                onCheckedChange={(checked) => setSettings({...settings, push_enabled: checked})}
              />
              <Label htmlFor="push-enabled">Push Notifications</Label>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Switch
              id="auto-escalate"
              checked={settings.auto_escalate}
              onCheckedChange={(checked) => setSettings({...settings, auto_escalate: checked})}
            />
            <Label htmlFor="auto-escalate">Auto-escalate critical alerts</Label>
          </div>
          
          <Button onClick={saveSettings}>Save Settings</Button>
        </CardContent>
      </Card>

      {/* Custom Alert Card */}
      <Card>
        <CardHeader>
          <CardTitle>Send Custom Alert</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder="Enter custom alert message..."
            value={customMessage}
            onChange={(e) => setCustomMessage(e.target.value)}
            rows={3}
          />
          <Button onClick={sendCustomAlert} disabled={loading}>
            <MessageSquare className="h-4 w-4 mr-2" />
            Send Alert
          </Button>
        </CardContent>
      </Card>

      {/* Notifications Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Notifications</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Message</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {notifications.map((notification) => (
                <TableRow key={notification.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getTypeIcon(notification.type)}
                      <span className="capitalize">{notification.type.replace('_', ' ')}</span>
                    </div>
                  </TableCell>
                  <TableCell>{getSeverityBadge(notification.severity)}</TableCell>
                  <TableCell className="font-medium">{notification.user_name}</TableCell>
                  <TableCell className="max-w-xs truncate">{notification.message}</TableCell>
                  <TableCell>
                    {new Date(notification.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(notification.status)}
                      <span className="capitalize">{notification.status}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {notification.status === 'pending' && (
                      <Button
                        size="sm"
                        onClick={() => sendNotification(notification.id)}
                        disabled={loading}
                      >
                        <Mail className="h-4 w-4 mr-1" />
                        Send
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          {notifications.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No notifications found.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AlertNotificationSystem;