import { ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { UserRole } from '@/hooks/useUserRole';
import { useAuth } from '@/contexts/AuthContext';
import { Home, Users, FileText, Activity, Phone, MessageSquare, Camera, CreditCard, Settings, LogOut } from 'lucide-react';

interface FamilyLayoutProps {
  children: ReactNode;
  userRole: UserRole | null;
}

const FamilyLayout = ({ children, userRole }: FamilyLayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut } = useAuth();

  const navigationItems = [
    { path: '/home', label: 'Home', icon: Home },
    { path: '/elders', label: 'Elders', icon: Users },
    { path: '/members', label: 'Members', icon: Users },
    { path: '/messages', label: 'Messages', icon: MessageSquare },
    { path: '/memories', label: 'Memories', icon: Camera },
    { path: '/care-notes', label: 'Care Notes', icon: FileText },
    ...(userRole?.permissions.canViewHealth ? [
      { path: '/insights', label: 'Insights', icon: Activity }
    ] : []),
    { path: '/calls', label: 'Call History', icon: Phone },
    { path: '/billing', label: 'Billing', icon: CreditCard },
    { path: '/settings', label: 'Settings', icon: Settings }
  ];

  const isActive = (path: string) => location.pathname === path;

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="w-64 bg-card border-r">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-primary">CallPanion</h1>
          <p className="text-sm text-muted-foreground">Family Dashboard</p>
        </div>

        <nav className="px-4 space-y-2">
          {navigationItems.map((item) => {
            const IconComponent = item.icon;
            return (
              <Button
                key={item.path}
                variant={isActive(item.path) ? "default" : "ghost"}
                className="w-full justify-start"
                onClick={() => navigate(item.path)}
              >
                <IconComponent className="mr-3 h-4 w-4" />
                {item.label}
              </Button>
            );
          })}
        </nav>

        <div className="absolute bottom-4 left-4 right-4">
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground px-2">
              Signed in as {userRole?.role}
            </div>
            <Button 
              variant="ghost" 
              className="w-full justify-start text-muted-foreground h-10"
              onClick={handleSignOut}
            >
              <LogOut className="mr-3 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  );
};

export default FamilyLayout;