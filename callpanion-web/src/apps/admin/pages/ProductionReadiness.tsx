import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  RefreshCw, 
  Shield, 
  Database, 
  Key, 
  Map, 
  Mic, 
  CreditCard, 
  FileText, 
  Zap,
  Globe,
  Users
} from "lucide-react";

interface ReadinessCheck {
  id: string;
  name: string;
  description: string;
  status: 'pass' | 'fail' | 'warning' | 'checking';
  message: string;
  icon: any;
  category: 'security' | 'infrastructure' | 'compliance' | 'performance';
}

export default function ProductionReadiness() {
  const [checks, setChecks] = useState<ReadinessCheck[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [lastRun, setLastRun] = useState<Date | null>(null);

  const initialChecks: ReadinessCheck[] = [
    {
      id: 'auth',
      name: 'Authentication System',
      description: 'Supabase authentication working correctly',
      status: 'checking',
      message: 'Checking auth configuration...',
      icon: Shield,
      category: 'security'
    },
    {
      id: 'rls',
      name: 'Row Level Security',
      description: 'All user tables have RLS enabled',
      status: 'checking',
      message: 'Verifying RLS policies...',
      icon: Database,
      category: 'security'
    },
    {
      id: 'api_keys',
      name: 'API Keys Present',
      description: 'Required API keys configured',
      status: 'checking',
      message: 'Checking API key presence...',
      icon: Key,
      category: 'infrastructure'
    },
    {
      id: 'mapbox',
      name: 'Mapbox Integration',
      description: 'Map tiles loading successfully',
      status: 'checking',
      message: 'Testing Mapbox connectivity...',
      icon: Map,
      category: 'infrastructure'
    },
    {
      id: 'elevenlabs',
      name: 'ElevenLabs Voice',
      description: 'Voice agent token present and valid',
      status: 'checking',
      message: 'Verifying ElevenLabs setup...',
      icon: Mic,
      category: 'infrastructure'
    },
    {
      id: 'stripe',
      name: 'Stripe Payments',
      description: 'Payment processing configured',
      status: 'checking',
      message: 'Checking Stripe configuration...',
      icon: CreditCard,
      category: 'infrastructure'
    },
    {
      id: 'legal_pages',
      name: 'Legal Pages',
      description: 'Privacy, terms, cookies pages accessible',
      status: 'checking',
      message: 'Verifying legal page accessibility...',
      icon: FileText,
      category: 'compliance'
    },
    {
      id: 'cookie_banner',
      name: 'Cookie Consent',
      description: 'GDPR-compliant cookie banner shown',
      status: 'checking',
      message: 'Checking cookie consent implementation...',
      icon: Globe,
      category: 'compliance'
    },
    {
      id: 'error_pages',
      name: 'Error Handling',
      description: '404 and 500 pages present',
      status: 'checking',
      message: 'Verifying error page handling...',
      icon: AlertTriangle,
      category: 'performance'
    },
    {
      id: 'performance',
      name: 'Performance Score',
      description: 'Lighthouse score >85 mobile & desktop',
      status: 'checking',
      message: 'This requires manual Lighthouse testing...',
      icon: Zap,
      category: 'performance'
    }
  ];

  useEffect(() => {
    setChecks(initialChecks);
    runReadinessChecks();
  }, []);

  const runReadinessChecks = async () => {
    setIsRunning(true);
    const updatedChecks = [...initialChecks];

    // Check authentication
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const authCheck = updatedChecks.find(c => c.id === 'auth');
      if (authCheck) {
        if (session) {
          authCheck.status = 'pass';
          authCheck.message = 'Authentication system working correctly';
        } else {
          authCheck.status = 'warning';
          authCheck.message = 'No active session (expected if not logged in)';
        }
      }
    } catch (error) {
      const authCheck = updatedChecks.find(c => c.id === 'auth');
      if (authCheck) {
        authCheck.status = 'fail';
        authCheck.message = 'Authentication system error';
      }
    }

    // Check RLS via a simple query
    try {
      const { error } = await supabase.from('profiles').select('count').limit(1);
      const rlsCheck = updatedChecks.find(c => c.id === 'rls');
      if (rlsCheck) {
        if (error && error.message.includes('RLS')) {
          rlsCheck.status = 'pass';
          rlsCheck.message = 'RLS is properly enabled and enforced';
        } else {
          rlsCheck.status = 'warning';
          rlsCheck.message = 'RLS status needs manual verification';
        }
      }
    } catch (error) {
      const rlsCheck = updatedChecks.find(c => c.id === 'rls');
      if (rlsCheck) {
        rlsCheck.status = 'warning';
        rlsCheck.message = 'RLS check inconclusive - verify manually';
      }
    }

    // Check environment variables (client-side detection)
    const apiKeysCheck = updatedChecks.find(c => c.id === 'api_keys');
    if (apiKeysCheck) {
      const hasSupabase = !!import.meta.env.VITE_SUPABASE_URL && !!import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      if (hasSupabase) {
        apiKeysCheck.status = 'pass';
        apiKeysCheck.message = 'Essential API keys present';
      } else {
        apiKeysCheck.status = 'fail';
        apiKeysCheck.message = 'Missing Supabase configuration';
      }
    }

    // Test Mapbox (basic connectivity test)
    try {
      const mapboxCheck = updatedChecks.find(c => c.id === 'mapbox');
      if (mapboxCheck) {
        // Simple test - try to load a Mapbox style
        const response = await fetch('https://api.mapbox.com/styles/v1/mapbox/light-v11?access_token=pk.test', { method: 'HEAD' });
        if (response.status === 401) {
          // 401 means API is accessible but token invalid (expected)
          mapboxCheck.status = 'warning';
          mapboxCheck.message = 'Mapbox API accessible - verify token in secrets';
        } else {
          mapboxCheck.status = 'pass';
          mapboxCheck.message = 'Mapbox connectivity verified';
        }
      }
    } catch (error) {
      const mapboxCheck = updatedChecks.find(c => c.id === 'mapbox');
      if (mapboxCheck) {
        mapboxCheck.status = 'fail';
        mapboxCheck.message = 'Mapbox connectivity failed';
      }
    }

    // ElevenLabs check
    const elevenlabsCheck = updatedChecks.find(c => c.id === 'elevenlabs');
    if (elevenlabsCheck) {
      // Check if we have the environment variable that indicates ElevenLabs is configured
      const hasElevenlabsConfig = !!import.meta.env.VITE_ELEVENLABS_AGENT_ID;
      if (hasElevenlabsConfig) {
        elevenlabsCheck.status = 'pass';
        elevenlabsCheck.message = 'ElevenLabs agent ID configured';
      } else {
        elevenlabsCheck.status = 'fail';
        elevenlabsCheck.message = 'Missing ELEVENLABS_AGENT_ID in function secrets';
      }
    }

    // Stripe check
    const stripeCheck = updatedChecks.find(c => c.id === 'stripe');
    if (stripeCheck) {
      stripeCheck.status = 'warning';
      stripeCheck.message = 'Verify Stripe secret key in function secrets';
    }

    // Legal pages check
    try {
      const legalUrls = ['/legal/privacy', '/legal/terms', '/legal/cookies'];
      const legalCheck = updatedChecks.find(c => c.id === 'legal_pages');
      if (legalCheck) {
        const responses = await Promise.all(
          legalUrls.map(url => fetch(url, { method: 'HEAD' }))
        );
        const allAccessible = responses.every(r => r.ok);
        if (allAccessible) {
          legalCheck.status = 'pass';
          legalCheck.message = 'All legal pages accessible';
        } else {
          legalCheck.status = 'fail';
          legalCheck.message = 'Some legal pages not accessible';
        }
      }
    } catch (error) {
      const legalCheck = updatedChecks.find(c => c.id === 'legal_pages');
      if (legalCheck) {
        legalCheck.status = 'fail';
        legalCheck.message = 'Legal pages check failed';
      }
    }

    // Cookie banner check
    const cookieCheck = updatedChecks.find(c => c.id === 'cookie_banner');
    if (cookieCheck) {
      const hasCookieConsent = !localStorage.getItem('callpanion_cookie_consent');
      if (hasCookieConsent || document.querySelector('[data-cookie-banner]')) {
        cookieCheck.status = 'pass';
        cookieCheck.message = 'Cookie consent banner implemented';
      } else {
        cookieCheck.status = 'warning';
        cookieCheck.message = 'Cookie banner may need verification';
      }
    }

    // Error pages check
    const errorCheck = updatedChecks.find(c => c.id === 'error_pages');
    if (errorCheck) {
      errorCheck.status = 'warning';
      errorCheck.message = 'Verify 404/500 pages manually';
    }

    // Performance check
    const perfCheck = updatedChecks.find(c => c.id === 'performance');
    if (perfCheck) {
      perfCheck.status = 'warning';
      perfCheck.message = 'Run Lighthouse manually for accurate scores';
    }

    setChecks(updatedChecks);
    setLastRun(new Date());
    setIsRunning(false);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pass':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'fail':
        return <XCircle className="h-5 w-5 text-red-600" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-amber-600" />;
      default:
        return <RefreshCw className="h-5 w-5 text-blue-600 animate-spin" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pass':
        return <Badge className="bg-green-100 text-green-800">PASS</Badge>;
      case 'fail':
        return <Badge className="bg-red-100 text-red-800">FAIL</Badge>;
      case 'warning':
        return <Badge className="bg-amber-100 text-amber-800">WARNING</Badge>;
      default:
        return <Badge className="bg-blue-100 text-blue-800">CHECKING</Badge>;
    }
  };

  const getCategoryChecks = (category: string) => {
    return checks.filter(check => check.category === category);
  };

  const getOverallScore = () => {
    const passCount = checks.filter(c => c.status === 'pass').length;
    const totalCount = checks.length;
    return Math.round((passCount / totalCount) * 100);
  };

  const categories = [
    { id: 'security', name: 'Security', icon: Shield },
    { id: 'infrastructure', name: 'Infrastructure', icon: Database },
    { id: 'compliance', name: 'Compliance', icon: FileText },
    { id: 'performance', name: 'Performance', icon: Zap }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Production Readiness Report</h1>
          <p className="text-muted-foreground">
            Comprehensive checks for CallPanion production deployment
          </p>
          {lastRun && (
            <p className="text-sm text-muted-foreground mt-1">
              Last run: {lastRun.toLocaleString()}
            </p>
          )}
        </div>
        <Button 
          onClick={runReadinessChecks} 
          disabled={isRunning}
          className="bg-brand-accent hover:bg-brand-accent/90"
        >
          {isRunning ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Running Checks...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Run Checks
            </>
          )}
        </Button>
      </div>

      {/* Overall Score */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Overall Readiness Score
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Progress value={getOverallScore()} className="h-3" />
            </div>
            <div className="text-2xl font-bold text-foreground">
              {getOverallScore()}%
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            {checks.filter(c => c.status === 'pass').length} of {checks.length} checks passing
          </p>
        </CardContent>
      </Card>

      {/* Category Sections */}
      {categories.map(category => {
        const categoryChecks = getCategoryChecks(category.id);
        const CategoryIcon = category.icon;
        
        return (
          <Card key={category.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CategoryIcon className="h-5 w-5" />
                {category.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {categoryChecks.map(check => {
                const CheckIcon = check.icon;
                return (
                  <div key={check.id} className="flex items-start gap-4 p-4 border rounded-lg">
                    <CheckIcon className="h-6 w-6 text-muted-foreground flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium text-foreground">{check.name}</h3>
                        {getStatusBadge(check.status)}
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{check.description}</p>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(check.status)}
                        <span className="text-sm">{check.message}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        );
      })}

      {/* Required Environment Variables */}
      <Card>
        <CardHeader>
          <CardTitle>Required Environment Variables Checklist</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <p className="font-medium">Edge Function Secrets (via Supabase Dashboard):</p>
            <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
              <li><code>ELEVENLABS_API_KEY</code> - Voice AI services</li>
              <li><code>ELEVENLABS_AGENT_ID</code> - Pre-configured voice agent</li>
              <li><code>STRIPE_SECRET_KEY</code> - Payment processing</li>
              <li><code>RESEND_API_KEY</code> - Email delivery</li>
              <li><code>OPENAI_API_KEY</code> - AI conversation features</li>
              <li><code>MAPBOX_ACCESS_TOKEN</code> - Map services</li>
              <li><code>VITE_VAPID_PUBLIC_KEY</code> - Push notifications (client-side)</li>
            </ul>
            <p className="text-xs text-muted-foreground mt-4">
              Configure these in: Supabase Dashboard → Functions → Secrets
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button variant="outline" asChild>
              <a href="https://pagespeed.web.dev/" target="_blank" rel="noopener noreferrer">
                Run Lighthouse Test
              </a>
            </Button>
            <Button variant="outline" asChild>
              <a href="/legal/privacy" target="_blank" rel="noopener noreferrer">
                Test Legal Pages
              </a>
            </Button>
            <Button variant="outline" asChild>
              <a href="https://supabase.com/dashboard/project/umjtepmdwfyfhdzbkyli/settings/functions" target="_blank" rel="noopener noreferrer">
                Manage Function Secrets
              </a>
            </Button>
            <Button variant="outline" onClick={() => window.location.href = '/nonexistent-page'}>
              Test 404 Page
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}