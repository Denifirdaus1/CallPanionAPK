import { Routes, Route, Navigate } from 'react-router-dom';
import { UserRole } from '@/hooks/useUserRole';
import AdminLayout from './components/AdminLayout';
import AdminOps from './pages/AdminOps';
import AdminAlerts from './pages/AdminAlerts';
import AdminAudit from './pages/AdminAudit';
import AdminSupport from './pages/AdminSupport';
import AdminReports from './pages/AdminReports';
import ProductionReadiness from './pages/ProductionReadiness';
import ProtectedRoute from '@/components/ProtectedRoute';
import AdminRoleGuard from '@/components/AdminRoleGuard';

interface AdminAppProps {
  userRole: UserRole | null;
  onUnauthorized: () => void;
}

const AdminApp = ({ userRole, onUnauthorized }: AdminAppProps) => {
  // Check if user is authorized for admin app
  if (userRole && !['company_admin', 'support'].includes(userRole.role)) {
    onUnauthorized();
    return null;
  }

  return (
    <ProtectedRoute>
      <AdminRoleGuard requiredRole="SUPPORT">
        <AdminLayout userRole={userRole}>
          <Routes>
            <Route path="/" element={<Navigate to="/ops" replace />} />
            <Route path="/ops" element={<AdminOps />} />
            <Route path="/alerts" element={<AdminAlerts />} />
            <Route path="/audit" element={<AdminAudit />} />
            <Route path="/support" element={<AdminSupport />} />
            <Route path="/reports" element={<AdminReports />} />
            <Route path="/readiness" element={<ProductionReadiness />} />
            
            {/* Legacy redirects */}
            <Route path="/admin/*" element={<Navigate to="/" replace />} />
            <Route path="*" element={<Navigate to="/ops" replace />} />
          </Routes>
        </AdminLayout>
      </AdminRoleGuard>
    </ProtectedRoute>
  );
};

export default AdminApp;