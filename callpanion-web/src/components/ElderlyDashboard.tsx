import { useState, useEffect } from "react";
import { Phone, HelpCircle, MessageCircle, Camera, Heart, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useMobileCapabilities } from "@/hooks/useMobile";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { VoiceInterface } from "@/components/VoiceInterface";
import { ImpactStyle } from "@capacitor/haptics";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface ElderlyDashboardProps {
  elderName?: string;
  isTokenAccess?: boolean;
  onEmergencyHelp?: () => void;
}

const ElderlyDashboard = ({ elderName = "Dear Friend", isTokenAccess = false, onEmergencyHelp }: ElderlyDashboardProps) => {
  const [isInCall, setIsInCall] = useState(false);
  const [volume, setVolume] = useState(true);
  const [callDuration, setCallDuration] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [conversation, setConversation] = useState<string[]>([]);
  const [relativeId, setRelativeId] = useState<string | undefined>(undefined);
  const [householdId, setHouseholdId] = useState<string | undefined>(undefined);
  
  const { toast } = useToast();
  const { user } = useAuth();
  const { isNativeMobile, triggerHapticFeedback, takeFamilyPhoto } = useMobileCapabilities();
  const { sendFamilyAlert } = usePushNotifications();

  // Fetch user's household and relative information
  useEffect(() => {
    const fetchUserData = async () => {
      if (!user) return;

      try {
        // First, try to find if this user is a relative
        const { data: relativeData, error: relativeError } = await supabase
          .from('relatives')
          .select('id, household_id')
          .limit(1)
          .single();

        if (relativeData) {
          setRelativeId(relativeData.id);
          setHouseholdId(relativeData.household_id);
          return;
        }

        // If not a relative, check if they're a household member
        const { data: memberData, error: memberError } = await supabase
          .from('household_members')
          .select('household_id')
          .eq('user_id', user.id)
          .limit(1)
          .single();

        if (memberData) {
          setHouseholdId(memberData.household_id);
          // For household members, we'll use their user_id as relative_id for demo purposes
          setRelativeId(user.id);
        }

      } catch (error) {
        console.error('Error fetching user data:', error);
        // Continue without household/relative data - some features will be limited
      }
    };

    fetchUserData();
  }, [user]);

  const handleEmergencyDetected = () => {
    // Handle emergency detection from voice interface
    handleHelp();
  };

  // Call duration timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isInCall) {
      interval = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else {
      setCallDuration(0);
    }
    return () => clearInterval(interval);
  }, [isInCall]);

  const handleAnswerCall = async () => {
    await triggerHapticFeedback(ImpactStyle.Medium);
    setIsInCall(true);
    toast({
      title: "Call Connected",
      description: "Your caring companion is here to chat with you"
    });
  };

  const handleEndCall = async () => {
    await triggerHapticFeedback(ImpactStyle.Light);
    setIsInCall(false);
    toast({
      title: "Call Ended",
      description: "Have a wonderful day! Talk to you soon."
    });
  };

  const handleHelp = async () => {
    await triggerHapticFeedback(ImpactStyle.Heavy);
    try {
      if (onEmergencyHelp) {
        onEmergencyHelp();
      } else {
        await sendFamilyAlert("Help request from interface");
      }
      toast({
        title: "Help Request Sent",
        description: "Your family has been notified"
      });
    } catch (error) {
      toast({
        title: "Unable to Send Alert",
        description: "Please try again or call directly",
        variant: "destructive"
      });
    }
  };

  const handleMessages = async () => {
    await triggerHapticFeedback(ImpactStyle.Light);
    toast({
      title: "Messages",
      description: "Your family messages will appear here"
    });
  };

  const handlePhotos = async () => {
    await triggerHapticFeedback(ImpactStyle.Light);
    if (isNativeMobile) {
      try {
        await takeFamilyPhoto();
        toast({
          title: "Photo Taken",
          description: "Your photo has been shared with family"
        });
      } catch (error) {
        toast({
          title: "Camera Not Available",
          description: "Unable to access camera"
        });
      }
    } else {
      toast({
        title: "Family Photos",
        description: "View and share photos with your family"
      });
    }
  };

  const toggleVolume = async () => {
    await triggerHapticFeedback(ImpactStyle.Light);
    setVolume(!volume);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isInCall) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 to-primary/10 p-4 flex items-center justify-center">
        <Card className="w-full max-w-lg bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="p-12 text-center space-y-8">
            {/* Call Status */}
            <div className="space-y-4">
              <div className="w-24 h-24 bg-primary/20 rounded-full flex items-center justify-center mx-auto animate-pulse">
                <Phone className="h-12 w-12 text-primary" />
              </div>
              <div>
                <h2 className="text-3xl font-bold text-foreground">Call Active</h2>
                <p className="text-xl text-muted-foreground mt-2">{formatTime(callDuration)}</p>
              </div>
            </div>

            {/* Call Controls */}
            <div className="flex justify-center space-x-6">
              <Button
                size="lg"
                variant="outline"
                onClick={toggleVolume}
                className="h-16 w-16 rounded-full border-2 border-primary/30"
              >
                {volume ? (
                  <Volume2 className="h-8 w-8 text-primary" />
                ) : (
                  <VolumeX className="h-8 w-8 text-muted-foreground" />
                )}
              </Button>
              
              <Button
                size="lg"
                onClick={handleEndCall}
                className="h-20 w-20 rounded-full bg-destructive hover:bg-destructive/90"
              >
                <Phone className="h-10 w-10 text-destructive-foreground rotate-[135deg]" />
              </Button>
            </div>

            {/* Voice Interface */}
            <div className="flex justify-center">
              <VoiceInterface 
                elderName={elderName}
                relativeId={relativeId}
                householdId={householdId}
                onSpeakingChange={setIsSpeaking}
                onConversationChange={setConversation}
                onEmergencyDetected={handleEmergencyDetected}
              />
            </div>

            {/* AI Response Display */}
            <div className="bg-background/80 rounded-xl p-6 border border-primary/20 min-h-[100px]">
              {isSpeaking ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  <span className="text-lg text-foreground ml-4">Speaking...</span>
                </div>
              ) : conversation.length > 0 ? (
                <p className="text-lg text-foreground leading-relaxed">
                  {conversation[conversation.length - 1]?.replace(/^(system|user|assistant):\s*/, '') || 
                   `Hello ${elderName}! Click "Start Chat" to begin our conversation.`}
                </p>
              ) : (
                <p className="text-lg text-foreground leading-relaxed">
                  Hello {elderName}! Click "Start Chat" to begin our conversation.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-primary/5 p-4">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-5xl font-bold text-primary tracking-wide">CallPanion</h1>
          <p className="text-2xl text-muted-foreground">Hello, {elderName}</p>
        </div>

        {/* Main Dashboard - 2x2 Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-12">
          
          {/* Answer Call */}
          <Card className="group hover:shadow-lg transition-all duration-300 border-2 hover:border-primary/30">
            <CardContent className="p-8 text-center space-y-6">
              <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto group-hover:bg-primary/20 transition-colors">
                <Phone className="h-10 w-10 text-primary" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-foreground mb-2">Answer Call</h3>
                <p className="text-muted-foreground">Your daily companion is ready to chat</p>
              </div>
              <Button
                size="lg"
                onClick={handleAnswerCall}
                className="w-full h-14 text-xl font-semibold bg-primary hover:bg-primary/90"
              >
                Pick Up
              </Button>
            </CardContent>
          </Card>

          {/* I Need Help */}
          <Card className="group hover:shadow-lg transition-all duration-300 border-2 hover:border-orange-300">
            <CardContent className="p-8 text-center space-y-6">
              <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto group-hover:bg-orange-200 transition-colors">
                <HelpCircle className="h-10 w-10 text-orange-600" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-foreground mb-2">I Need Help</h3>
                <p className="text-muted-foreground">Alert your family right away</p>
              </div>
              <Button
                size="lg"
                onClick={handleHelp}
                variant="outline"
                className="w-full h-14 text-xl font-semibold border-2 border-orange-300 hover:bg-orange-50"
              >
                Get Help
              </Button>
            </CardContent>
          </Card>

          {/* Messages */}
          <Card className="group hover:shadow-lg transition-all duration-300 border-2 hover:border-blue-300">
            <CardContent className="p-8 text-center space-y-6">
              <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto group-hover:bg-blue-200 transition-colors">
                <MessageCircle className="h-10 w-10 text-blue-600" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-foreground mb-2">Messages</h3>
                <p className="text-muted-foreground">Read messages from your family</p>
              </div>
              <Button
                size="lg"
                onClick={handleMessages}
                variant="outline"
                className="w-full h-14 text-xl font-semibold border-2 border-blue-300 hover:bg-blue-50"
              >
                View Messages
              </Button>
            </CardContent>
          </Card>

          {/* Photos */}
          <Card className="group hover:shadow-lg transition-all duration-300 border-2 hover:border-green-300">
            <CardContent className="p-8 text-center space-y-6">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto group-hover:bg-green-200 transition-colors">
                <Camera className="h-10 w-10 text-green-600" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-foreground mb-2">Photos</h3>
                <p className="text-muted-foreground">
                  {isNativeMobile ? "Take and share photos" : "View family photos"}
                </p>
              </div>
              <Button
                size="lg"
                onClick={handlePhotos}
                variant="outline"
                className="w-full h-14 text-xl font-semibold border-2 border-green-300 hover:bg-green-50"
              >
                {isNativeMobile ? "Take Photo" : "View Photos"}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <div className="text-center mt-16 p-6 bg-primary/5 rounded-2xl">
          <div className="flex items-center justify-center space-x-2 mb-2">
            <Heart className="h-6 w-6 text-primary" />
            <p className="text-xl font-medium text-foreground">Your family loves you</p>
            <Heart className="h-6 w-6 text-primary" />
          </div>
          <p className="text-muted-foreground">Always here when you need us</p>
        </div>
      </div>
    </div>
  );
};

export default ElderlyDashboard;