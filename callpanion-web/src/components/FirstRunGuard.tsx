import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface FirstRunGuardProps {
  children: React.ReactNode;
}

const FirstRunGuard = ({ children }: FirstRunGuardProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkFirstRun = async () => {
      if (!user) {
        setIsChecking(false);
        return;
      }

      // Check localStorage flag first
      const onboardingComplete = localStorage.getItem('onboardingComplete');
      if (onboardingComplete === 'true') {
        setIsChecking(false);
        return;
      }

      try {
        // Check if user has a household
        const { data: householdData, error: householdError } = await supabase
          .from('household_members')
          .select('household_id')
          .eq('user_id', user.id)
          .single();

        if (householdError || !householdData) {
          // No household - redirect to getting started
          navigate('/getting-started');
          return;
        }

        // Check if household has any relatives
        const { data: relativesData, error: relativesError } = await supabase
          .rpc('get_relatives_for_household', { _household_id: householdData.household_id });

        if (relativesError) {
          console.error('Error checking relatives:', relativesError);
          setIsChecking(false);
          return;
        }

        if (!relativesData || relativesData.length === 0) {
          // No relatives - redirect to getting started
          navigate('/getting-started');
          return;
        }

        // User has relatives - mark onboarding as complete
        localStorage.setItem('onboardingComplete', 'true');
        setIsChecking(false);
      } catch (error) {
        console.error('Error in first run check:', error);
        setIsChecking(false);
      }
    };

    checkFirstRun();
  }, [user, navigate]);

  if (isChecking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-comfort/20 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default FirstRunGuard;