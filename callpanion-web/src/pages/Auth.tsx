import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const Auth = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("signin");
  
  const { signUp, signIn, user } = useAuth();
  const navigate = useNavigate();

  // Redirect if already authenticated
  useEffect(() => {
    if (user) {
      // User is already authenticated, let AuthContext handle the redirect
      return;
    }
  }, [user]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please fill in all fields");
      return;
    }

    setIsLoading(true);
    setError("");
    
    const { error } = await signIn(email.trim().toLowerCase(), password);
    
    if (error) {
      if (error.message.includes('CSP') || error.message.includes('blocked')) {
        setError("Please refresh the page if you see security warnings.");
      } else {
        setError(error.message);
      }
    }
    // Don't navigate here - let AuthContext handle the redirect
    
    setIsLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = email.trim().toLowerCase();

    if (!normalized || !password || !confirmPassword) {
      setError("Please fill in all fields");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setIsLoading(true);
    setError("");
    setSuccess("");

    try {
      // 1) Pre-check via Edge Function (pakai invoke biar header Authorization/apikey otomatis)
      console.log('Checking email availability...', normalized);
      const { data: info, error: fnError } = await supabase.functions.invoke('check-email-exists', {
        body: { email: normalized },
      });

      console.log('Edge function response:', { info, fnError });

      if (fnError) {
        console.error('Edge function error:', fnError);
        // fallback: tampilkan pesan detail bila ada, lalu stop
        setError(`Signup check failed: ${fnError.message}`);
        setIsLoading(false);
        return;
      }

      if (!info?.ok) {
        const reason = info?.reason || "unknown_error";
        const msg = info?.message || (
          reason === "missing_secrets"
            ? "Server is misconfigured. Please try again later."
            : "Unable to verify your email right now."
        );
        setError(`Signup check failed: ${msg}`);
        setIsLoading(false);
        return;
      }

      if (info.exists === true) {
        if (info.confirmed) {
          setError("Email is already registered. Please sign in.");
          setActiveTab("signin");
        } else {
          const redirectUrl = `${window.location.origin}/auth/callback`;
          const { error: resendErr } = await supabase.auth.resend({
            type: "signup",
            email: normalized,
            options: { emailRedirectTo: redirectUrl },
          });
          if (resendErr) setError(resendErr.message || "Failed to resend confirmation email.");
          else setSuccess("You already signed up but not confirmed. We've re-sent the confirmation link to your email.");
        }
        setIsLoading(false);
        return;
      }

      // else: not exists → lanjut signup normal
      const { error } = await signUp(normalized, password);
      if (error) {
        const msg = error.message?.toLowerCase() || "";
        if (msg.includes("already registered") || msg.includes("user already registered")) {
          setError("An account with this email already exists. Please sign in.");
          setActiveTab("signin");
        } else if (msg.includes("rate")) {
          setError("Too many attempts. Please try again in a moment.");
        } else {
          setError(error.message);
        }
      } else {
        setSuccess("Check your email for the confirmation link!");
      }
    } catch (err: any) {
      setError(err?.message || "Sign up failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-warmth/10 via-background to-comfort/20 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-4">
          <div className="text-center">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              CallPanion
            </h1>
          </div>
          <p className="text-muted-foreground">Connect with your loved ones</p>
        </div>

        <Card className="shadow-warm border-0">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-semibold text-center">
              Welcome
            </CardTitle>
            <CardDescription className="text-center">
              Sign in to your account or create a new one
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>
              
              <TabsContent value="signin" className="space-y-4">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">Email</Label>
                    <Input
                      id="signin-email"
                      type="email"
                      placeholder="Enter your email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signin-password">Password</Label>
                    <Input
                      id="signin-password"
                      type="password"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full"
                    disabled={isLoading}
                  >
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Sign In
                  </Button>
                </form>
              </TabsContent>
              
              <TabsContent value="signup" className="space-y-4">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="Enter your email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder="Create a password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirm Password</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      placeholder="Confirm your password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full"
                    disabled={isLoading}
                  >
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create Account
                  </Button>
                </form>
              </TabsContent>
            </Tabs>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {success && (
              <Alert>
                <AlertDescription className="text-green-600">{success}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;