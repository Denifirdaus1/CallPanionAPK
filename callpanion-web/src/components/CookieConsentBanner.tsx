import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { X, Cookie, Settings } from "lucide-react";

export default function CookieConsentBanner() {
  const [isVisible, setIsVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    // Check if consent has already been given
    const consent = getCookie('callpanion_cookie_consent');
    if (!consent) {
      setIsVisible(true);
    } else if (consent === 'all') {
      enableNonEssential();
    }
  }, []);

  const setCookie = (name: string, value: string, days: number) => {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    document.cookie = `${name}=${value};expires=${date.toUTCString()};path=/;SameSite=Lax`;
  };

  const getCookie = (name: string): string | null => {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
      let c = ca[i];
      while (c.charAt(0) === ' ') c = c.substring(1, c.length);
      if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
  };

  const enableNonEssential = () => {
    // Enable Google Analytics if consent given
    if (typeof (window as any).gtag !== 'undefined') {
      (window as any).gtag('consent', 'update', {
        analytics_storage: 'granted'
      });
    }
    console.log('Non-essential cookies enabled');
  };

  const handleAcceptAll = () => {
    setCookie('callpanion_cookie_consent', 'all', 365);
    enableNonEssential();
    setIsVisible(false);
    // Dispatch custom event to notify GA
    window.dispatchEvent(new CustomEvent('cookieConsentChanged', { detail: { consent: 'all' } }));
  };

  const handleRejectNonEssential = () => {
    setCookie('callpanion_cookie_consent', 'essential', 365);
    // Disable non-essential cookies
    if (typeof (window as any).gtag !== 'undefined') {
      (window as any).gtag('consent', 'update', {
        analytics_storage: 'denied'
      });
    }
    setIsVisible(false);
    // Dispatch custom event to notify GA
    window.dispatchEvent(new CustomEvent('cookieConsentChanged', { detail: { consent: 'essential' } }));
  };

  const handleCustomize = () => {
    setShowDetails(!showDetails);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-card border-t shadow-lg z-50 p-4">
      <div className="max-w-6xl mx-auto">
        <Card className="border-0 shadow-none">
          <CardContent className="p-0">
            <div className="flex items-start gap-4">
              <Cookie className="h-6 w-6 text-brand-accent flex-shrink-0 mt-1" />
              
              <div className="flex-1 space-y-4">
                <div>
                  <h3 className="font-semibold text-foreground mb-2">We use cookies to make CallPanion work</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    We use essential cookies to make CallPanion work, and optional cookies to improve it. Choose your preferences.{' '}
                    <a 
                      href="/legal/cookies" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-brand-accent hover:underline font-medium"
                    >
                      Read our Cookie Policy
                    </a>
                  </p>
                </div>

                {showDetails && (
                  <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
                    <div>
                      <h4 className="font-medium text-sm text-foreground">Essential Cookies</h4>
                      <p className="text-xs text-muted-foreground">Required for authentication, security, and basic functionality. Cannot be disabled.</p>
                    </div>
                    <div>
                      <h4 className="font-medium text-sm text-foreground">Analytics Cookies</h4>
                      <p className="text-xs text-muted-foreground">Help us understand how you use CallPanion so we can improve it. Uses Google Analytics with privacy-enhanced settings.</p>
                    </div>
                    <div>
                      <h4 className="font-medium text-sm text-foreground">Third-Party Service Cookies</h4>
                      <p className="text-xs text-muted-foreground">Set by Mapbox (maps), Stripe (payments), and Supabase (hosting) to deliver their services.</p>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-3">
                  <Button
                    onClick={handleAcceptAll}
                    className="bg-brand-accent hover:bg-brand-accent/90 text-white"
                    size="sm"
                  >
                    Accept all
                  </Button>
                  
                  <Button
                    onClick={handleRejectNonEssential}
                    variant="outline"
                    size="sm"
                  >
                    Reject non-essential
                  </Button>
                  
                  <Button
                    onClick={handleCustomize}
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground"
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    {showDetails ? 'Hide details' : 'Manage choices'}
                  </Button>
                </div>
              </div>

              <Button
                onClick={() => setIsVisible(false)}
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-foreground flex-shrink-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}