import { Routes, Route } from 'react-router-dom';

// Import shared components
import Auth from '@/pages/Auth';
import AuthCallback from '@/pages/auth/AuthCallback';
import CallPanionLanding from '@/pages/CallPanionLanding';
import Privacy from '@/pages/Privacy';
import Terms from '@/pages/Terms';
import MembershipTerms from '@/pages/MembershipTerms';
import Cookies from '@/pages/Cookies';
import Accessibility from '@/pages/Accessibility';
import NotFound from '@/pages/NotFound';
import DashboardRouter from "@/pages/DashboardRouter";
import BatchCallDashboard from "@/pages/BatchCallDashboard";
import InAppDashboard from "@/pages/InAppDashboard";
import CallMethodSelection from "@/pages/onboarding/CallMethodSelection";
import DevicePairing from '@/pages/DevicePairing';

import ProtectedRoute from '@/components/ProtectedRoute';

// Import onboarding pages
import HouseholdSetup from '@/pages/onboarding/HouseholdSetup';
import RelativeSetup from '@/pages/onboarding/RelativeSetup';
import ScheduleSetup from '@/pages/onboarding/ScheduleSetup';
import { RouteGuard } from "@/components/RouteGuard";

// Import legal pages
import PrivacyPolicy from '@/pages/legal/PrivacyPolicy';
import TermsOfUse from '@/pages/legal/TermsOfUse';
import CookiePolicy from '@/pages/legal/CookiePolicy';
import AccessibilityStatement from '@/pages/legal/AccessibilityStatement';
import HealthDisclaimer from '@/pages/legal/HealthDisclaimer';
import FamilyConsent from '@/pages/legal/FamilyConsent';

const AppRouter = () => {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<CallPanionLanding />} />
      <Route path="/auth" element={<Auth />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/terms/membership" element={<MembershipTerms />} />
      <Route path="/cookies" element={<Cookies />} />
      <Route path="/accessibility" element={<Accessibility />} />
      <Route path="/legal/privacy" element={<PrivacyPolicy />} />
      <Route path="/legal/terms" element={<TermsOfUse />} />
      <Route path="/legal/cookies" element={<CookiePolicy />} />
      <Route path="/legal/accessibility" element={<AccessibilityStatement />} />
      <Route path="/legal/health-disclaimer" element={<HealthDisclaimer />} />
      <Route path="/legal/family-consent" element={<FamilyConsent />} />
      
      
      {/* Protected routes */}
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <DashboardRouter />
            </ProtectedRoute>
          } />
          <Route path="/dashboard/batch" element={
            <ProtectedRoute>
              <RouteGuard requiredMethod="batch_call">
                <BatchCallDashboard />
              </RouteGuard>
            </ProtectedRoute>
          } />
          <Route path="/dashboard/in-app" element={
            <ProtectedRoute>
              <RouteGuard requiredMethod="in_app_call">
                <InAppDashboard />
              </RouteGuard>
            </ProtectedRoute>
          } />
          <Route path="/device-pairing" element={
            <ProtectedRoute>
              <DevicePairing />
            </ProtectedRoute>
          } />
      
      {/* Onboarding routes */}
          <Route path="/onboarding/household" element={
            <ProtectedRoute>
              <HouseholdSetup />
            </ProtectedRoute>
          } />
          <Route path="/onboarding/call-method" element={
            <ProtectedRoute>
              <CallMethodSelection />
            </ProtectedRoute>
          } />
      <Route path="/onboarding/relative" element={
        <ProtectedRoute>
          <RelativeSetup />
        </ProtectedRoute>
      } />
      <Route path="/onboarding/schedule" element={
        <ProtectedRoute>
          <ScheduleSetup />
        </ProtectedRoute>
      } />
      
      {/* Fallback */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

export default AppRouter;