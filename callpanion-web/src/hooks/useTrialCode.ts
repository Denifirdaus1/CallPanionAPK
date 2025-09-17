import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const useTrialCode = () => {
  const [isLoading, setIsLoading] = useState(false);

  const activateTrialCode = async (code: string) => {
    if (!code.trim()) {
      toast.error("Please enter a trial code");
      return false;
    }

    setIsLoading(true);
    
    try {
      const { data, error } = await supabase.rpc('activate_trial_code', {
        trial_code_text: code.trim()
      });

      if (error) {
        console.error('Trial code activation error:', error);
        toast.error("Failed to activate trial code");
        return false;
      }

      // Parse the JSON response
      const result = data as any;
      if (!result?.success) {
        toast.error(result?.error || "Invalid trial code");
        return false;
      }

      toast.success(`Trial activated! You have ${result.trial_days} days of premium access.`);
      return true;
    } catch (error) {
      console.error('Trial code activation error:', error);
      toast.error("Failed to activate trial code");
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    activateTrialCode,
    isLoading
  };
};