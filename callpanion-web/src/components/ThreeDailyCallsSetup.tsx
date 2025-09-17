import React, { useState } from 'react';
import { Clock, AlertTriangle, Plus, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface CallTime {
  id: string;
  time: string; // HH:MM format
  type: 'morning' | 'afternoon' | 'evening';
  enabled: boolean;
}

interface EscalationRule {
  id: string;
  trigger: 'missed_call' | 'consecutive_missed' | 'concerning_response' | 'no_answer_streak';
  threshold: number;
  action: 'notify_family' | 'call_emergency_contact' | 'send_alert' | 'escalate_to_service';
  contacts: string[]; // email addresses
  enabled: boolean;
}

interface ThreeDailyCallsSetupProps {
  onCallTimesChange: (callTimes: CallTime[]) => void;
  onEscalationRulesChange: (rules: EscalationRule[]) => void;
  initialCallTimes?: CallTime[];
  initialEscalationRules?: EscalationRule[];
}

const DEFAULT_CALL_TIMES: CallTime[] = [
  { id: '1', time: '09:00', type: 'morning', enabled: true },
  { id: '2', time: '13:00', type: 'afternoon', enabled: true },
  { id: '3', time: '18:00', type: 'evening', enabled: true },
];

const DEFAULT_ESCALATION_RULES: EscalationRule[] = [
  {
    id: '1',
    trigger: 'consecutive_missed',
    threshold: 2,
    action: 'notify_family',
    contacts: [],
    enabled: true,
  },
  {
    id: '2',
    trigger: 'concerning_response',
    threshold: 1,
    action: 'send_alert',
    contacts: [],
    enabled: true,
  },
];

export const ThreeDailyCallsSetup: React.FC<ThreeDailyCallsSetupProps> = ({
  onCallTimesChange,
  onEscalationRulesChange,
  initialCallTimes = DEFAULT_CALL_TIMES,
  initialEscalationRules = DEFAULT_ESCALATION_RULES,
}) => {
  const [callTimes, setCallTimes] = useState<CallTime[]>(initialCallTimes);
  const [escalationRules, setEscalationRules] = useState<EscalationRule[]>(initialEscalationRules);

  const updateCallTime = (id: string, updates: Partial<CallTime>) => {
    const updated = callTimes.map(ct => 
      ct.id === id ? { ...ct, ...updates } : ct
    );
    setCallTimes(updated);
    onCallTimesChange(updated);
  };

  const addCallTime = () => {
    const newCallTime: CallTime = {
      id: Date.now().toString(),
      time: '12:00',
      type: 'afternoon',
      enabled: true,
    };
    const updated = [...callTimes, newCallTime];
    setCallTimes(updated);
    onCallTimesChange(updated);
  };

  const removeCallTime = (id: string) => {
    const updated = callTimes.filter(ct => ct.id !== id);
    setCallTimes(updated);
    onCallTimesChange(updated);
  };

  const updateEscalationRule = (id: string, updates: Partial<EscalationRule>) => {
    const updated = escalationRules.map(rule => 
      rule.id === id ? { ...rule, ...updates } : rule
    );
    setEscalationRules(updated);
    onEscalationRulesChange(updated);
  };

  const addEscalationRule = () => {
    const newRule: EscalationRule = {
      id: Date.now().toString(),
      trigger: 'missed_call',
      threshold: 1,
      action: 'notify_family',
      contacts: [],
      enabled: true,
    };
    const updated = [...escalationRules, newRule];
    setEscalationRules(updated);
    onEscalationRulesChange(updated);
  };

  const removeEscalationRule = (id: string) => {
    const updated = escalationRules.filter(rule => rule.id !== id);
    setEscalationRules(updated);
    onEscalationRulesChange(updated);
  };

  const getCallTypeColor = (type: CallTime['type']) => {
    switch (type) {
      case 'morning': return 'bg-amber-100 text-amber-800';
      case 'afternoon': return 'bg-blue-100 text-blue-800';
      case 'evening': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTriggerDescription = (trigger: EscalationRule['trigger']) => {
    switch (trigger) {
      case 'missed_call': return 'Single missed call';
      case 'consecutive_missed': return 'Consecutive missed calls';
      case 'concerning_response': return 'Concerning AI response detected';
      case 'no_answer_streak': return 'No answer streak';
      default: return trigger;
    }
  };

  return (
    <div className="space-y-6">
      {/* Three Daily Calls Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Three Daily Wellbeing Calls
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Configure the three daily check-in times. Each call will be an AI-powered conversation 
            to assess wellbeing and provide companionship.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {callTimes.map((callTime) => (
            <div key={callTime.id} className="flex items-center gap-4 p-4 border rounded-lg">
              <Switch
                checked={callTime.enabled}
                onCheckedChange={(enabled) => updateCallTime(callTime.id, { enabled })}
              />
              
              <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor={`time-${callTime.id}`}>Call Time</Label>
                  <Input
                    id={`time-${callTime.id}`}
                    type="time"
                    value={callTime.time}
                    onChange={(e) => updateCallTime(callTime.id, { time: e.target.value })}
                    disabled={!callTime.enabled}
                  />
                </div>
                
                <div>
                  <Label htmlFor={`type-${callTime.id}`}>Call Type</Label>
                  <Select 
                    value={callTime.type} 
                    onValueChange={(type: CallTime['type']) => updateCallTime(callTime.id, { type })}
                    disabled={!callTime.enabled}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="morning">Morning Check-in</SelectItem>
                      <SelectItem value="afternoon">Afternoon Chat</SelectItem>
                      <SelectItem value="evening">Evening Check-in</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex items-end">
                  <Badge className={getCallTypeColor(callTime.type)}>
                    {callTime.type.charAt(0).toUpperCase() + callTime.type.slice(1)}
                  </Badge>
                </div>
              </div>
              
              {callTimes.length > 1 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => removeCallTime(callTime.id)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
          
          <Button variant="outline" onClick={addCallTime} className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Add Another Call Time
          </Button>
        </CardContent>
      </Card>

      {/* Escalation Rules Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Escalation Rules
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Set up automatic alerts and escalation procedures for missed calls or concerning responses.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {escalationRules.map((rule) => (
            <div key={rule.id} className="p-4 border rounded-lg space-y-4">
              <div className="flex items-center justify-between">
                <Switch
                  checked={rule.enabled}
                  onCheckedChange={(enabled) => updateEscalationRule(rule.id, { enabled })}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => removeEscalationRule(rule.id)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <Label>Trigger</Label>
                  <Select 
                    value={rule.trigger} 
                    onValueChange={(trigger: EscalationRule['trigger']) => 
                      updateEscalationRule(rule.id, { trigger })
                    }
                    disabled={!rule.enabled}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="missed_call">Missed Call</SelectItem>
                      <SelectItem value="consecutive_missed">Consecutive Missed</SelectItem>
                      <SelectItem value="concerning_response">Concerning Response</SelectItem>
                      <SelectItem value="no_answer_streak">No Answer Streak</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    {getTriggerDescription(rule.trigger)}
                  </p>
                </div>
                
                <div>
                  <Label>Threshold</Label>
                  <Input
                    type="number"
                    min="1"
                    max="10"
                    value={rule.threshold}
                    onChange={(e) => updateEscalationRule(rule.id, { threshold: parseInt(e.target.value) || 1 })}
                    disabled={!rule.enabled}
                  />
                </div>
                
                <div>
                  <Label>Action</Label>
                  <Select 
                    value={rule.action} 
                    onValueChange={(action: EscalationRule['action']) => 
                      updateEscalationRule(rule.id, { action })
                    }
                    disabled={!rule.enabled}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="notify_family">Notify Family</SelectItem>
                      <SelectItem value="call_emergency_contact">Call Emergency Contact</SelectItem>
                      <SelectItem value="send_alert">Send Alert</SelectItem>
                      <SelectItem value="escalate_to_service">Escalate to Service</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label>Contacts</Label>
                  <Input
                    placeholder="email@example.com"
                    value={rule.contacts.join(', ')}
                    onChange={(e) => updateEscalationRule(rule.id, { 
                      contacts: e.target.value.split(',').map(email => email.trim()).filter(Boolean)
                    })}
                    disabled={!rule.enabled}
                  />
                </div>
              </div>
            </div>
          ))}
          
          <Button variant="outline" onClick={addEscalationRule} className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Add Escalation Rule
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};