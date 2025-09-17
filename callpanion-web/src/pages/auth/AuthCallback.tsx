import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

const AuthCallback = () => {
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    
    if (!user) {
      navigate('/auth'); 
      return;
    }
    
    // Check if user has household membership
    (async () => {
      try {
        const { data, error } = await supabase
          .from('household_members')
          .select('household_id')
          .eq('user_id', user.id)
          .limit(1)
          .maybeSingle();
        
        if (!error && data?.household_id) {
          navigate('/dashboard');
        } else {
          navigate('/onboarding/household');
        }
      } catch (error) {
        console.error('Error checking household membership:', error);
        navigate('/onboarding/household');
      }
    })();
  }, [user, isLoading, navigate]);

  // Timeout fallback to prevent getting stuck
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (isLoading) {
        console.warn('Auth callback timeout, redirecting to auth');
        navigate('/auth');
      }
    }, 2000);

    return () => clearTimeout(timeout);
  }, [isLoading, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-warmth/10 via-background to-comfort/20 flex items-center justify-center">
      <div className="text-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
        <p className="text-muted-foreground">Verifying your account...</p>
      </div>
    </div>
  );
};

export default AuthCallback;