
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, useLocation } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { useEffect, useRef, useState } from "react";
import CookieConsentBanner from "./components/CookieConsentBanner";
import { FloatingHelpButton } from "./components/FloatingHelpButton";
import CanonicalRedirect from "./components/CanonicalRedirect";
import OfflineIndicator from "./components/OfflineIndicator";
import AppRouter from "./components/AppRouter";
import ErrorBoundary from "./components/ErrorBoundary";

const queryClient = new QueryClient();

const Analytics: React.FC = () => {
  const location = useLocation();
  const firstLoadRef = useRef(true);
  const [gaInitialized, setGaInitialized] = useState(false);
  const GA_ID = 'G-6B1DDCV687';

  // Check for cookie consent and initialize GA
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

  const initializeGA = () => {
    if (gaInitialized) return;
    
    try {
      (window as any).dataLayer = (window as any).dataLayer || [];
      (window as any).gtag = (window as any).gtag || function gtag(){ (window as any).dataLayer.push(arguments); };
      (window as any).gtag('js', new Date());
      (window as any).gtag('config', GA_ID);
      setGaInitialized(true);
      console.info('[GA] initialized with consent');
    } catch (e) {
      console.warn('[GA] init failed', e);
    }
  };

  // Initialize GA only if consent given
  useEffect(() => {
    const consent = getCookie('callpanion_cookie_consent');
    if (consent === 'all') {
      initializeGA();
    }
  }, []);

  // Listen for consent changes via custom event (no polling)
  useEffect(() => {
    const handleConsentChange = (event: CustomEvent) => {
      const { consent } = event.detail;
      if (consent === 'all' && !gaInitialized) {
        initializeGA();
      }
    };

    window.addEventListener('cookieConsentChanged', handleConsentChange as EventListener);
    return () => window.removeEventListener('cookieConsentChanged', handleConsentChange as EventListener);
  }, [gaInitialized]);

  // Track route changes (only if GA is initialized and skip first render)
  useEffect(() => {
    if (!gaInitialized) return;
    
    if (firstLoadRef.current) {
      firstLoadRef.current = false;
      return;
    }
    try {
      const page_path = location.pathname + location.search;
      (window as any).gtag?.('event', 'page_view', {
        page_title: document.title,
        page_location: window.location.href,
        page_path,
      });
      console.info('[GA] page_view', page_path);
    } catch (e) {
      console.warn('[GA] page_view failed', e);
    }
  }, [location.pathname, location.search, gaInitialized]);

  return null;
};

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <CanonicalRedirect />
            <Analytics />
            <AppRouter />
            <CookieConsentBanner />
            <OfflineIndicator />
            <FloatingHelpButton />
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
