import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Footer from "@/components/Footer";

export default function TermsOfUse() {
  useEffect(() => {
    document.title = "Terms of Use | CallPanion";
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-foreground mb-2">Terms of Use</h1>
          <p className="text-muted-foreground mb-8">Last updated: January 2025</p>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>1. Service Provider</CardTitle>
              </CardHeader>
              <CardContent>
                <p>These terms govern your use of CallPanion services provided by CallPanion Ltd, a company registered in Northern Ireland.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>2. Service Description</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>CallPanion provides:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>AI-powered voice companion calls for elderly users</li>
                  <li>Family monitoring and communication tools</li>
                  <li>Health and wellness check-ins</li>
                  <li>Emergency alert capabilities</li>
                  <li>Medication reminders and scheduling</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>3. Eligibility and Account Security</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>You must be 18 or older to create an account. You're responsible for:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Maintaining the security of your account credentials</li>
                  <li>All activities under your account</li>
                  <li>Promptly notifying us of unauthorised use</li>
                  <li>Providing accurate registration information</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>4. Acceptable Use</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>You agree not to:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Use the service for illegal purposes or to harm others</li>
                  <li>Attempt to circumvent security measures</li>
                  <li>Share accounts or login credentials</li>
                  <li>Interfere with service operation or other users</li>
                  <li>Use automated systems to access the service without permission</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>5. Subscription and Fees</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>CallPanion is offered on a subscription basis. Fees are charged in British Pounds (£):</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Monthly subscriptions renew automatically</li>
                  <li>Fees are non-refundable except as required by law</li>
                  <li>We may change prices with 30 days notice</li>
                  <li>You can cancel anytime; service continues until period end</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>6. Content Ownership</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>You retain ownership of content you provide. By using CallPanion, you grant us licence to:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Process voice recordings to provide services</li>
                  <li>Analyse data to improve our AI systems</li>
                  <li>Share permitted information with designated family members</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>7. Service Availability</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>We strive for high availability but cannot guarantee uninterrupted service. We may:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Perform maintenance with reasonable notice</li>
                  <li>Suspend service for security or legal reasons</li>
                  <li>Modify features to improve functionality</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>8. Suspension and Termination</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>We may suspend or terminate accounts for:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Violation of these terms</li>
                  <li>Non-payment of fees</li>
                  <li>Illegal activity</li>
                  <li>Risk to service security or other users</li>
                </ul>
                <p>You may terminate your account at any time through account settings.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>9. Disclaimers and Limitations</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="font-semibold">CallPanion is not a medical device and does not provide medical diagnosis or emergency services.</p>
                <p>Our liability is limited to the maximum extent permitted by law. We're not liable for:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Indirect, incidental, or consequential damages</li>
                  <li>Data loss or corruption</li>
                  <li>Third-party service interruptions</li>
                  <li>Damages exceeding 12 months of subscription fees</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>10. Consumer Rights</CardTitle>
              </CardHeader>
              <CardContent>
                <p>These terms don't affect your statutory rights as a consumer under UK law, including rights under the Consumer Rights Act 2015.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>11. Governing Law and Disputes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>These terms are governed by Northern Ireland law. Any disputes will be resolved in Northern Ireland courts.</p>
                <p>We encourage contacting our support team first to resolve issues informally.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>12. Changes to Terms</CardTitle>
              </CardHeader>
              <CardContent>
                <p>We may update these terms. Continued use after changes constitutes acceptance. We'll notify users of material changes.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}