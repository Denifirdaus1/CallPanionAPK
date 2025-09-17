import { ArrowLeft, Phone, MessageCircle, Calendar, Camera, BarChart3, Users, Settings, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import RelativeNavigation from "@/components/RelativeNavigation";

export default function FamilyHelp() {
  return (
    <div className="min-h-screen bg-background">
      <RelativeNavigation />
      
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="outline" size="sm" asChild>
            <Link to="/family/getting-started">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Getting Started
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Family Member Guide</h1>
            <p className="text-muted-foreground">Complete instructions for using Callpanion</p>
          </div>
        </div>

        {/* Getting Started Section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Getting Started
            </CardTitle>
            <CardDescription>Essential first steps for family administrators</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <h4 className="font-semibold text-foreground">1. Become Family Administrator</h4>
              <p className="text-sm text-muted-foreground">
                Click "Become Administrator" on the Getting Started page to set up your family account and gain full access to all features.
              </p>
              
              <h4 className="font-semibold text-foreground">2. Add Your Elderly Relative</h4>
              <p className="text-sm text-muted-foreground">
                Navigate to "Family Members" and click "Invite New Member" to add your elderly relative. They'll receive setup instructions via email.
              </p>
              
              <h4 className="font-semibold text-foreground">3. Set Up Device Pairing</h4>
              <p className="text-sm text-muted-foreground">
                Help your elderly relative pair their device using the pairing instructions. This enables daily check-in calls and health monitoring.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Daily Use Section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              Daily Use Features
            </CardTitle>
            <CardDescription>How to use Callpanion's main features</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <MessageCircle className="h-4 w-4 text-primary" />
                  <h4 className="font-semibold">Family Messages</h4>
                </div>
                <p className="text-sm text-muted-foreground">
                  Send messages to your elderly relative that will be read aloud during their daily calls. Perfect for sharing daily updates, reminders, or words of encouragement.
                </p>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" />
                  <h4 className="font-semibold">Event Planning</h4>
                </div>
                <p className="text-sm text-muted-foreground">
                  Schedule family events, appointments, and reminders. Your elderly relative will be notified about upcoming events during their calls.
                </p>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Camera className="h-4 w-4 text-primary" />
                  <h4 className="font-semibold">Family Memories</h4>
                </div>
                <p className="text-sm text-muted-foreground">
                  Upload and share family photos. Your elderly relative can view these on their device and they'll be mentioned during daily calls.
                </p>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  <h4 className="font-semibold">Health Insights</h4>
                  <Badge variant="secondary" className="ml-2">Premium</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Monitor your elderly relative's wellbeing through AI analysis of their daily conversations. Receive alerts about potential health concerns.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Family Management Section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Family Management
            </CardTitle>
            <CardDescription>Managing family members and permissions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <h4 className="font-semibold text-foreground">Adding Family Members</h4>
              <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                <li>• Go to "Family Members" in the navigation</li>
                <li>• Click "Invite New Member"</li>
                <li>• Enter their email address</li>
                <li>• Choose their role (Admin or Member)</li>
                <li>• Set health access permissions</li>
              </ul>
              
              <h4 className="font-semibold text-foreground">Managing Permissions</h4>
              <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                <li>• <strong>Admin:</strong> Full access to all features and settings</li>
                <li>• <strong>Member:</strong> Can view updates and send messages</li>
                <li>• <strong>Health Access:</strong> Can view health insights and call summaries</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Understanding Alerts Section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Understanding Alerts & Notifications
            </CardTitle>
            <CardDescription>How to interpret and respond to system alerts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <h4 className="font-semibold text-foreground">Types of Alerts</h4>
              <div className="space-y-2">
                <div>
                  <Badge variant="destructive" className="mb-1">Urgent Health Alert</Badge>
                  <p className="text-sm text-muted-foreground">
                    Immediate attention needed. Your relative mentioned concerning symptoms or expressed distress during their call.
                  </p>
                </div>
                <div>
                  <Badge variant="outline" className="mb-1">Missed Call Alert</Badge>
                  <p className="text-sm text-muted-foreground">
                    Your relative missed their scheduled daily call. The system will retry, but consider reaching out directly.
                  </p>
                </div>
                <div>
                  <Badge variant="secondary" className="mb-1">Wellness Update</Badge>
                  <p className="text-sm text-muted-foreground">
                    Regular update about your relative's mood and general wellbeing based on conversation analysis.
                  </p>
                </div>
              </div>
              
              <h4 className="font-semibold text-foreground">Response Guidelines</h4>
              <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                <li>• For urgent alerts: Contact your relative immediately</li>
                <li>• For missed calls: Check in within a few hours</li>
                <li>• For wellness updates: Use as conversation starters</li>
                <li>• Trust your instincts - you know your relative best</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Troubleshooting Section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Troubleshooting Common Issues</CardTitle>
            <CardDescription>Solutions to frequent problems</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <h4 className="font-semibold text-foreground">Device Connection Issues</h4>
              <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                <li>• Ensure your relative's device is connected to WiFi</li>
                <li>• Check that the Callpanion app is installed and up to date</li>
                <li>• Try restarting the device</li>
                <li>• Re-pair the device if necessary</li>
              </ul>
              
              <h4 className="font-semibold text-foreground">Missed Calls</h4>
              <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                <li>• Check if your relative's device volume is turned up</li>
                <li>• Verify call times match your relative's schedule</li>
                <li>• Ensure the device isn't in "Do Not Disturb" mode</li>
                <li>• Contact support if calls consistently fail</li>
              </ul>
              
              <h4 className="font-semibold text-foreground">Health Data Not Showing</h4>
              <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                <li>• Verify you have health access permissions</li>
                <li>• Check that your relative has had recent calls</li>
                <li>• Ensure health monitoring is enabled in settings</li>
                <li>• Health data may take 24-48 hours to appear</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Best Practices Section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Best Practices</CardTitle>
            <CardDescription>Tips for getting the most out of Callpanion</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <h4 className="font-semibold text-foreground">Communication Tips</h4>
              <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                <li>• Send regular messages even if brief - consistency matters</li>
                <li>• Include specific details about your day or family news</li>
                <li>• Ask questions that encourage your relative to share</li>
                <li>• Keep messages positive and engaging</li>
              </ul>
              
              <h4 className="font-semibold text-foreground">Using Health Insights</h4>
              <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                <li>• Review insights regularly but don't over-analyze</li>
                <li>• Look for patterns over time rather than daily fluctuations</li>
                <li>• Use insights as conversation starters, not diagnostic tools</li>
                <li>• Always consult healthcare professionals for medical concerns</li>
              </ul>
              
              <h4 className="font-semibold text-foreground">Supporting Your Relative</h4>
              <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                <li>• Be patient as they learn to use the technology</li>
                <li>• Celebrate small victories and improvements</li>
                <li>• Maintain regular contact outside of the system too</li>
                <li>• Involve other family members to create a support network</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <div className="text-center p-6 bg-muted rounded-lg">
          <p className="text-sm text-muted-foreground mb-4">
            Need additional help? Our support team is here to assist you.
          </p>
          <Button asChild>
            <Link to="mailto:support@callpanion.com">Contact Support</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}