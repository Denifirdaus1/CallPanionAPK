import { useState } from "react";
import { Lock, User, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Login disabled - this page is deprecated. Redirect to Auth
    setTimeout(() => {
      toast({
        title: "Login disabled",
        description: "Please use the Sign In page.",
        variant: "destructive"
      });
      setIsLoading(false);
      navigate('/auth');
    }, 300);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-warmth/10 via-background to-comfort/20 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-foreground">Callpanion</h1>
          </div>
          <p className="text-muted-foreground">Family Care Dashboard Login</p>
        </div>

        {/* Login Card */}
        <Card className="shadow-warm border-0">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-semibold text-center">Welcome Back</CardTitle>
            <CardDescription className="text-center">
              Sign in to manage your loved one's care and connection
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your.email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-12 pr-12"
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-12 w-12"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-12 text-lg font-medium"
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Signing in...</span>
                  </div>
                ) : (
                  <>
                    <Lock className="h-5 w-5 mr-2" />
                    Sign In
                  </>
                )}
              </Button>
            </form>

            <div className="text-center space-y-2">
              <Button variant="link" className="text-sm">
                Forgot your password?
              </Button>
              <div className="text-sm text-muted-foreground">
                Don't have an account?{" "}
                <Button variant="link" className="text-primary p-0">
                  Contact us to get started
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Access */}
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="text-lg text-center">Quick Access</CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              className="w-full h-12"
              onClick={() => navigate('/elderly')}
            >
              <User className="h-5 w-5 mr-2" />
              Go to Elderly Interface
            </Button>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-sm text-muted-foreground">
          <p>Keeping families connected with love and care</p>
        </div>
      </div>
    </div>
  );
};

export default Login;