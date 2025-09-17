import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Footer from "@/components/Footer";
import { AlertTriangle, Phone } from "lucide-react";

export default function HealthDisclaimer() {
  useEffect(() => {
    document.title = "Health Disclaimer | CallPanion";
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-foreground mb-2">Health Disclaimer</h1>
          <p className="text-muted-foreground mb-8">Important information about CallPanion's health-related features</p>

          <div className="space-y-6">
            <Card className="border-red-200 bg-red-50">
              <CardHeader className="flex flex-row items-center space-y-0 pb-2">
                <AlertTriangle className="h-6 w-6 text-red-600 mr-2" />
                <CardTitle className="text-red-900">Important: Emergency Services</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="flex items-center space-x-4 p-4 bg-red-100 rounded-lg">
                  <Phone className="h-8 w-8 text-red-600" />
                  <div>
                    <p className="font-semibold text-red-900 text-lg">In an emergency, call 999 immediately</p>
                    <p className="text-red-800">CallPanion is not an emergency service and cannot replace emergency medical care.</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>What CallPanion Is</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>CallPanion is a voice companion and family communication service designed to:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Provide friendly conversation and social interaction</li>
                  <li>Help with daily reminders and routine support</li>
                  <li>Enable family members to stay connected</li>
                  <li>Support general wellbeing through regular check-ins</li>
                  <li>Facilitate communication between family members</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>What CallPanion Is NOT</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="font-semibold">CallPanion is not a medical device, healthcare service, or emergency response system.</p>
                <p>CallPanion does not:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Monitor vital signs:</strong> We don't measure heart rate, blood pressure, oxygen levels, or other medical indicators</li>
                  <li><strong>Provide medical diagnosis:</strong> We cannot diagnose medical conditions or provide medical advice</li>
                  <li><strong>Replace healthcare professionals:</strong> Always consult qualified medical practitioners for health concerns</li>
                  <li><strong>Offer emergency response:</strong> We cannot dispatch emergency services or provide immediate crisis intervention</li>
                  <li><strong>Monitor for medical emergencies:</strong> We cannot detect falls, heart attacks, strokes, or other medical emergencies</li>
                  <li><strong>Provide medication management:</strong> While we can provide reminders, we don't manage or monitor medication effects</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Health Information Limitations</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>Any health-related information shared through CallPanion:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Is for informational and communication purposes only</li>
                  <li>Should not be used for medical decision-making</li>
                  <li>Cannot replace professional medical assessment</li>
                  <li>May not be comprehensive or complete</li>
                  <li>Should be verified with healthcare providers</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>When to Seek Medical Help</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>Contact appropriate medical services for:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Life-threatening emergencies:</strong> Call 999 immediately</li>
                  <li><strong>Urgent medical concerns:</strong> Contact NHS 111 or your GP</li>
                  <li><strong>Mental health crises:</strong> Call Samaritans (116 123) or emergency services</li>
                  <li><strong>Medication concerns:</strong> Consult your pharmacist or prescribing doctor</li>
                  <li><strong>Changes in health status:</strong> Speak with your regular healthcare provider</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Family Member Responsibilities</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>Family members using CallPanion should:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Not rely solely on CallPanion for health monitoring</li>
                  <li>Maintain regular contact through other means</li>
                  <li>Encourage professional medical care when needed</li>
                  <li>Understand that CallPanion provides limited health information</li>
                  <li>Have emergency plans that don't depend on CallPanion</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Data Accuracy</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>While we strive for accuracy, CallPanion:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>May experience technical errors or service interruptions</li>
                  <li>Relies on user-provided information which may be incomplete</li>
                  <li>Cannot verify the accuracy of health information shared</li>
                  <li>Should not be the sole source of health-related data</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Professional Healthcare</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>We strongly encourage:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Regular check-ups with healthcare providers</li>
                  <li>Following prescribed treatment plans</li>
                  <li>Discussing any concerns with qualified medical professionals</li>
                  <li>Maintaining relationships with GPs, specialists, and pharmacists</li>
                  <li>Using established medical alert systems for emergency situations</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Liability Limitations</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>CallPanion Ltd is not liable for:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Health outcomes or medical decisions made based on service use</li>
                  <li>Delays in seeking appropriate medical care</li>
                  <li>Service interruptions during health events</li>
                  <li>Misinterpretation of health information</li>
                  <li>Failure to detect medical emergencies</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Questions or Concerns</CardTitle>
              </CardHeader>
              <CardContent>
                <p>For questions about this health disclaimer or CallPanion's capabilities, contact us at: health@callpanion.co.uk</p>
                <p className="text-sm text-muted-foreground mt-4">This disclaimer is part of our Terms of Use and is governed by Northern Ireland law.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}