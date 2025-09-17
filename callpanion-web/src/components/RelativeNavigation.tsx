import { BarChart3, MessageCircle, Calendar, Camera, Phone, Settings, LogOut, HelpCircle } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

const RelativeNavigation = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { signOut } = useAuth();

  const navItems = [
    { to: "/family", label: "Dashboard", icon: BarChart3 },
    { to: "/family/messages", label: "Messages", icon: MessageCircle },
    { to: "/family/calendar", label: "Calendar", icon: Calendar },
    { to: "/family/memories", label: "Memories", icon: Camera },
    { to: "/family/health", label: "Health", icon: BarChart3 },
  ];

  const handleLogout = async () => {
    await signOut();
    toast({
      title: "Logged Out",
      description: "You have been successfully logged out."
    });
    navigate('/family-login');
  };

  return (
    <nav className="bg-card border-b border-border shadow-gentle">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-2">
            <Link to="/family" className="flex items-center space-x-2">
              <span className="text-xl font-semibold text-foreground">Callpanion</span>
              <div className="text-xs text-muted-foreground">Family Dashboard</div>
            </Link>
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
                      : "text-muted-foreground hover:text-foreground hover:bg-comfort/30"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <Button variant="ghost" size="sm" className="w-10 h-10 p-0" asChild>
              <Link to="/family/help">
                <HelpCircle className="h-4 w-4" />
              </Link>
            </Button>
            <Button variant="ghost" size="sm" className="w-10 h-10 p-0">
              <Settings className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="w-10 h-10 p-0" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default RelativeNavigation;