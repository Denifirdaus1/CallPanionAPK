# Complete ElevenLabs ConvAI WebRTC Implementation Guide

ElevenLabs ConvAI WebRTC integration with Supabase Edge Functions and Flutter native bridges delivers sub-100ms latency for real-time conversational AI applications. This implementation leverages conversation tokens for secure authentication, WebRTC for superior audio processing with automatic echo cancellation, and native mobile SDKs for production-grade voice experiences. The architecture combines ElevenLabs' advanced speech processing with Supabase's real-time infrastructure and Flutter's cross-platform capabilities to create scalable, secure conversational AI applications.

**WebRTC offers significant advantages over WebSocket alternatives**, including built-in echo cancellation, background noise removal, and optimized audio codecs. The conversation token system provides ephemeral authentication (10-minute validity), while Supabase Edge Functions enable secure server-side token generation. Native iOS and Android SDKs ensure optimal performance and system integration, including CallKit support for seamless call experiences.

## Architecture overview

The implementation follows a three-tier architecture: **Supabase Edge Functions generate secure conversation tokens**, **Flutter coordinates cross-platform functionality through method channels**, and **native SDKs handle WebRTC connections directly with ElevenLabs**. This design separates concerns effectively - server-side security, cross-platform coordination, and platform-optimized audio processing.

## Core infrastructure setup

### Supabase project configuration

Initialize your Supabase project with the required database schema for conversation tracking and session management:

```sql
-- Enable RLS on all tables
CREATE TABLE conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  session_id text UNIQUE NOT NULL,
  status text DEFAULT 'active' CHECK (status IN ('active', 'completed', 'failed', 'terminated')),
  conversation_config jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  ended_at timestamptz
);

CREATE TABLE conversation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES conversations(id) NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('start', 'message', 'interrupt', 'end', 'error')),
  event_data jsonb NOT NULL,
  timestamp timestamptz DEFAULT now(),
  sequence_number integer NOT NULL
);

-- Enable Row Level Security
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can only access their own conversations" 
  ON conversations FOR ALL TO authenticated 
  USING (auth.uid() = user_id);
```

Configure your environment secrets in Supabase:

```bash
supabase secrets set ELEVENLABS_API_KEY="your_elevenlabs_api_key"
supabase secrets set ELEVENLABS_AGENT_ID="your_agent_id"
```

### ElevenLabs agent configuration

Create and configure your conversational AI agent through the ElevenLabs dashboard. **Key configuration parameters include voice selection, conversation prompt, dynamic variables, and webhook endpoints**. The agent supports 32+ languages with automatic detection and allows custom turn-taking models for natural conversation flow.

Configure dynamic variables for runtime personalization:

```json
{
  "user_name": "{{ user_name }}",
  "session_context": "{{ session_context }}",
  "custom_instructions": "{{ custom_instructions }}"
}
```

## Supabase Edge Functions implementation

### Secure token generation endpoint

Create a robust token generation function that handles authentication, session tracking, and secure communication with ElevenLabs:

```typescript
// supabase/functions/generate-conversation-token/index.ts
import { createClient } from 'npm:@supabase/supabase-js@2'

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Extract and validate user
    const token = req.headers.get('Authorization')?.replace('Bearer ', '')
    if (!token) {
      return new Response('Unauthorized', { status: 401, headers: corsHeaders })
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)
    if (authError || !user) {
      return new Response('Invalid token', { status: 401, headers: corsHeaders })
    }

    const { agentId, dynamicVariables = {} } = await req.json()

    // Generate ElevenLabs conversation token
    const elevenLabsResponse = await fetch('https://api.elevenlabs.io/v1/convai/conversations/webrtc', {
      method: 'GET',
      headers: {
        'xi-api-key': Deno.env.get('ELEVENLABS_API_KEY')!,
      },
      params: new URLSearchParams({
        agent_id: agentId,
        participant_name: user.email || 'User'
      })
    })

    if (!elevenLabsResponse.ok) {
      throw new Error(`ElevenLabs API error: ${elevenLabsResponse.statusText}`)
    }

    const { token: conversationToken } = await elevenLabsResponse.json()

    // Store session in database
    const { data: conversation, error: dbError } = await supabaseAdmin
      .from('conversations')
      .insert({
        user_id: user.id,
        session_id: conversationToken,
        conversation_config: {
          agent_id: agentId,
          dynamic_variables: dynamicVariables
        }
      })
      .select()
      .single()

    if (dbError) throw dbError

    return new Response(JSON.stringify({
      conversation_token: conversationToken,
      conversation_id: conversation.id,
      expires_in: 600 // 10 minutes
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    })

  } catch (error) {
    console.error('Token generation error:', error)
    return new Response(JSON.stringify({ 
      error: 'Token generation failed',
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
```

### Session management and real-time updates

Implement session tracking with real-time subscriptions for conversation state management:

```typescript
// supabase/functions/conversation-webhook/index.ts
Deno.serve(async (req) => {
  try {
    const webhook_data = await req.json()
    
    // Verify webhook signature (implement HMAC verification)
    const signature = req.headers.get('x-elevenlabs-signature')
    if (!verifyWebhookSignature(webhook_data, signature)) {
      return new Response('Invalid signature', { status: 401 })
    }

    const { conversation_id, event_type, event_data } = webhook_data

    // Update conversation status
    await supabaseAdmin
      .from('conversations')
      .update({ 
        status: event_type === 'conversation.ended' ? 'completed' : 'active',
        updated_at: new Date().toISOString()
      })
      .eq('session_id', conversation_id)

    // Log conversation event
    await supabaseAdmin
      .from('conversation_events')
      .insert({
        conversation_id,
        event_type,
        event_data,
        sequence_number: event_data.sequence || 0
      })

    // Broadcast real-time update
    const channel = supabase.channel(`conversation:${conversation_id}`)
    await channel.send({
      type: 'broadcast',
      event: 'conversation_update',
      payload: { event_type, event_data }
    })

    return new Response(JSON.stringify({ status: 'processed' }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200
    })

  } catch (error) {
    console.error('Webhook processing error:', error)
    return new Response(JSON.stringify({ error: 'Processing failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})
```

## Flutter integration architecture

### Method channel setup and communication

Establish bidirectional communication between Dart and native platforms using Flutter's method channels:

```dart
// lib/services/elevenlabs_service.dart
import 'package:flutter/services.dart';

class ElevenLabsService {
  static const MethodChannel _methodChannel = 
      MethodChannel('com.yourapp.elevenlabs/conversation');
  
  static const EventChannel _eventChannel = 
      EventChannel('com.yourapp.elevenlabs/events');

  // Start conversation with token
  Future<String> startConversation({
    required String conversationToken,
    Map<String, dynamic>? dynamicVariables,
  }) async {
    try {
      final conversationId = await _methodChannel.invokeMethod('startConversation', {
        'token': conversationToken,
        'dynamicVariables': dynamicVariables ?? {},
      });
      
      return conversationId as String;
    } on PlatformException catch (e) {
      throw ConversationException(_mapErrorCode(e.code), e.message ?? 'Unknown error');
    }
  }

  // End active conversation
  Future<void> endConversation() async {
    try {
      await _methodChannel.invokeMethod('endConversation');
    } on PlatformException catch (e) {
      throw ConversationException(_mapErrorCode(e.code), e.message ?? 'Failed to end conversation');
    }
  }

  // Stream conversation events
  Stream<ConversationEvent> get conversationEvents {
    return _eventChannel
        .receiveBroadcastStream()
        .map((data) => ConversationEvent.fromJson(Map<String, dynamic>.from(data)));
  }

  ConversationErrorType _mapErrorCode(String code) {
    switch (code) {
      case 'PERMISSION_DENIED': return ConversationErrorType.permissionDenied;
      case 'NETWORK_ERROR': return ConversationErrorType.networkError;
      case 'TOKEN_EXPIRED': return ConversationErrorType.tokenExpired;
      case 'API_ERROR': return ConversationErrorType.apiError;
      default: return ConversationErrorType.unknown;
    }
  }
}

// Data models
class ConversationEvent {
  final String type;
  final Map<String, dynamic> data;
  final DateTime timestamp;

  ConversationEvent({
    required this.type,
    required this.data,
    required this.timestamp,
  });

  factory ConversationEvent.fromJson(Map<String, dynamic> json) {
    return ConversationEvent(
      type: json['type'],
      data: Map<String, dynamic>.from(json['data']),
      timestamp: DateTime.parse(json['timestamp']),
    );
  }
}
```

### Permission handling and audio setup

Implement comprehensive permission management for microphone access and audio processing:

```dart
// lib/services/permission_service.dart
import 'package:permission_handler/permission_handler.dart';

class PermissionService {
  static Future<bool> requestMicrophonePermission() async {
    final status = await Permission.microphone.request();
    
    switch (status) {
      case PermissionStatus.granted:
        return true;
      case PermissionStatus.denied:
        return false;
      case PermissionStatus.permanentlyDenied:
        await openAppSettings();
        return false;
      case PermissionStatus.restricted:
        return false;
      default:
        return false;
    }
  }

  static Future<bool> checkMicrophonePermission() async {
    return await Permission.microphone.isGranted;
  }
}
```

## Native iOS implementation with Swift

### Core Swift bridge implementation

Create a comprehensive iOS implementation that integrates ElevenLabs Swift SDK with Flutter:

```swift
// ios/Runner/ElevenLabsBridge.swift
import Flutter
import ElevenLabsSwift
import CallKit
import AVFoundation

class ElevenLabsBridge: NSObject, FlutterPlugin {
    private var conversation: Conversation?
    private var eventSink: FlutterEventSink?
    private let callKitManager = CallKitManager()
    
    static func register(with registrar: FlutterPluginRegistrar) {
        let methodChannel = FlutterMethodChannel(
            name: "com.yourapp.elevenlabs/conversation",
            binaryMessenger: registrar.messenger()
        )
        
        let eventChannel = FlutterEventChannel(
            name: "com.yourapp.elevenlabs/events", 
            binaryMessenger: registrar.messenger()
        )
        
        let instance = ElevenLabsBridge()
        registrar.addMethodCallDelegate(instance, channel: methodChannel)
        eventChannel.setStreamHandler(instance)
    }
    
    func handle(_ call: FlutterMethodCall, result: @escaping FlutterResult) {
        switch call.method {
        case "startConversation":
            handleStartConversation(call: call, result: result)
        case "endConversation":
            handleEndConversation(result: result)
        case "sendMessage":
            handleSendMessage(call: call, result: result)
        default:
            result(FlutterMethodNotImplemented)
        }
    }
    
    private func handleStartConversation(call: FlutterMethodCall, result: @escaping FlutterResult) {
        guard let args = call.arguments as? [String: Any],
              let token = args["token"] as? String else {
            result(FlutterError(code: "INVALID_ARGUMENT", message: "Token required", details: nil))
            return
        }
        
        // Configure audio session
        do {
            let audioSession = AVAudioSession.sharedInstance()
            try audioSession.setCategory(.playAndRecord, mode: .voiceChat, options: [.allowBluetooth, .defaultToSpeaker])
            try audioSession.setActive(true)
        } catch {
            result(FlutterError(code: "AUDIO_SESSION_ERROR", message: error.localizedDescription, details: nil))
            return
        }
        
        conversation = Conversation()
        setupConversationHandlers()
        
        let dynamicVariables = args["dynamicVariables"] as? [String: String] ?? [:]
        
        Task {
            do {
                let conversationId = try await conversation!.startSession(
                    config: ConversationConfig(
                        conversationToken: token,
                        dynamicVariables: dynamicVariables
                    )
                )
                
                DispatchQueue.main.async {
                    result(conversationId)
                }
            } catch {
                DispatchQueue.main.async {
                    self.handleError(error, result: result)
                }
            }
        }
    }
    
    private func setupConversationHandlers() {
        conversation?.onConnect = { [weak self] conversationId in
            self?.sendEvent(type: "connected", data: ["conversation_id": conversationId])
        }
        
        conversation?.onMessage = { [weak self] source, message in
            self?.sendEvent(type: "message", data: [
                "source": source.rawValue,
                "message": message
            ])
        }
        
        conversation?.onModeChange = { [weak self] mode in
            self?.sendEvent(type: "mode_change", data: ["mode": mode.rawValue])
        }
        
        conversation?.onStatusChange = { [weak self] status in
            self?.sendEvent(type: "status_change", data: ["status": status.rawValue])
        }
    }
    
    private func sendEvent(type: String, data: [String: Any]) {
        let event = [
            "type": type,
            "data": data,
            "timestamp": ISO8601DateFormatter().string(from: Date())
        ] as [String : Any]
        
        DispatchQueue.main.async {
            self.eventSink?(event)
        }
    }
    
    private func handleError(_ error: Error, result: FlutterResult) {
        if let elevenLabsError = error as? ElevenLabsError {
            switch elevenLabsError {
            case .permissionDenied:
                result(FlutterError(code: "PERMISSION_DENIED", message: "Microphone permission required", details: nil))
            case .networkError:
                result(FlutterError(code: "NETWORK_ERROR", message: "Network connectivity issue", details: nil))
            case .tokenExpired:
                result(FlutterError(code: "TOKEN_EXPIRED", message: "Conversation token has expired", details: nil))
            default:
                result(FlutterError(code: "API_ERROR", message: error.localizedDescription, details: nil))
            }
        } else {
            result(FlutterError(code: "UNKNOWN_ERROR", message: error.localizedDescription, details: nil))
        }
    }
}

// MARK: - FlutterStreamHandler
extension ElevenLabsBridge: FlutterStreamHandler {
    func onListen(withArguments arguments: Any?, eventSink events: @escaping FlutterEventSink) -> FlutterError? {
        eventSink = events
        return nil
    }
    
    func onCancel(withArguments arguments: Any?) -> FlutterError? {
        eventSink = nil
        return nil
    }
}
```

### CallKit integration for native call experience

Implement CallKit for seamless iOS call integration:

```swift
// ios/Runner/CallKitManager.swift
import CallKit

class CallKitManager: NSObject {
    private let provider: CXProvider
    private let callController = CXCallController()
    
    override init() {
        let config = CXProviderConfiguration(localizedName: "ElevenLabs Voice")
        config.maximumCallGroups = 1
        config.maximumCallsPerCallGroup = 1
        config.supportsVideo = false
        config.supportedHandleTypes = [.generic]
        config.iconTemplateImageData = UIImage(named: "CallKitIcon")?.pngData()
        
        provider = CXProvider(configuration: config)
        super.init()
        provider.setDelegate(self, queue: nil)
    }
    
    func reportIncomingCall(uuid: UUID, handle: String, completion: @escaping (Error?) -> Void) {
        let update = CXCallUpdate()
        update.remoteHandle = CXHandle(type: .generic, value: handle)
        update.hasVideo = false
        update.localizedCallerName = "AI Assistant"
        
        provider.reportNewIncomingCall(with: uuid, update: update, completion: completion)
    }
}

extension CallKitManager: CXProviderDelegate {
    func providerDidReset(_ provider: CXProvider) {
        // Handle provider reset
    }
    
    func provider(_ provider: CXProvider, perform action: CXAnswerCallAction) {
        // Configure audio and start conversation
        action.fulfill()
    }
    
    func provider(_ provider: CXProvider, perform action: CXEndCallAction) {
        // End conversation
        action.fulfill()
    }
}
```

## Native Android implementation with Kotlin

### Core Android bridge implementation

Develop a robust Android implementation using the ElevenLabs Android SDK:

```kotlin
// android/app/src/main/kotlin/ElevenLabsPlugin.kt
package com.yourapp.elevenlabs

import io.flutter.plugin.common.*
import io.flutter.plugin.common.EventChannel.StreamHandler
import io.elevenlabs.sdk.*
import kotlinx.coroutines.*

class ElevenLabsPlugin : FlutterPlugin, MethodCallHandler, StreamHandler {
    private var methodChannel: MethodChannel? = null
    private var eventChannel: EventChannel? = null
    private var eventSink: EventChannel.EventSink? = null
    
    private var elevenLabsSDK: ElevenLabsSDK? = null
    private var conversationSession: ConversationSession? = null
    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())
    
    override fun onAttachedToEngine(flutterPluginBinding: FlutterPlugin.FlutterPluginBinding) {
        methodChannel = MethodChannel(flutterPluginBinding.binaryMessenger, "com.yourapp.elevenlabs/conversation")
        methodChannel?.setMethodCallHandler(this)
        
        eventChannel = EventChannel(flutterPluginBinding.binaryMessenger, "com.yourapp.elevenlabs/events")
        eventChannel?.setStreamHandler(this)
        
        elevenLabsSDK = ElevenLabsSDK.create()
    }
    
    override fun onMethodCall(call: MethodCall, result: MethodChannel.Result) {
        when (call.method) {
            "startConversation" -> handleStartConversation(call, result)
            "endConversation" -> handleEndConversation(result)
            "sendMessage" -> handleSendMessage(call, result)
            else -> result.notImplemented()
        }
    }
    
    private fun handleStartConversation(call: MethodCall, result: MethodChannel.Result) {
        val token = call.argument<String>("token")
        if (token == null) {
            result.error("INVALID_ARGUMENT", "Token required", null)
            return
        }
        
        val dynamicVariables = call.argument<Map<String, String>>("dynamicVariables") ?: emptyMap()
        
        scope.launch {
            try {
                conversationSession = elevenLabsSDK?.createConversationSession(
                    ConversationConfig(
                        conversationToken = token,
                        dynamicVariables = dynamicVariables
                    )
                )
                
                setupSessionHandlers()
                val conversationId = conversationSession?.startSession()
                
                withContext(Dispatchers.Main) {
                    result.success(conversationId)
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    handleError(e, result)
                }
            }
        }
    }
    
    private fun setupSessionHandlers() {
        conversationSession?.apply {
            onConnect { conversationId ->
                sendEvent("connected", mapOf("conversation_id" to conversationId))
            }
            
            onMessage { source, message ->
                sendEvent("message", mapOf(
                    "source" to source.name,
                    "message" to message
                ))
            }
            
            onModeChange { mode ->
                sendEvent("mode_change", mapOf("mode" to mode.name))
            }
            
            onStatusChange { status ->
                sendEvent("status_change", mapOf("status" to status.name))
            }
        }
    }
    
    private fun sendEvent(type: String, data: Map<String, Any>) {
        val event = mapOf(
            "type" to type,
            "data" to data,
            "timestamp" to System.currentTimeMillis()
        )
        
        Handler(Looper.getMainLooper()).post {
            eventSink?.success(event)
        }
    }
    
    private fun handleError(error: Exception, result: MethodChannel.Result) {
        when (error) {
            is PermissionException -> 
                result.error("PERMISSION_DENIED", "Microphone permission required", null)
            is NetworkException -> 
                result.error("NETWORK_ERROR", "Network connectivity issue", null)
            is TokenExpiredException -> 
                result.error("TOKEN_EXPIRED", "Conversation token has expired", null)
            is ElevenLabsException -> 
                result.error("API_ERROR", error.message, null)
            else -> 
                result.error("UNKNOWN_ERROR", error.message, null)
        }
    }
    
    override fun onListen(arguments: Any?, events: EventChannel.EventSink?) {
        eventSink = events
    }
    
    override fun onCancel(arguments: Any?) {
        eventSink = null
    }
}
```

## WebRTC configuration and optimization

### Connection establishment and session management

Implement robust WebRTC connection handling with comprehensive error recovery:

```dart
// lib/services/webrtc_manager.dart
class WebRTCManager {
  RTCPeerConnection? _peerConnection;
  MediaStream? _localStream;
  final List<RTCIceCandidate> _remoteCandidates = [];
  
  // ICE configuration with STUN servers
  final Map<String, dynamic> _iceConfig = {
    'iceServers': [
      {'urls': 'stun:stun.l.google.com:19302'},
      {'urls': 'stun:stun1.l.google.com:19302'},
    ],
    'iceCandidatePoolSize': 10,
  };

  Future<RTCSessionDescription> createOffer() async {
    _peerConnection = await createPeerConnection(_iceConfig);
    
    // Get user media with optimized constraints
    final mediaConstraints = {
      'audio': {
        'echoCancellation': true,
        'noiseSuppression': true,
        'autoGainControl': true,
        'sampleRate': 48000,
        'channelCount': 1
      },
      'video': false
    };
    
    _localStream = await navigator.mediaDevices.getUserMedia(mediaConstraints);
    
    // Add tracks to peer connection
    _localStream!.getTracks().forEach((track) {
      _peerConnection!.addTrack(track, _localStream!);
    });
    
    // Set up event handlers
    _setupEventHandlers();
    
    // Create and return offer
    final offer = await _peerConnection!.createOffer();
    await _peerConnection!.setLocalDescription(offer);
    
    return offer;
  }
  
  void _setupEventHandlers() {
    _peerConnection!.onConnectionState = (state) {
      print('WebRTC Connection State: $state');
      switch (state) {
        case RTCPeerConnectionState.RTCPeerConnectionStateConnected:
          _onConnected();
          break;
        case RTCPeerConnectionState.RTCPeerConnectionStateDisconnected:
          _handleDisconnection();
          break;
        case RTCPeerConnectionState.RTCPeerConnectionStateFailed:
          _handleConnectionFailure();
          break;
      }
    };
    
    _peerConnection!.onIceCandidate = (candidate) {
      // Send candidate through signaling channel
      _sendIceCandidate(candidate);
    };
  }
  
  Future<void> _handleConnectionFailure() async {
    print('WebRTC connection failed, attempting ICE restart');
    try {
      final offer = await _peerConnection!.createOffer({'iceRestart': true});
      await _peerConnection!.setLocalDescription(offer);
      // Send restart offer through signaling
    } catch (error) {
      print('ICE restart failed: $error');
    }
  }
}
```

### Audio codec optimization and quality control

Configure optimal audio settings for conversational AI:

```javascript
// WebRTC SDP optimization for Opus codec
function optimizeOpusSettings(sdp) {
  return sdp.replace(
    /a=fmtp:111 (.+)/g,
    'a=fmtp:111 minptime=10;useinbandfec=1;stereo=0;cbr=1;maxaveragebitrate=32000;maxplaybackrate=48000;usedtx=1'
  );
}

// Adaptive bitrate control based on network conditions
class AdaptiveBitrateController {
  constructor(peerConnection) {
    this.pc = peerConnection;
    this.currentBitrate = 32000;
    this.minBitrate = 16000;
    this.maxBitrate = 64000;
  }
  
  async adjustBitrate(networkCondition) {
    const sender = this.pc.getSenders().find(s => 
      s.track && s.track.kind === 'audio'
    );
    
    if (!sender) return;
    
    const params = sender.getParameters();
    
    switch (networkCondition) {
      case 'poor':
        this.currentBitrate = this.minBitrate;
        break;
      case 'excellent':
        this.currentBitrate = this.maxBitrate;
        break;
      default:
        this.currentBitrate = 32000;
    }
    
    if (params.encodings && params.encodings[0]) {
      params.encodings[0].maxBitrate = this.currentBitrate;
      await sender.setParameters(params);
    }
  }
}
```

## Security implementation and production deployment

### Comprehensive security architecture

Implement multi-layered security with proper authentication, authorization, and data protection:

```typescript
// Webhook signature verification
function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload, 'utf8')
    .digest('hex');
    
  const receivedSignature = signature.replace('sha256=', '');
  
  // Use constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature, 'hex'),
    Buffer.from(receivedSignature, 'hex')
  );
}

// Rate limiting implementation with token bucket
class RateLimiter {
  private buckets = new Map<string, TokenBucket>();
  
  isAllowed(identifier: string, tokensRequested: number = 1): boolean {
    let bucket = this.buckets.get(identifier);
    
    if (!bucket) {
      bucket = new TokenBucket(100, 10); // 100 capacity, 10 tokens/second
      this.buckets.set(identifier, bucket);
    }
    
    return bucket.consume(tokensRequested);
  }
}
```

### Production deployment configuration

Configure robust production infrastructure with monitoring and observability:

```yaml
# docker-compose.production.yml
version: '3.8'
services:
  app:
    image: your-app:latest
    environment:
      - NODE_ENV=production
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
      - ELEVENLABS_API_KEY=${ELEVENLABS_API_KEY}
    deploy:
      replicas: 3
      resources:
        limits:
          memory: 512M
          cpus: '0.5'
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

## Error handling and monitoring strategies

### Comprehensive error management

Implement robust error handling across all layers of the application:

```dart
// lib/models/conversation_exceptions.dart
abstract class ConversationException implements Exception {
  final String message;
  final ConversationErrorType type;
  
  ConversationException(this.type, this.message);
}

class TokenExpiredException extends ConversationException {
  TokenExpiredException() : super(ConversationErrorType.tokenExpired, 'Conversation token has expired');
}

class NetworkException extends ConversationException {
  NetworkException(String details) : super(ConversationErrorType.networkError, 'Network error: $details');
}

// Error recovery strategies
class ConversationManager {
  Future<void> handleError(ConversationException error) async {
    switch (error.type) {
      case ConversationErrorType.tokenExpired:
        await _refreshToken();
        await _retryConnection();
        break;
      case ConversationErrorType.networkError:
        await _implementExponentialBackoff();
        break;
      case ConversationErrorType.permissionDenied:
        await _requestPermissions();
        break;
    }
  }
  
  Future<void> _implementExponentialBackoff() async {
    for (int attempt = 0; attempt < 3; attempt++) {
      await Future.delayed(Duration(milliseconds: pow(2, attempt).toInt() * 1000));
      try {
        await _retryConnection();
        break;
      } catch (e) {
        if (attempt == 2) rethrow;
      }
    }
  }
}
```

### Production monitoring and observability

Implement comprehensive monitoring for production deployments:

```typescript
// Production monitoring setup
const monitoring = {
  // Key performance indicators
  metrics: {
    conversationLatency: 'Time from user speech to AI response',
    connectionSuccess: 'Percentage of successful WebRTC connections',
    audioQuality: 'Jitter, packet loss, and audio level metrics',
    tokenGenerationTime: 'Time to generate conversation tokens',
    errorRates: 'Error rates by type and endpoint'
  },
  
  // Alerting thresholds
  alerts: {
    highLatency: 'Alert when conversation latency > 500ms',
    connectionFailures: 'Alert when connection success < 95%',
    highErrorRate: 'Alert when error rate > 5%',
    tokenExpiration: 'Alert on excessive token expiration events'
  },
  
  // Health checks
  healthChecks: [
    'Supabase database connectivity',
    'ElevenLabs API accessibility',
    'WebRTC STUN server availability',
    'Audio device detection'
  ]
};
```

## Testing and troubleshooting guide

### Comprehensive testing strategy

Develop thorough testing procedures for all system components:

```dart
// test/integration/conversation_flow_test.dart
void main() {
  group('ElevenLabs ConvAI Integration Tests', () {
    late ElevenLabsService service;
    late MockSupabaseClient mockSupabase;
    
    setUp(() {
      service = ElevenLabsService();
      mockSupabase = MockSupabaseClient();
    });
    
    testWidgets('Complete conversation flow', (tester) async {
      // Test token generation
      final token = await service.generateConversationToken(
        agentId: 'test_agent',
        userId: 'test_user'
      );
      expect(token, isNotNull);
      expect(token.length, greaterThan(0));
      
      // Test conversation initialization
      final conversationId = await service.startConversation(
        conversationToken: token,
        dynamicVariables: {'user_name': 'Test User'}
      );
      expect(conversationId, isNotNull);
      
      // Test event streaming
      final events = service.conversationEvents;
      expectLater(events, emits(predicate<ConversationEvent>((event) => 
        event.type == 'connected'
      )));
      
      // Test conversation termination
      await service.endConversation();
    });
  });
}
```

### Common troubleshooting scenarios

Document solutions for frequent implementation challenges:

**Token Expiration Issues:**
- Implement automatic token refresh 2 minutes before expiration
- Cache valid tokens and reuse across multiple conversation attempts
- Handle token refresh failures gracefully with user notifications

**WebRTC Connection Failures:**
- Verify STUN server accessibility from client network
- Check firewall configurations for UDP traffic
- Implement ICE restart mechanism for connection recovery
- Test different ICE candidate gathering policies

**Audio Quality Problems:**
- Verify microphone permissions and device availability
- Monitor audio levels and packet loss statistics
- Implement adaptive bitrate based on network conditions
- Test echo cancellation effectiveness in different environments

**Platform-Specific Issues:**
- iOS: Ensure proper Info.plist configuration for microphone usage
- Android: Verify runtime permission handling for API level 23+
- Flutter: Check method channel registration and event stream handling

This comprehensive implementation guide provides all necessary components for building production-ready ElevenLabs ConvAI applications with WebRTC, Supabase integration, and Flutter native bridges. **The architecture ensures optimal performance, security, and scalability** while maintaining consistent user experience across iOS and Android platforms.