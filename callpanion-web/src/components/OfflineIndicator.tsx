import { useState, useEffect } from "react";
import { WifiOff, Wifi } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";

export default function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showOfflineAlert, setShowOfflineAlert] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowOfflineAlert(false);
      toast({
        title: "Connection restored",
        description: "You're back online! All features are now available.",
      });
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowOfflineAlert(true);
      toast({
        title: "Connection lost",
        description: "You're currently offline. Some features may not work.",
        variant: "destructive",
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Set initial state if already offline
    if (!navigator.onLine) {
      setShowOfflineAlert(true);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [toast]);

  if (!showOfflineAlert) return null;

  return (
    <div className="fixed top-4 left-4 right-4 z-50 max-w-md mx-auto">
      <Alert className="border-destructive/50 bg-destructive/10">
        <WifiOff className="h-4 w-4" />
        <AlertDescription className="flex items-center justify-between">
          <span>You're currently offline</span>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Limited functionality</span>
          </div>
        </AlertDescription>
      </Alert>
    </div>
  );
}