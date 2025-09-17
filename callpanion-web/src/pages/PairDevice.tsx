import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PairDevice as PairDeviceComponent } from "@/components/PairDevice";
import RelativeNavigation from "@/components/RelativeNavigation";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const PairDevicePage = () => {
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const fetchHouseholdId = async () => {
      if (!user) return;

      try {
        const { data: householdMembers, error } = await supabase
          .from('household_members')
          .select('household_id, role')
          .eq('user_id', user.id)
          .eq('role', 'FAMILY_PRIMARY')
          .limit(1)
          .single();

        if (error || !householdMembers) {
          toast({
            title: "Access denied",
            description: "You must be a family admin to pair devices.",
            variant: "destructive",
          });
          navigate('/dashboard');
          return;
        }

        setHouseholdId(householdMembers.household_id);
      } catch (error) {
        console.error('Error fetching household:', error);
        toast({
          title: "Error",
          description: "Failed to load household information.",
          variant: "destructive",
        });
        navigate('/dashboard');
      } finally {
        setLoading(false);
      }
    };

    fetchHouseholdId();
  }, [user, navigate, toast]);

  const handlePaired = (deviceId: string) => {
    toast({
      title: "Device paired successfully!",
      description: "The elder device is now connected to your household.",
    });
    // Optionally navigate back to dashboard or show device management
    setTimeout(() => {
      navigate('/dashboard');
    }, 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-comfort/20">
        <RelativeNavigation />
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        </div>
      </div>
    );
  }

  if (!householdId) {
    return null; // Will redirect
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-comfort/20">
      <RelativeNavigation />
      
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate('/dashboard')}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Pair Elder Device
          </h1>
          <p className="text-muted-foreground">
            Connect a new device for your elderly family member to receive CallPanion wellbeing calls.
          </p>
        </div>

        <PairDeviceComponent 
          householdId={householdId} 
          onPaired={handlePaired}
        />
      </div>
    </div>
  );
};

export default PairDevicePage;