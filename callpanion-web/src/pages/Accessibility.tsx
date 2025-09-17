import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Accessibility() {
  useEffect(() => {
    document.title = "Accessibility Statement | CallPanion";
  }, []);

  return (
    <main className="min-h-screen bg-gradient-to-br from-background to-comfort/20">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-4">Accessibility Statement</h1>
          <p className="text-muted-foreground text-lg">
            Last updated: 18 August 2025 | Version: 1.0
          </p>
        </header>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Our Commitment to Accessibility</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4">
                CallPanion is committed to ensuring digital accessibility for people with disabilities. We are continually improving the user experience for everyone and applying the relevant accessibility standards.
              </p>
              <p>We aim to conform to the Web Content Accessibility Guidelines (WCAG) 2.1 at AA level, which is also the basis for most accessibility legislation around the world.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Accessibility Features</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4">Our website includes the following accessibility features:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Keyboard Navigation:</strong> All interactive elements can be accessed using keyboard navigation</li>
                <li><strong>Screen Reader Support:</strong> Proper heading structure, alt text for images, and semantic HTML</li>
                <li><strong>High Contrast:</strong> Color choices meet WCAG contrast requirements</li>
                <li><strong>Responsive Design:</strong> Content adapts to different screen sizes and orientations</li>
                <li><strong>Clear Language:</strong> We use plain English and avoid jargon where possible</li>
                <li><strong>Focus Indicators:</strong> Clear visual focus indicators for keyboard users</li>
                <li><strong>Descriptive Links:</strong> Link text clearly describes the destination or purpose</li>
              </ul>
            </CardContent>
          </Card>

           <Card>
             <CardHeader>
               <CardTitle>Features for All Users</CardTitle>
             </CardHeader>
             <CardContent>
               <p className="mb-4">We have designed CallPanion with all users in mind:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Large, Clear Text:</strong> Easily readable font sizes and clear typography</li>
                <li><strong>Simple Navigation:</strong> Intuitive menu structure and clear labels</li>
                <li><strong>Voice Interface:</strong> AI companion calls reduce need for complex interactions</li>
                <li><strong>High Contrast Colors:</strong> Easy to distinguish interface elements</li>
                <li><strong>Touch-Friendly:</strong> Large click targets suitable for tablets and touchscreens</li>
                <li><strong>Help and Support:</strong> Multiple ways to get assistance, including phone support</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Known Limitations</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4">We are aware of the following accessibility limitations and are working to address them:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Some dynamic content may not be immediately announced by screen readers</li>
                <li>Video content may require manual caption activation</li>
                <li>Some third-party embedded content (like payment forms) may have limited accessibility features</li>
              </ul>
              <p className="mt-4">We are actively working to resolve these issues in future updates.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Feedback and Assistance</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4">
                We welcome your feedback on the accessibility of CallPanion. If you encounter accessibility barriers or need assistance:
              </p>
              
              <div className="space-y-3">
                <div>
                  <h4 className="font-semibold">Contact Methods:</h4>
                  <ul className="list-disc pl-6 space-y-1">
                    <li><strong>Email:</strong> <a href="mailto:accessibility@callpanion.co.uk" className="text-primary hover:underline">accessibility@callpanion.co.uk</a></li>
                    <li><strong>General Support:</strong> <a href="mailto:callpanion@gmail.com" className="text-primary hover:underline">callpanion@gmail.com</a></li>
                    <li><strong>Phone:</strong> Available through our family dashboard for subscribers</li>
                  </ul>
                </div>
                
                <div>
                  <h4 className="font-semibold">What to Include:</h4>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>A description of the accessibility problem</li>
                    <li>The page or feature where you encountered the issue</li>
                    <li>Your contact information if you'd like a response</li>
                    <li>Any assistive technology you were using</li>
                  </ul>
                </div>
              </div>
              
              <p className="mt-4">We aim to respond to accessibility feedback within 2 business days and provide a resolution timeline.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Technical Specifications</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <h4 className="font-semibold">Supported Browsers:</h4>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>Chrome (latest 2 versions)</li>
                    <li>Firefox (latest 2 versions)</li>
                    <li>Safari (latest 2 versions)</li>
                    <li>Edge (latest 2 versions)</li>
                  </ul>
                </div>
                
                <div>
                  <h4 className="font-semibold">Tested with:</h4>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>NVDA screen reader</li>
                    <li>JAWS screen reader</li>
                    <li>VoiceOver (macOS and iOS)</li>
                    <li>Keyboard-only navigation</li>
                    <li>Voice control software</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Formal Complaints Process</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4">
                If you are not satisfied with our response to your accessibility concerns, you may file a formal complaint:
              </p>
              
              <ol className="list-decimal pl-6 space-y-2">
                <li>Contact us first using the methods above - most issues can be resolved quickly</li>
                <li>If unsatisfied, escalate to our director at the postal address below</li>
                <li>For UK public sector websites, you may also contact the Equality and Human Rights Commission</li>
              </ol>
              
              <div className="mt-4 p-4 bg-muted rounded">
                <h4 className="font-semibold mb-2">Postal Address:</h4>
                <p>
                  Gail Cook Consulting<br />
                  10 Ballinderry Road<br />
                  Aghalee<br />
                  BT67 0DZ<br />
                  Northern Ireland
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ongoing Improvements</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4">We are committed to continually improving accessibility:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Regular accessibility audits and testing</li>
                <li>Staff training on accessibility best practices</li>
                <li>User testing with people who have disabilities</li>
                <li>Monitoring and responding to user feedback</li>
                <li>Staying current with accessibility standards and guidelines</li>
              </ul>
              
              <p className="mt-4">
                This statement will be updated as we make improvements and changes to our website.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}