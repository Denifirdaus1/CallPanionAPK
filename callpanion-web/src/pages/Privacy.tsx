import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Privacy() {
  useEffect(() => {
    console.log('[Privacy] Component mounted');
    document.title = "Privacy Policy | CallPanion";
  }, []);

  return (
    <main className="min-h-screen bg-gradient-to-br from-background to-comfort/20">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-4">Privacy Policy</h1>
          <p className="text-muted-foreground text-lg">
            Last updated: 18 August 2025 | Version: 2.0
          </p>
        </header>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Data Controller</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4">
                CallPanion is a trading name of <strong>Gail Cook Consulting</strong>, a sole trader based in Northern Ireland.
              </p>
              <div className="space-y-1">
                <p><strong>Registered Address:</strong> 10 Ballinderry Road, Aghalee, BT67 0DZ, Northern Ireland</p>
                <p><strong>Email:</strong> <a href="mailto:info@callpanion.co.uk" className="text-primary hover:underline">info@callpanion.co.uk</a></p>
                <p><strong>Privacy Contact:</strong> <a href="mailto:privacy@callpanion.co.uk" className="text-primary hover:underline">privacy@callpanion.co.uk</a></p>
              </div>
              <p className="mt-4">We are the "data controller" for the purposes of UK data protection law (UK GDPR and Data Protection Act 2018).</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>1. Information We Collect</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4">We collect the following categories of personal data:</p>
              
              <div className="mb-6">
                <h4 className="font-semibold mb-2">Account Information:</h4>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Full name and preferred name</li>
                  <li>Email address</li>
                  <li>Phone number</li>
                  <li>Login credentials (encrypted passwords)</li>
                  <li>Account preferences and settings</li>
                </ul>
              </div>

              <div className="mb-6">
                <h4 className="font-semibold mb-2">Location Information:</h4>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Town/village, county, country</li>
                  <li>Timezone settings</li>
                  <li>We do NOT collect or store full street addresses unless you explicitly provide them</li>
                </ul>
              </div>

              <div className="mb-6">
                <h4 className="font-semibold mb-2">Service Usage Data:</h4>
                <ul className="list-disc pl-6 space-y-1">
                  <li>AI wellbeing call logs and recordings</li>
                  <li>Call transcripts and analysis</li>
                  <li>Dashboard activity and interactions</li>
                  <li>Family message history</li>
                  <li>Photo uploads and captions</li>
                  <li>Calendar events and reminders</li>
                </ul>
              </div>

              <div className="mb-6">
                <h4 className="font-semibold mb-2">Emergency Contact Information:</h4>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Escalation contact names and email addresses</li>
                  <li>Family member contact details</li>
                </ul>
              </div>

              <div className="mb-6">
                <h4 className="font-semibold mb-2">Technical Data:</h4>
                <ul className="list-disc pl-6 space-y-1">
                  <li>IP address</li>
                  <li>Browser type and version</li>
                  <li>Device type and operating system</li>
                  <li>Usage analytics (via Google Analytics when consented)</li>
                  <li>Cookies and similar technologies</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>2. How We Use Your Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold">Service Delivery (Legal Basis: Contract Performance)</h4>
                  <ul className="list-disc pl-6 mt-2 space-y-1">
                    <li>Provide AI wellbeing calls and companion services</li>
                    <li>Enable family dashboard functionality</li>
                    <li>Process subscription payments</li>
                    <li>Send service-related communications</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold">Safety and Care (Legal Basis: Legitimate Interests)</h4>
                  <ul className="list-disc pl-6 mt-2 space-y-1">
                    <li>Detect health concerns or emergencies during calls</li>
                    <li>Alert designated family members when appropriate</li>
                    <li>Provide wellbeing insights to authorized family members</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold">Service Improvement (Legal Basis: Legitimate Interests)</h4>
                  <ul className="list-disc pl-6 mt-2 space-y-1">
                    <li>Analyze service usage to improve features</li>
                    <li>Develop better AI conversation capabilities</li>
                    <li>Enhance user experience</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold">Marketing (Legal Basis: Consent)</h4>
                  <ul className="list-disc pl-6 mt-2 space-y-1">
                    <li>Send promotional emails (with opt-out)</li>
                    <li>Provide relevant service updates</li>
                    <li>Website analytics via Google Analytics</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold">Legal Compliance (Legal Basis: Legal Obligation)</h4>
                  <ul className="list-disc pl-6 mt-2 space-y-1">
                    <li>Comply with data protection laws</li>
                    <li>Respond to regulatory enquiries</li>
                    <li>Maintain audit trails for security</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>3. Data Sharing and Processors</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4">We share your data with the following categories of recipients:</p>
              
              <div className="mb-6">
                <h4 className="font-semibold mb-2">Service Providers (Data Processors):</h4>
                <ul className="list-disc pl-6 space-y-1">
                  <li><strong>Supabase (Cloud Database):</strong> Stores account data, call logs, and service data</li>
                  <li><strong>Resend (Email Service):</strong> Sends service emails and invitations</li>
                  <li><strong>PayPal (Payment Processing):</strong> Processes subscription payments</li>
                  <li><strong>Google Analytics (Website Analytics):</strong> Tracks website usage (only with consent)</li>
                  <li><strong>ElevenLabs (AI Voice Services):</strong> Provides AI voice capabilities for calls</li>
                </ul>
              </div>

              <div className="mb-6">
                <h4 className="font-semibold mb-2">Authorized Family Members:</h4>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Household members you invite can see relevant wellbeing information</li>
                  <li>Access levels are controlled by your consent settings</li>
                  <li>Emergency contacts may be notified of urgent situations</li>
                </ul>
              </div>

              <div className="mb-6">
                <h4 className="font-semibold mb-2">Legal Requirements:</h4>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Law enforcement (only when legally required)</li>
                  <li>Regulatory authorities (ICO, trading standards)</li>
                  <li>Emergency services (in life-threatening situations)</li>
                </ul>
              </div>

              <p className="font-semibold text-destructive">We DO NOT sell your personal data to third parties.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>4. International Data Transfers</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4">Some of our service providers are located outside the UK/EU:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Supabase:</strong> Data stored in EU regions with adequate protection</li>
                <li><strong>PayPal:</strong> Transfers to USA under adequacy decisions and appropriate safeguards</li>
                <li><strong>Google Analytics:</strong> Transfers to USA with privacy safeguards when consented</li>
              </ul>
              <p className="mt-4">All international transfers are protected by appropriate safeguards including adequacy decisions, Standard Contractual Clauses (SCCs), or other approved mechanisms under UK data protection law.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>5. Data Retention</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <h4 className="font-semibold">Account Data:</h4>
                  <p>Retained while your account is active, then deleted within 30 days of account closure</p>
                </div>
                <div>
                  <h4 className="font-semibold">Call Records and Transcripts:</h4>
                  <p>Retained for 12 months for service improvement, then automatically deleted</p>
                </div>
                <div>
                  <h4 className="font-semibold">Relative Information:</h4>
                  <p>Deleted after 15 months of inactivity to respect elderly users' privacy</p>
                </div>
                <div>
                  <h4 className="font-semibold">Invitation Data:</h4>
                  <p>Deleted 6 months after acceptance or expiry</p>
                </div>
                <div>
                  <h4 className="font-semibold">Marketing Consents:</h4>
                  <p>Retained until withdrawn, then deleted within 30 days</p>
                </div>
                <div>
                  <h4 className="font-semibold">Legal/Financial Records:</h4>
                  <p>Retained for 7 years as required by UK law</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>6. Your Rights Under UK Data Protection Law</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4">You have the following rights regarding your personal data:</p>
              <div className="space-y-3">
                <div>
                  <h4 className="font-semibold">Right of Access:</h4>
                  <p>Request a copy of all personal data we hold about you</p>
                </div>
                <div>
                  <h4 className="font-semibold">Right to Rectification:</h4>
                  <p>Correct any inaccurate or incomplete personal data</p>
                </div>
                <div>
                  <h4 className="font-semibold">Right to Erasure ("Right to be Forgotten"):</h4>
                  <p>Request deletion of your personal data in certain circumstances</p>
                </div>
                <div>
                  <h4 className="font-semibold">Right to Restrict Processing:</h4>
                  <p>Limit how we use your data in certain situations</p>
                </div>
                <div>
                  <h4 className="font-semibold">Right to Data Portability:</h4>
                  <p>Receive your data in a machine-readable format or transfer it to another provider</p>
                </div>
                <div>
                  <h4 className="font-semibold">Right to Object:</h4>
                  <p>Object to processing based on legitimate interests or for marketing purposes</p>
                </div>
                <div>
                  <h4 className="font-semibold">Right to Withdraw Consent:</h4>
                  <p>Withdraw consent at any time where processing is based on consent</p>
                </div>
              </div>
              <p className="mt-4">To exercise any of these rights, contact us at <a href="mailto:privacy@callpanion.co.uk" className="text-primary hover:underline">privacy@callpanion.co.uk</a>. We will respond within 30 days.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>7. Cookies and Tracking</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4">We use cookies and similar technologies. For full details, see our <a href="/cookies" className="text-primary hover:underline">Cookie Policy</a>.</p>
              <p>You can manage your cookie preferences through our cookie consent banner or browser settings.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>8. Data Security</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4">We implement appropriate technical and organizational measures to protect your data:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>End-to-end encryption for sensitive data</li>
                <li>Secure cloud hosting with ISO 27001 certified providers</li>
                <li>Regular security assessments and monitoring</li>
                <li>Staff training on data protection</li>
                <li>Incident response procedures</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>9. Complaints and Regulatory Contact</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4">If you have concerns about how we handle your personal data:</p>
              <ol className="list-decimal pl-6 space-y-2">
                <li>Contact us first at <a href="mailto:privacy@callpanion.co.uk" className="text-primary hover:underline">privacy@callpanion.co.uk</a> - we aim to resolve issues quickly</li>
                <li>If unsatisfied, you can complain to the UK Information Commissioner's Office (ICO):
                  <ul className="list-disc pl-6 mt-2">
                    <li>Website: <a href="https://ico.org.uk" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">ico.org.uk</a></li>
                    <li>Phone: 0303 123 1113</li>
                    <li>Post: Information Commissioner's Office, Wycliffe House, Water Lane, Wilmslow, Cheshire, SK9 5AF</li>
                  </ul>
                </li>
              </ol>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>10. Changes to This Policy</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4">We may update this privacy policy to reflect changes in our practices or legal requirements.</p>
              <p>Significant changes will be communicated by:</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>Email notification to active users</li>
                <li>Prominent notice on our website</li>
                <li>Updated version date at the top of this policy</li>
              </ul>
              <p className="mt-4">Your continued use of our services after notification constitutes acceptance of the updated policy.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}