import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Clock, X, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

const DomainStatus = () => {
  const [isProduction, setIsProduction] = useState(false);
  const [hasSSL, setHasSSL] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [currentHost, setCurrentHost] = useState('');

  useEffect(() => {
    // Check if user has previously dismissed this notification
    const dismissed = localStorage.getItem('domain-status-dismissed');
    if (dismissed === 'true') {
      setIsDismissed(true);
    }

    const checkDomainStatus = () => {
      const host = window.location.host;
      const protocol = window.location.protocol;
      
      setCurrentHost(host);
      
      // Check for production domains (including any subdomain of callpanion.co.uk)
      const isProductionDomain = 
        host === 'www.callpanion.co.uk' || 
        host === 'callpanion.co.uk' ||
        host.endsWith('.callpanion.co.uk');
      
      setIsProduction(isProductionDomain);
      setHasSSL(protocol === 'https:');
    };

    checkDomainStatus();
    
    // Re-check every 30 seconds to catch DNS updates
    const interval = setInterval(checkDomainStatus, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const handleDismiss = () => {
    localStorage.setItem('domain-status-dismissed', 'true');
    setIsDismissed(true);
  };

  const handleOpenProduction = () => {
    window.open('https://www.callpanion.co.uk', '_blank');
  };

  // Hide if in full production mode, or if user dismissed it
  if ((isProduction && hasSSL) || isDismissed) return null;

  return (
    <Card className="mx-4 mt-4 border-orange-200 relative">
      <Button
        variant="ghost"
        size="sm"
        className="absolute top-2 right-2 h-6 w-6 p-0"
        onClick={handleDismiss}
      >
        <X className="h-4 w-4" />
      </Button>
      
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Clock className="h-4 w-4" />
          {isProduction ? 'Domain Setup Status' : 'Preview Mode'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-xs text-muted-foreground mb-2">
          Current: {currentHost}
        </div>
        
        {!isProduction ? (
          <>
            <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-800 dark:text-blue-200 mb-2">
                You're viewing a preview version. Visit the production site for the best experience.
              </p>
              <Button 
                onClick={handleOpenProduction}
                size="sm" 
                className="w-full"
                variant="outline"
              >
                <ExternalLink className="h-3 w-3 mr-2" />
                Open Production Site
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <span className="text-sm">Production Domain</span>
              <Badge variant="default" className="bg-green-100 text-green-800">
                <CheckCircle className="h-3 w-3 mr-1" />
                Active
              </Badge>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm">SSL Certificate</span>
              {hasSSL ? (
                <Badge variant="default" className="bg-green-100 text-green-800">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Secure
                </Badge>
              ) : (
                <Badge variant="destructive">
                  <XCircle className="h-3 w-3 mr-1" />
                  Insecure
                </Badge>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default DomainStatus;