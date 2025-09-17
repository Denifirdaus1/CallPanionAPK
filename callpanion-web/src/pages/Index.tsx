import { MessageCircle, Phone, Calendar, Camera, BarChart3, ArrowRight, Users, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import WarmCard from "@/components/WarmCard";
import { Link } from "react-router-dom";
import heroWarmth from "@/assets/hero-warmth.jpg";
import gentleConnection from "@/assets/gentle-connection.jpg";
import familyMemories from "@/assets/family-memories.jpg";
import Footer from "@/components/Footer";

const Index = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-warmth/10 to-comfort/20">
      <div className="max-w-6xl mx-auto px-6 py-12">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <div className="text-center mb-6">
            <h1 className="text-5xl md:text-6xl font-bold text-foreground mb-2">
              Callpanion
            </h1>
            <p className="text-xl text-muted-foreground">
              Near, when you are far
            </p>
          </div>
          
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto mb-8">
            Bridge the gap between generations with gentle technology that connects families, 
            monitors wellbeing, and creates lasting memories together.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/subscribe">
              <Button size="lg" className="h-14 px-8 text-lg font-semibold">
                <Users className="h-6 w-6 mr-3" />
                Sign up today
              </Button>
            </Link>
            <Link to="/elderly">
              <Button size="lg" variant="outline" className="h-14 px-8 text-lg font-semibold border-primary/30">
                <Users className="h-6 w-6 mr-3" />
                Elderly Interface
              </Button>
            </Link>
          </div>
          
          <div className="mt-6 pt-6 border-t border-muted-foreground/20">
            <p className="text-sm text-muted-foreground mb-4">
              Already have a pairing code? Set up your elder device:
            </p>
            <Button 
              size="lg" 
              variant="secondary" 
              className="h-12 px-6"
              onClick={() => {
                // Use production domain for Elder App if we're on callpanion.co.uk
                const isCallpanionDomain = window.location.host.includes('callpanion.co.uk');
                const elderAppBaseUrl = isCallpanionDomain 
                  ? 'https://www.callpanion.co.uk'
                  : (import.meta.env.VITE_ELDER_APP_BASE_URL || window.location.origin);
                window.open(`${elderAppBaseUrl}/pair`, '_blank');
              }}
            >
              <Phone className="h-5 w-5 mr-2" />
              Open Elder App
            </Button>
          </div>
        </div>

        {/* Two Interface Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-16">
          <WarmCard gradient="love" className="text-center p-8">
            <div className="bg-white/90 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6">
              <Users className="h-10 w-10 text-primary" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-4">For Family Members</h3>
            <p className="text-white/90 mb-6">
              Comprehensive dashboard to send messages, manage calendars, monitor health insights, 
              and set up daily companion calls for your loved ones.
            </p>
            <ul className="text-white/80 text-left space-y-2 mb-6">
              <li>• Send loving messages and reminders</li>
              <li>• Monitor health and wellness trends</li>
              <li>• Manage appointments and activities</li>
              <li>• Set up AI companion calls</li>
              <li>• Track cognitive health gently</li>
            </ul>
            {/* CTA removed to prioritize main subscription flow */}
          </WarmCard>

          <WarmCard gradient="peace" className="text-center p-8">
            <div className="bg-white/90 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6">
              <Users className="h-10 w-10 text-primary" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-4">For Elderly Users</h3>
            <p className="text-white/90 mb-6">
              Simple, friendly interface designed for easy use. Receive daily companion calls, 
              view loving messages, and enjoy beautiful photo galleries.
            </p>
            <ul className="text-white/80 text-left space-y-2 mb-6">
              <li>• Large, clear buttons and text</li>
              <li>• Daily companion calls with care</li>
              <li>• Receive family messages</li>
              <li>• Beautiful photo gallery</li>
              <li>• Simple, warm interface</li>
            </ul>
            <Link to="/elderly">
              <Button className="bg-white text-primary hover:bg-white/90">
                Go to Simple Interface
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </WarmCard>
        </div>

        {/* Key Features */}
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-4">How Callpanion Works</h2>
          <p className="text-muted-foreground text-lg">
            Two beautifully designed interfaces working together to keep families connected
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          <Card className="text-center p-6 border-0 shadow-gentle">
            <CardHeader>
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <MessageCircle className="h-8 w-8 text-primary" />
              </div>
              <CardTitle>Send Love Daily</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Family members use the dashboard to send caring messages, schedule reminders, 
                and manage the elderly person's calendar and activities.
              </p>
            </CardContent>
          </Card>

          <Card className="text-center p-6 border-0 shadow-gentle">
            <CardHeader>
              <div className="w-16 h-16 bg-love/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Phone className="h-8 w-8 text-love" />
              </div>
              <CardTitle>AI Companion Calls</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Daily AI companion calls provide gentle wellness monitoring through natural 
                conversation, feeding insights back to the family dashboard.
              </p>
            </CardContent>
          </Card>

          <Card className="text-center p-6 border-0 shadow-gentle">
            <CardHeader>
              <div className="w-16 h-16 bg-peace/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="h-8 w-8 text-peace" />
              </div>
              <CardTitle>Gentle Monitoring</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Health insights track wellbeing patterns and cognitive health through 
                unobtrusive assessment questions woven into natural conversations.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Call to Action */}
        <WarmCard gradient="warmth" className="text-center p-12">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold text-white mb-4">
              Ready to Strengthen Family Connections?
            </h2>
            <p className="text-white/90 text-lg mb-8">
              Start building a bridge of love and care that makes every day brighter for your family.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/subscribe">
                <Button size="lg" className="bg-white text-primary hover:bg-white/90 h-14 px-8 text-lg font-semibold">
                  <Users className="h-6 w-6 mr-3" />
                  Sign up today
                </Button>
              </Link>
              <Link to="/elderly">
                <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10 h-14 px-8 text-lg font-semibold">
                  <Users className="h-6 w-6 mr-3" />
                  Try the Simple Interface
                </Button>
              </Link>
            </div>
          </div>
        </WarmCard>
      </div>
      <Footer />
    </div>
  );
};

export default Index;