import { useState, useRef, useEffect } from 'react';
import { Volume2, VolumeX, Mic, MicOff, Phone, PhoneOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useConversation } from '@11labs/react';
import { 
  fetchWeather, 
  fetchSafeNews, 
  getTrivia, 
  checkEmergencyKeywords,
  logWellbeing,
  notifyFamily,
  escalateEmergency,
  getFamilyMessages,
  getWellbeingTrends
} from '@/lib/clientTools';

interface VoiceInterfaceProps {
  elderName?: string;
  relativeId?: string;
  householdId?: string;
  onSpeakingChange?: (speaking: boolean) => void;
  onConversationChange?: (conversation: string[]) => void;
  onEmergencyDetected?: () => void;
}

export const VoiceInterface = ({ 
  elderName = "Dear Friend", 
  relativeId,
  householdId,
  onSpeakingChange, 
  onConversationChange,
  onEmergencyDetected
}: VoiceInterfaceProps) => {
  const [isConnected, setIsConnected] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [conversationLog, setConversationLog] = useState<string[]>([]);
  
  const { toast } = useToast();

  // ElevenLabs conversation hook with client tools
  const conversation = useConversation({
    onConnect: () => {
      console.log('Connected to ElevenLabs');
      setIsConnected(true);
      onSpeakingChange?.(false);
    },
    onDisconnect: () => {
      console.log('Disconnected from ElevenLabs');
      setIsConnected(false);
      onSpeakingChange?.(false);
    },
    onMessage: (message) => {
      console.log('Message received:', message);
      if (message.source === 'user') {
        const newLog = `You: ${message.message}`;
        setConversationLog(prev => [...prev, newLog]);
        onConversationChange?.([...conversationLog, newLog]);
      } else if (message.source === 'ai') {
        const newLog = `AI Companion: ${message.message}`;
        setConversationLog(prev => [...prev, newLog]);
        onConversationChange?.([...conversationLog, newLog]);
      }
    },
    onError: (error) => {
      console.error('ElevenLabs error:', error);
      toast({
        title: "Voice Error",
        description: "There was an issue with the voice connection",
        variant: "destructive"
      });
    },
    clientTools: {
      // Client-side tools (no server needed)
      fetch_weather: async (parameters: { location?: string }) => {
        console.log('Fetching weather for:', parameters.location);
        return await fetchWeather(parameters.location);
      },
      
      fetch_safe_news: async () => {
        console.log('Fetching safe news');
        return await fetchSafeNews();
      },
      
      get_trivia: async () => {
        console.log('Getting trivia');
        return await getTrivia();
      },
      
      check_emergency_keywords: async (parameters: { text: string }) => {
        console.log('Checking for emergency keywords in:', parameters.text);
        const result = await checkEmergencyKeywords(parameters.text);
        if (result.isEmergency) {
          onEmergencyDetected?.();
        }
        return JSON.stringify(result);
      },

      // Webhook tools (server-side via edge functions)
      log_wellbeing: async (parameters: {
        mood_rating?: number;
        energy_level?: number;
        pain_level?: number;
        sleep_quality?: number;
        notes?: string;
      }) => {
        if (!relativeId) return "I need to know who you are to save this information.";
        console.log('Logging wellbeing:', parameters);
        return await logWellbeing({ relative_id: relativeId, ...parameters });
      },

      get_recent_wellbeing_logs: async (parameters: { days?: number }) => {
        if (!relativeId) return "I need to know who you are to check your wellbeing history.";
        console.log('Getting wellbeing trends:', parameters);
        return await getWellbeingTrends({ relative_id: relativeId, ...parameters });
      },

      notify_family: async (parameters: { title: string; message: string; priority?: string }) => {
        if (!householdId || !relativeId) return "I can't contact your family right now.";
        console.log('Notifying family:', parameters);
        return await notifyFamily({ 
          household_id: householdId,
          relative_id: relativeId,
          ...parameters 
        });
      },

      escalate_emergency: async (parameters: { emergency_type: string; details?: string }) => {
        if (!householdId || !relativeId) return "I can't send emergency alerts right now.";
        console.log('Escalating emergency:', parameters);
        return await escalateEmergency({
          household_id: householdId,
          relative_id: relativeId,
          ...parameters
        });
      },

      read_family_messages: async (parameters: { limit?: number }) => {
        if (!householdId) return "I can't access your family messages right now.";
        console.log('Reading family messages:', parameters);
        return await getFamilyMessages({ household_id: householdId, ...parameters });
      }
    },
    overrides: {
      agent: {
        prompt: {
          prompt: `You are a caring AI companion for ${elderName}. You have access to various tools to help them:

PERSONALITY: Be warm, friendly, patient, and supportive. Speak naturally and conversationally. Keep responses under 2-3 sentences unless they ask for more detail.

AVAILABLE TOOLS:
- fetch_weather: Get weather information 
- fetch_safe_news: Share positive, uplifting news
- get_trivia: Share interesting facts and questions
- log_wellbeing: Save their daily mood, energy, pain, and sleep ratings (1-10 scale)
- get_recent_wellbeing_logs: Check their wellbeing trends over recent days
- notify_family: Send messages to their family members
- escalate_emergency: Alert family immediately for emergencies
- read_family_messages: Read recent messages from family
- check_emergency_keywords: Automatically check for emergency situations

WELLBEING LOGGING: When they mention how they're feeling, offer to log it: "Would you like me to record how you're feeling today?" Use 1-10 scales: mood (1=very sad, 10=very happy), energy (1=exhausted, 10=energetic), pain (0=no pain, 10=severe), sleep (1=terrible, 5=excellent).

EMERGENCY DETECTION: If they mention pain, falling, breathing problems, chest pain, feeling confused, or need help, use escalate_emergency immediately.

FAMILY CONNECTION: Encourage family connection by offering to check messages or send updates to family.

Be proactive in offering these tools when relevant, but don't overwhelm them.`
        },
        firstMessage: `Hello ${elderName}! I'm your AI companion, here to chat and help you stay connected with your family. How are you feeling today?`,
        language: "en"
      },
      tts: {
        voiceId: "Sarah" // Warm, friendly female voice
      }
    }
  });

  useEffect(() => {
    onConversationChange?.(conversationLog);
  }, [conversationLog, onConversationChange]);

  useEffect(() => {
    // Update AI speaking status based on conversation status
    if (conversation.isSpeaking) {
      onSpeakingChange?.(true);
    } else {
      onSpeakingChange?.(false);
    }
  }, [conversation.isSpeaking, onSpeakingChange]);

  const startConversation = async () => {
    try {
      console.log('Starting ElevenLabs conversation...');
      
      // Agent ID should be configured in production environment
      const agentId = process.env.ELEVENLABS_AGENT_ID || 'default-agent-id';
      
      await conversation.startSession({
        agentId: agentId // Using public agent approach for now
      });
      
      // Set volume
      await conversation.setVolume({ volume: volume });
      
      toast({
        title: "Voice Chat Started",
        description: "You can now speak naturally with your AI companion"
      });
      
    } catch (error) {
      console.error('Error starting conversation:', error);
      toast({
        title: "Connection Error",
        description: "Unable to start voice conversation. Please check your connection.",
        variant: "destructive"
      });
    }
  };

  const endConversation = async () => {
    try {
      await conversation.endSession();
      setConversationLog([]);
      onConversationChange?.([]);
    } catch (error) {
      console.error('Error ending conversation:', error);
    }
  };

  const toggleVolume = async () => {
    const newVolume = volume > 0 ? 0 : 0.8;
    setVolume(newVolume);
    if (isConnected) {
      await conversation.setVolume({ volume: newVolume });
    }
  };

  return (
    <div className="flex flex-col items-center space-y-4">
      {/* Connection Status */}
      {isConnected && (
        <div className="flex items-center space-x-2 px-3 py-2 bg-green-100 text-green-800 rounded-lg border">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-sm font-medium">Voice chat active</span>
          {conversation.isSpeaking && (
            <span className="text-xs">AI is speaking...</span>
          )}
        </div>
      )}
      
      <div className="flex items-center space-x-4">
        {/* Volume Control */}
        <Button
          variant="outline"
          size="lg"
          onClick={toggleVolume}
          className="h-12 w-12 rounded-full border-2"
          title={volume > 0 ? "Mute" : "Unmute"}
        >
          {volume > 0 ? (
            <Volume2 className="h-6 w-6" />
          ) : (
            <VolumeX className="h-6 w-6" />
          )}
        </Button>

        {/* Main Voice Control */}
        {!isConnected ? (
          <Button
            size="lg"
            onClick={startConversation}
            className="h-14 px-8 text-lg font-semibold bg-primary hover:bg-primary/90"
            disabled={conversation.status === 'connecting'}
          >
            <Phone className="h-6 w-6 mr-2" />
            {conversation.status === 'connecting' ? 'Connecting...' : 'Start Voice Chat'}
          </Button>
        ) : (
          <Button
            size="lg"
            onClick={endConversation}
            variant="outline"
            className="h-14 px-8 text-lg font-semibold border-2"
          >
            <PhoneOff className="h-6 w-6 mr-2" />
            End Call
          </Button>
        )}
      </div>
      
      {/* Instructions */}
      {isConnected && (
        <p className="text-sm text-muted-foreground text-center max-w-md">
          Speak naturally - I can help with weather, news, wellbeing tracking, 
          family messages, and emergencies. Just talk to me like a friend!
        </p>
      )}
    </div>
  );
};