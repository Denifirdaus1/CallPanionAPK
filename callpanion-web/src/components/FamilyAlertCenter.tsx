import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Phone, Mail, Check, Clock } from 'lucide-react';
import { useHouseholdData, HouseholdAlert } from '@/hooks/useHouseholdData';
import { toast } from '@/hooks/use-toast';

export const FamilyAlertCenter: React.FC = () => {
  const { alerts, loading, acknowledgeAlert: acknowledgeHouseholdAlert } = useHouseholdData();

  const acknowledgeAlert = async (alertId: string) => {
    try {
      await acknowledgeHouseholdAlert(alertId);
      toast({
        title: "Alert acknowledged",
        description: "Alert has been marked as acknowledged",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to acknowledge alert",
        variant: "destructive",
      });
    }
  };

  const getPriorityColor = (severity: string) => {
    switch (severity) {
      case 'HIGH': return 'destructive';
      case 'MEDIUM': return 'default';
      case 'LOW': return 'secondary';
      default: return 'secondary';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'OPEN': return 'text-red-600';
      case 'IN_PROGRESS': return 'text-yellow-600';
      case 'RESOLVED': return 'text-green-600';
      case 'CLOSED': return 'text-green-600';
      default: return 'text-gray-600';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Family Alert Center
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">Loading alerts...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Family Alert Center
          {alerts.filter(a => a.status === 'OPEN').length > 0 && (
            <Badge variant="destructive">
              {alerts.filter(a => a.status === 'OPEN').length} new
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No alerts yet. Alerts will appear here when issues are detected.
          </div>
        ) : (
          <div className="space-y-4">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className={`border rounded-lg p-4 ${
                  alert.status === 'RESOLVED' || alert.status === 'CLOSED' ? 'bg-muted/50' : 'bg-background'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge variant={getPriorityColor(alert.severity)}>
                      {alert.severity.toLowerCase()} priority
                    </Badge>
                    <span className={`text-sm font-medium ${getStatusColor(alert.status)}`}>
                      {alert.status}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(alert.created_at).toLocaleString()}
                  </span>
                </div>
                
                <div className="space-y-2">
                  <p className="text-sm">
                    <strong>{alert.customer?.full_name || 'Family Member'}</strong>
                  </p>
                  
                  <p className="text-sm text-muted-foreground">
                    Alert Type: {alert.type}
                  </p>
                </div>
                
                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center gap-2">
                    {alert.status !== 'OPEN' ? (
                      <div className="flex items-center gap-1 text-green-600 text-sm">
                        <Check className="h-4 w-4" />
                        {alert.status}
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => acknowledgeAlert(alert.id)}
                      >
                        <Check className="h-3 w-3 mr-1" />
                        Acknowledge
                      </Button>
                    )}
                  </div>
                  
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost">
                      <Phone className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="ghost">
                      <Mail className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};