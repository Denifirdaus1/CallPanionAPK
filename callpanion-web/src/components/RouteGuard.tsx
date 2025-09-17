import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useCallMethodAccess } from "@/hooks/useCallMethodAccess";
import { useToast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";

interface RouteGuardProps {
  requiredMethod: 'batch_call' | 'in_app_call';
  children: React.ReactNode;
}

export const RouteGuard = ({ requiredMethod, children }: RouteGuardProps) => {
  const { callMethod, isLoading } = useCallMethodAccess();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!isLoading && callMethod && callMethod !== requiredMethod) {
      toast({
        title: "Access Denied",
        description: `This feature is only available for ${requiredMethod === 'batch_call' ? 'Automated Phone Calls' : 'In-App Video Calls'} users.`,
        variant: "destructive",
      });
      
      // Redirect to correct dashboard
      const redirectPath = callMethod === 'batch_call' ? '/dashboard/batch' : '/dashboard/in-app';
      navigate(redirectPath, { replace: true });
    }
  }, [callMethod, isLoading, requiredMethod, navigate, toast]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-warmth/10 via-background to-comfort/20 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Checking access permissions...</p>
        </div>
      </div>
    );
  }

  if (!callMethod) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-warmth/10 via-background to-comfort/20 flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">Unable to determine call method preference.</p>
        </div>
      </div>
    );
  }

  if (callMethod !== requiredMethod) {
    return null; // Will redirect via useEffect
  }

  return <>{children}</>;
};