import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useCallMethodAccess } from "@/hooks/useCallMethodAccess";
import { Loader2 } from "lucide-react";

const DashboardRouter = () => {
  const { callMethod, isLoading } = useCallMethodAccess();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && callMethod) {
      // Redirect based on call method preference
      const redirectPath = callMethod === 'batch_call' ? '/dashboard/batch' : '/dashboard/in-app';
      navigate(redirectPath, { replace: true });
    }
  }, [callMethod, isLoading, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-warmth/10 via-background to-comfort/20 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading your dashboard...</p>
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

  return null; // Will redirect via useEffect
};

export default DashboardRouter;