import { useEffect } from 'react';

const CanonicalRedirect = () => {
  useEffect(() => {
    try {
      // Prevent redirect loops by checking if we've already attempted a redirect
      const redirectAttempted = sessionStorage.getItem('canonical_redirect_attempted');
      if (redirectAttempted) return;

      const currentHost = window.location.host.toLowerCase();
      const currentProtocol = window.location.protocol;
      
      console.log('[CanonicalRedirect] Current:', { currentHost, currentProtocol });
      
      // Only force HTTPS redirect for production domains (narrowed scope)
      if (currentHost.includes('callpanion.co.uk') && currentProtocol === 'http:') {
        sessionStorage.setItem('canonical_redirect_attempted', 'true');
        const newUrl = `https://${currentHost}${window.location.pathname}${window.location.search}${window.location.hash}`;
        console.log('[CanonicalRedirect] HTTPS redirect to:', newUrl);
        window.location.replace(newUrl);
      }
    } catch (error) {
      console.warn('[CanonicalRedirect] Error:', error);
    }
  }, []);

  return null;
};

export default CanonicalRedirect;