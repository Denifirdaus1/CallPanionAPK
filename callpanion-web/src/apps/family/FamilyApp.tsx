
import { Routes, Route, Navigate } from 'react-router-dom';
import { UserRole } from '@/hooks/useUserRole';
import FamilyLayout from './components/FamilyLayout';
import FamilyHome from './pages/FamilyHome';
import FamilyElders from './pages/FamilyElders';
import FamilyMembers from './pages/FamilyMembers';
import FamilyCareNotes from './pages/FamilyCareNotes';
import FamilyInsights from './pages/FamilyInsights';
import FamilyCalls from './pages/FamilyCalls';
import FamilyBilling from './pages/FamilyBilling';
import FamilySettings from './pages/FamilySettings';
import ProtectedRoute from '@/components/ProtectedRoute';
import SubscriberRoute from '@/components/SubscriberRoute';
import FamilyMessages from '@/pages/FamilyMessages';
import FamilyMemories from '@/pages/FamilyMemories';
import GettingStarted from '@/pages/GettingStarted';
import AddRelativeWizard from '@/pages/AddRelativeWizard';
import FirstRunGuard from '@/components/FirstRunGuard';

interface FamilyAppProps {
  userRole: UserRole | null;
  onUnauthorized: () => void;
}

const FamilyApp = ({ userRole, onUnauthorized }: FamilyAppProps) => {
  // Check if user is authorized for family app
  if (userRole && !['family_admin', 'family_member'].includes(userRole.role)) {
    onUnauthorized();
    return null;
  }

  return (
    <ProtectedRoute>
      <FamilyLayout userRole={userRole}>
        <Routes>
          <Route path="/" element={<Navigate to="/home" replace />} />
          
          {/* Free routes - accessible without subscription */}
          <Route path="/getting-started" element={<GettingStarted />} />
          <Route path="/add-relative" element={<AddRelativeWizard />} />
          <Route path="/billing" element={<FamilyBilling />} />
          
          {/* Protected routes - require subscription */}
          <Route path="/home" element={
            <SubscriberRoute>
              <FirstRunGuard>
                <FamilyHome />
              </FirstRunGuard>
            </SubscriberRoute>
          } />
          <Route path="/elders" element={
            <SubscriberRoute>
              <FamilyElders />
            </SubscriberRoute>
          } />
          <Route path="/members" element={
            <SubscriberRoute>
              <FamilyMembers />
            </SubscriberRoute>
          } />
          <Route path="/care-notes" element={
            <SubscriberRoute>
              <FamilyCareNotes />
            </SubscriberRoute>
          } />
          <Route path="/insights" element={
            <SubscriberRoute>
              {userRole?.permissions.canViewHealth ? 
                <FamilyInsights /> : 
                <Navigate to="/home" replace />}
            </SubscriberRoute>
          } />
          <Route path="/calls" element={
            <SubscriberRoute>
              <FamilyCalls />
            </SubscriberRoute>
          } />
          <Route path="/messages" element={
            <SubscriberRoute>
              <FamilyMessages />
            </SubscriberRoute>
          } />
          <Route path="/memories" element={
            <SubscriberRoute>
              <FamilyMemories />
            </SubscriberRoute>
          } />
          <Route path="/settings" element={
            <SubscriberRoute>
              <FamilySettings />
            </SubscriberRoute>
          } />
          
          {/* Legacy redirects */}
          <Route path="/family/*" element={<Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>
      </FamilyLayout>
    </ProtectedRoute>
  );
};

export default FamilyApp;
