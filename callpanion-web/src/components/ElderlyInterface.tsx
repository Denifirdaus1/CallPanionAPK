import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Phone, PhoneOff, Volume2, Heart } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface IncomingCall {
  sessionId: string;
  relativeName: string;
  callType: 'in_app_call' | 'elevenlabs_call';
  householdId: string;
  relativeId: string;
}

const ElderlyInterface: React.FC = () => {
  const { toast } = useToast();
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [isInCall, setIsInCall] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [deviceInfo, setDeviceInfo] = useState<any>(null);

  // Check for device pairing status and incoming calls
  useEffect(() => {
    checkDeviceStatus();
    setupPushNotificationListener();
    
    // Poll for incoming calls every 5 seconds
    const pollInterval = setInterval(checkForIncomingCalls, 5000);
    
    return () => {
      clearInterval(pollInterval);
    };
  }, []);

  // Call duration counter
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isInCall) {
      interval = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isInCall]);

  const checkDeviceStatus = async () => {
    try {
      // Check if device is properly paired
      const deviceToken = localStorage.getItem('device_token');
      const pairingToken = localStorage.getItem('pairing_token');
      
      if (!deviceToken && !pairingToken) {
        toast({
          title: "Device Not Paired",
          description: "Please pair your device with your family first.",
          variant: "destructive"
        });
        return;
      }

      // Get device info
      const { data, error } = await supabase.functions.invoke('check-scheduled-calls', {
        body: { 
          deviceToken: deviceToken,
          pairingToken: pairingToken 
        }
      });

      if (error) {
        console.error('Error checking device status:', error);
        return;
      }

      setDeviceInfo(data);
    } catch (error) {
      console.error('Error in checkDeviceStatus:', error);
    }
  };

  const checkForIncomingCalls = async () => {
    try {
      const deviceToken = localStorage.getItem('device_token');
      const pairingToken = localStorage.getItem('pairing_token');
      
      if (!deviceToken && !pairingToken) return;

      const { data, error } = await supabase.functions.invoke('check-scheduled-calls', {
        body: { 
          deviceToken: deviceToken,
          pairingToken: pairingToken 
        }
      });

      if (error) {
        console.error('Error checking for calls:', error);
        return;
      }

      // Check for scheduled calls in the next 5 minutes
      if (data?.scheduledCalls && data.scheduledCalls.length > 0) {
        const nextCall = data.scheduledCalls[0];
        const callTime = new Date(nextCall.scheduledTime);
        const now = new Date();
        const timeDiff = callTime.getTime() - now.getTime();
        
        // If call is within next 5 minutes, show incoming call UI
        if (timeDiff <= 5 * 60 * 1000 && timeDiff >= -1 * 60 * 1000) {
          setIncomingCall({
            sessionId: nextCall.sessionId,
            relativeName: nextCall.relativeName || `Your Family`,
            callType: 'in_app_call',
            householdId: nextCall.householdId,
            relativeId: nextCall.relativeId
          });
          
          // Play notification sound
          playNotificationSound();
        }
      }
    } catch (error) {
      console.error('Error checking for incoming calls:', error);
    }
  };

  const setupPushNotificationListener = () => {
    // Listen for push notifications if on mobile
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'incoming_call') {
          setIncomingCall({
            sessionId: event.data.sessionId,
            relativeName: event.data.relativeName || 'Your Family',
            callType: event.data.callType || 'in_app_call',
            householdId: event.data.householdId,
            relativeId: event.data.relativeId
          });
          
          // Play notification sound
          playNotificationSound();
        }
      });
    }
  };

  const playNotificationSound = () => {
    // Create audio notification for incoming call
    const audio = new Audio('/notification-sound.mp3');
    audio.play().catch(console.error);
  };

  const acceptCall = async () => {
    if (!incomingCall) return;
    
    setIsLoading(true);
    try {
      // Update call session status to active
      // Update call status via the new updateCallStatus function
      const { error } = await supabase.functions.invoke('updateCallStatus', {
        body: {
          sessionId: incomingCall.sessionId,
          status: 'active',
          action: 'accept'
        }
      });

      if (error) throw error;

      if (incomingCall.callType === 'in_app_call') {
        // Start WebRTC call
        await startWebRTCCall();
      } else {
        // Handle ElevenLabs agent call
        await startElevenLabsCall();
      }
      
      setIsInCall(true);
      setIncomingCall(null);
      setCallDuration(0);
      
      toast({
        title: "Call Connected",
        description: "You're now connected with your family",
      });
    } catch (error) {
      console.error('Error accepting call:', error);
      toast({
        title: "Call Failed",
        description: "Could not connect to the call",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const rejectCall = async () => {
    if (!incomingCall) return;
    
    try {
      // Update call session status to missed
      // Update call status via the new updateCallStatus function
      const { error } = await supabase.functions.invoke('updateCallStatus', {
        body: {
          sessionId: incomingCall.sessionId,
          status: 'missed',
          action: 'decline'
        }
      });

      if (error) throw error;

      setIncomingCall(null);
      
      toast({
        title: "Call Declined",
        description: "Call has been declined",
      });
    } catch (error) {
      console.error('Error rejecting call:', error);
    }
  };

  const endCall = async () => {
    setIsLoading(true);
    try {
      if (incomingCall) {
        // End call session
        // Update call status via the new updateCallStatus function
        const { error } = await supabase.functions.invoke('updateCallStatus', {
          body: {
            sessionId: incomingCall.sessionId,
            status: 'completed',
            action: 'end',
            duration: callDuration
          }
        });

        if (error) throw error;
      }
      
      setIsInCall(false);
      setIncomingCall(null);
      setCallDuration(0);
      
      toast({
        title: "Call Ended",
        description: "Thank you for talking with your family",
      });
    } catch (error) {
      console.error('Error ending call:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const startWebRTCCall = async () => {
    // Implement WebRTC call logic here
    console.log('Starting WebRTC call');
  };

  const startElevenLabsCall = async () => {
    // Implement ElevenLabs agent call logic here
    console.log('Starting ElevenLabs call');
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (incomingCall && !isInCall) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary/10 to-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">📞 Incoming Call</CardTitle>
            <div className="flex items-center justify-center gap-2 mt-4">
              <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center">
                <Heart className="w-8 h-8 text-primary" />
              </div>
            </div>
            <h3 className="text-xl font-semibold mt-2">{incomingCall.relativeName}</h3>
            <Badge variant="secondary">Family Call</Badge>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 justify-center">
              <Button 
                onClick={rejectCall}
                variant="destructive"
                size="lg"
                className="flex-1"
                disabled={isLoading}
              >
                <PhoneOff className="w-5 h-5 mr-2" />
                Decline
              </Button>
              <Button 
                onClick={acceptCall}
                className="flex-1 bg-green-600 hover:bg-green-700"
                size="lg"
                disabled={isLoading}
              >
                <Phone className="w-5 h-5 mr-2" />
                Accept
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isInCall) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">📞 In Call</CardTitle>
            <div className="flex items-center justify-center gap-2 mt-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center animate-pulse">
                <Volume2 className="w-8 h-8 text-green-600" />
              </div>
            </div>
            <h3 className="text-xl font-semibold mt-2">Connected</h3>
            <Badge variant="secondary" className="bg-green-100 text-green-800">
              {formatTime(callDuration)}
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="text-center mb-6">
              <p className="text-muted-foreground">
                You're talking with your family. Speak naturally.
              </p>
            </div>
            <Button 
              onClick={endCall}
              variant="destructive"
              size="lg"
              className="w-full"
              disabled={isLoading}
            >
              <PhoneOff className="w-5 h-5 mr-2" />
              End Call
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">CallPanion</CardTitle>
          <div className="flex items-center justify-center gap-2 mt-4">
            <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center">
              <Heart className="w-8 h-8 text-primary" />
            </div>
          </div>
          <h3 className="text-xl font-semibold mt-2">Ready for Calls</h3>
        </CardHeader>
        <CardContent>
          <div className="text-center space-y-4">
            <p className="text-muted-foreground">
              Your device is connected. Your family can call you anytime.
            </p>
            {deviceInfo && (
              <div className="bg-muted p-3 rounded-lg">
                <p className="text-sm">
                  <strong>Status:</strong> {deviceInfo.device_status || 'Connected'}
                </p>
                <p className="text-sm">
                  <strong>Last Check:</strong> {new Date().toLocaleTimeString()}
                </p>
              </div>
            )}
            <Button onClick={checkForIncomingCalls} variant="outline" className="w-full">
              Check for Calls
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ElderlyInterface;