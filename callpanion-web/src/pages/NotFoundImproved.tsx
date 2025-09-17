import { useEffect } from "react";
import { useLocation, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Home, ArrowLeft, Phone, Mail } from "lucide-react";

const NotFoundImproved = () => {
  const location = useLocation();

  useEffect(() => {
    document.title = "Page Not Found | CallPanion";
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-gradient-warmth flex items-center justify-center p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="mx-auto w-24 h-24 bg-brand-accent/10 rounded-full flex items-center justify-center mb-4">
            <span className="text-4xl font-bold text-brand-accent">404</span>
          </div>
          <CardTitle className="text-2xl text-foreground">Page Not Found</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-muted-foreground">
            We couldn't find the page you're looking for. It may have been moved or doesn't exist.
          </p>
          
          <div className="space-y-3">
            <Button asChild className="w-full bg-brand-accent hover:bg-brand-accent/90">
              <Link to="/">
                <Home className="h-4 w-4 mr-2" />
                Return Home
              </Link>
            </Button>
            
            <Button variant="outline" onClick={() => window.history.back()} className="w-full">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go Back
            </Button>
          </div>

          <div className="pt-4 border-t space-y-2">
            <p className="text-sm text-muted-foreground">Need help?</p>
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
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default NotFoundImproved;