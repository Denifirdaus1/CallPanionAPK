import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Footer from "@/components/Footer";

export default function AccessibilityStatement() {
  useEffect(() => {
    document.title = "Accessibility Statement | CallPanion";
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-foreground mb-2">Accessibility Statement</h1>
          <p className="text-muted-foreground mb-8">Last updated: January 2025</p>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Our Commitment</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>CallPanion is committed to ensuring digital accessibility for people with disabilities. We continually improve the user experience for everyone and apply relevant accessibility standards.</p>
                <p>We aim to conform to the Web Content Accessibility Guidelines (WCAG) 2.2 Level AA as our accessibility standard.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Accessibility Features</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>Our website and apps include:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Large Text Options:</strong> Especially designed for elderly users with larger touch targets and high contrast</li>
                  <li><strong>Voice Interface:</strong> Natural voice interaction for hands-free operation</li>
                  <li><strong>Keyboard Navigation:</strong> Full functionality accessible via keyboard</li>
                  <li><strong>Screen Reader Support:</strong> Semantic HTML and ARIA labels</li>
                  <li><strong>High Contrast:</strong> Sufficient colour contrast ratios throughout</li>
                  <li><strong>Focus Indicators:</strong> Clear visual focus indicators for navigation</li>
                  <li><strong>Responsive Design:</strong> Works across devices and screen sizes</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Known Limitations</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>While we strive for full accessibility, some areas may present challenges:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Third-party Maps:</strong> Mapbox integration may have limited screen reader support</li>
                  <li><strong>Voice Features:</strong> Require microphone access and may not work with all assistive technologies</li>
                  <li><strong>Complex Data Visualisations:</strong> Some charts may require alternative text descriptions</li>
                </ul>
                <p>We're actively working to address these limitations.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Assistive Technologies</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>CallPanion has been tested with:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>NVDA and JAWS screen readers on Windows</li>
                  <li>VoiceOver on macOS and iOS</li>
                  <li>TalkBack on Android</li>
                  <li>Dragon speech recognition software</li>
                  <li>Switch navigation devices</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Browser Support</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>CallPanion works best with recent versions of:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Chrome, Firefox, Safari, and Edge browsers</li>
                  <li>Mobile browsers on iOS Safari and Android Chrome</li>
                  <li>Browsers with JavaScript enabled</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Feedback and Contact</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>We welcome feedback on accessibility. If you encounter barriers or need assistance:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Email:</strong> accessibility@callpanion.co.uk</li>
                  <li><strong>Phone:</strong> +44 (0) 28 9000 0000</li>
                  <li><strong>Post:</strong> CallPanion Ltd, Accessibility Team, Belfast, Northern Ireland</li>
                </ul>
                <p>We aim to respond to accessibility feedback within 5 working days.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Reasonable Adjustments</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>If you need content in a different format or additional support to use our service, we'll make reasonable adjustments including:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Alternative format documents (large print, audio, braille)</li>
                  <li>Additional phone support for navigation</li>
                  <li>Extended time limits for session timeouts</li>
                  <li>Customised interface settings</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Continuous Improvement</CardTitle>
              </CardHeader>
              <CardContent>
                <p>We regularly:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Conduct accessibility audits with disabled users</li>
                  <li>Test with multiple assistive technologies</li>
                  <li>Train our development team on accessibility practices</li>
                  <li>Review and update this statement as we improve</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Compliance Status</CardTitle>
              </CardHeader>
              <CardContent>
                <p>This website is partially compliant with WCAG 2.2 Level AA. We're committed to achieving full compliance and will update this statement as improvements are made.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}