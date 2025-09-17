import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Home, RefreshCw, Phone, Mail, AlertTriangle } from "lucide-react";

const ServerError = () => {
  useEffect(() => {
    document.title = "Server Error | CallPanion";
  }, []);

  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-gradient-warmth flex items-center justify-center p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="mx-auto w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle className="h-12 w-12 text-red-600" />
          </div>
          <CardTitle className="text-2xl text-foreground">Server Error</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <p className="text-muted-foreground mb-2">
              Something went wrong on our end. We're working to fix this issue.
            </p>
            <p className="text-sm text-muted-foreground">
              Error code: 500
            </p>
          </div>
          
          <div className="space-y-3">
            <Button onClick={handleRefresh} className="w-full bg-brand-accent hover:bg-brand-accent/90">
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
            
            <Button variant="outline" asChild className="w-full">
              <Link to="/">
                <Home className="h-4 w-4 mr-2" />
                Return Home
              </Link>
            </Button>
          </div>

          <div className="pt-4 border-t space-y-2">
            <p className="text-sm text-muted-foreground">Still having trouble?</p>
            <div className="flex justify-center space-x-4">
              <Button variant="ghost" size="sm" asChild>
                <a href="mailto:support@callpanion.co.uk">
                  <Mail className="h-4 w-4 mr-2" />
                  Email Support
                </a>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <a href="tel:+442890000000">
                  <Phone className="h-4 w-4 mr-2" />
                  Call Us
                </a>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Our support team is available Monday-Friday, 9 AM - 5 PM GMT
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ServerError;