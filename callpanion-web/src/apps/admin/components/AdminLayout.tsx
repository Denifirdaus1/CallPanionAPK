import { ReactNode } from 'react';
import { UserRole } from '@/hooks/useUserRole';

interface AdminLayoutProps {
  children: ReactNode;
  userRole: UserRole | null;
}

const AdminLayout = ({ children }: AdminLayoutProps) => {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-primary">CallPanion Admin</h1>
          <nav className="flex space-x-4">
            <a href="/admin/ops" className="text-sm text-muted-foreground hover:text-brand-accent">Operations</a>
            <a href="/admin/alerts" className="text-sm text-muted-foreground hover:text-brand-accent">Alerts</a>
            <a href="/admin/audit" className="text-sm text-muted-foreground hover:text-brand-accent">Audit</a>
            <a href="/admin/support" className="text-sm text-muted-foreground hover:text-brand-accent">Support</a>
            <a href="/admin/reports" className="text-sm text-muted-foreground hover:text-brand-accent">Reports</a>
            <a href="/admin/readiness" className="text-sm text-muted-foreground hover:text-brand-accent">Readiness</a>
          </nav>
        </div>
      </header>
      <main className="p-8">{children}</main>
    </div>
  );
};

export default AdminLayout;