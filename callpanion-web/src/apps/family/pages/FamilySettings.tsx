import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Settings, Bell, Shield, Users, Phone, Mail } from 'lucide-react';

const FamilySettings = () => {
  const [notifications, setNotifications] = useState({
    missedCalls: true,
    healthAlerts: true,
    dailyReports: false,
    emergencyContacts: true,
    systemUpdates: false
  });

  const [privacy, setPrivacy] = useState({
    shareHealthData: true,
    allowDataAnalysis: true,
    locationTracking: false,
    voiceRecordings: true
  });

  const emergencyContacts = [
    {
      id: '1',
      name: 'Sarah Wilson',
      relation: 'Daughter',
      phone: '+44 7123 456789',
      email: 'sarah@example.com',
      priority: 1
    },
    {
      id: '2',
      name: 'John Wilson',
      relation: 'Son',
      phone: '+44 7987 654321',
      email: 'john@example.com',
      priority: 2
    }
  ];

  const familyMembers = [
    {
      id: '1',
      name: 'Margaret Thompson',
      role: 'Elder',
      permissions: ['receive_calls', 'send_messages', 'emergency_access']
    },
    {
      id: '2',
      name: 'George Wilson',
      role: 'Elder',
      permissions: ['receive_calls', 'emergency_access']
    }
  ];

  const handleNotificationChange = (key: string, value: boolean) => {
    setNotifications(prev => ({ ...prev, [key]: value }));
  };

  const handlePrivacyChange = (key: string, value: boolean) => {
    setPrivacy(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Family Settings</h1>
        <p className="text-muted-foreground">
          Manage your family's care preferences and privacy settings
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Notification Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-blue-500" />
              Notification Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(notifications).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between">
                <Label htmlFor={key} className="text-sm font-medium">
                  {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                </Label>
                <Switch
                  id={key}
                  checked={value}
                  onCheckedChange={(checked) => handleNotificationChange(key, checked)}
                />
              </div>
            ))}
            <div className="pt-4">
              <Button variant="outline" className="w-full">
                Test Notifications
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Privacy Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-green-500" />
              Privacy & Data
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(privacy).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between">
                <Label htmlFor={key} className="text-sm font-medium">
                  {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                </Label>
                <Switch
                  id={key}
                  checked={value}
                  onCheckedChange={(checked) => handlePrivacyChange(key, checked)}
                />
              </div>
            ))}
            <div className="pt-4 space-y-2">
              <Button variant="outline" className="w-full">
                Download My Data
              </Button>
              <Button variant="outline" className="w-full">
                Privacy Policy
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Emergency Contacts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5 text-red-500" />
            Emergency Contacts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {emergencyContacts.map((contact) => (
              <div key={contact.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-medium">{contact.name}</span>
                    <Badge variant="outline">{contact.relation}</Badge>
                    <Badge className="bg-red-100 text-red-800">
                      Priority {contact.priority}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p className="flex items-center">
                      <Phone className="h-3 w-3 mr-2" />
                      {contact.phone}
                    </p>
                    <p className="flex items-center">
                      <Mail className="h-3 w-3 mr-2" />
                      {contact.email}
                    </p>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <Button variant="outline" size="sm">Edit</Button>
                  <Button variant="outline" size="sm">Remove</Button>
                </div>
              </div>
            ))}
            <Button className="w-full">
              Add Emergency Contact
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Family Member Permissions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-purple-500" />
            Family Member Permissions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {familyMembers.map((member) => (
              <div key={member.id} className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="font-medium">{member.name}</span>
                    <Badge variant="outline" className="ml-2">{member.role}</Badge>
                  </div>
                  <Button variant="outline" size="sm">
                    Manage Permissions
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {member.permissions.map((permission, index) => (
                    <Badge key={index} className="bg-blue-100 text-blue-800">
                      {permission.replace(/_/g, ' ')}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Account Management */}
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-red-800">Account Management</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="account-email">Account Email</Label>
              <Input
                id="account-email"
                type="email"
                defaultValue="sarah.wilson@example.com"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="family-name">Family Name</Label>
              <Input
                id="family-name"
                defaultValue="Wilson Family"
                className="mt-1"
              />
            </div>
          </div>
          
          <div className="flex space-x-4 pt-4">
            <Button variant="outline">
              Change Password
            </Button>
            <Button variant="outline">
              Update Account
            </Button>
            <Button variant="destructive">
              Delete Account
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default FamilySettings;