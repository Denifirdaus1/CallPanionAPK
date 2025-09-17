import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ElderPairing } from "@/components/ElderPairing";
import { useToast } from "@/hooks/use-toast";

const ElderPairingPage = () => {
  const [isPaired, setIsPaired] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handlePaired = (session: any, deviceId: string, householdId: string) => {
    setIsPaired(true);
    
    toast({
      title: "Welcome to CallPanion!",
      description: "Your device is now connected. You'll receive wellbeing calls from your family.",
    });

    // Navigate to Elder home immediately since sign-in is complete
    setTimeout(() => {
      navigate('/elder');
    }, 2000);
  };

  return (
    <ElderPairing onPaired={handlePaired} />
  );
};

export default ElderPairingPage;