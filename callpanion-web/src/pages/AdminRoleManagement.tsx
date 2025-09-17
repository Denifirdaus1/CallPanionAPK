import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Users, Crown, UserCheck, User } from "lucide-react";

interface UserProfile {
  id: string;
  email: string;
  display_name: string | null;
  role: string;
  created_at: string;
}

const AdminRoleManagement = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      // Get profiles with user emails from auth.users
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select(`
          id,
          display_name,
          role,
          created_at
        `)
        .order('created_at', { ascending: false });

      if (profilesError) {
        throw profilesError;
      }

      // Get user emails from auth metadata
      const usersWithEmails = await Promise.all(
        (profilesData || []).map(async (profile) => {
          try {
            const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(profile.id);
            return {
              ...profile,
              email: user?.email || 'No email',
            };
          } catch {
            return {
              ...profile,
              email: 'No email',
            };
          }
        })
      );

      setUsers(usersWithEmails || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: "Error",
        description: "Failed to load users",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const updateUserRole = async (userId: string, newRole: string) => {
    try {
      setUpdatingUserId(userId);
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId);

      if (error) {
        toast({
          title: "Error",
          description: "Failed to update user role",
          variant: "destructive",
        });
        return;
      }

      // Update local state
      setUsers(users.map(user => 
        user.id === userId ? { ...user, role: newRole } : user
      ));

      toast({
        title: "Success",
        description: `User role updated to ${newRole}`,
      });
    } catch (error) {
      console.error('Error updating user role:', error);
      toast({
        title: "Error",
        description: "Failed to update user role",
        variant: "destructive",
      });
    } finally {
      setUpdatingUserId(null);
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin': return <Crown className="w-4 h-4" />;
      case 'subscriber': return <UserCheck className="w-4 h-4" />;
      default: return <User className="w-4 h-4" />;
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin': return 'default';
      case 'subscriber': return 'secondary';
      default: return 'outline';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[40vh] w-full flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center space-x-2">
        <Users className="w-6 h-6" />
        <h1 className="text-2xl font-bold">User Role Management</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Manage User Roles</CardTitle>
          <CardDescription>
            Update user roles to control access to CallPanion features
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {users.map((user) => (
              <div 
                key={user.id} 
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <h3 className="font-medium">
                      {user.display_name || user.email}
                    </h3>
                    <Badge 
                      variant={getRoleBadgeVariant(user.role)}
                      className="flex items-center space-x-1"
                    >
                      {getRoleIcon(user.role)}
                      <span className="capitalize">{user.role}</span>
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                  <p className="text-xs text-muted-foreground">
                    Joined: {new Date(user.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <Select 
                    value={user.role} 
                    onValueChange={(newRole) => updateUserRole(user.id, newRole)}
                    disabled={updatingUserId === user.id}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="free">Free</SelectItem>
                      <SelectItem value="subscriber">Subscriber</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  {updatingUserId === user.id && (
                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  )}
                </div>
              </div>
            ))}

            {users.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No users found
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminRoleManagement;