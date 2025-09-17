import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

interface AdminRoleGuardProps {
  children: React.ReactNode;
  requiredRole?: 'SUPER_ADMIN' | 'SUPPORT';
}

const AdminRoleGuard: React.FC<AdminRoleGuardProps> = ({ 
  children, 
  requiredRole = 'SUPPORT' 
}) => {
  const { session, isLoading } = useAuth();
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const checkAdminAccess = async () => {
      if (!session?.user) {
        setHasAccess(false);
        setIsChecking(false);
        return;
      }

      try {
        // Query org_users to check role and MFA status
        const { data: orgUser, error } = await supabase
          .from('org_users')
          .select('role, status, mfa_enabled')
          .eq('user_id', session.user.id)
          .single();

        if (error) {
          console.error('Error checking admin access:', error);
          setHasAccess(false);
          toast({
            title: "Access Denied",
            description: "Unable to verify admin access.",
            variant: "destructive",
          });
          setIsChecking(false);
          return;
        }

        if (!orgUser) {
          setHasAccess(false);
          toast({
            title: "Access Denied",
            description: "You don't have admin access to this system.",
            variant: "destructive",
          });
          setIsChecking(false);
          return;
        }

        // Check if user is active
        if (orgUser.status !== 'ACTIVE') {
          setHasAccess(false);
          toast({
            title: "Access Denied",
            description: "Your admin account is not active.",
            variant: "destructive",
          });
          setIsChecking(false);
          return;
        }

        // Check role requirements
        const hasRequiredRole = requiredRole === 'SUPER_ADMIN' 
          ? orgUser.role === 'SUPER_ADMIN'
          : ['SUPER_ADMIN', 'SUPPORT'].includes(orgUser.role);

        if (!hasRequiredRole) {
          setHasAccess(false);
          toast({
            title: "Insufficient Permissions",
            description: `This area requires ${requiredRole} access.`,
            variant: "destructive",
          });
          setIsChecking(false);
          return;
        }

        // Check MFA requirement for sensitive operations
        if (!orgUser.mfa_enabled) {
          setHasAccess(false);
          toast({
            title: "MFA Required",
            description: "Multi-factor authentication must be enabled for admin access.",
            variant: "destructive",
          });
          setIsChecking(false);
          return;
        }

        setHasAccess(true);
      } catch (error) {
        console.error('Unexpected error checking admin access:', error);
        setHasAccess(false);
        toast({
          title: "Error",
          description: "An unexpected error occurred while checking access.",
          variant: "destructive",
        });
      } finally {
        setIsChecking(false);
      }
    };

    if (!isLoading) {
      checkAdminAccess();
    }
  }, [session, isLoading, requiredRole, toast]);

  if (isLoading || isChecking) {
    return (
      <div className="min-h-[40vh] w-full flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Verifying admin access...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/admin-login" replace />;
  }

  if (hasAccess === false) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default AdminRoleGuard;