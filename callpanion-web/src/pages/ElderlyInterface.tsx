import { Phone, MessageCircle, Volume2, VolumeX, Camera, Home, Smartphone, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import WarmCard from "@/components/WarmCard";
import { useState, useRef, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useParams, Navigate } from "react-router-dom";
import { listPhotos, getDefaultPhotos, type FamilyPhoto, likePhotoRemote, addPhotoCommentRemote, subscribeToPhotoUpdates } from "@/lib/photoService";
import { useMobileCapabilities } from "@/hooks/useMobile";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { ImpactStyle } from "@capacitor/haptics";
import { supabase } from "@/integrations/supabase/client";

const ElderlyInterface = () => {
  const { inviteToken } = useParams<{ inviteToken: string }>();
  const [isValidToken, setIsValidToken] = useState<boolean | null>(null);
  const [elderlyName, setElderlyName] = useState<string>("");
  const [isInCall, setIsInCall] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [volume, setVolume] = useState(true);
  const [photos, setPhotos] = useState<FamilyPhoto[]>([]);
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [messages, setMessages] = useState<Array<{content: string, time: string}>>([
    { content: "Good morning! How are you feeling today?", time: "10:00 AM" },
    { content: "Your family is thinking of you ❤️", time: "Yesterday" },
    { content: "Remember to take your afternoon medicine", time: "Yesterday" }
  ]);
  const { toast } = useToast();
  const { isNativeMobile, takeFamilyPhoto, triggerHapticFeedback, setStatusBarTheme } = useMobileCapabilities();
  const { sendFamilyAlert } = usePushNotifications();

  // Validate invite token on mount
  useEffect(() => {
    const validateToken = async () => {
      if (!inviteToken) {
        setIsValidToken(false);
        return;
      }

      try {
        // Check if invite token exists and is valid
        const { data, error } = await supabase
          .from('invites')
          .select('*')
          .eq('token', inviteToken)
          .single();

        if (error || !data) {
          setIsValidToken(false);
          return;
        }

        setIsValidToken(true);
        setElderlyName("Dear Friend");
        
        // Load photos after validation
        const list = await listPhotos();
        setPhotos(list.length > 0 ? list : getDefaultPhotos());
      } catch (error) {
        console.error('Token validation error:', error);
        setIsValidToken(false);
      }
    };

    validateToken();
  }, [inviteToken]);

  useEffect(() => {
    const unsub = subscribeToPhotoUpdates(async () => {
      const list = await listPhotos();
      setPhotos(list.length > 0 ? list : getDefaultPhotos());
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('call') === '1') {
      handleIncomingCall();
    }
  }, []);

  const handleIncomingCall = async () => {
    await triggerHapticFeedback(ImpactStyle.Medium);
    setIsInCall(true);
    toast({
      title: "Daily Call Connected",
      description: "Your family companion is here to chat!"
    });
  };

  const endCall = async () => {
    await triggerHapticFeedback(ImpactStyle.Light);
    setIsInCall(false);
    toast({
      title: "Call Ended",
      description: "Have a wonderful day! We'll talk again soon."
    });
  };

  const toggleVolume = async () => {
    await triggerHapticFeedback(ImpactStyle.Light);
    setVolume(!volume);
    toast({
      title: volume ? "Volume Off" : "Volume On",
      description: volume ? "Call sounds muted" : "Call sounds restored"
    });
  };

  const handleTakePhoto = async () => {
    try {
      await triggerHapticFeedback(ImpactStyle.Medium);
      if (isNativeMobile) {
        const photo = await takeFamilyPhoto();
        toast({
          title: "Photo Captured!",
          description: "Your special moment has been saved"
        });
        // Add the photo to the gallery (in a real app, you'd save it to your backend)
        console.log('Photo captured:', photo);
      } else {
        toast({
          title: "Camera Feature",
          description: "Camera is available on mobile devices"
        });
      }
    } catch (error) {
      toast({
        title: "Camera Error",
        description: "Unable to access camera",
        variant: "destructive"
      });
    }
  };

  const handleEmergencyAlert = async () => {
    try {
      await triggerHapticFeedback(ImpactStyle.Heavy);
      await sendFamilyAlert("Emergency alert from elderly interface");
      toast({
        title: "Alert Sent",
        description: "Your family has been notified"
      });
    } catch (error) {
      toast({
        title: "Alert Error",
        description: "Unable to send alert",
        variant: "destructive"
      });
    }
  };

  // Show loading or error states
  if (isValidToken === null) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-warmth/20 via-background to-comfort/30 flex items-center justify-center p-4">
        <WarmCard className="p-8 text-center">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-lg text-foreground">Connecting...</p>
        </WarmCard>
      </div>
    );
  }

  if (isValidToken === false) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-warmth/20 via-background to-comfort/30 flex items-center justify-center p-4">
        <WarmCard className="p-8 text-center max-w-md">
          <AlertTriangle className="h-16 w-16 text-destructive mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-foreground mb-4">Access Not Available</h2>
          <p className="text-foreground/80 mb-6">
            This link is no longer valid or has expired. Please contact your family member for a new invitation.
          </p>
          <Button 
            onClick={() => window.location.href = '/'}
            className="bg-primary hover:bg-primary/90"
          >
            <Home className="h-4 w-4 mr-2" />
            Return to Homepage
          </Button>
        </WarmCard>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-warmth/20 via-background to-comfort/30 p-4">
      <div className="max-w-6xl mx-auto">
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-center mb-4">
            <h1 className="text-5xl font-bold text-foreground">Callpanion</h1>
          </div>
          <p className="text-2xl text-muted-foreground">Near, when you are far</p>
        </div>

        {/* Main Interface - Call in Progress */}
        {isInCall ? (
          <div className="space-y-8">
            <WarmCard gradient="love" className="text-center p-12">
              <div className="space-y-8">
                <div className="w-32 h-32 bg-white/90 rounded-full flex items-center justify-center mx-auto animate-pulse">
                  <Phone className="h-16 w-16 text-primary" />
                </div>
                
                <div>
                  <h2 className="text-4xl font-bold text-foreground mb-4">Daily Check-in Call</h2>
                  <p className="text-xl text-foreground/80">Your caring companion is listening</p>
                </div>

                <div className="flex justify-center space-x-6">
                  <Button
                    size="lg"
                    onClick={toggleVolume}
                    className="h-16 w-16 rounded-full bg-white/20 hover:bg-white/30"
                  >
                    {volume ? (
                      <Volume2 className="h-8 w-8 text-foreground" />
                    ) : (
                      <VolumeX className="h-8 w-8 text-foreground" />
                    )}
                  </Button>
                  
                  <Button
                    size="lg"
                    onClick={endCall}
                    className="h-20 w-20 rounded-full bg-destructive hover:bg-destructive/90"
                  >
                    <Phone className="h-10 w-10 text-destructive-foreground rotate-[135deg]" />
                  </Button>
                </div>

                <div className="bg-white/20 rounded-lg p-6">
                  <p className="text-lg text-foreground">
                    "How are you feeling today? I'd love to hear about what you've been up to!"
                  </p>
                </div>
              </div>
            </WarmCard>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Left Column - Call & Chat */}
            <div className="lg:col-span-1 space-y-6">
              
              {/* Incoming Call */}
              <WarmCard gradient="warmth" className="text-center p-8">
                <div className="space-y-6">
                  <div className="w-20 h-20 bg-white/90 rounded-full flex items-center justify-center mx-auto">
                    <Phone className="h-10 w-10 text-primary" />
                  </div>
                  
                  <div>
                    <h3 className="text-2xl font-bold text-foreground mb-2">Daily Call Ready</h3>
                    <p className="text-foreground/80">Your family companion is waiting</p>
                  </div>

                  <Button
                    size="lg"
                    onClick={handleIncomingCall}
                    className="bg-primary hover:bg-primary/90 h-16 px-8 text-xl font-semibold"
                  >
                    <Phone className="h-6 w-6 mr-3" />
                    Answer Call
                  </Button>
                </div>
              </WarmCard>

              {/* Messages */}
              <WarmCard className="p-6">
                <div className="flex items-center space-x-3 mb-6">
                  <MessageCircle className="h-8 w-8 text-primary" />
                  <h3 className="text-2xl font-bold text-foreground">Messages</h3>
                </div>
                
                <div className="space-y-4">
                  {messages.map((message, index) => (
                    <div key={index} className="bg-comfort/30 rounded-lg p-4">
                      <p className="text-lg text-foreground mb-2">{message.content}</p>
                      <span className="text-sm text-muted-foreground">{message.time}</span>
                    </div>
                  ))}
                </div>

                <Button 
                  className="w-full mt-6 h-12 text-lg"
                  onClick={() => setIsChatOpen(!isChatOpen)}
                >
                  <MessageCircle className="h-5 w-5 mr-2" />
                  {isChatOpen ? "Close Chat" : "Open Chat"}
                </Button>
              </WarmCard>
            </div>

            {/* Right Column - Image Gallery */}
            <div className="lg:col-span-2">
              <WarmCard className="p-6">
                <div className="flex items-center space-x-3 mb-6">
                  <Camera className="h-8 w-8 text-primary" />
                  <h3 className="text-2xl font-bold text-foreground">Beautiful Moments</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {photos.map((photo) => (
                    <Card key={photo.id} className="overflow-hidden border-0 shadow-gentle">
                      <div className="aspect-[4/3] overflow-hidden">
                        <img
                          src={photo.url}
                          alt={photo.alt}
                          className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                      <CardContent className="p-4">
                        <p className="text-lg text-center text-foreground font-medium">
                          {photo.caption}
                        </p>
                        <div className="mt-4 flex items-center justify-center gap-3">
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-primary/30"
                            onClick={async () => { await likePhotoRemote(photo.id); const list = await listPhotos(); setPhotos(list.length > 0 ? list : getDefaultPhotos()); }}
                          >
                            ❤️ {photo.likes ?? 0}
                          </Button>
                          <input
                            className="flex-1 border border-border rounded-md px-3 py-2 text-sm bg-background"
                            placeholder="Add a comment"
                            value={commentInputs[photo.id] ?? ''}
                            onChange={(e) => setCommentInputs({ ...commentInputs, [photo.id]: e.target.value })}
                          />
                          <Button
                            size="sm"
                            onClick={async () => {
                              const text = commentInputs[photo.id];
                              if (text && text.trim()) {
                                await addPhotoCommentRemote(photo.id, { author: 'Elderly', text });
                                setCommentInputs({ ...commentInputs, [photo.id]: '' });
                                const list = await listPhotos();
                                setPhotos(list.length > 0 ? list : getDefaultPhotos());
                              }
                            }}
                          >
                            Post
                          </Button>
                        </div>
                        {(photo.comments ?? []).slice(-2).map((c) => (
                          <p key={c.id} className="text-sm text-muted-foreground mt-2 text-center">
                            <span className="font-medium">{c.author}:</span> {c.text}
                          </p>
                        ))}
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <div className="mt-8 text-center space-y-4">
                  <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <Button 
                      variant="outline" 
                      className="h-12 px-8 text-lg border-primary/30"
                      onClick={handleTakePhoto}
                    >
                      <Camera className="h-5 w-5 mr-2" />
                      {isNativeMobile ? "Take Photo" : "View More Photos"}
                    </Button>
                    {isNativeMobile && (
                      <Button 
                        variant="destructive" 
                        className="h-12 px-8 text-lg"
                        onClick={handleEmergencyAlert}
                      >
                        <Smartphone className="h-5 w-5 mr-2" />
                        Emergency Alert
                      </Button>
                    )}
                  </div>
                  {isNativeMobile && (
                    <div className="flex items-center justify-center space-x-2 text-sm text-muted-foreground">
                      <Smartphone className="h-4 w-4" />
                      <span>Mobile features enabled</span>
                    </div>
                  )}
                </div>
              </WarmCard>
            </div>
          </div>
        )}

        {/* Chat Interface Overlay */}
        {isChatOpen && !isInCall && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <WarmCard className="w-full max-w-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-foreground">Family Chat</h3>
                <Button variant="outline" onClick={() => setIsChatOpen(false)}>
                  Close
                </Button>
              </div>
              
              <div className="space-y-4 mb-6 max-h-96 overflow-y-auto">
                {messages.map((message, index) => (
                  <div key={index} className="bg-comfort/20 rounded-lg p-4">
                    <p className="text-lg text-foreground">{message.content}</p>
                    <span className="text-sm text-muted-foreground mt-2 block">{message.time}</span>
                  </div>
                ))}
              </div>

              <div className="text-center">
                <p className="text-lg text-muted-foreground mb-4">New messages will appear here</p>
                <Button className="h-12 px-8 text-lg">
                  <MessageCircle className="h-5 w-5 mr-2" />
                  Send Love Message
                </Button>
              </div>
            </WarmCard>
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-12 p-6 bg-white/50 rounded-lg">
          <div className="text-center mb-2">
            <p className="text-xl text-foreground font-medium">Your family loves you</p>
          </div>
          <p className="text-muted-foreground">Always here when you need us</p>
        </div>
      </div>
    </div>
  );
};

export default ElderlyInterface;