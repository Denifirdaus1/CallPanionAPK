import React, { useState, useEffect } from 'react';
import { Settings, Users, Phone, Download, AlertTriangle, Clock, Mic } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AdminSettingsManager } from '@/components/AdminSettingsManager';
import { AlertRulesManager } from '@/components/AlertRulesManager';
import { AlertCenterDashboard } from '@/components/AlertCenterDashboard';
import CallHistoryDashboard from '@/components/CallHistoryDashboard';

interface AdminSettings {
  default_call_frequency: string;
  ai_voice_style: string;
  health_alert_threshold: number;
  mood_alert_threshold: number;
  urgent_alert_enabled: boolean;
}

interface RelativeData {
  id: string;
  first_name: string;
  last_name: string;
  town: string;
  call_cadence: string;
  last_active_at: string;
  escalation_contact_email: string;
}

const AdminDashboard: React.FC = () => {
  const [settings, setSettings] = useState<AdminSettings>({
    default_call_frequency: 'daily',
    ai_voice_style: 'alloy',
    health_alert_threshold: 3,
    mood_alert_threshold: 2,
    urgent_alert_enabled: true,
  });
  
  const [relatives, setRelatives] = useState<RelativeData[]>([]);
  const [selectedRelative, setSelectedRelative] = useState<string | null>(null);
  const [exportDateFrom, setExportDateFrom] = useState('');
  const [exportDateTo, setExportDateTo] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchRelatives();
    loadSettings();
  }, []);

  const loadSettings = () => {
    // Load from localStorage or API
    const savedSettings = localStorage.getItem('admin_settings');
    if (savedSettings) {
      setSettings(JSON.parse(savedSettings));
    }
  };

  const saveSettings = async () => {
    try {
      localStorage.setItem('admin_settings', JSON.stringify(settings));
      toast.success('Settings saved successfully');
    } catch (error) {
      toast.error('Failed to save settings');
    }
  };

  const fetchRelatives = async () => {
    try {
      const { data, error } = await supabase
        .from('relatives')
        .select('*')
        .order('first_name');

      if (error) throw error;
      setRelatives(data || []);
    } catch (error) {
      console.error('Error fetching relatives:', error);
      toast.error('Failed to fetch relatives data');
    }
  };

  const initiateManualCall = async (relativeId: string) => {
    if (!relativeId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('initiateWellbeingCall', {
        body: {
          user_id: relativeId,
          scheduled_for: new Date().toISOString(),
          call_type: 'manual_admin',
        },
      });

      if (error) throw error;

      toast.success('Manual wellbeing call has been started');
    } catch (error) {
      console.error('Error initiating call:', error);
      toast.error('Failed to initiate call');
    } finally {
      setLoading(false);
    }
  };

  const exportCallHistory = async () => {
    if (!exportDateFrom || !exportDateTo) {
      toast.error('Please select both start and end dates');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('call_logs')
        .select(`
          *,
          call_analysis (*),
          profiles (display_name)
        `)
        .gte('timestamp', exportDateFrom)
        .lte('timestamp', exportDateTo)
        .order('timestamp', { ascending: false });

      if (error) throw error;

      // Convert to CSV
      const csvContent = convertToCSV(data || []);
      downloadCSV(csvContent, `call_history_${exportDateFrom}_to_${exportDateTo}.csv`);
      
      toast.success('Call history has been exported successfully');
    } catch (error) {
      console.error('Error exporting data:', error);
      toast.error('Failed to export call history');
    } finally {
      setLoading(false);
    }
  };

  const convertToCSV = (data: any[]) => {
    if (data.length === 0) return '';
    
    const headers = [
      'Date/Time',
      'User',
      'Outcome',
      'Duration (seconds)',
      'Mood Score',
      'Health Flag',
      'Urgent Flag',
      'Summary'
    ];
    
    const rows = data.map(row => [
      new Date(row.timestamp).toISOString(),
      row.profiles?.display_name || 'Unknown',
      row.call_outcome,
      row.call_duration || '',
      row.call_analysis?.[0]?.mood_score || '',
      row.call_analysis?.[0]?.health_flag || '',
      row.call_analysis?.[0]?.urgent_flag || '',
      row.call_analysis?.[0]?.summary || ''
    ]);
    
    return [headers, ...rows].map(row => 
      row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(',')
    ).join('\n');
  };

  const downloadCSV = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-comfort/20 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Admin Dashboard</h1>
          <p className="text-muted-foreground">Manage CallPanion system settings and monitor operations</p>
        </div>

        <Tabs defaultValue="settings" className="space-y-6">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="settings">Settings</TabsTrigger>
            <TabsTrigger value="alerts">Alert Center</TabsTrigger>
            <TabsTrigger value="automation">Alert Rules</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="calls">Calls</TabsTrigger>
            <TabsTrigger value="exports">Export</TabsTrigger>
          </TabsList>

          <TabsContent value="settings" className="space-y-6">
            <AdminSettingsManager />
          </TabsContent>

          <TabsContent value="alerts" className="space-y-6">
            <AlertCenterDashboard />
          </TabsContent>

          <TabsContent value="automation" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Alert Rules & Automation
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Configure automated alert rules for households
                </p>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  Select a household to manage alert rules:
                </p>
                {/* For demo purposes - in production this would list actual households */}
                <AlertRulesManager householdId="demo-household-id" />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  User Management
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Call Frequency</TableHead>
                      <TableHead>Last Active</TableHead>
                      <TableHead>Emergency Contact</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {relatives.map((relative) => (
                      <TableRow key={relative.id}>
                        <TableCell className="font-medium">
                          {relative.first_name} {relative.last_name}
                        </TableCell>
                        <TableCell>{relative.town}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{relative.call_cadence}</Badge>
                        </TableCell>
                        <TableCell>
                          {relative.last_active_at 
                            ? new Date(relative.last_active_at).toLocaleDateString()
                            : 'Never'
                          }
                        </TableCell>
                        <TableCell>{relative.escalation_contact_email}</TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => initiateManualCall(relative.id)}
                            disabled={loading}
                          >
                            <Phone className="h-4 w-4 mr-1" />
                            Call Now
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="calls" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Phone className="h-5 w-5" />
                  Manual Call Initiation
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Select Relative</Label>
                    <Select value={selectedRelative || ''} onValueChange={setSelectedRelative}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a relative to call" />
                      </SelectTrigger>
                      <SelectContent>
                        {relatives.map((relative) => (
                          <SelectItem key={relative.id} value={relative.id}>
                            {relative.first_name} {relative.last_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Button
                      onClick={() => selectedRelative && initiateManualCall(selectedRelative)}
                      disabled={!selectedRelative || loading}
                      className="w-full"
                    >
                      <Phone className="h-4 w-4 mr-2" />
                      Initiate Call
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <CallHistoryDashboard />
          </TabsContent>

          <TabsContent value="exports" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="h-5 w-5" />
                  Data Export
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="date-from">From Date</Label>
                    <Input
                      id="date-from"
                      type="date"
                      value={exportDateFrom}
                      onChange={(e) => setExportDateFrom(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="date-to">To Date</Label>
                    <Input
                      id="date-to"
                      type="date"
                      value={exportDateTo}
                      onChange={(e) => setExportDateTo(e.target.value)}
                    />
                  </div>
                </div>
                <Button
                  onClick={exportCallHistory}
                  disabled={loading || !exportDateFrom || !exportDateTo}
                  className="w-full"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export Call History (CSV)
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminDashboard;