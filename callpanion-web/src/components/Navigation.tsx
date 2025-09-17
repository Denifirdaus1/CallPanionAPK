
import { Home, MessageCircle as MessageIcon, Calendar, Camera, MessageCircle, Phone, BarChart3, LogOut, Info } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useHealthAccess } from "@/hooks/useHealthAccess";

const Navigation = () => {
  const location = useLocation();
  const { session, signOut } = useAuth();
  const { canViewHealthInsights, loading } = useHealthAccess();

  const baseNavItems = [
    { to: "/", label: "Home", icon: Home },
    { to: "/messages", label: "Love Messages", icon: MessageIcon },
    { to: "/companion", label: "Daily Call", icon: Phone },
    { to: "/calendar", label: "Joyful Moments", icon: Calendar },
    { to: "/memories", label: "Our Memories", icon: Camera },
  ];

  const navItems = session && !loading && canViewHealthInsights 
    ? [...baseNavItems, { to: "/family/health", label: "Health Insights", icon: BarChart3 }]
    : baseNavItems;

  return (
    <nav className="bg-card border-b border-border shadow-gentle">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-2">
            <span className="text-xl font-semibold text-foreground">Callpanion</span>
          </div>
          
          <div className="hidden md:flex space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.to;
              
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-gentle"
                      : "text-muted-foreground hover:text-foreground hover:bg-comfort"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>

          <div className="flex items-center space-x-3 shrink-0">
            {session ? (
              <Button
                variant="outline"
                size="sm"
                className="flex items-center px-3 py-2"
                onClick={signOut}
                title="Sign out"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign out
              </Button>
            ) : (
              <div className="flex items-center space-x-3">
                <Link
                  to="/auth"
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 text-muted-foreground hover:text-foreground hover:bg-comfort"
                >
                  Sign in
                </Link>
                <Link to="/subscribe">
                  <Button size="sm" className="font-semibold">
                    Sign up
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
