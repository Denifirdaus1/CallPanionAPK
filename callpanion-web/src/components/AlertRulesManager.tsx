import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Plus, Trash2, AlertTriangle, Phone, Heart, Zap } from 'lucide-react';

interface AlertRule {
  id: string;
  rule_name: string;
  rule_type: string; // Keep as string to match database response
  conditions: any;
  actions: any;
  is_active: boolean;
  created_at: string;
}

interface AlertRulesManagerProps {
  householdId: string;
}

export const AlertRulesManager: React.FC<AlertRulesManagerProps> = ({ householdId }) => {
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [householdMembers, setHouseholdMembers] = useState<any[]>([]);
  const { user } = useAuth();

  const [formData, setFormData] = useState({
    rule_name: '',
    rule_type: 'missed_calls' as const,
    conditions: {
      missed_calls: 3,
      timeframe: '24h',
      health_score: 5
    },
    actions: {
      notify_users: [] as string[],
      notification_title: '',
      notification_body: '',
      send_sms: false,
      send_email: false,
      priority: 'medium'
    }
  });

  useEffect(() => {
    loadRules();
    loadHouseholdMembers();
  }, [householdId]);

  const loadRules = async () => {
    try {
      const { data, error } = await supabase
        .from('alert_rules')
        .select('*')
        .eq('household_id', householdId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRules(data || []);
    } catch (error) {
      console.error('Error loading alert rules:', error);
      toast.error('Failed to load alert rules');
    } finally {
      setIsLoading(false);
    }
  };

  const loadHouseholdMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('household_members')
        .select(`
          user_id,
          role,
          profiles:user_id (
            id,
            display_name,
            email
          )
        `)
        .eq('household_id', householdId);

      if (error) throw error;
      setHouseholdMembers(data || []);
    } catch (error) {
      console.error('Error loading household members:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.rule_name.trim()) {
      toast.error('Please enter a rule name');
      return;
    }

    if (formData.actions.notify_users.length === 0) {
      toast.error('Please select at least one person to notify');
      return;
    }

    try {
      const { error } = await supabase
        .from('alert_rules')
        .insert({
          household_id: householdId,
          rule_name: formData.rule_name,
          rule_type: formData.rule_type,
          conditions: formData.conditions,
          actions: formData.actions,
          is_active: true,
          created_by: user?.id
        });

      if (error) throw error;

      toast.success('Alert rule created successfully');
      resetForm();
      loadRules();
    } catch (error) {
      console.error('Error creating alert rule:', error);
      toast.error('Failed to create alert rule');
    }
  };

  const deleteRule = async (ruleId: string) => {
    try {
      const { error } = await supabase
        .from('alert_rules')
        .delete()
        .eq('id', ruleId);

      if (error) throw error;

      toast.success('Alert rule deleted');
      loadRules();
    } catch (error) {
      console.error('Error deleting alert rule:', error);
      toast.error('Failed to delete alert rule');
    }
  };

  const toggleRule = async (ruleId: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('alert_rules')
        .update({ is_active: isActive })
        .eq('id', ruleId);

      if (error) throw error;

      toast.success(`Alert rule ${isActive ? 'enabled' : 'disabled'}`);
      loadRules();
    } catch (error) {
      console.error('Error updating alert rule:', error);
      toast.error('Failed to update alert rule');
    }
  };

  const resetForm = () => {
    setFormData({
      rule_name: '',
      rule_type: 'missed_calls',
      conditions: {
        missed_calls: 3,
        timeframe: '24h',
        health_score: 5
      },
      actions: {
        notify_users: [],
        notification_title: '',
        notification_body: '',
        send_sms: false,
        send_email: false,
        priority: 'medium'
      }
    });
    setShowForm(false);
  };

  const getRuleIcon = (type: string) => {
    switch (type) {
      case 'missed_calls': return <Phone className="h-4 w-4" />;
      case 'health_concern': return <Heart className="h-4 w-4" />;
      case 'emergency': return <AlertTriangle className="h-4 w-4" />;
      default: return <Zap className="h-4 w-4" />;
    }
  };

  const getRuleTypeColor = (type: string) => {
    switch (type) {
      case 'missed_calls': return 'bg-blue-100 text-blue-800';
      case 'health_concern': return 'bg-orange-100 text-orange-800';
      case 'emergency': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
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
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Alert Rules</CardTitle>
            <Button onClick={() => setShowForm(!showForm)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Rule
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {showForm && (
            <form onSubmit={handleSubmit} className="space-y-4 p-4 border rounded-lg mb-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="rule_name">Rule Name</Label>
                  <Input
                    id="rule_name"
                    value={formData.rule_name}
                    onChange={(e) => setFormData({ ...formData, rule_name: e.target.value })}
                    placeholder="e.g., Missed Calls Alert"
                  />
                </div>
                
                <div>
                  <Label htmlFor="rule_type">Rule Type</Label>
                  <Select 
                    value={formData.rule_type} 
                    onValueChange={(value: any) => setFormData({ ...formData, rule_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="missed_calls">Missed Calls</SelectItem>
                      <SelectItem value="health_concern">Health Concern</SelectItem>
                      <SelectItem value="emergency">Emergency</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {formData.rule_type === 'missed_calls' && (
                <div>
                  <Label>Trigger after how many missed calls?</Label>
                  <Input
                    type="number"
                    value={formData.conditions.missed_calls}
                    onChange={(e) => setFormData({
                      ...formData,
                      conditions: { ...formData.conditions, missed_calls: parseInt(e.target.value) }
                    })}
                    min="1"
                    max="10"
                  />
                </div>
              )}

              <div>
                <Label>Who should be notified?</Label>
                <div className="space-y-2 mt-2">
                  {householdMembers.map((member) => (
                    <div key={member.user_id} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={member.user_id}
                        checked={formData.actions.notify_users.includes(member.user_id)}
                        onChange={(e) => {
                          const users = e.target.checked
                            ? [...formData.actions.notify_users, member.user_id]
                            : formData.actions.notify_users.filter(id => id !== member.user_id);
                          setFormData({
                            ...formData,
                            actions: { ...formData.actions, notify_users: users }
                          });
                        }}
                      />
                      <Label htmlFor={member.user_id}>
                        {member.profiles?.display_name || member.profiles?.email || 'Unknown User'}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="notification_title">Notification Title</Label>
                <Input
                  id="notification_title"
                  value={formData.actions.notification_title}
                  onChange={(e) => setFormData({
                    ...formData,
                    actions: { ...formData.actions, notification_title: e.target.value }
                  })}
                  placeholder="Alert title"
                />
              </div>

              <div>
                <Label htmlFor="notification_body">Notification Message</Label>
                <Textarea
                  id="notification_body"
                  value={formData.actions.notification_body}
                  onChange={(e) => setFormData({
                    ...formData,
                    actions: { ...formData.actions, notification_body: e.target.value }
                  })}
                  placeholder="Alert message"
                />
              </div>

              <div className="flex gap-2">
                <Button type="submit">Create Rule</Button>
                <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>
              </div>
            </form>
          )}

          <div className="space-y-4">
            {rules.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No alert rules configured yet. Create your first rule to get started.
              </p>
            ) : (
              rules.map((rule) => (
                <div key={rule.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      {getRuleIcon(rule.rule_type)}
                      <Badge className={getRuleTypeColor(rule.rule_type)}>
                        {rule.rule_type.replace('_', ' ')}
                      </Badge>
                    </div>
                    <div>
                      <h3 className="font-medium">{rule.rule_name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {rule.rule_type === 'missed_calls' && 
                          `Triggers after ${rule.conditions.missed_calls} missed calls`}
                        {rule.rule_type === 'health_concern' && 
                          `Triggers when health score ≤ ${rule.conditions.health_score}`}
                        {rule.rule_type === 'emergency' && 'Triggers immediately'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={rule.is_active}
                      onCheckedChange={(checked) => toggleRule(rule.id, checked)}
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteRule(rule.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};