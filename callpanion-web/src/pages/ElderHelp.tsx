import { ArrowLeft, Phone, Heart, Camera, Volume2, Wifi, HelpCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ElderHelp() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto p-6">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="outline" size="sm" asChild>
            <Link to="/elder">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Link>
          </Button>
          <div>
            <h1 className="text-4xl font-bold text-foreground">How to Use Callpanion</h1>
            <p className="text-xl text-muted-foreground">Simple instructions for staying connected</p>
          </div>
        </div>

        {/* What is Callpanion */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Heart className="h-6 w-6 text-primary" />
              What is Callpanion?
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Callpanion is your daily companion that helps you stay connected with your family. 
              Every day, Callpanion will call you for a friendly chat to see how you're doing and 
              share messages from your loved ones.
            </p>
          </CardContent>
        </Card>

        {/* Your Daily Calls */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Phone className="h-6 w-6 text-primary" />
              Your Daily Calls
            </CardTitle>
            <CardDescription className="text-lg">What to expect from your daily conversations</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-foreground">When Will Callpanion Call?</h3>
              <p className="text-lg text-muted-foreground">
                Callpanion will call you at the same time each day, usually in the morning or afternoon. 
                Your family has set up the best time that works for your schedule.
              </p>
              
              <h3 className="text-xl font-semibold text-foreground">What Will We Talk About?</h3>
              <ul className="text-lg text-muted-foreground space-y-2">
                <li>• How you're feeling today</li>
                <li>• What you've been up to</li>
                <li>• Messages from your family members</li>
                <li>• Upcoming family events or appointments</li>
                <li>• Your family photos and memories</li>
              </ul>
              
              <h3 className="text-xl font-semibold text-foreground">How Long Are the Calls?</h3>
              <p className="text-lg text-muted-foreground">
                Calls usually last 10-15 minutes, but you can chat for as long as you'd like. 
                If you need to end the call early, just say "goodbye" and Callpanion will understand.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Answering Calls */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Volume2 className="h-6 w-6 text-primary" />
              Answering Your Calls
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-6 md:grid-cols-1">
              <div className="p-4 border border-border rounded-lg">
                <h4 className="text-xl font-semibold text-foreground mb-2">When Your Device Rings:</h4>
                <ol className="text-lg text-muted-foreground space-y-2">
                  <li>1. Look for the green "Answer" button on your screen</li>
                  <li>2. Tap the button to answer the call</li>
                  <li>3. Say "Hello" when you hear Callpanion's friendly voice</li>
                  <li>4. Speak normally - Callpanion can hear you well</li>
                </ol>
              </div>
              
              <div className="p-4 border border-border rounded-lg">
                <h4 className="text-xl font-semibold text-foreground mb-2">If You Miss a Call:</h4>
                <p className="text-lg text-muted-foreground">
                  Don't worry! Callpanion will try calling you again in a little while. Your family 
                  will also be notified so they can check on you if needed.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Using Your Device */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Camera className="h-6 w-6 text-primary" />
              Using Your Device
            </CardTitle>
            <CardDescription className="text-lg">Simple tips for your daily use</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-foreground">Viewing Family Photos</h3>
              <p className="text-lg text-muted-foreground">
                Your family can send you photos that will appear on your screen. You can look at 
                these anytime by tapping on the "Family Photos" section on your home screen.
              </p>
              
              <h3 className="text-xl font-semibold text-foreground">Checking Your Connection</h3>
              <p className="text-lg text-muted-foreground">
                Look for the connection status on your home screen. If you see "Connected" with a 
                green color, everything is working well. If it shows "Disconnected," try moving 
                closer to your WiFi router.
              </p>
              
              <h3 className="text-xl font-semibold text-foreground">Getting Help</h3>
              <p className="text-lg text-muted-foreground">
                If you need help anytime, look for the "Help" button on your screen. Tap it and 
                someone will call you back to assist.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Troubleshooting */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Wifi className="h-6 w-6 text-primary" />
              If Something Isn't Working
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <div className="p-4 border border-border rounded-lg">
                <h4 className="text-xl font-semibold text-foreground mb-2">If Callpanion Doesn't Call:</h4>
                <ul className="text-lg text-muted-foreground space-y-1">
                  <li>• Check that your device volume is turned up</li>
                  <li>• Make sure your device is plugged in and charged</li>
                  <li>• Try pressing the "Help" button for assistance</li>
                </ul>
              </div>
              
              <div className="p-4 border border-border rounded-lg">
                <h4 className="text-xl font-semibold text-foreground mb-2">If You Can't Hear Callpanion:</h4>
                <ul className="text-lg text-muted-foreground space-y-1">
                  <li>• Check that your device volume is turned up high enough</li>
                  <li>• Make sure nothing is covering the speaker</li>
                  <li>• Ask a family member to help adjust the settings</li>
                </ul>
              </div>
              
              <div className="p-4 border border-border rounded-lg">
                <h4 className="text-xl font-semibold text-foreground mb-2">If Your Screen Looks Different:</h4>
                <ul className="text-lg text-muted-foreground space-y-1">
                  <li>• Try touching the home button or main screen</li>
                  <li>• Ask a family member to show you around again</li>
                  <li>• Don't worry - it's normal for screens to change sometimes</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Remember */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <HelpCircle className="h-6 w-6 text-primary" />
              Remember
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-lg text-muted-foreground">
                <strong>You don't need to remember everything!</strong> Callpanion is designed to be 
                simple and helpful. If you forget how to do something, that's perfectly okay.
              </p>
              
              <p className="text-lg text-muted-foreground">
                Your family loves you and wants to stay connected. Callpanion is just another way 
                for them to check in and share their love with you every day.
              </p>
              
              <p className="text-lg text-muted-foreground">
                If you ever need help with anything, just press the "Help" button or ask a family 
                member. They're always happy to help you use Callpanion.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="text-center p-6 bg-muted rounded-lg">
          <h3 className="text-2xl font-semibold text-foreground mb-4">You're All Set!</h3>
          <p className="text-lg text-muted-foreground mb-4">
            Enjoy your daily conversations with Callpanion and stay connected with your family.
          </p>
          <Button size="lg" asChild>
            <Link to="/elder">Go to My Home Screen</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}