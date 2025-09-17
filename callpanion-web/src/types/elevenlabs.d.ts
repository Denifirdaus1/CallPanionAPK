// Type definitions for ElevenLabs integration

export interface ElevenLabsCallData {
  sessionId: string;
  signedUrl: string;
  pairingToken?: string;
  relativeName: string;
  callType: 'in_app_call' | 'elevenlabs_call';
}

export interface ElevenLabsResponse {
  success: boolean;
  signedUrl?: string;
  conversationId?: string;
  error?: string;
}

export interface ConversationData {
  timestamp: Date;
  speaker: 'user' | 'ai';
  message: string;
  type: 'transcript' | 'event';
}

export interface CallSummary {
  duration: number;
  conversationData: ConversationData[];
  mood?: string;
  keyPoints?: string[];
}