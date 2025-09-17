import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  Settings, 
  Save, 
  TestTube, 
  Mail, 
  MessageSquare, 
  Bell,
  Shield,
  Palette,
  Database
} from 'lucide-react';

interface AdminSetting {
  setting_key: string;
  setting_value: any;
  is_encrypted: boolean;
}

interface SettingsGroup {
  title: string;
  icon: React.ReactNode;
  settings: AdminSetting[];
}

export const AdminSettingsManager: React.FC = () => {
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [testResults, setTestResults] = useState<Record<string, string>>({});

  // Default settings structure
  const defaultSettings = {
    // Email Configuration
    notification_email_enabled: true,
    notification_email_sender: 'alerts@callpanion.com',
    email_rate_limit: 10,
    
    // SMS Configuration  
    notification_sms_enabled: false,
    sms_provider: 'twilio',
    sms_rate_limit: 5,
    
    // Push Notifications
    push_notifications_enabled: true,
    fcm_server_key: '',
    
    // PayPal Integration
    paypal_client_id: '',
    paypal_environment: 'sandbox',
    
    // Alert System
    alert_escalation_enabled: true,
    alert_escalation_delay_minutes: 30,
    max_alert_attempts: 3,
    
    // Call System
    missed_call_threshold: 3,
    emergency_call_escalation: true,
    health_monitoring_enabled: true,
    
    // UI Configuration
    app_name: 'CallPanion',
    primary_color: '#667eea',
    logo_url: '',
    
    // Security
    session_timeout_minutes: 60,
    require_mfa_for_admin: true,
    max_login_attempts: 5
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('*');

      if (error) throw error;

      const loadedSettings = { ...defaultSettings };
      data?.forEach(setting => {
        loadedSettings[setting.setting_key] = setting.setting_value;
      });

      setSettings(loadedSettings);
    } catch (error) {
      console.error('Error loading settings:', error);
      toast.error('Failed to load admin settings');
      setSettings(defaultSettings);
    } finally {
      setIsLoading(false);
    }
  };

  const saveSetting = async (key: string, value: any, isEncrypted: boolean = false) => {
    try {
      const { error } = await supabase
        .from('app_settings')
        .upsert({
          setting_key: key,
          setting_value: value,
          is_encrypted: isEncrypted,
          updated_by: (await supabase.auth.getUser()).data.user?.id
        }, {
          onConflict: 'setting_key'
        });

      if (error) throw error;
    } catch (error) {
      console.error(`Error saving setting ${key}:`, error);
      throw error;
    }
  };

  const saveAllSettings = async () => {
    setIsSaving(true);
    try {
      // Batch save all settings
      const settingsToSave = Object.entries(settings).map(([key, value]) => ({
        setting_key: key,
        setting_value: value,
        is_encrypted: key.includes('key') || key.includes('secret'),
        updated_by: null // Will be set by the edge function
      }));

      for (const setting of settingsToSave) {
        await saveSetting(setting.setting_key, setting.setting_value, setting.is_encrypted);
      }

      toast.success('All settings saved successfully');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save some settings');
    } finally {
      setIsSaving(false);
    }
  };

  const testEmailService = async () => {
    try {
      const { error } = await supabase.functions.invoke('send-notification', {
        body: {
          type: 'email',
          recipients: [(await supabase.auth.getUser()).data.user?.email],
          title: 'CallPanion Email Test',
          message: 'This is a test email from your CallPanion admin settings.',
          priority: 'low'
        }
      });

      if (error) throw error;

      setTestResults({ ...testResults, email: 'Test email sent successfully!' });
      toast.success('Test email sent!');
    } catch (error) {
      const message = `Test failed: ${error.message}`;
      setTestResults({ ...testResults, email: message });
      toast.error(message);
    }
  };

  const testPushService = async () => {
    try {
      const { error } = await supabase.functions.invoke('send-push-notification', {
        body: {
          user_ids: [(await supabase.auth.getUser()).data.user?.id],
          title: 'CallPanion Push Test',
          body: 'This is a test push notification from admin settings.',
          data: { test: true }
        }
      });

      if (error) throw error;

      setTestResults({ ...testResults, push: 'Test notification sent successfully!' });
      toast.success('Test push notification sent!');
    } catch (error) {
      const message = `Test failed: ${error.message}`;
      setTestResults({ ...testResults, push: message });
      toast.error(message);
    }
  };

  const updateSetting = (key: string, value: any) => {
    setSettings({ ...settings, [key]: value });
  };

  const settingsGroups: SettingsGroup[] = [
    {
      title: 'Notification Services',
      icon: <Bell className="h-5 w-5" />,
      settings: [
        { setting_key: 'notification_email_enabled', setting_value: settings.notification_email_enabled, is_encrypted: false },
        { setting_key: 'notification_email_sender', setting_value: settings.notification_email_sender, is_encrypted: false },
        { setting_key: 'email_rate_limit', setting_value: settings.email_rate_limit, is_encrypted: false },
        { setting_key: 'notification_sms_enabled', setting_value: settings.notification_sms_enabled, is_encrypted: false },
        { setting_key: 'sms_provider', setting_value: settings.sms_provider, is_encrypted: false },
        { setting_key: 'push_notifications_enabled', setting_value: settings.push_notifications_enabled, is_encrypted: false },
        { setting_key: 'fcm_server_key', setting_value: settings.fcm_server_key, is_encrypted: true },
      ]
    },
    {
      title: 'Payment Integration',
      icon: <Database className="h-5 w-5" />,
      settings: [
        { setting_key: 'paypal_client_id', setting_value: settings.paypal_client_id, is_encrypted: true },
        { setting_key: 'paypal_environment', setting_value: settings.paypal_environment, is_encrypted: false },
      ]
    },
    {
      title: 'Alert System',
      icon: <Shield className="h-5 w-5" />,
      settings: [
        { setting_key: 'alert_escalation_enabled', setting_value: settings.alert_escalation_enabled, is_encrypted: false },
        { setting_key: 'alert_escalation_delay_minutes', setting_value: settings.alert_escalation_delay_minutes, is_encrypted: false },
        { setting_key: 'max_alert_attempts', setting_value: settings.max_alert_attempts, is_encrypted: false },
        { setting_key: 'missed_call_threshold', setting_value: settings.missed_call_threshold, is_encrypted: false },
        { setting_key: 'emergency_call_escalation', setting_value: settings.emergency_call_escalation, is_encrypted: false },
      ]
    },
    {
      title: 'Application Appearance',
      icon: <Palette className="h-5 w-5" />,
      settings: [
        { setting_key: 'app_name', setting_value: settings.app_name, is_encrypted: false },
        { setting_key: 'primary_color', setting_value: settings.primary_color, is_encrypted: false },
        { setting_key: 'logo_url', setting_value: settings.logo_url, is_encrypted: false },
      ]
    },
    {
      title: 'Security Settings',
      icon: <Shield className="h-5 w-5" />,
      settings: [
        { setting_key: 'session_timeout_minutes', setting_value: settings.session_timeout_minutes, is_encrypted: false },
        { setting_key: 'require_mfa_for_admin', setting_value: settings.require_mfa_for_admin, is_encrypted: false },
        { setting_key: 'max_login_attempts', setting_value: settings.max_login_attempts, is_encrypted: false },
      ]
    }
  ];

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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Admin Settings Management
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Configure global application settings and services
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-6">
            <Button onClick={saveAllSettings} disabled={isSaving}>
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? 'Saving...' : 'Save All Settings'}
            </Button>
            <Button variant="outline" onClick={testEmailService}>
              <Mail className="h-4 w-4 mr-2" />
              Test Email
            </Button>
            <Button variant="outline" onClick={testPushService}>
              <Bell className="h-4 w-4 mr-2" />
              Test Push
            </Button>
          </div>

          {/* Test Results */}
          {Object.keys(testResults).length > 0 && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-sm">Test Results</CardTitle>
              </CardHeader>
              <CardContent>
                {Object.entries(testResults).map(([service, result]) => (
                  <div key={service} className="flex items-center gap-2 mb-2">
                    <Badge variant={result.includes('failed') ? 'destructive' : 'default'}>
                      {service}
                    </Badge>
                    <span className="text-sm">{result}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Settings Groups */}
          <div className="space-y-8">
            {settingsGroups.map((group, index) => (
              <div key={index}>
                <div className="flex items-center gap-2 mb-4">
                  {group.icon}
                  <h3 className="text-lg font-semibold">{group.title}</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {group.settings.map((setting) => (
                    <div key={setting.setting_key} className="space-y-2">
                      <Label htmlFor={setting.setting_key} className="text-sm font-medium">
                        {setting.setting_key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        {setting.is_encrypted && (
                          <Badge variant="secondary" className="ml-2 text-xs">
                            Encrypted
                          </Badge>
                        )}
                      </Label>
                      
                      {typeof setting.setting_value === 'boolean' ? (
                        <Switch
                          id={setting.setting_key}
                          checked={setting.setting_value}
                          onCheckedChange={(checked) => updateSetting(setting.setting_key, checked)}
                        />
                      ) : setting.setting_key === 'paypal_environment' ? (
                        <Select
                          value={setting.setting_value}
                          onValueChange={(value) => updateSetting(setting.setting_key, value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="sandbox">Sandbox</SelectItem>
                            <SelectItem value="live">Live</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : setting.setting_key === 'sms_provider' ? (
                        <Select
                          value={setting.setting_value}
                          onValueChange={(value) => updateSetting(setting.setting_key, value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="twilio">Twilio</SelectItem>
                            <SelectItem value="vonage">Vonage</SelectItem>
                            <SelectItem value="aws_sns">AWS SNS</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          id={setting.setting_key}
                          type={setting.is_encrypted ? 'password' : 
                                typeof setting.setting_value === 'number' ? 'number' : 'text'}
                          value={setting.setting_value || ''}
                          onChange={(e) => updateSetting(
                            setting.setting_key, 
                            typeof setting.setting_value === 'number' ? 
                              parseInt(e.target.value) || 0 : e.target.value
                          )}
                          placeholder={setting.is_encrypted ? '••••••••' : 'Enter value'}
                        />
                      )}
                    </div>
                  ))}
                </div>
                
                {index < settingsGroups.length - 1 && <Separator className="mt-6" />}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};