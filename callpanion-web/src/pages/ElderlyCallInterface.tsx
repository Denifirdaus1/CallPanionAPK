import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import ElevenLabsCallInterface from '@/components/ElevenLabsCallInterface';
import WebRTCCallInterface from '@/components/WebRTCCallInterface';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Phone, PhoneOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const ElderlyCallInterface: React.FC = () => {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('sessionId') || '';
  const autoStart = searchParams.get('autoStart') === 'true';
  const platform = searchParams.get('platform') || 'web';
  const [callState, setCallState] = useState<'waiting' | 'connecting' | 'active' | 'ended'>('waiting');
  const [signedUrl, setSignedUrl] = useState<string>('');
  const [relativeName, setRelativeName] = useState('Your Family');
  const [pairingToken, setPairingToken] = useState('');

  useEffect(() => {
    initializeCall();
  }, [sessionId, autoStart]);

  const initializeCall = async () => {
    try {
      // Get call session data
      const { data: sessionData, error: sessionError } = await supabase
        .from('call_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (sessionError) {
        console.error('Error getting session:', sessionError);
        return;
      }

      // Get relative name from relatives table
      if (sessionData.relative_id) {
        const { data: relativeData } = await supabase
          .from('relatives')
          .select('first_name, last_name')
          .eq('id', sessionData.relative_id)
          .single();

        if (relativeData) {
          setRelativeName(`${relativeData.first_name} ${relativeData.last_name}`);
        }
      }

      // Generate signed URL for ElevenLabs WebRTC
      const { data: urlData, error: urlError } = await supabase.functions.invoke('elevenlabs-webrtc-call', {
        body: {
          sessionId: sessionId,
          action: 'start'
        }
      });

      if (urlError) {
        console.error('Error getting signed URL:', urlError);
        return;
      }

      setSignedUrl(urlData.signedUrl || '');
      setPairingToken(urlData.pairingToken || '');

      if (autoStart) {
        setCallState('connecting');
      }
    } catch (error) {
      console.error('Error initializing call:', error);
    }
  };

  const handleCallEnd = () => {
    setCallState('ended');
    
    // Notify Flutter app via JavaScript channel
    if (platform === 'flutter' && window.CallPanion) {
      window.CallPanion.postMessage('call_ended');
    }
    
    // Or redirect for web
    setTimeout(() => {
      if (platform !== 'flutter') {
        window.location.href = '/elderly';
      }
    }, 2000);
  };

  const startCall = () => {
    setCallState('connecting');
  };

  const endCall = () => {
    handleCallEnd();
  };

  if (callState === 'ended') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="text-center p-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <PhoneOff className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-semibold mb-2">Call Ended</h2>
            <p className="text-muted-foreground">
              Thank you for talking with your family
            </p>
            <Badge variant="secondary" className="mt-4">
              CallPanion
            </Badge>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (callState === 'waiting') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary/10 to-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="text-center p-8">
            <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Phone className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-2xl font-semibold mb-2">Incoming Call</h2>
            <p className="text-lg mb-4">{relativeName}</p>
            <p className="text-muted-foreground mb-6">
              Your family is calling you
            </p>
            <div className="flex gap-4">
              <button 
                onClick={endCall}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-lg font-medium flex items-center justify-center gap-2"
              >
                <PhoneOff className="w-5 h-5" />
                Decline
              </button>
              <button 
                onClick={startCall}
                className="flex-1 bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-lg font-medium flex items-center justify-center gap-2"
              >
                <Phone className="w-5 h-5" />
                Accept
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Use WebRTC interface for real conversation */}
      <WebRTCCallInterface
        sessionId={sessionId}
        relativeName={relativeName}
        onCallEnd={handleCallEnd}
      />
    </div>
  );
};

// Extend window interface for Flutter communication
declare global {
  interface Window {
    CallPanion?: {
      postMessage: (message: string) => void;
    };
  }
}

export default ElderlyCallInterface;