import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Footer from "@/components/Footer";

export default function PrivacyPolicy() {
  useEffect(() => {
    document.title = "Privacy Policy | CallPanion";
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-foreground mb-2">Privacy Policy</h1>
          <p className="text-muted-foreground mb-8">Last updated: January 2025</p>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>1. Who We Are</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>CallPanion is operated by CallPanion Ltd. We are committed to protecting your privacy in accordance with UK GDPR and the Data Protection Act 2018.</p>
                <p><strong>Data Controller:</strong> CallPanion Ltd</p>
                <p><strong>Contact:</strong> privacy@callpanion.co.uk</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>2. Information We Collect</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>We collect information necessary to provide our voice companion and family care services:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Account Information:</strong> Name, email address, phone number</li>
                  <li><strong>Voice Data:</strong> Call recordings and transcripts for service delivery</li>
                  <li><strong>Health & Wellness Data:</strong> Mood assessments, check-in responses (with your consent)</li>
                  <li><strong>Usage Data:</strong> Device information, call logs, app usage patterns</li>
                  <li><strong>Payment Information:</strong> Billing details processed by Stripe</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>3. Lawful Basis for Processing</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>We process your data on the following legal bases:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Contract:</strong> To provide CallPanion services you've subscribed to</li>
                  <li><strong>Consent:</strong> For voice recordings, health data, and marketing communications</li>
                  <li><strong>Legitimate Interests:</strong> Service improvement, security, and customer support</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>4. How We Use Your Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="list-disc pl-6 space-y-2">
                  <li>Providing voice companion calls and emergency response</li>
                  <li>Enabling family members to check on elderly relatives (with permissions)</li>
                  <li>Processing payments and managing subscriptions</li>
                  <li>Improving our AI and voice services</li>
                  <li>Sending service updates and support communications</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>5. Data Sharing</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>We share data only as necessary:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Family Members:</strong> Health and activity updates (with your consent and configured permissions)</li>
                  <li><strong>Service Providers:</strong> ElevenLabs (voice services), Stripe (payments), Supabase (hosting), Mapbox (location services)</li>
                  <li><strong>Emergency Services:</strong> Only when you explicitly request emergency assistance</li>
                  <li><strong>Legal Requirements:</strong> When required by law or to protect safety</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>6. International Transfers</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>Some of our service providers are based outside the UK/EU. We ensure adequate protection through:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Adequacy decisions by the UK Information Commissioner's Office</li>
                  <li>Standard Contractual Clauses with appropriate safeguards</li>
                  <li>Certification schemes and codes of conduct</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>7. Data Retention</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Account Data:</strong> Retained while your account is active, then 12 months after closure</li>
                  <li><strong>Voice Recordings:</strong> 90 days unless you request deletion</li>
                  <li><strong>Health Data:</strong> 3 years or until consent is withdrawn</li>
                  <li><strong>Payment Data:</strong> 7 years for tax and accounting purposes</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>8. Your Rights</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>Under UK GDPR, you have the right to:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Access:</strong> Request a copy of your personal data</li>
                  <li><strong>Rectification:</strong> Correct inaccurate data</li>
                  <li><strong>Erasure:</strong> Request deletion of your data</li>
                  <li><strong>Portability:</strong> Receive your data in a machine-readable format</li>
                  <li><strong>Restrict Processing:</strong> Limit how we use your data</li>
                  <li><strong>Object:</strong> Opt out of processing based on legitimate interests</li>
                  <li><strong>Withdraw Consent:</strong> For consent-based processing</li>
                </ul>
                <p>To exercise these rights, contact: privacy@callpanion.co.uk</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>9. Complaints</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>If you're not satisfied with how we handle your data, you can complain to:</p>
                <p><strong>Information Commissioner's Office (ICO)</strong><br />
                Website: <a href="https://ico.org.uk" className="text-brand-accent hover:underline">ico.org.uk</a><br />
                Phone: 0303 123 1113</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>10. Changes to This Policy</CardTitle>
              </CardHeader>
              <CardContent>
                <p>We may update this policy periodically. We'll notify you of significant changes via email or app notification.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}