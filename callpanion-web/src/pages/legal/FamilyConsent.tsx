import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Footer from "@/components/Footer";
import { Shield, Users, Eye, Settings } from "lucide-react";

export default function FamilyConsent() {
  useEffect(() => {
    document.title = "Family Access & Consent Agreement | CallPanion";
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-foreground mb-2">Family Access & Consent Agreement</h1>
          <p className="text-muted-foreground mb-8">Understanding permissions and consent for family access to elderly relative information</p>

          <div className="space-y-6">
            <Card className="border-blue-200 bg-blue-50">
              <CardHeader className="flex flex-row items-center space-y-0 pb-2">
                <Shield className="h-6 w-6 text-blue-600 mr-2" />
                <CardTitle className="text-blue-900">Privacy & Consent</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <p className="text-blue-800">All access to personal information requires explicit consent from the elderly user or their authorised representative. Family members only see information that has been specifically permitted.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Users className="h-5 w-5 mr-2" />
                  How Family Access Works
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>CallPanion enables families to stay connected while respecting privacy:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Invitation-Based:</strong> Elderly users or primary family members invite specific family members</li>
                  <li><strong>Role-Based Permissions:</strong> Different family members can have different access levels</li>
                  <li><strong>Granular Control:</strong> Permission can be granted for specific types of information</li>
                  <li><strong>Revocable:</strong> Consent can be withdrawn at any time</li>
                  <li><strong>Transparent:</strong> All family members know who has access to what information</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Eye className="h-5 w-5 mr-2" />
                  Types of Access Permissions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h4 className="font-semibold mb-2">Basic Information (Always Shared)</h4>
                  <ul className="list-disc pl-6 space-y-1 text-sm">
                    <li>General activity status (last seen)</li>
                    <li>Family messages and communications</li>
                    <li>Scheduled events and reminders</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Health & Wellness Summary (Requires Consent)</h4>
                  <ul className="list-disc pl-6 space-y-1 text-sm">
                    <li>Mood and wellbeing check-in summaries</li>
                    <li>Call frequency and engagement patterns</li>
                    <li>Medication reminder completion status</li>
                    <li>General wellness trends</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Detailed Health Data (Requires Explicit Consent)</h4>
                  <ul className="list-disc pl-6 space-y-1 text-sm">
                    <li>Detailed call transcripts and recordings</li>
                    <li>Specific health concerns mentioned</li>
                    <li>Detailed mood assessments</li>
                    <li>Emergency alert details</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Administrative Control (Primary Family Member Only)</h4>
                  <ul className="list-disc pl-6 space-y-1 text-sm">
                    <li>Manage other family member permissions</li>
                    <li>Billing and subscription management</li>
                    <li>Device setup and configuration</li>
                    <li>Account settings and preferences</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Consent Requirements</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>Valid consent for family access must be:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Informed:</strong> The elderly user understands what information will be shared</li>
                  <li><strong>Specific:</strong> Consent is given for particular types of data and specific family members</li>
                  <li><strong>Freely Given:</strong> No pressure or coercion is involved</li>
                  <li><strong>Recorded:</strong> Consent decisions are logged with timestamps</li>
                  <li><strong>Revocable:</strong> Can be withdrawn at any time through settings or support</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Setting Up Family Access</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold">Step 1: Primary Account Setup</h4>
                    <p className="text-sm text-muted-foreground">The elderly user or their representative creates a CallPanion account and completes initial consent forms.</p>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold">Step 2: Family Member Invitations</h4>
                    <p className="text-sm text-muted-foreground">Specific family members are invited by email with defined roles and permissions.</p>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold">Step 3: Permission Configuration</h4>
                    <p className="text-sm text-muted-foreground">Each family member's access level is configured based on consent preferences.</p>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold">Step 4: Ongoing Management</h4>
                    <p className="text-sm text-muted-foreground">Permissions can be reviewed and modified at any time through account settings.</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Settings className="h-5 w-5 mr-2" />
                  Managing Permissions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>Permissions can be managed through:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Account Settings:</strong> Online dashboard for reviewing and changing permissions</li>
                  <li><strong>Voice Commands:</strong> Simple voice requests during calls (for basic changes)</li>
                  <li><strong>Family Member Requests:</strong> Family can request additional access (requires approval)</li>
                  <li><strong>Support Assistance:</strong> Our support team can help with permission changes</li>
                  <li><strong>Emergency Override:</strong> Limited emergency access procedures for crisis situations</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Revoking Consent</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>Consent can be withdrawn:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Immediately:</strong> Changes take effect within 24 hours</li>
                  <li><strong>Partially:</strong> Revoke access for specific family members or data types</li>
                  <li><strong>Completely:</strong> Remove all family access while maintaining the service</li>
                  <li><strong>Temporarily:</strong> Pause family access for a specific period</li>
                </ul>
                
                <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-amber-800 text-sm">
                    <strong>Contact Methods for Consent Changes:</strong><br />
                    • Email: consent@callpanion.co.uk<br />
                    • Phone: +44 (0) 28 9000 0000<br />
                    • Account settings: Online dashboard<br />
                    • Voice request: During regular calls
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Family Member Responsibilities</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>Family members with access agree to:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Respect the privacy and dignity of their elderly relative</li>
                  <li>Use shared information only for appropriate care and support</li>
                  <li>Not share access credentials with others</li>
                  <li>Report concerns appropriately (medical issues to healthcare providers)</li>
                  <li>Respect any requests to limit or revoke their access</li>
                  <li>Maintain confidentiality of personal information</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Legal Framework</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>This consent framework operates under:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>UK GDPR:</strong> Lawful processing of personal data with explicit consent</li>
                  <li><strong>Data Protection Act 2018:</strong> UK implementation of data protection rights</li>
                  <li><strong>Mental Capacity Act 2005:</strong> Considerations for those who may lack capacity</li>
                  <li><strong>Care Act 2014:</strong> Adult social care and family involvement principles</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Questions or Concerns</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>For questions about family access, consent, or privacy:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Email:</strong> consent@callpanion.co.uk</li>
                  <li><strong>Phone:</strong> +44 (0) 28 9000 0000</li>
                  <li><strong>Post:</strong> CallPanion Ltd, Family Consent Team, Belfast, Northern Ireland</li>
                </ul>
                <p className="text-sm text-muted-foreground mt-4">
                  This agreement is part of our Terms of Use and Privacy Policy. All provisions are governed by Northern Ireland law.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}