import { supabase } from '@/integrations/supabase/client';

export class AudioRecorder {
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;

  constructor(private onAudioData: (audioData: Float32Array) => void) {}

  async start() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 24000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      this.audioContext = new AudioContext({
        sampleRate: 24000,
      });
      
      this.source = this.audioContext.createMediaStreamSource(this.stream);
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
      
      this.processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        this.onAudioData(new Float32Array(inputData));
      };
      
      this.source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      throw error;
    }
  }

  stop() {
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}

export const encodeAudioForAPI = (float32Array: Float32Array): string => {
  const int16Array = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  
  const uint8Array = new Uint8Array(int16Array.buffer);
  let binary = '';
  const chunkSize = 0x8000;
  
  for (let i = 0; i < uint8Array.length; i += chunkSize) {
    const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  
  return btoa(binary);
};

// Audio queue for sequential playback
class AudioQueue {
  private queue: Uint8Array[] = [];
  private isPlaying = false;
  private audioContext: AudioContext;

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext;
  }

  async addToQueue(audioData: Uint8Array) {
    this.queue.push(audioData);
    if (!this.isPlaying) {
      await this.playNext();
    }
  }

  private async playNext() {
    if (this.queue.length === 0) {
      this.isPlaying = false;
      return;
    }

    this.isPlaying = true;
    const audioData = this.queue.shift()!;

    try {
      const wavData = this.createWavFromPCM(audioData);
      const audioBuffer = await this.audioContext.decodeAudioData(wavData.buffer);
      
      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioContext.destination);
      
      source.onended = () => this.playNext();
      source.start(0);
    } catch (error) {
      console.error('Error playing audio:', error);
      this.playNext(); // Continue with next segment even if current fails
    }
  }

  private createWavFromPCM(pcmData: Uint8Array): Uint8Array {
    // Convert bytes to 16-bit samples
    const int16Data = new Int16Array(pcmData.length / 2);
    for (let i = 0; i < pcmData.length; i += 2) {
      int16Data[i / 2] = (pcmData[i + 1] << 8) | pcmData[i];
    }
    
    // Create WAV header
    const wavHeader = new ArrayBuffer(44);
    const view = new DataView(wavHeader);
    
    const writeString = (view: DataView, offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    // WAV header parameters
    const sampleRate = 24000;
    const numChannels = 1;
    const bitsPerSample = 16;
    const blockAlign = (numChannels * bitsPerSample) / 8;
    const byteRate = sampleRate * blockAlign;

    // Write WAV header
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + int16Data.byteLength, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    writeString(view, 36, 'data');
    view.setUint32(40, int16Data.byteLength, true);

    // Combine header and data
    const wavArray = new Uint8Array(wavHeader.byteLength + int16Data.byteLength);
    wavArray.set(new Uint8Array(wavHeader), 0);
    wavArray.set(new Uint8Array(int16Data.buffer), wavHeader.byteLength);
    
    return wavArray;
  }
}

export class RealtimeAICall {
  private ws: WebSocket | null = null;
  private recorder: AudioRecorder | null = null;
  private audioQueue: AudioQueue | null = null;
  private audioContext: AudioContext | null = null;
  private isCallActive = false;

  constructor(
    private onMessage: (message: any) => void,
    private onCallStateChange: (state: string) => void
  ) {}

  async startCall(relativeId: string) {
    try {
      console.log('Starting AI call for relative:', relativeId);
      this.onCallStateChange('connecting');

      // Initialize audio context
      this.audioContext = new AudioContext({ sampleRate: 24000 });
      this.audioQueue = new AudioQueue(this.audioContext);

      // Get current session token for authentication
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No valid authentication session');
      }

      // Connect to the AI calling WebSocket with authentication
      const wsUrl = `wss://umjtepmdwfyfhdzbkyli.functions.supabase.co/functions/v1/ai-realtime-call?token=${session.access_token}`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('Connected to AI call service');
        this.onCallStateChange('connected');
        
        // Start the call
        this.ws?.send(JSON.stringify({
          type: 'start_call',
          relativeId
        }));
      };

      this.ws.onmessage = async (event) => {
        const message = JSON.parse(event.data);
        console.log('Received message:', message.type);

        switch (message.type) {
          case 'connection_established':
            this.onMessage({ type: 'info', text: 'Connected to AI service' });
            break;

          case 'call_starting':
            this.isCallActive = true;
            this.onCallStateChange('call_active');
            this.onMessage({ type: 'info', text: 'Call started' });
            
            // Start recording
            await this.startRecording();
            break;

          case 'openai_message':
            await this.handleOpenAIMessage(message.data);
            break;

          case 'call_ended':
            this.isCallActive = false;
            this.onCallStateChange('call_ended');
            this.onMessage({ 
              type: 'call_summary', 
              summary: message.summary 
            });
            break;

          case 'error':
            this.onMessage({ type: 'error', text: message.message });
            this.onCallStateChange('error');
            break;

          default:
            this.onMessage(message);
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.onMessage({ type: 'error', text: 'Connection error' });
        this.onCallStateChange('error');
      };

      this.ws.onclose = () => {
        console.log('WebSocket closed');
        this.cleanup();
        this.onCallStateChange('disconnected');
      };

    } catch (error) {
      console.error('Error starting call:', error);
      this.onMessage({ type: 'error', text: 'Failed to start call' });
      this.onCallStateChange('error');
    }
  }

  private async handleOpenAIMessage(data: any) {
    switch (data.type) {
      case 'session.created':
        console.log('OpenAI session created');
        this.onMessage({ type: 'info', text: 'AI is ready' });
        break;

      case 'response.audio.delta':
        // Play audio from AI
        if (this.audioQueue) {
          const binaryString = atob(data.delta);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          await this.audioQueue.addToQueue(bytes);
        }
        break;

      case 'response.audio_transcript.delta':
        // Show AI transcript
        this.onMessage({ 
          type: 'ai_transcript', 
          text: data.delta,
          isComplete: false 
        });
        break;

      case 'response.audio_transcript.done':
        this.onMessage({ 
          type: 'ai_transcript', 
          text: data.transcript,
          isComplete: true 
        });
        break;

      case 'conversation.item.input_audio_transcription.completed':
        // Show user transcript
        this.onMessage({ 
          type: 'user_transcript', 
          text: data.transcript 
        });
        break;

      case 'response.done':
        console.log('AI response completed');
        break;

      default:
        console.log('Unhandled OpenAI message:', data.type);
    }
  }

  private async startRecording() {
    try {
      this.recorder = new AudioRecorder((audioData) => {
        if (this.ws && this.ws.readyState === WebSocket.OPEN && this.isCallActive) {
          const encodedAudio = encodeAudioForAPI(audioData);
          this.ws.send(JSON.stringify({
            type: 'audio_data',
            audio: encodedAudio
          }));
        }
      });

      await this.recorder.start();
      console.log('Recording started');
    } catch (error) {
      console.error('Error starting recording:', error);
      this.onMessage({ type: 'error', text: 'Microphone access failed' });
    }
  }

  endCall() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'end_call' }));
    }
    this.cleanup();
  }

  private cleanup() {
    this.isCallActive = false;
    
    if (this.recorder) {
      this.recorder.stop();
      this.recorder = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.audioQueue = null;
  }

  isActive() {
    return this.isCallActive;
  }
}