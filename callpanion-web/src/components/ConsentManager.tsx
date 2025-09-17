import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Shield, AlertTriangle } from "lucide-react";

interface ConsentFormData {
  aiCalls: boolean;
  familyDataSharing: boolean;
  healthMonitoring: boolean;
  emergencyContact: boolean;
  serviceImprovement: boolean;
}

interface ConsentManagerProps {
  customerId?: string;
  onConsentChange?: (consents: ConsentFormData) => void;
  showHeader?: boolean;
}

export function ConsentManager({ customerId, onConsentChange, showHeader = true }: ConsentManagerProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [loadingConsents, setLoadingConsents] = useState(true);

  const { register, handleSubmit, watch, setValue } = useForm<ConsentFormData>({
    defaultValues: {
      aiCalls: false,
      familyDataSharing: false,
      healthMonitoring: false,
      emergencyContact: true, // Usually essential
      serviceImprovement: false,
    }
  });

  const watchedValues = watch();

  useEffect(() => {
    onConsentChange?.(watchedValues);
  }, [watchedValues, onConsentChange]);

  useEffect(() => {
    if (customerId) {
      loadExistingConsents();
    } else {
      setLoadingConsents(false);
    }
  }, [customerId]);

  const loadExistingConsents = async () => {
    if (!customerId) return;

    try {
      const { data: consents, error } = await supabase
        .from('consents')
        .select('type, status')
        .eq('customer_id', customerId)
        .eq('status', 'GRANTED');

      if (error) throw error;

      if (consents) {
        consents.forEach(consent => {
          switch (consent.type) {
            case 'AI_CALLS':
              setValue('aiCalls', true);
              break;
            case 'FAMILY_DATA_SHARING':
              setValue('familyDataSharing', true);
              break;
            default:
              // Handle other consent types if needed
              break;
          }
        });
      }
    } catch (error) {
      console.error('Error loading consents:', error);
    } finally {
      setLoadingConsents(false);
    }
  };

  const onSubmit = async (data: ConsentFormData) => {
    if (!user) {
      toast({ title: "Authentication required", variant: "destructive" });
      return;
    }

    if (!customerId) {
      // Just trigger the callback for form-only mode
      onConsentChange?.(data);
      return;
    }

    setLoading(true);

    try {
      // First, revoke all existing consents for this customer
      await supabase
        .from('consents')
        .update({ status: 'REVOKED' })
        .eq('customer_id', customerId);

      // Then insert new consents based on current selections
      const consentRows = [];
      
      if (data.aiCalls) {
        consentRows.push({
          customer_id: customerId,
          type: 'AI_CALLS',
          status: 'GRANTED',
          captured_by: user.id
        });
      }

      if (data.familyDataSharing) {
        consentRows.push({
          customer_id: customerId,
          type: 'FAMILY_DATA_SHARING',
          status: 'GRANTED',
          captured_by: user.id
        });
      }

      // Note: Using available consent types for now
      // Additional consent types can be added as database schema is updated

      if (consentRows.length > 0) {
        const { error: insertError } = await supabase
          .from('consents')
          .insert(consentRows);

        if (insertError) throw insertError;
      }

      toast({ title: "Consent preferences updated successfully" });
      onConsentChange?.(data);
    } catch (error) {
      console.error('Error updating consents:', error);
      toast({ 
        title: "Failed to update consent preferences", 
        description: "Please try again",
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  if (loadingConsents) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Loading consent preferences...
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      {showHeader && (
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Consent & Privacy Preferences
          </CardTitle>
        </CardHeader>
      )}
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              These settings control how we use personal data. You can change these at any time. 
              Some features may not be available if consent is not granted.
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="aiCalls" className="font-medium">
                  AI Wellbeing Calls
                </Label>
                <p className="text-sm text-muted-foreground">
                  Allow AI-powered calls to check on wellbeing and provide companionship
                </p>
              </div>
              <Switch
                id="aiCalls"
                {...register("aiCalls")}
                checked={watchedValues.aiCalls}
                onCheckedChange={(checked) => setValue("aiCalls", checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="familyDataSharing" className="font-medium">
                  Family Data Sharing
                </Label>
                <p className="text-sm text-muted-foreground">
                  Share wellbeing insights and call summaries with authorized family members
                </p>
              </div>
              <Switch
                id="familyDataSharing"
                {...register("familyDataSharing")}
                checked={watchedValues.familyDataSharing}
                onCheckedChange={(checked) => setValue("familyDataSharing", checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="healthMonitoring" className="font-medium">
                  Health Monitoring
                </Label>
                <p className="text-sm text-muted-foreground">
                  Track health trends and alert family to concerning changes
                </p>
              </div>
              <Switch
                id="healthMonitoring"
                {...register("healthMonitoring")}
                checked={watchedValues.healthMonitoring}
                onCheckedChange={(checked) => setValue("healthMonitoring", checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="emergencyContact" className="font-medium">
                  Emergency Contact
                </Label>
                <p className="text-sm text-muted-foreground">
                  Allow emergency services contact in urgent situations (recommended)
                </p>
              </div>
              <Switch
                id="emergencyContact"
                {...register("emergencyContact")}
                checked={watchedValues.emergencyContact}
                onCheckedChange={(checked) => setValue("emergencyContact", checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="serviceImprovement" className="font-medium">
                  Service Improvement
                </Label>
                <p className="text-sm text-muted-foreground">
                  Use anonymised data to improve Callpanion services
                </p>
              </div>
              <Switch
                id="serviceImprovement"
                {...register("serviceImprovement")}
                checked={watchedValues.serviceImprovement}
                onCheckedChange={(checked) => setValue("serviceImprovement", checked)}
              />
            </div>
          </div>

          {customerId && (
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Updating..." : "Update Consent Preferences"}
            </Button>
          )}
        </form>
      </CardContent>
    </Card>
  );
}

export default ConsentManager;