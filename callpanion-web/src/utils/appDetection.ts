export type AppType = 'elder' | 'family' | 'admin';

export interface AppConfig {
  type: AppType;
  baseUrl: string;
  title: string;
}

// Detect which app based on subdomain or localhost port
export const detectApp = (): AppConfig => {
  const hostname = window.location.hostname;
  const port = window.location.port;
  
  // Development mode - check port or path
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    const path = window.location.pathname;
    if (path.startsWith('/elder') || port === '8081') {
      return { type: 'elder', baseUrl: '/elder', title: 'CallPanion Elder' };
    }
    if (path.startsWith('/admin') || port === '8082') {
      return { type: 'admin', baseUrl: '/admin', title: 'CallPanion Admin' };
    }
    // Default to family for localhost
    return { type: 'family', baseUrl: '/family', title: 'CallPanion Family' };
  }
  
  // Production mode - check subdomain
  if (hostname.startsWith('elder.')) {
    return { type: 'elder', baseUrl: '/', title: 'CallPanion Elder' };
  }
  if (hostname.startsWith('admin.')) {
    return { type: 'admin', baseUrl: '/', title: 'CallPanion Admin' };
  }
  if (hostname.startsWith('family.')) {
    return { type: 'family', baseUrl: '/', title: 'CallPanion Family' };
  }
  
  // Default fallback
  return { type: 'family', baseUrl: '/', title: 'CallPanion' };
};

export const getRedirectUrl = (userRole: string, currentApp: AppType): string | null => {
  // Map user roles to their appropriate apps
  const roleToApp: Record<string, AppType> = {
    'elder': 'elder',
    'family_admin': 'family', 
    'family_member': 'family',
    'company_admin': 'admin',
    'support': 'admin'
  };
  
  const targetApp = roleToApp[userRole];
  if (!targetApp || targetApp === currentApp) {
    return null; // No redirect needed
  }
  
  // Generate redirect URL based on environment
  const hostname = window.location.hostname;
  const protocol = window.location.protocol;
  
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    // Development mode
    return `${protocol}//${hostname}:${window.location.port}/${targetApp}`;
  } else {
    // Production mode - redirect to subdomain
    const baseDomain = hostname.replace(/^(elder\.|family\.|admin\.)/, '');
    return `${protocol}//${targetApp}.${baseDomain}`;
  }
};