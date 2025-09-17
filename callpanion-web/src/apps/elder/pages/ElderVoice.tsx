import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Mic, MicOff, Phone, PhoneOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';

interface VoiceSession {
  sessionId: string | null;
  status: 'idle' | 'connecting' | 'live' | 'ending';
  error?: string;
  ws: WebSocket | null;
  mediaRecorder: MediaRecorder | null;
  audioContext: AudioContext | null;
}

const ElderVoice = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [session, setSession] = useState<VoiceSession>({
    sessionId: null,
    status: 'idle',
    ws: null,
    mediaRecorder: null,
    audioContext: null
  });
  const [showConsent, setShowConsent] = useState(true);
  const [hasConsent, setHasConsent] = useState(false);
  
  // Safety timeout refs to prevent credit burn
  const cleanupTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const emergencyCleanup = () => {
    console.log('🚨 EMERGENCY CLEANUP - Stopping all voice resources');
    
    // Stop any existing stream tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log('Stopped track:', track.kind);
      });
      streamRef.current = null;
    }
    
    // Close WebSocket immediately
    if (session.ws && session.ws.readyState === WebSocket.OPEN) {
      session.ws.close();
    }
    
    // Stop MediaRecorder
    if (session.mediaRecorder && session.mediaRecorder.state !== 'inactive') {
      session.mediaRecorder.stop();
    }
    
    // Close AudioContext
    if (session.audioContext) {
      session.audioContext.close();
    }
    
    // Clear any cleanup timeout
    if (cleanupTimeoutRef.current) {
      clearTimeout(cleanupTimeoutRef.current);
    }
    
    setSession({
      sessionId: null,
      status: 'idle',
      ws: null,
      mediaRecorder: null,
      audioContext: null
    });
  };

  const startSession = async () => {
    try {
      // Clear any existing cleanup timeouts
      if (cleanupTimeoutRef.current) {
        clearTimeout(cleanupTimeoutRef.current);
      }
      
      setSession(prev => ({ ...prev, status: 'connecting' }));

      // Set a safety timeout to prevent credit burn if connection fails
      cleanupTimeoutRef.current = setTimeout(() => {
        console.log('⏰ Safety timeout triggered - cleaning up session');
        emergencyCleanup();
        toast({
          title: "Connection Timeout",
          description: "Session ended for safety - please try again",
          variant: "destructive"
        });
      }, 30000); // 30 second safety timeout

      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 24000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      // Store stream reference for emergency cleanup
      streamRef.current = stream;

      // Create audio context
      const audioContext = new AudioContext({ sampleRate: 24000 });

      // Get session start authorization
      const { data, error } = await supabase.functions.invoke('voice-start', {
        body: {}
      });

      if (error || !data.ok) {
        throw new Error(data?.error || 'Failed to start session');
      }

      const { sessionId, agentId, authToken } = data;

      // Connect to WebSocket proxy
      const wsUrl = `wss://umjtepmdwfyfhdzbkyli.functions.supabase.co/functions/v1/eleven-proxy?agent_id=${agentId}&token=${encodeURIComponent(authToken)}`;
      const ws = new WebSocket(wsUrl);
      ws.binaryType = 'arraybuffer';

      ws.onopen = () => {
        console.log('WebSocket connected');
        
        // Start recording audio
        const mediaRecorder = new MediaRecorder(stream, { 
          mimeType: 'audio/webm;codecs=opus',
          audioBitsPerSecond: 128000
        });

        mediaRecorder.ondataavailable = (event) => {
          if (ws.readyState === WebSocket.OPEN && event.data.size > 0) {
            ws.send(event.data);
          }
        };

        mediaRecorder.start(250); // Send chunks every 250ms

        setSession(prev => ({
          ...prev,
          sessionId,
          status: 'live',
          ws,
          mediaRecorder,
          audioContext
        }));

        // Clear safety timeout once connected
        if (cleanupTimeoutRef.current) {
          clearTimeout(cleanupTimeoutRef.current);
          cleanupTimeoutRef.current = null;
        }

        toast({
          title: "Call Connected",
          description: "You can now speak with the AI assistant",
        });
      };

      ws.onmessage = async (event) => {
        try {
          // Handle incoming audio from ElevenLabs
          const audioData = event.data;
          if (audioData instanceof ArrayBuffer && audioData.byteLength > 0) {
            const audioBuffer = await audioContext.decodeAudioData(audioData.slice(0));
            const source = audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioContext.destination);
            source.start();
          }
        } catch (error) {
          console.warn('Error playing audio:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('🔥 WebSocket error:', error);
        emergencyCleanup();
        toast({
          title: "Connection Error", 
          description: "Voice session ended - please try again",
          variant: "destructive"
        });
      };

      ws.onclose = () => {
        console.log('WebSocket closed');
        emergencyCleanup();
      };

    } catch (error) {
      console.error('❌ Error starting session:', error);
      emergencyCleanup();
      
      toast({
        title: "Failed to Start Call",
        description: error.message.includes('Permission') 
          ? "Microphone access is required for voice calls"
          : "Unable to start voice session",
        variant: "destructive"
      });
    }
  };

  const endSession = async (outcome = 'completed') => {
    try {
      setSession(prev => ({ ...prev, status: 'ending' }));

      // Immediate emergency cleanup to stop credit burn
      emergencyCleanup();

      // End session on server
      if (session.sessionId) {
        await supabase.functions.invoke('voice-end', {
          body: {
            sessionId: session.sessionId,
            outcome
          }
        });
      }

      toast({
        title: "Call Ended",
        description: "Voice session has been ended",
      });

      // Return to home after a brief delay
      setTimeout(() => navigate('/elder/home'), 1000);

    } catch (error) {
      console.error('Error ending session:', error);
      emergencyCleanup(); // Ensure cleanup even on error
    }
  };

  const handleConsent = () => {
    setHasConsent(true);
    setShowConsent(false);
  };

  // Aggressive cleanup on unmount to prevent credit burn
  useEffect(() => {
    return () => {
      console.log('🧹 Component unmounting - emergency cleanup');
      emergencyCleanup();
    };
  }, []);
  
  // Cleanup on page visibility change (user navigates away)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && session.status === 'live') {
        console.log('👀 Page hidden - emergency cleanup to prevent credit burn');
        emergencyCleanup();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [session.status]);

  if (showConsent && !hasConsent) {
    return (
      <div className="min-h-screen bg-background p-8 flex flex-col justify-center">
        <Card className="max-w-2xl mx-auto p-8 text-center space-y-6">
          <h1 className="text-3xl font-bold text-foreground">
            Voice Call Consent
          </h1>
          
          <div className="text-lg text-muted-foreground space-y-4">
            <p>
              This conversation may be monitored by your family for safety.
            </p>
            <p>
              By tapping Continue you consent to processing per our Privacy Notice.
            </p>
          </div>

          <div className="flex gap-4 justify-center pt-4">
            <Button 
              size="lg" 
              variant="outline"
              className="text-xl py-8 px-16 h-auto rounded-full"
              onClick={() => navigate('/elder/home')}
            >
              <ArrowLeft className="mr-2" size={24} />
              Back
            </Button>
            
            <Button 
              size="lg"
              className="text-xl py-8 px-16 h-auto rounded-full bg-green-600 hover:bg-green-700"
              onClick={handleConsent}
            >
              Continue
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8 flex flex-col justify-center">
      <div className="max-w-2xl mx-auto text-center space-y-8">
        {session.status === 'idle' && (
          <>
            <h1 className="text-4xl font-bold text-foreground">
              Ready to Call
            </h1>
            <p className="text-xl text-muted-foreground">
              Tap the button below to start your voice conversation
            </p>
            
            <div className="pt-8">
              <Button 
                size="lg"
                className="text-2xl py-12 px-20 h-auto rounded-full bg-green-600 hover:bg-green-700"
                onClick={startSession}
              >
                <Phone className="mr-4" size={32} />
                Start Voice Call
              </Button>
            </div>

            {session.error && (
              <div className="text-red-600 text-lg mt-4">
                {session.error}
              </div>
            )}
          </>
        )}

        {session.status === 'connecting' && (
          <>
            <h1 className="text-4xl font-bold text-foreground">
              Connecting...
            </h1>
            <div className="animate-pulse">
              <Mic size={120} className="mx-auto text-primary" />
            </div>
            <p className="text-xl text-muted-foreground">
              Setting up your voice connection
            </p>
          </>
        )}

        {session.status === 'live' && (
          <>
            <h1 className="text-4xl font-bold text-foreground">
              Call Active
            </h1>
            <div className="animate-pulse">
              <Mic size={120} className="mx-auto text-green-600" />
            </div>
            <p className="text-xl text-muted-foreground">
              Speaking with AI Assistant
            </p>
            
            <div className="pt-8">
              <Button 
                size="lg" 
                variant="destructive"
                className="text-2xl py-12 px-20 h-auto rounded-full"
                onClick={() => endSession('hung_up')}
              >
                <PhoneOff className="mr-4" size={32} />
                End Call
              </Button>
            </div>
          </>
        )}

        {session.status === 'ending' && (
          <>
            <h1 className="text-4xl font-bold text-foreground">
              Ending Call...
            </h1>
            <div className="animate-pulse">
              <MicOff size={120} className="mx-auto text-muted-foreground" />
            </div>
            <p className="text-xl text-muted-foreground">
              Closing voice connection
            </p>
          </>
        )}

        <div className="pt-8">
          <Button 
            variant="ghost" 
            size="lg"
            onClick={() => navigate('/elder/home')}
            className="text-xl p-4"
            disabled={session.status === 'live'}
          >
            <ArrowLeft className="mr-2" size={24} />
            Back to Home
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ElderVoice;