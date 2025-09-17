import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Cookies() {
  useEffect(() => {
    document.title = "Cookie Policy | CallPanion";
  }, []);

  return (
    <main className="min-h-screen bg-gradient-to-br from-background to-comfort/20">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-4">Cookie Policy</h1>
          <p className="text-muted-foreground text-lg">
            Last updated: 18 August 2025 | Version: 2.0
          </p>
        </header>

        <div className="space-y-6">
          <Card>
            <CardContent className="pt-6">
              <p className="mb-4">
                CallPanion is a brand of <strong>Gail Cook Consulting</strong>, 10 Ballinderry Road, Aghalee, BT67 0DZ, Northern Ireland.
              </p>
              <p>Contact: <a href="mailto:callpanion@gmail.com" className="text-primary hover:underline">callpanion@gmail.com</a></p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>1. What are cookies?</CardTitle>
            </CardHeader>
            <CardContent>
              <p>Small text files placed on your device to help websites work and improve your experience.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>2. Cookies we use</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Essential</strong> – for login, security, and service delivery.</li>
                <li><strong>Performance</strong> – analytics and performance monitoring.</li>
                <li><strong>Functional</strong> – remember preferences.</li>
                <li><strong>Marketing</strong> – only with your consent.</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>3. Third-party cookies</CardTitle>
            </CardHeader>
            <CardContent>
              <p>Set by trusted providers for analytics or features.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>4. Consent</CardTitle>
            </CardHeader>
            <CardContent>
              <p>We request consent before setting non-essential cookies via our cookie banner.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>5. Managing cookies</CardTitle>
            </CardHeader>
            <CardContent>
              <p>You can manage or delete cookies in your browser settings. Essential cookies cannot be disabled.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>6. Questions</CardTitle>
            </CardHeader>
            <CardContent>
              <p>Email <a href="mailto:callpanion@gmail.com" className="text-primary hover:underline">callpanion@gmail.com</a></p>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}