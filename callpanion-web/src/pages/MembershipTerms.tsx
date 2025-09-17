import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const MembershipTerms = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Link to="/subscribe">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Subscription
            </Button>
          </Link>
        </div>

        <Card className="max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-center">
              CallPanion Membership Terms and Conditions
            </CardTitle>
            <p className="text-center text-muted-foreground">
              Version 1.0 | Effective Date: 17 August 2025
            </p>
          </CardHeader>

          <CardContent className="space-y-6">
            <section>
              <h2 className="text-xl font-semibold mb-3">1. Membership Overview</h2>
              <p className="mb-2">
                CallPanion Membership provides AI companion calling services and family coordination tools.
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Monthly subscription fee: £15.00</li>
                <li>Includes up to 4 family member accounts</li>
                <li>Includes 1 elderly person account</li>
                <li>7-day free trial for new subscribers</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">2. Free Trial</h2>
              <p>
                New subscribers receive a 7-day free trial with full access to all features. After the trial period, 
                your chosen payment method will be charged £15.00 monthly unless you cancel before the trial ends.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">3. Billing and Payment</h2>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Subscription fees are billed monthly in advance</li>
                <li>Payments are processed securely through PayPal</li>
                <li>All prices include applicable taxes</li>
                <li>Failed payments may result in service suspension</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">4. Account Limits</h2>
              <p className="mb-2">
                Your £15 monthly subscription includes:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Up to 4 family member accounts with dashboard access</li>
                <li>1 elderly person account with companion calling services</li>
                <li>Additional accounts may be available for an extra fee (contact support)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">5. Cancellation</h2>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>You may cancel your subscription at any time</li>
                <li>Cancellation can be done through your PayPal account or by contacting support</li>
                <li>No cancellation fees apply</li>
                <li>Service continues until the end of your current billing period</li>
                <li>No refunds for partial months</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">6. Fair Use Policy</h2>
              <p>
                Our AI companion calling service is designed for reasonable personal use. Excessive usage that 
                impacts service quality for other users may result in service limitations.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">7. Service Availability</h2>
              <p>
                While we strive for continuous service availability, we cannot guarantee 100% uptime. 
                Scheduled maintenance will be communicated in advance when possible.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">8. Health and Medical Disclaimer</h2>
              <p>
                CallPanion is not a medical service and should not replace professional medical care. 
                Our AI companion is for social interaction and basic wellness support only. 
                Always consult healthcare professionals for medical concerns.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">9. Privacy and Data</h2>
              <p>
                Your privacy is important to us. Please review our Privacy Policy for details on how we 
                collect, use, and protect your personal information. By subscribing, you consent to our 
                data practices as outlined in our Privacy Policy.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">10. Eligibility</h2>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>You must be at least 18 years old to subscribe</li>
                <li>You must provide accurate billing information</li>
                <li>One subscription per household</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">11. Service Modifications</h2>
              <p>
                We reserve the right to modify or discontinue features with reasonable notice. 
                Significant changes to pricing will be communicated at least 30 days in advance.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">12. Termination</h2>
              <p>
                We may terminate accounts for violation of these terms, illegal activity, or abuse of our services. 
                Upon termination, access to all account data will be removed.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">13. Limitation of Liability</h2>
              <p>
                Our liability is limited to the amount of subscription fees paid in the 12 months prior to any claim. 
                We are not liable for indirect, consequential, or punitive damages.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">14. Auto-Renewal and Cancellation Rights</h2>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                <p className="font-semibold text-yellow-800 mb-2">⚠️ Important Auto-Renewal Notice:</p>
                <p className="text-yellow-700">
                  Your subscription will automatically renew each month and charge your payment method £15.00 
                  unless you cancel before your next billing date. You can cancel anytime through PayPal or by contacting support.
                </p>
              </div>
              <p><strong>Your Cancellation Rights:</strong></p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Cancel anytime without penalty</li>
                <li>14-day cooling-off period for UK consumers</li>
                <li>Service continues until end of billing period after cancellation</li>
                <li>No refunds for partial months of service already provided</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">15. Governing Law</h2>
              <p>
                These terms are governed by the laws of Northern Ireland and England & Wales. 
                UK consumer protection laws apply. Any disputes will be resolved in UK courts.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">16. Contact Information</h2>
              <p className="mb-2">
                <strong>Service Provider:</strong> Gail Cook Consulting (trading as CallPanion)<br/>
                <strong>Address:</strong> 10 Ballinderry Road, Aghalee, BT67 0DZ, Northern Ireland
              </p>
              <p>For questions about these terms or your subscription:</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Email: <a href="mailto:support@callpanion.co.uk" className="text-primary hover:underline">support@callpanion.co.uk</a></li>
                <li>Privacy: <a href="mailto:privacy@callpanion.co.uk" className="text-primary hover:underline">privacy@callpanion.co.uk</a></li>
                <li>Website: www.callpanion.co.uk</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">17. Changes to Terms</h2>
              <p>
                We may update these terms periodically. Significant changes will be communicated via email 
                and will take effect 30 days after notification. Continued use of the service constitutes 
                acceptance of updated terms.
              </p>
            </section>

            <div className="mt-8 p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">
                By subscribing to CallPanion Membership, you acknowledge that you have read, understood, 
                and agree to be bound by these Terms and Conditions.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MembershipTerms;