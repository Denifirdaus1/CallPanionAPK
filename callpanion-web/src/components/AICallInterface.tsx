import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { RealtimeAICall } from '@/utils/RealtimeAICall';
import { Phone, PhoneOff, Mic, MicOff, Volume2 } from 'lucide-react';

interface CallMessage {
  type: 'info' | 'error' | 'ai_transcript' | 'user_transcript' | 'call_summary';
  text?: string;
  summary?: any;
  isComplete?: boolean;
}

interface AICallInterfaceProps {
  relativeId: string;
  relativeName: string;
  onCallComplete?: (summary: any) => void;
}

const AICallInterface: React.FC<AICallInterfaceProps> = ({ 
  relativeId, 
  relativeName, 
  onCallComplete 
}) => {
  const { toast } = useToast();
  const [callState, setCallState] = useState<string>('idle');
  const [messages, setMessages] = useState<CallMessage[]>([]);
  const [currentAIText, setCurrentAIText] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const callRef = useRef<RealtimeAICall | null>(null);

  const handleMessage = (message: CallMessage) => {
    console.log('Call message:', message);
    
    if (message.type === 'ai_transcript') {
      if (message.isComplete) {
        setMessages(prev => [...prev, { ...message, type: 'ai_transcript' }]);
        setCurrentAIText('');
      } else {
        setCurrentAIText(prev => prev + (message.text || ''));
      }
    } else if (message.type === 'call_summary') {
      setMessages(prev => [...prev, message]);
      onCallComplete?.(message.summary);
      
      // Show summary toast
      if (message.summary) {
        toast({
          title: "Call Completed",
          description: `Mood: ${message.summary.mood_assessment}. ${message.summary.health_concerns ? 'Health concerns noted.' : 'No health concerns.'}`,
          variant: message.summary.emergency_flag ? "destructive" : "default",
        });
      }
    } else {
      setMessages(prev => [...prev, message]);
    }

    if (message.type === 'error') {
      toast({
        title: "Call Error",
        description: message.text,
        variant: "destructive",
      });
    }
  };

  const handleCallStateChange = (state: string) => {
    console.log('Call state changed:', state);
    setCallState(state);
    
    switch (state) {
      case 'connecting':
        toast({
          title: "Connecting",
          description: "Establishing AI call connection...",
        });
        break;
      case 'call_active':
        toast({
          title: "Call Active",
          description: `AI is now talking with ${relativeName}`,
        });
        break;
      case 'call_ended':
        toast({
          title: "Call Ended",
          description: "AI call completed successfully",
        });
        break;
      case 'error':
        setCallState('idle');
        break;
    }
  };

  const startCall = async () => {
    try {
      if (!callRef.current) {
        callRef.current = new RealtimeAICall(handleMessage, handleCallStateChange);
      }
      
      setMessages([]);
      setCurrentAIText('');
      await callRef.current.startCall(relativeId);
    } catch (error) {
      console.error('Error starting call:', error);
      toast({
        title: "Error",
        description: "Failed to start AI call",
        variant: "destructive",
      });
    }
  };

  const endCall = () => {
    if (callRef.current) {
      callRef.current.endCall();
    }
    setCallState('idle');
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    // Note: In a real implementation, you'd need to handle muting in the RealtimeAICall class
    toast({
      title: isMuted ? "Unmuted" : "Muted",
      description: isMuted ? "Microphone enabled" : "Microphone muted",
    });
  };

  useEffect(() => {
    return () => {
      if (callRef.current) {
        callRef.current.endCall();
      }
    };
  }, []);

  const getCallStateInfo = () => {
    switch (callState) {
      case 'idle':
        return { label: 'Ready', color: 'secondary' as const };
      case 'connecting':
        return { label: 'Connecting...', color: 'default' as const };
      case 'connected':
        return { label: 'Connected', color: 'default' as const };
      case 'call_active':
        return { label: 'In Call', color: 'default' as const };
      case 'call_ended':
        return { label: 'Call Ended', color: 'secondary' as const };
      case 'error':
        return { label: 'Error', color: 'destructive' as const };
      default:
        return { label: callState, color: 'default' as const };
    }
  };

  const stateInfo = getCallStateInfo();

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>AI Call with {relativeName}</span>
          <Badge variant={stateInfo.color}>{stateInfo.label}</Badge>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Call Controls */}
        <div className="flex justify-center gap-4">
          {callState === 'idle' || callState === 'call_ended' ? (
            <Button 
              onClick={startCall}
              size="lg"
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <Phone className="w-5 h-5 mr-2" />
              Start AI Call
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button 
                onClick={endCall}
                size="lg"
                variant="destructive"
              >
                <PhoneOff className="w-5 h-5 mr-2" />
                End Call
              </Button>
              
              <Button 
                onClick={toggleMute}
                size="lg"
                variant={isMuted ? "destructive" : "secondary"}
              >
                {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </Button>
            </div>
          )}
        </div>

        {/* Live Transcript */}
        {(callState === 'call_active' || callState === 'connected') && (
          <div className="space-y-2">
            <h4 className="font-medium flex items-center">
              <Volume2 className="w-4 h-4 mr-2" />
              Live Conversation
            </h4>
            
            {currentAIText && (
              <div className="p-3 bg-blue-50 rounded-lg border-l-4 border-blue-400">
                <p className="text-sm font-medium text-blue-800">AI (speaking...):</p>
                <p className="text-blue-700">{currentAIText}</p>
              </div>
            )}
          </div>
        )}

        {/* Call Messages */}
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {messages.map((message, index) => (
            <div key={index} className={`p-3 rounded-lg ${
              message.type === 'error' 
                ? 'bg-red-50 border-l-4 border-red-400' 
                : message.type === 'ai_transcript'
                ? 'bg-blue-50 border-l-4 border-blue-400'
                : message.type === 'user_transcript'
                ? 'bg-green-50 border-l-4 border-green-400'
                : message.type === 'call_summary'
                ? 'bg-yellow-50 border-l-4 border-yellow-400'
                : 'bg-gray-50 border-l-4 border-gray-400'
            }`}>
              {message.type === 'call_summary' && message.summary ? (
                <div>
                  <p className="font-medium text-yellow-800">Call Summary:</p>
                  <div className="mt-2 space-y-1 text-sm text-yellow-700">
                    <p><strong>Mood:</strong> {message.summary.mood_assessment}</p>
                    <p><strong>Health Concerns:</strong> {message.summary.health_concerns ? 'Yes' : 'No'}</p>
                    {message.summary.emergency_flag && (
                      <p className="text-red-600 font-medium">⚠️ Requires immediate attention</p>
                    )}
                    <p><strong>Summary:</strong> {message.summary.summary}</p>
                    {message.summary.key_points && message.summary.key_points.length > 0 && (
                      <div>
                        <strong>Key Points:</strong>
                        <ul className="list-disc list-inside ml-2">
                          {message.summary.key_points.map((point: string, i: number) => (
                            <li key={i}>{point}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-medium capitalize">
                    {message.type === 'ai_transcript' ? 'AI' :
                     message.type === 'user_transcript' ? relativeName :
                     message.type}:
                  </p>
                  <p className="text-sm">{message.text}</p>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Instructions */}
        {callState === 'idle' && (
          <div className="text-sm text-muted-foreground space-y-2">
            <p><strong>How it works:</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Click "Start AI Call" to begin the wellness check</li>
              <li>The AI will conduct a natural conversation</li>
              <li>It will assess mood, health, and wellbeing</li>
              <li>You'll receive a summary when the call ends</li>
              <li>Family alerts are sent if concerns are detected</li>
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AICallInterface;