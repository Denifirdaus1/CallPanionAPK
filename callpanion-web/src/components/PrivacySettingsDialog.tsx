import { useState, useEffect } from "react";
import { Shield, Eye, Bell, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface PrivacySettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface PrivacySettings {
  analytics_consent: boolean;
  marketing_emails: boolean;
  push_notifications: boolean;
  data_sharing_family: boolean;
}

export default function PrivacySettingsDialog({ open, onOpenChange }: PrivacySettingsDialogProps) {
  const [settings, setSettings] = useState<PrivacySettings>({
    analytics_consent: false,
    marketing_emails: false,
    push_notifications: false,
    data_sharing_family: true,
  });
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (open && user) {
      loadPrivacySettings();
    }
  }, [open, user]);

  const loadPrivacySettings = async () => {
    try {
      // For now, use localStorage until the database types are updated
      const saved = localStorage.getItem(`privacy_settings_${user?.id}`);
      if (saved) {
        const parsedSettings = JSON.parse(saved);
        setSettings({
          analytics_consent: parsedSettings.analytics_consent || false,
          marketing_emails: parsedSettings.marketing_emails || false,
          push_notifications: parsedSettings.push_notifications || false,
          data_sharing_family: parsedSettings.data_sharing_family !== false,
        });
      }
    } catch (error: any) {
      console.error('Error loading privacy settings:', error);
    }
  };

  const savePrivacySettings = async () => {
    if (!user) return;

    setIsSaving(true);
    try {
      // Save to localStorage for now
      localStorage.setItem(`privacy_settings_${user.id}`, JSON.stringify(settings));

      toast({
        title: "Privacy settings updated",
        description: "Your privacy preferences have been saved.",
      });

      onOpenChange(false);
    } catch (error: any) {
      console.error('Error saving privacy settings:', error);
      toast({
        title: "Save failed",
        description: "Failed to save privacy settings.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSettingChange = (key: keyof PrivacySettings, value: boolean) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Privacy Settings
          </DialogTitle>
          <DialogDescription>
            Control how your data is used and shared within CallPanion.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Eye className="h-4 w-4" />
                Analytics & Tracking
              </CardTitle>
              <CardDescription>
                Help us improve CallPanion by sharing anonymous usage data.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <Label htmlFor="analytics" className="flex-1">
                  Allow analytics and usage tracking
                </Label>
                <Switch
                  id="analytics"
                  checked={settings.analytics_consent}
                  onCheckedChange={(value) => handleSettingChange('analytics_consent', value)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Mail className="h-4 w-4" />
                Email Communications
              </CardTitle>
              <CardDescription>
                Choose what emails you'd like to receive from us.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <Label htmlFor="marketing" className="flex-1">
                  Marketing and promotional emails
                </Label>
                <Switch
                  id="marketing"
                  checked={settings.marketing_emails}
                  onCheckedChange={(value) => handleSettingChange('marketing_emails', value)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Bell className="h-4 w-4" />
                Push Notifications
              </CardTitle>
              <CardDescription>
                Receive notifications about important updates and alerts.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <Label htmlFor="push" className="flex-1">
                  Enable push notifications
                </Label>
                <Switch
                  id="push"
                  checked={settings.push_notifications}
                  onCheckedChange={(value) => handleSettingChange('push_notifications', value)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Shield className="h-4 w-4" />
                Family Data Sharing
              </CardTitle>
              <CardDescription>
                Control how your health and wellbeing data is shared with family members.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <Label htmlFor="family-sharing" className="flex-1">
                  Share wellbeing insights with family members
                </Label>
                <Switch
                  id="family-sharing"
                  checked={settings.data_sharing_family}
                  onCheckedChange={(value) => handleSettingChange('data_sharing_family', value)}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end gap-3 pt-6">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            onClick={savePrivacySettings}
            disabled={isSaving}
          >
            {isSaving ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}