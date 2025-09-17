import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Footer from "@/components/Footer";

export default function Terms() {
  useEffect(() => {
    document.title = "Terms of Use | CallPanion";
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-comfort/20 flex flex-col">
      <div className="max-w-4xl mx-auto px-4 py-8 flex-1">
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-4">Terms of Use</h1>
          <p className="text-muted-foreground text-lg">
            Last updated: 14 August 2025 | Version: 1.0
          </p>
        </header>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Service Provider</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4">
                CallPanion is a trading name of <strong>Gail Cook Consulting</strong>, a sole trader based in Northern Ireland.
              </p>
              <div className="space-y-1">
                <p><strong>Registered Address:</strong> 10 Ballinderry Road, Aghalee, BT67 0DZ, Northern Ireland</p>
                <p><strong>Email:</strong> <a href="mailto:callpanion@gmail.com" className="text-primary hover:underline">callpanion@gmail.com</a></p>
                <p><strong>Support:</strong> <a href="mailto:support@callpanion.co.uk" className="text-primary hover:underline">support@callpanion.co.uk</a></p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>1. Agreement</CardTitle>
            </CardHeader>
            <CardContent>
              <p>By using CallPanion you agree to these Terms of Use. If you do not agree, do not use the service.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>2. Eligibility</CardTitle>
            </CardHeader>
            <CardContent>
              <p>Household account holders must be aged 18 or over.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>3. Service description</CardTitle>
            </CardHeader>
            <CardContent>
              <p>CallPanion provides AI wellbeing calls, a family dashboard, and invite features. Not a medical or emergency service.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>4. Acceptable use</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc pl-6 space-y-1">
                <li>No illegal activity or harassment.</li>
                <li>No uploading unlawful or infringing content.</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>5. Content ownership</CardTitle>
            </CardHeader>
            <CardContent>
              <p>You own your uploads but grant us a limited licence to store/display to household members.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>6. Suspension/termination</CardTitle>
            </CardHeader>
            <CardContent>
              <p>We may suspend or terminate accounts for misuse or breach.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>7. Liability and Disclaimers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <p><strong>Service Disclaimer:</strong> CallPanion is provided "as is" without warranties of any kind.</p>
                <p><strong>Medical Disclaimer:</strong> CallPanion is not a medical service. Always consult healthcare professionals for medical concerns.</p>
                <p><strong>Liability Limitation:</strong> Our liability is limited to the amount paid in the 12 months prior to any claim, except for death, personal injury, fraud, or statutory duties that cannot be excluded.</p>
                <p><strong>Indemnity:</strong> You agree to indemnify us against claims arising from your misuse of the service.</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>8. Data Protection and Privacy</CardTitle>
            </CardHeader>
            <CardContent>
              <p>Your privacy rights are governed by our Privacy Policy. By using our service, you consent to our data practices as outlined there.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>9. Consumer Rights</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-2">Under UK consumer protection law, you have certain rights:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Right to cancel within 14 days (cooling-off period)</li>
                <li>Right to receive services as described</li>
                <li>Right to compensation for defective services</li>
                <li>Right to complain to Trading Standards if needed</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>10. Changes to Terms</CardTitle>
            </CardHeader>
            <CardContent>
              <p>We may update these terms periodically. Significant changes will be communicated via email at least 30 days in advance. Continued use constitutes acceptance.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>11. Governing Law and Disputes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-2">These terms are governed by the laws of Northern Ireland and England & Wales.</p>
              <p>For consumer disputes, you may use alternative dispute resolution services or contact Trading Standards before court proceedings.</p>
            </CardContent>
          </Card>
        </div>
      </div>
      <Footer />
    </div>
  );
}