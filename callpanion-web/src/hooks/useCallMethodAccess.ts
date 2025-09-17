import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

type CallMethod = 'batch_call' | 'in_app_call' | null;

export const useCallMethodAccess = () => {
  const [callMethod, setCallMethod] = useState<CallMethod>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchCallMethod();
    } else {
      setIsLoading(false);
    }
  }, [user]);

  const fetchCallMethod = async () => {
    try {
      setIsLoading(true);
      
      // Get household for current user
      const { data: households, error } = await supabase
        .from('households')
        .select('call_method_preference')
        .eq('created_by', user?.id)
        .limit(1);

      if (error) {
        console.error('Error fetching call method:', error);
        return;
      }

      if (households && households.length > 0) {
        setCallMethod(households[0].call_method_preference as CallMethod);
      }
    } catch (error) {
      console.error('Error in fetchCallMethod:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const hasBatchCallAccess = callMethod === 'batch_call';
  const hasInAppCallAccess = callMethod === 'in_app_call';

  return {
    callMethod,
    hasBatchCallAccess,
    hasInAppCallAccess,
    isLoading,
    refetch: fetchCallMethod
  };
};