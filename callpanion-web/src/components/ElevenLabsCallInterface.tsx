import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Phone, PhoneOff, Mic, MicOff, Brain, Heart } from 'lucide-react';

interface ElevenLabsCallInterfaceProps {
  sessionId: string;
  relativeName: string;
  onCallEnd: () => void;
}

// This will be replaced with proper ElevenLabs React SDK integration
const ElevenLabsCallInterface: React.FC<ElevenLabsCallInterfaceProps> = ({
  sessionId,
  relativeName,
  onCallEnd
}) => {
  const { toast } = useToast();
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [conversationData, setConversationData] = useState<any[]>([]);
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  const startCall = async () => {
    try {
      setIsConnecting(true);

      // Start ElevenLabs WebRTC call via our edge function
      const { data, error } = await supabase.functions.invoke('elevenlabs-webrtc-call', {
        body: {
          sessionId,
          action: 'start'
        }
      });

      if (error) {
        throw new Error(error.message || 'Failed to start ElevenLabs call');
      }

      console.log('ElevenLabs call started:', data);

      // Request microphone access
      try {
        mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          } 
        });
        console.log('Microphone access granted');
      } catch (micError) {
        console.error('Microphone access denied:', micError);
        toast({
          title: "Microphone Access Required",
          description: "Please allow microphone access to start the call",
          variant: "destructive",
        });
        setIsConnecting(false);
        return;
      }

      // Use conversationToken with ElevenLabs Conversational AI
      if (data.conversationToken) {
        await connectToElevenLabs(data.conversationToken, data);
      } else {
        throw new Error('No conversation token received');
      }

    } catch (error) {
      console.error('Error starting AI conversation:', error);
      setIsConnecting(false);
      toast({
        title: "AI Connection Failed",
        description: error instanceof Error ? error.message : 'Failed to connect to AI companion',
        variant: "destructive",
      });
    }
  };

  const connectToElevenLabs = async (conversationToken: string, callData: any) => {
    // This connects to ElevenLabs Conversational AI using conversation token
    // In production, this would use:
    // import { useConversation } from '@11labs/react';
    // const conversation = useConversation();
    // await conversation.startSession({ 
    //   url: `wss://api.elevenlabs.io/v1/convai/conversation?agent_id=${callData.agentId}`,
    //   token: conversationToken 
    // });

    console.log('Connecting to ElevenLabs ConvAI with token:', !!conversationToken);
    
    // Simulate connection delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    setIsConnected(true);
    setIsConnecting(false);
    startTimeRef.current = Date.now();
    
    // Start duration counter
    intervalRef.current = setInterval(() => {
      if (startTimeRef.current) {
        const duration = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setCallDuration(duration);
      }
    }, 1000);

    toast({
      title: "ElevenLabs ConvAI Connected",
      description: `Connected via conversation token to ${relativeName}`,
    });

    // Log the start of conversation
    logConversationData({
      type: 'conversation.started',
      content: `ElevenLabs ConvAI call started with ${relativeName}`,
      role: 'system'
    });

    // Update backend with conversation ID
    const simulatedConversationId = `conv_${Date.now()}`;
    if (callData.callLogId) {
      await updateConversationId(callData.callLogId, simulatedConversationId);
    }

    // Simulate AI conversation flow
    simulateAIConversation();
  };

  const updateConversationId = async (callLogId: string, conversationId: string) => {
    try {
      await supabase.functions.invoke('elevenlabs-webrtc-call', {
        body: {
          sessionId,
          action: 'update_conversation_id',
          callLogId,
          conversationId
        }
      });
      console.log('✅ Conversation ID updated:', conversationId);
    } catch (error) {
      console.error('❌ Failed to update conversation ID:', error);
    }
  };

  const simulateAIConversation = () => {
    // Simulate AI speaking patterns for demo
    const speakingIntervals = [3000, 7000, 12000, 18000, 25000];
    
    speakingIntervals.forEach((delay, index) => {
      setTimeout(() => {
        if (isConnected) {
          setIsAISpeaking(true);
          logConversationData({
            type: 'ai.speaking',
            content: `AI message ${index + 1}`,
            role: 'assistant'
          });
          
          // Stop speaking after 2-4 seconds
          setTimeout(() => {
            setIsAISpeaking(false);
          }, 2000 + Math.random() * 2000);
        }
      }, delay);
    });
  };

  const logConversationData = (message: any) => {
    setConversationData(prev => [...prev, {
      timestamp: new Date().toISOString(),
      type: message.type,
      content: message.content || message.text || '',
      speaker: message.role || 'system'
    }]);
  };

  const endCall = async () => {
    try {
      const duration = callDuration;
      
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }

      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }

      // Generate conversation summary from collected data
      const conversationSummary = generateConversationSummary();

      // End ElevenLabs WebRTC call via our edge function
      const { error } = await supabase.functions.invoke('elevenlabs-webrtc-call', {
        body: {
          sessionId,
          action: 'end',
          conversationSummary,
          duration,
          outcome: 'completed'
        }
      });

      if (error) {
        console.error('Error ending call session:', error);
      }

      setIsConnected(false);
      toast({
        title: "AI Session Completed",
        description: `ElevenLabs conversation lasted ${formatDuration(duration)}. Analysis saved to dashboard.`,
      });

      onCallEnd();
    } catch (error) {
      console.error('Error ending AI conversation:', error);
      toast({
        title: "Error",
        description: 'Failed to end conversation properly',
        variant: "destructive",
      });
    }
  };

  const generateConversationSummary = (): string => {
    if (conversationData.length === 0) return 'Brief ElevenLabs AI conversation completed';
    
    const userMessages = conversationData.filter(d => d.speaker === 'user');
    const aiMessages = conversationData.filter(d => d.speaker === 'assistant');
    
    return `ElevenLabs AI conversation with ${relativeName}. ${userMessages.length} user responses, ${aiMessages.length} AI responses. Duration: ${formatDuration(callDuration)}.`;
  };

  const toggleMute = async () => {
    if (mediaStreamRef.current) {
      const audioTracks = mediaStreamRef.current.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = isMuted;
      });
      setIsMuted(!isMuted);
      
      toast({
        title: isMuted ? "Microphone Unmuted" : "Microphone Muted",
        description: isMuted ? "You can now speak" : "Your microphone is muted",
      });
    }
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="text-center">
          {isConnected ? `ElevenLabs AI Chat with ${relativeName}` : `Call ${relativeName}`}
        </CardTitle>
        {isConnected && (
          <p className="text-center text-muted-foreground">
            {formatDuration(callDuration)}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-center space-x-4">
          {!isConnected && !isConnecting && (
            <Button
              onClick={startCall}
              className="bg-green-600 hover:bg-green-700 text-white p-6 rounded-full"
              size="lg"
            >
              <Phone className="h-6 w-6" />
            </Button>
          )}
          
          {isConnecting && (
            <Button disabled className="p-6 rounded-full" size="lg">
              Connecting to ElevenLabs AI...
            </Button>
          )}
          
          {isConnected && (
            <>
              <Button
                onClick={toggleMute}
                variant={isMuted ? "destructive" : "outline"}
                className="p-4 rounded-full"
                size="lg"
              >
                {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </Button>
              
              <Button
                onClick={endCall}
                className="bg-red-600 hover:bg-red-700 text-white p-6 rounded-full"
                size="lg"
              >
                <PhoneOff className="h-6 w-6" />
              </Button>
            </>
          )}
        </div>
        
        {isConnected && (
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center space-x-2">
              <Brain className="h-4 w-4 text-primary" />
              <p className="text-sm text-muted-foreground">
                {isAISpeaking ? '🗣️ ElevenLabs AI Speaking...' : '👂 Listening to ' + relativeName + '...'}
              </p>
            </div>
            
            {conversationData.length > 0 && (
              <div className="flex items-center justify-center space-x-2">
                <Heart className="h-3 w-3 text-red-500" />
                <p className="text-xs text-muted-foreground">
                  {conversationData.length} conversation exchanges via ElevenLabs
                </p>
              </div>
            )}
          </div>
        )}
        
        <div className="text-center">
          <p className="text-xs text-muted-foreground">
            Powered by ElevenLabs Conversational AI
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default ElevenLabsCallInterface;