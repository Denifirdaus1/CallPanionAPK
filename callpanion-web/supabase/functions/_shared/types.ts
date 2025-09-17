/**
 * Signal types for different health and wellness metrics
 */
export type SignalType = 
  | 'mood'
  | 'sleep'
  | 'pain'
  | 'activity'
  | 'social'
  | 'medication'
  | 'nutrition'
  | 'cognitive';

/**
 * Mood signal values
 */
export type MoodValue = 'very_low' | 'low' | 'neutral' | 'good' | 'very_good';

/**
 * Sleep quality values
 */
export type SleepValue = 'very_poor' | 'poor' | 'fair' | 'good' | 'excellent';

/**
 * Pain level values
 */
export type PainValue = 'none' | 'mild' | 'moderate' | 'severe' | 'extreme';

/**
 * Activity level values
 */
export type ActivityValue = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';

/**
 * Social interaction values
 */
export type SocialValue = 'isolated' | 'minimal' | 'some' | 'active' | 'very_social';

/**
 * Generic signal structure
 */
export interface Signal {
  type: SignalType;
  value: string | number;
  confidence?: number; // 0-1, how confident we are in this signal
  timestamp: string; // ISO timestamp
  source: 'conversation' | 'device' | 'manual' | 'inference';
  metadata?: Record<string, unknown>;
}

/**
 * Mood-specific signal
 */
export interface MoodSignal extends Signal {
  type: 'mood';
  value: MoodValue;
  triggers?: string[]; // What might have caused this mood
  context?: string; // Additional context about the mood
}

/**
 * Sleep-specific signal
 */
export interface SleepSignal extends Signal {
  type: 'sleep';
  value: SleepValue;
  duration_hours?: number;
  bedtime?: string;
  wake_time?: string;
  interruptions?: number;
}

/**
 * Pain-specific signal
 */
export interface PainSignal extends Signal {
  type: 'pain';
  value: PainValue;
  location?: string[];
  pain_type?: 'sharp' | 'dull' | 'throbbing' | 'burning' | 'aching';
  duration_description?: string;
}

/**
 * Activity-specific signal
 */
export interface ActivitySignal extends Signal {
  type: 'activity';
  value: ActivityValue;
  activity_type?: string;
  duration_minutes?: number;
  location?: string;
}

/**
 * Social interaction signal
 */
export interface SocialSignal extends Signal {
  type: 'social';
  value: SocialValue;
  interaction_type?: 'family' | 'friends' | 'neighbors' | 'healthcare' | 'community';
  participants?: number;
  quality?: 'poor' | 'fair' | 'good' | 'excellent';
}

/**
 * Union type for all signal types
 */
export type AnySignal = MoodSignal | SleepSignal | PainSignal | ActivitySignal | SocialSignal | Signal;

/**
 * Payload for saving signals to the database
 */
export interface SavePayload {
  customer_id: string;
  household_id?: string;
  signals: AnySignal[];
  transcript?: string;
  conversation_summary?: string;
  call_id?: string;
  processed_at: string; // ISO timestamp
  processing_version?: string; // Version of AI model/logic used
}

/**
 * Response from signal processing
 */
export interface ProcessingResult {
  success: boolean;
  signals_extracted: number;
  alerts_generated?: number;
  confidence_score?: number;
  processing_time_ms?: number;
  errors?: string[];
}