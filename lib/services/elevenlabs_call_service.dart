import 'package:http/http.dart' as http;
import 'dart:convert';
import 'dart:async';
import 'package:flutter/services.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/call_data.dart';
import '../utils/constants.dart';

// Enhanced enums and models
enum ConversationState {
  idle,
  connecting,
  connected,
  disconnected,
  error
}

enum ConversationEventType {
  conversationConnected,
  conversationFailed,
  conversationEnded,
  microphoneStateChanged,
  textMessageSent,
  conversationEvent
}

class ConversationEvent {
  final ConversationEventType type;
  final Map<String, dynamic> data;
  final DateTime timestamp;

  ConversationEvent({
    required this.type,
    required this.data,
    required this.timestamp,
  });

  factory ConversationEvent.fromEventChannel(Map<String, dynamic> eventData) {
    final eventType = eventData['type'] as String;
    final data = eventData['data'] as Map<String, dynamic>? ?? {};
    final timestamp = DateTime.fromMillisecondsSinceEpoch(
      (eventData['timestamp'] as num?)?.toInt() ?? DateTime.now().millisecondsSinceEpoch
    );

    ConversationEventType type;
    switch (eventType) {
      case 'connected':
        type = ConversationEventType.conversationConnected;
        break;
      case 'message':
        type = ConversationEventType.conversationEvent;
        break;
      case 'mode_change':
        type = ConversationEventType.conversationEvent;
        break;
      case 'status_change':
        type = ConversationEventType.conversationEvent;
        break;
      case 'error':
        type = ConversationEventType.conversationFailed;
        break;
      default:
        type = ConversationEventType.conversationEvent;
    }

    return ConversationEvent(
      type: type,
      data: data,
      timestamp: timestamp,
    );
  }
}

class ConversationException implements Exception {
  final String message;
  final String? code;
  final bool retryable;
  final String? debugInfo;
  final DateTime timestamp;

  ConversationException(
    this.message, {
    this.code,
    this.retryable = false,
    this.debugInfo,
  }) : timestamp = DateTime.now();

  @override
  String toString() => 'ConversationException: $message${code != null ? ' (Code: $code)' : ''}';

  Map<String, dynamic> toJson() => {
    'message': message,
    'code': code,
    'retryable': retryable,
    'debugInfo': debugInfo,
    'timestamp': timestamp.toIso8601String(),
  };
}

class ElevenLabsCallService {
  static final ElevenLabsCallService _instance = ElevenLabsCallService._internal();
  static ElevenLabsCallService get instance => _instance;

  static const _methodChannel = MethodChannel('com.yourapp.elevenlabs/conversation');
  static const _eventChannel = EventChannel('com.yourapp.elevenlabs/events');

  // Enhanced state management
  bool _isCallActive = false;
  String? _currentSessionId;
  String? _currentConversationId;
  Map<String, dynamic> _conversationMetadata = {};
  DateTime? _connectionStartTime;
  ConversationState _conversationState = ConversationState.idle;

  // Stream controllers for real-time events
  final StreamController<ConversationEvent> _conversationEventController =
      StreamController<ConversationEvent>.broadcast();
  final StreamController<Map<String, dynamic>> _nativeEventController =
      StreamController<Map<String, dynamic>>.broadcast();

  // Event stream subscription
  StreamSubscription<dynamic>? _eventSubscription;

  // Initialize with native event handling
  ElevenLabsCallService._internal() {
    _initializeEventStream();
  }

  // Initialize event stream from native platforms
  void _initializeEventStream() {
    _eventSubscription = _eventChannel.receiveBroadcastStream().listen(
      (dynamic event) {
        final eventData = Map<String, dynamic>.from(event);
        print('[ElevenLabsService] Event received: ${eventData['type']}');

        // Emit to raw native event stream
        _nativeEventController.add(eventData);

        // Process and emit typed conversation event
        final conversationEvent = ConversationEvent.fromEventChannel(eventData);
        _conversationEventController.add(conversationEvent);

        // Update internal state based on event
        _updateStateFromEvent(conversationEvent);
      },
      onError: (error) {
        print('[ElevenLabsService] Event stream error: $error');
      },
    );
  }

  // Enhanced getters
  bool get isCallActive => _isCallActive;
  String? get currentSessionId => _currentSessionId;
  String? get currentConversationId => _currentConversationId;
  ConversationState get conversationState => _conversationState;
  Map<String, dynamic> get conversationMetadata => Map.from(_conversationMetadata);
  Duration? get connectionDuration => _connectionStartTime != null
      ? DateTime.now().difference(_connectionStartTime!)
      : null;

  // Stream getters
  Stream<ConversationEvent> get conversationEvents => _conversationEventController.stream;
  Stream<Map<String, dynamic>> get nativeEvents => _nativeEventController.stream;

  // Start conversation with ElevenLabs WebRTC
  Future<String> startConversation({
    required String conversationToken,
    Map<String, String>? dynamicVariables,
  }) async {
    try {
      print('[ElevenLabsService] 🚀 Starting conversation with token: ${conversationToken.substring(0, 20)}...');
      print('[ElevenLabsService] 📋 Dynamic variables: $dynamicVariables');

      _conversationState = ConversationState.connecting;
      _connectionStartTime = DateTime.now();

      final conversationId = await _methodChannel.invokeMethod<String>('startConversation', {
        'token': conversationToken,
        'dynamicVariables': dynamicVariables ?? {},
      });

      if (conversationId != null) {
        _currentConversationId = conversationId;
        _conversationState = ConversationState.connected;
        _isCallActive = true;

        print('[ElevenLabsService] ✅ Conversation started successfully: $conversationId');
        return conversationId;
      } else {
        final errorMsg = 'Failed to start conversation - no ID returned from native bridge';
        print('[ElevenLabsService] ❌ $errorMsg');
        throw ConversationException(
          errorMsg,
          code: 'NO_CONVERSATION_ID',
          debugInfo: 'Native bridge returned null conversation ID',
        );
      }
    } on PlatformException catch (e) {
      _conversationState = ConversationState.error;
      final errorMsg = _mapErrorCode(e.code);
      print('[ElevenLabsService] ❌ Platform Exception: ${e.code} - ${e.message}');
      print('[ElevenLabsService] 🔍 Details: ${e.details}');

      throw ConversationException(
        errorMsg,
        code: e.code,
        retryable: _isRetryableError(e.code),
        debugInfo: 'Platform: ${e.code}, Message: ${e.message}, Details: ${e.details}',
      );
    } catch (e) {
      _conversationState = ConversationState.error;
      print('[ElevenLabsService] ❌ Unexpected error starting conversation: $e');

      throw ConversationException(
        'Unexpected error starting conversation',
        code: 'UNKNOWN_ERROR',
        debugInfo: 'Exception: ${e.toString()}, Type: ${e.runtimeType}',
      );
    }
  }

  // End active conversation
  Future<void> endConversation() async {
    try {
      await _methodChannel.invokeMethod('endConversation');

      _conversationState = ConversationState.disconnected;
      _isCallActive = false;
      _currentSessionId = null;
      _currentConversationId = null;
      _connectionStartTime = null;
      _conversationMetadata.clear();

      print('[ElevenLabsService] ✅ Conversation ended');
    } on PlatformException catch (e) {
      throw ConversationException(_mapErrorCode(e.code), code: e.code);
    }
  }

  // Send message to conversation
  Future<void> sendMessage(String message) async {
    try {
      await _methodChannel.invokeMethod('sendMessage', {
        'message': message,
      });
      print('[ElevenLabsService] ✅ Message sent: $message');
    } on PlatformException catch (e) {
      throw ConversationException(_mapErrorCode(e.code), code: e.code);
    }
  }

  // Map error codes to user-friendly messages
  String _mapErrorCode(String code) {
    switch (code) {
      case 'PERMISSION_DENIED':
        return 'Microphone permission required';
      case 'NETWORK_ERROR':
        return 'Network connectivity issue';
      case 'TOKEN_EXPIRED':
        return 'Conversation token has expired';
      case 'API_ERROR':
        return 'ElevenLabs API error';
      case 'INVALID_ARGUMENT':
        return 'Invalid conversation parameters';
      case 'CONVERSATION_NOT_ACTIVE':
        return 'No active conversation';
      case 'CONVERSATION_ACTIVE':
        return 'A conversation is already active';
      case 'CONNECTION_FAILED':
        return 'Failed to establish WebRTC connection';
      case 'AUDIO_SESSION_ERROR':
        return 'Audio session configuration failed';
      case 'NO_CONVERSATION_ID':
        return 'Failed to get conversation ID from native SDK';
      default:
        return 'Unknown error occurred: $code';
    }
  }

  // Check if error is retryable
  bool _isRetryableError(String code) {
    switch (code) {
      case 'NETWORK_ERROR':
      case 'CONNECTION_FAILED':
      case 'API_ERROR':
        return true;
      case 'PERMISSION_DENIED':
      case 'TOKEN_EXPIRED':
      case 'INVALID_ARGUMENT':
      case 'CONVERSATION_ACTIVE':
        return false;
      default:
        return false;
    }
  }

  // Enhanced debug logging
  void _logDebug(String message, {Map<String, dynamic>? data}) {
    final timestamp = DateTime.now().toIso8601String();
    print('[ElevenLabsService] $timestamp: $message');
    if (data != null) {
      print('[ElevenLabsService] Debug data: ${json.encode(data)}');
    }
  }

  // Get detailed service state for debugging
  Map<String, dynamic> getDebugState() {
    return {
      'isCallActive': _isCallActive,
      'currentSessionId': _currentSessionId,
      'currentConversationId': _currentConversationId,
      'conversationState': _conversationState.toString(),
      'connectionStartTime': _connectionStartTime?.toIso8601String(),
      'connectionDuration': connectionDuration?.inSeconds,
      'conversationMetadata': _conversationMetadata,
      'hasEventSubscription': _eventSubscription != null,
    };
  }

  // Update internal state based on native events
  void _updateStateFromEvent(ConversationEvent event) {
    switch (event.type) {
      case ConversationEventType.conversationConnected:
        _conversationState = ConversationState.connected;
        _currentConversationId = event.data['conversationId'] as String?;
        _conversationMetadata.addAll(event.data);
        break;

      case ConversationEventType.conversationFailed:
        _conversationState = ConversationState.error;
        break;

      case ConversationEventType.conversationEnded:
        _conversationState = ConversationState.disconnected;
        _isCallActive = false;
        _currentSessionId = null;
        _currentConversationId = null;
        _connectionStartTime = null;
        _conversationMetadata.clear();
        break;

      default:
        // Update metadata with any new data
        _conversationMetadata.addAll(event.data);
    }
  }

  // Start ElevenLabs WebRTC call when user accepts
  Future<Map<String, dynamic>?> startElevenLabsCall(String sessionId) async {
    try {
      _logDebug('🚀 Starting ElevenLabs call', data: {'sessionId': sessionId});

      // Request microphone permission
      if (!await _requestMicrophonePermission()) {
        _logDebug('❌ Microphone permission denied');
        throw ConversationException(
          'Microphone permission is required for voice calls',
          code: 'PERMISSION_DENIED',
          debugInfo: 'User denied microphone permission',
        );
      }

      // Get pairing token and device token for authentication
      final prefs = await SharedPreferences.getInstance();
      final pairingToken = prefs.getString(AppConstants.keyPairingToken);
      final deviceToken = prefs.getString(AppConstants.keyDeviceToken);

      if (pairingToken == null || deviceToken == null) {
        _logDebug('❌ Missing authentication tokens', data: {
          'hasPairingToken': pairingToken != null,
          'hasDeviceToken': deviceToken != null,
        });
        throw ConversationException(
          'Device not properly paired. Please pair device again.',
          code: 'AUTHENTICATION_ERROR',
          debugInfo: 'Missing pairing token or device token',
        );
      }

      _logDebug('🔗 Requesting conversation token from Edge Function');

      // Get conversation token from our device-specific edge function
      final response = await http.post(
        Uri.parse('${AppConstants.supabaseUrl}/functions/v1/elevenlabs-device-call'),
        headers: {
          'Content-Type': 'application/json',
          'apikey': AppConstants.supabaseAnonKey,
        },
        body: json.encode({
          'sessionId': sessionId,
          'action': 'start',
          'pairingToken': pairingToken,
          'deviceToken': deviceToken,
        }),
      );

      _logDebug('📡 Edge Function response', data: {
        'statusCode': response.statusCode,
        'hasBody': response.body.isNotEmpty,
      });

      if (response.statusCode == 200) {
        final data = json.decode(response.body);

        if (data['conversationToken'] == null) {
          _logDebug('❌ No conversation token in response', data: {'responseData': data});
          throw ConversationException(
            'Failed to get conversation token from server',
            code: 'TOKEN_MISSING',
            debugInfo: 'Edge Function returned success but no token: ${json.encode(data)}',
          );
        }

        _logDebug('✅ Conversation token received', data: {
          'hasToken': data['conversationToken'] != null,
          'tokenLength': data['conversationToken']?.length,
          'hasCallLogId': data['callLogId'] != null,
        });

        _currentSessionId = sessionId;

        // Start ElevenLabs session via native SDK using new API
        final conversationId = await startConversation(
          conversationToken: data['conversationToken'],
          dynamicVariables: {
            'session_id': sessionId,
            'secret__household_id': data['householdId'] ?? '',
            'secret__relative_id': data['relativeId'] ?? '',
            'call_type': 'in_app_call',
            'device_call': 'true',
          },
        );

        _logDebug('✅ Native conversation started', data: {'conversationId': conversationId});

        // Update call log with conversation ID if available
        if (data['callLogId'] != null) {
          await _updateCallLogWithConversationId(
              data['callLogId'], conversationId, sessionId);
        }

        _isCallActive = true;

        return data;
      } else {
        final errorBody = response.body;
        _logDebug('❌ Edge Function error', data: {
          'statusCode': response.statusCode,
          'errorBody': errorBody,
        });

        String errorMessage;
        String errorCode;

        try {
          final errorData = json.decode(errorBody);
          errorMessage = errorData['error'] ?? 'Unknown server error';
          errorCode = 'SERVER_ERROR_${response.statusCode}';
        } catch (_) {
          errorMessage = 'Server error: ${response.statusCode}';
          errorCode = 'SERVER_ERROR_${response.statusCode}';
        }

        throw ConversationException(
          errorMessage,
          code: errorCode,
          retryable: response.statusCode >= 500,
          debugInfo: 'HTTP ${response.statusCode}: $errorBody',
        );
      }
    } on ConversationException {
      // Re-throw conversation exceptions as-is
      _isCallActive = false;
      _currentSessionId = null;
      rethrow;
    } catch (e) {
      _logDebug('❌ Unexpected error starting ElevenLabs call', data: {
        'error': e.toString(),
        'type': e.runtimeType.toString(),
      });

      // Ensure call state is reset on error
      _isCallActive = false;
      _currentSessionId = null;

      throw ConversationException(
        'Unexpected error starting call',
        code: 'UNKNOWN_ERROR',
        debugInfo: 'Exception: ${e.toString()}, Type: ${e.runtimeType}',
      );
    }
  }

  // Request microphone permission
  Future<bool> _requestMicrophonePermission() async {
    final status = await Permission.microphone.request();
    return status.isGranted;
  }

  // Update call log with conversation ID from ElevenLabs
  Future<void> _updateCallLogWithConversationId(String callLogId, String conversationId, String sessionId) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final pairingToken = prefs.getString(AppConstants.keyPairingToken);
      final deviceToken = prefs.getString(AppConstants.keyDeviceToken);

      final response = await http.post(
        Uri.parse('${AppConstants.supabaseUrl}/functions/v1/elevenlabs-device-call'),
        headers: {
          'Content-Type': 'application/json',
          'apikey': AppConstants.supabaseAnonKey,
        },
        body: json.encode({
          'action': 'update_conversation_id',
          'sessionId': sessionId,
          'callLogId': callLogId,
          'conversationId': conversationId,
          'pairingToken': pairingToken,
          'deviceToken': deviceToken,
        }),
      );

      if (response.statusCode == 200) {
        print('✅ Updated call log with conversation ID: $conversationId');
      } else {
        print('❌ Failed to update call log: ${response.statusCode}');
      }
    } catch (e) {
      print('❌ Error updating call log: $e');
    }
  }

  // End ElevenLabs WebRTC call
  Future<bool> endElevenLabsCall(String sessionId, {
    String? summary,
    int? duration,
  }) async {
    try {
      // End session via native SDK first using new API
      await endConversation();

      // Clean up local state
      await _cleanupWebRTCResources();

      // Get pairing token and device token for authentication
      final prefs = await SharedPreferences.getInstance();
      final pairingToken = prefs.getString(AppConstants.keyPairingToken);
      final deviceToken = prefs.getString(AppConstants.keyDeviceToken);

      final response = await http.post(
        Uri.parse('${AppConstants.supabaseUrl}/functions/v1/elevenlabs-device-call'),
        headers: {
          'Content-Type': 'application/json',
          'apikey': AppConstants.supabaseAnonKey,
        },
        body: json.encode({
          'sessionId': sessionId,
          'action': 'end',
          'conversationSummary': summary ?? 'Call completed',
          'duration': duration ?? 0,
          'outcome': 'completed',
          'pairingToken': pairingToken,
          'deviceToken': deviceToken,
        }),
      );

      if (response.statusCode == 200) {
        print('✅ ElevenLabs call ended successfully');
        return true;
      } else {
        print('❌ Failed to end ElevenLabs call: ${response.body}');
        return false;
      }
    } catch (e) {
      print('❌ Error ending ElevenLabs call: $e');
      return false;
    }
  }

  // Force end call - cleanup resources without API call
  Future<void> forceEndCall(String sessionId) async {
    try {
      print('🔄 Force ending ElevenLabs call: $sessionId');
      await _cleanupWebRTCResources();
      print('✅ ElevenLabs call resources cleaned up');
    } catch (e) {
      print('❌ Error force ending ElevenLabs call: $e');
    }
  }

  // Clean up WebRTC resources
  Future<void> _cleanupWebRTCResources() async {
    try {
      _isCallActive = false;
      _currentSessionId = null;
      print('✅ WebRTC resources cleaned up');
    } catch (e) {
      print('❌ Error cleaning up WebRTC resources: $e');
    }
  }

  // Mute/unmute microphone for compatibility (if still needed)
  Future<void> setMicrophoneMuted(bool muted) async {
    try {
      // This is for backward compatibility with existing call_screen.dart
      print('${muted ? '🔇 Microphone muted' : '🎤 Microphone unmuted'} (managed by native SDK)');
    } catch (e) {
      print('❌ Error setting microphone state: $e');
    }
  }

  // Cleanup resources when service is disposed
  void dispose() {
    _eventSubscription?.cancel();
    _conversationEventController.close();
    _nativeEventController.close();
  }
}