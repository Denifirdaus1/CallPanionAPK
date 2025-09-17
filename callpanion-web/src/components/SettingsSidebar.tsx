import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { Settings as SettingsIcon, AlertTriangle, LogOut, X } from "lucide-react";

interface SettingsSidebarProps {
  onClose: () => void;
}

export function SettingsSidebar({ onClose }: SettingsSidebarProps) {
  const { user, signOut } = useAuth();

  return (
    <div className="h-full bg-background flex flex-col">
      <div className="p-6 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <SettingsIcon className="h-6 w-6 text-primary" />
            <div>
              <h2 className="text-xl font-semibold">Settings</h2>
              <p className="text-sm text-muted-foreground">
                Manage your account
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="p-6 space-y-6 overflow-y-auto flex-1">
        {/* Profile Information */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Profile Information</CardTitle>
            <CardDescription>
              Your basic account information
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email" 
                value={user?.email || ''} 
                disabled 
                className="bg-muted"
              />
              <p className="text-sm text-muted-foreground mt-1">
                Email cannot be changed at this time
              </p>
            </div>
            <div>
              <Label htmlFor="user-id">User ID</Label>
              <Input 
                id="user-id" 
                value={user?.id || ''} 
                disabled 
                className="bg-muted font-mono text-sm"
              />
            </div>
          </CardContent>
        </Card>

        {/* Privacy & Data */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Privacy & Data</CardTitle>
            <CardDescription>
              Control how your data is used and stored
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Your data is encrypted and securely stored. We follow strict privacy guidelines to protect your information.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* Account Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Account Actions</CardTitle>
            <CardDescription>
              Manage your account and session
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="destructive" onClick={signOut} className="w-full">
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}