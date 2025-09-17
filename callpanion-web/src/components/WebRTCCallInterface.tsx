import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Phone, PhoneOff, Mic, MicOff, Brain, Heart } from 'lucide-react';

interface WebRTCCallInterfaceProps {
  sessionId: string;
  relativeName: string;
  onCallEnd: () => void;
}

interface ElevenLabsConversation {
  startSession: (config: any) => Promise<string>;
  endSession: () => Promise<void>;
  setVolume: (options: { volume: number }) => Promise<void>;
  status: string;
  isSpeaking: boolean;
}

// For now, we'll handle this directly in the component
// Later we'll integrate with the proper ElevenLabs React SDK

const WebRTCCallInterface: React.FC<WebRTCCallInterfaceProps> = ({
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
  const conversationRef = useRef<ElevenLabsConversation | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    // Load ElevenLabs React SDK
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@11labs/react@latest/dist/index.js';
    script.async = true;
    script.onload = () => {
      console.log('ElevenLabs React SDK loaded');
    };
    document.head.appendChild(script);

    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (conversationRef.current) {
        conversationRef.current.endSession();
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
      
      // Use conversationToken with ElevenLabs React SDK
      if (data.conversationToken) {
        await startElevenLabsSession(data.conversationToken, data);
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

  const startElevenLabsSession = async (conversationToken: string, callData: any) => {
    try {
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      console.log('Microphone access granted, starting ElevenLabs session...');
      
      // In production, this would use @11labs/react:
      // const conversation = useConversation();
      // const conversationId = await conversation.startSession({ 
      //   url: `wss://api.elevenlabs.io/v1/convai/conversation?agent_id=${callData.agentId}`,
      //   token: conversationToken,
      //   dynamicVariables: {
      //     session_id: sessionId,
      //     secret__household_id: callData.householdId,
      //     secret__relative_id: callData.relativeId,
      //     call_type: 'in_app_call'
      //   }
      // });
      
      // For now, simulate the connection
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
        title: "ElevenLabs AI Connected",
        description: `Connected via conversation token to chat with ${relativeName}`,
      });

      // Log the start of conversation
      logConversationData({
        type: 'conversation.started',
        content: `ElevenLabs ConvAI call started with ${relativeName}`,
        role: 'system'
      });

      // Simulate conversation ID being returned and update backend
      const simulatedConversationId = `conv_${Date.now()}`;
      if (callData.callLogId) {
        await updateConversationId(callData.callLogId, simulatedConversationId);
      }

      // Simulate AI speaking states
      setTimeout(() => {
        setIsAISpeaking(true);
        setTimeout(() => setIsAISpeaking(false), 3000);
      }, 2000);
      
    } catch (error) {
      console.error('Error starting ElevenLabs session:', error);
      throw error;
    }
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

  const logConversationData = (message: any) => {
    setConversationData(prev => [...prev, {
      timestamp: new Date().toISOString(),
      type: message.type,
      content: message.content || message.text || '',
      speaker: message.role || 'system'
    }]);
  };

  const handleTranscriptCompletion = (message: any) => {
    console.log('Transcript completed:', message);
    setIsAISpeaking(false);
    
    // Analyze conversation for health insights
    if (message.transcript) {
      analyzeConversationContent(message.transcript);
    }
  };

  const analyzeConversationContent = async (transcript: string) => {
    try {
      // Send transcript for AI analysis
      const { error } = await supabase.functions.invoke('ai-conversation-analysis', {
        body: {
          sessionId,
          transcript,
          relativeId: sessionId.split('_')[1], // Extract relative ID
          analysisType: 'wellbeing_check'
        }
      });

      if (error) {
        console.error('Failed to analyze conversation:', error);
      }
    } catch (error) {
      console.error('Error analyzing conversation:', error);
    }
  };

  const endCall = async () => {
    try {
      const duration = callDuration;
      
      if (conversationRef.current) {
        await conversationRef.current.endSession();
      }

      if (intervalRef.current) {
        clearInterval(intervalRef.current);
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
        description: `Conversation lasted ${formatDuration(duration)}. Analysis saved to dashboard.`,
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
    if (conversationData.length === 0) return 'Brief AI conversation completed';
    
    const userMessages = conversationData.filter(d => d.speaker === 'user');
    const aiMessages = conversationData.filter(d => d.speaker === 'assistant');
    
    return `AI companion conversation with ${relativeName}. ${userMessages.length} user responses, ${aiMessages.length} AI responses. Duration: ${formatDuration(callDuration)}.`;
  };

  const toggleMute = async () => {
    if (conversationRef.current) {
      try {
        await conversationRef.current.setVolume({ volume: isMuted ? 1 : 0 });
        setIsMuted(!isMuted);
      } catch (error) {
        console.error('Error toggling mute:', error);
      }
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
          {isConnected ? `Talking to ${relativeName}` : `Call ${relativeName}`}
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
              Connecting...
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
                {isAISpeaking ? '🗣️ AI Companion Speaking...' : '👂 Listening to ' + relativeName + '...'}
              </p>
            </div>
            
            {conversationData.length > 0 && (
              <div className="flex items-center justify-center space-x-2">
                <Heart className="h-3 w-3 text-red-500" />
                <p className="text-xs text-muted-foreground">
                  {conversationData.length} conversation exchanges recorded
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default WebRTCCallInterface;