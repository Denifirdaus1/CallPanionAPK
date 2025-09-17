import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Footer from "@/components/Footer";

export default function CookiePolicy() {
  useEffect(() => {
    document.title = "Cookie Policy | CallPanion";
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-foreground mb-2">Cookie Policy</h1>
          <p className="text-muted-foreground mb-8">Last updated: January 2025</p>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>What Are Cookies</CardTitle>
              </CardHeader>
              <CardContent>
                <p>Cookies are small text files stored on your device when you visit our website. They help us provide and improve our services while respecting your privacy choices.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Essential Cookies</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>These cookies are necessary for CallPanion to function. They cannot be disabled:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Authentication:</strong> Keep you logged in securely</li>
                  <li><strong>Security:</strong> Protect against unauthorised access</li>
                  <li><strong>Session Management:</strong> Maintain your preferences during visits</li>
                  <li><strong>Cookie Consent:</strong> Remember your cookie preferences</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Performance & Analytics Cookies</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>These help us understand how you use CallPanion so we can improve our services:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Usage Analytics:</strong> Which features are most helpful</li>
                  <li><strong>Error Tracking:</strong> Identify and fix technical issues</li>
                  <li><strong>Performance Monitoring:</strong> Ensure fast, reliable service</li>
                </ul>
                <p className="text-sm text-muted-foreground">We use Google Analytics with privacy-enhanced settings.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Third-Party Service Cookies</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>Our service partners may set cookies to deliver their services:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Mapbox:</strong> Location services and mapping functionality</li>
                  <li><strong>Stripe:</strong> Secure payment processing</li>
                  <li><strong>Supabase:</strong> Cloud hosting and authentication</li>
                </ul>
                <p>These cookies are subject to the respective privacy policies of these services.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Marketing Cookies</CardTitle>
              </CardHeader>
              <CardContent>
                <p>We currently don't use marketing or advertising cookies. If this changes, we'll update this policy and seek your consent.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Managing Your Cookie Preferences</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>You can control cookies through:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Cookie Banner:</strong> Choose preferences when you first visit</li>
                  <li><strong>Browser Settings:</strong> Block or delete cookies (may affect functionality)</li>
                  <li><strong>Opt-out Links:</strong> Disable specific analytics services</li>
                </ul>
                <p>Essential cookies cannot be disabled as they're required for basic functionality.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Cookie Lifespan</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Session Cookies:</strong> Deleted when you close your browser</li>
                  <li><strong>Persistent Cookies:</strong> Remain for a set period (typically 30 days to 2 years)</li>
                  <li><strong>Authentication Cookies:</strong> Remain until you log out or expire for security</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Legal Basis</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>We use cookies based on:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Essential Cookies:</strong> Necessary for service delivery (legitimate interest)</li>
                  <li><strong>Analytics Cookies:</strong> Your explicit consent via cookie banner</li>
                  <li><strong>Third-party Cookies:</strong> Your consent and our legitimate interest in service delivery</li>
                </ul>
                <p>This complies with UK GDPR and Privacy and Electronic Communications Regulations (PECR).</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Contact Us</CardTitle>
              </CardHeader>
              <CardContent>
                <p>Questions about our cookie practices? Contact us at: privacy@callpanion.co.uk</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}