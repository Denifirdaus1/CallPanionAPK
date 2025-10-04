import 'package:http/http.dart' as http;
import 'dart:convert';
import 'dart:async';
import 'package:flutter/services.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../utils/constants.dart';

// Enhanced enums and models
enum ConversationState { idle, connecting, connected, disconnected, error }

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

  factory ConversationEvent.fromEventChannel(dynamic rawData) {
    // Safely convert to Map<String, dynamic>
    final Map<String, dynamic> eventData;
    if (rawData is Map<String, dynamic>) {
      eventData = rawData;
    } else if (rawData is Map) {
      eventData = Map<String, dynamic>.from(rawData);
    } else {
      throw ArgumentError('Invalid event data type: ${rawData.runtimeType}');
    }

    final eventType = eventData['type'] as String;
    final data = eventData['data'] as Map<String, dynamic>? ?? {};
    final timestamp = DateTime.fromMillisecondsSinceEpoch(
        (eventData['timestamp'] as num?)?.toInt() ??
            DateTime.now().millisecondsSinceEpoch);

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
      case 'conversationEnded':
        type = ConversationEventType.conversationEnded;
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
  String toString() =>
      'ConversationException: $message${code != null ? ' (Code: $code)' : ''}';

  Map<String, dynamic> toJson() => {
        'message': message,
        'code': code,
        'retryable': retryable,
        'debugInfo': debugInfo,
        'timestamp': timestamp.toIso8601String(),
      };
}

class ElevenLabsCallService {
  static final ElevenLabsCallService _instance =
      ElevenLabsCallService._internal();
  static ElevenLabsCallService get instance => _instance;

  static const _methodChannel = MethodChannel(
      'app.lovable.a4b57244d3ad47ea85cac99941e17d30.elevenlabs/conversation');
  static const _eventChannel = EventChannel(
      'app.lovable.a4b57244d3ad47ea85cac99941e17d30.elevenlabs/events');

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
  Map<String, dynamic> get conversationMetadata =>
      Map.from(_conversationMetadata);
  Duration? get connectionDuration => _connectionStartTime != null
      ? DateTime.now().difference(_connectionStartTime!)
      : null;

  // Stream getters
  Stream<ConversationEvent> get conversationEvents =>
      _conversationEventController.stream;
  Stream<Map<String, dynamic>> get nativeEvents =>
      _nativeEventController.stream;

  // Start conversation with ElevenLabs Official SDK
  Future<String> startConversation({
    required String conversationToken,
    String? agentId,
    Map<String, String>? dynamicVariables,
    String? callLogId,
  }) async {
    try {
      print('[ElevenLabsService] 🚀 Starting conversation with official SDK');
      print(
          '[ElevenLabsService] 📋 Token: ${conversationToken.substring(0, 20)}...');
      print('[ElevenLabsService] 📋 Agent ID: $agentId');
      print('[ElevenLabsService] 📋 Dynamic variables: $dynamicVariables');
      print('[ElevenLabsService] 📋 Call Log ID: $callLogId');

      _conversationState = ConversationState.connecting;
      _connectionStartTime = DateTime.now();

      // Store callLogId in metadata for later use
      if (callLogId != null) {
        _conversationMetadata['callLogId'] = callLogId;
      }

      final conversationId =
          await _methodChannel.invokeMethod<String>('startConversation', {
        'conversationToken': conversationToken,
        'agentId': agentId,
        'dynamicVariables': dynamicVariables ?? {},
        'callLogId': callLogId,
      });

      if (conversationId != null) {
        _currentConversationId = conversationId;
        _conversationState = ConversationState.connected;
        _isCallActive = true;

        print(
            '[ElevenLabsService] ✅ Conversation started successfully: $conversationId');
        return conversationId;
      } else {
        final errorMsg =
            'Failed to start conversation - no ID returned from native bridge';
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
      print(
          '[ElevenLabsService] ❌ Platform Exception: ${e.code} - ${e.message}');
      print('[ElevenLabsService] 🔍 Details: ${e.details}');

      throw ConversationException(
        errorMsg,
        code: e.code,
        retryable: _isRetryableError(e.code),
        debugInfo:
            'Platform: ${e.code}, Message: ${e.message}, Details: ${e.details}',
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

  // Set microphone muted state
  Future<void> setMicrophoneMuted(bool muted) async {
    try {
      await _methodChannel.invokeMethod('setMicMuted', {
        'muted': muted,
      });
      print(
          '[ElevenLabsService] ${muted ? '🔇 Microphone muted' : '🎤 Microphone unmuted'}');
    } on PlatformException catch (e) {
      throw ConversationException(_mapErrorCode(e.code), code: e.code);
    }
  }

  // Send feedback to conversation
  Future<void> sendFeedback(bool isPositive) async {
    try {
      await _methodChannel.invokeMethod('sendFeedback', {
        'isPositive': isPositive,
      });
      print(
          '[ElevenLabsService] ✅ Feedback sent: ${isPositive ? "positive" : "negative"}');
    } on PlatformException catch (e) {
      throw ConversationException(_mapErrorCode(e.code), code: e.code);
    }
  }

  // Send contextual update to conversation
  Future<void> sendContextualUpdate(String update) async {
    try {
      await _methodChannel.invokeMethod('sendContextualUpdate', {
        'update': update,
      });
      print('[ElevenLabsService] ✅ Contextual update sent: $update');
    } on PlatformException catch (e) {
      throw ConversationException(_mapErrorCode(e.code), code: e.code);
    }
  }

  // Send user activity to conversation
  Future<void> sendUserActivity() async {
    try {
      await _methodChannel.invokeMethod('sendUserActivity');
      print('[ElevenLabsService] ✅ User activity sent');
    } on PlatformException catch (e) {
      throw ConversationException(_mapErrorCode(e.code), code: e.code);
    }
  }

  // Update conversation ID on server
  Future<void> updateConversationId(
      String callLogId, String conversationId) async {
    try {
      // Call Edge Function to update conversation ID
      final response = await http.post(
        Uri.parse(
            '${AppConstants.supabaseUrl}/functions/v1/elevenlabs-device-call'),
        headers: {
          'Content-Type': 'application/json',
          'apikey': AppConstants.supabaseAnonKey,
        },
        body: json.encode({
          'action': 'update_conversation_id',
          'callLogId': callLogId,
          'conversationId': conversationId,
        }),
      );

      if (response.statusCode == 200) {
        print(
            '[ElevenLabsService] ✅ Conversation ID updated on server: $conversationId');
      } else {
        print(
            '[ElevenLabsService] ⚠️ Server update response: ${response.statusCode}');
      }
    } catch (e) {
      print(
          '[ElevenLabsService] ❌ Failed to update conversation ID on server: $e');
      // Don't throw error - this is not critical for conversation flow
    }
  }

  // Get conversation token with retry mechanism for expired tokens
  Future<http.Response> _getConversationTokenWithRetry({
    required String sessionId,
    required String pairingToken,
    required String deviceToken,
    int maxRetries = 3,
  }) async {
    int attempt = 0;
    Exception? lastException;

    while (attempt < maxRetries) {
      try {
        attempt++;
        _logDebug(
            '🔗 Requesting conversation token (attempt $attempt/$maxRetries)');

        // Get current user session for auth
        final prefs = await SharedPreferences.getInstance();
        final pairingToken = prefs.getString(AppConstants.keyPairingToken);
        final deviceToken = prefs.getString(AppConstants.keyDeviceToken);

        if (pairingToken == null || deviceToken == null) {
          throw ConversationException(
            'User not authenticated. Please log in again.',
            code: 'AUTH_REQUIRED',
            debugInfo: 'No valid pairing or device token found',
          );
        }

        final response = await http.post(
          Uri.parse(
              '${AppConstants.supabaseUrl}/functions/v1/elevenlabs-device-call'),
          headers: {
            'Content-Type': 'application/json',
            'apikey': AppConstants.supabaseAnonKey,
            'Authorization': 'Bearer ${AppConstants.supabaseAnonKey}',
          },
          body: json.encode({
            'action': 'start',
            'sessionId': sessionId,
            'pairingToken': pairingToken,
            'deviceToken': deviceToken,
          }),
        );

        // Check for token expiry or auth errors
        if (response.statusCode == 401 || response.statusCode == 403) {
          _logDebug(
              '⚠️ Token expired or auth error (${response.statusCode}), retrying...');
          if (attempt < maxRetries) {
            await Future.delayed(
                Duration(seconds: attempt * 2)); // Exponential backoff
            continue;
          }
        }

        // Success or non-retryable error
        return response;
      } catch (e) {
        lastException = e is Exception ? e : Exception(e.toString());
        _logDebug('❌ Token request failed (attempt $attempt/$maxRetries): $e');

        if (attempt < maxRetries) {
          await Future.delayed(
              Duration(seconds: attempt * 2)); // Exponential backoff
        }
      }
    }

    // All retries failed
    throw ConversationException(
      'Failed to get conversation token after $maxRetries attempts',
      code: 'TOKEN_RETRY_FAILED',
      debugInfo: 'Last error: ${lastException?.toString()}',
    );
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
      case 'AUTH_REQUIRED':
        return 'Authentication required';
      case 'TOKEN_RETRY_FAILED':
        return 'Failed to get conversation token after multiple attempts';
      case 'CONCURRENT_CALL_LIMIT':
        return 'Too many concurrent calls. Please wait before starting another call.';
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

        // Update conversation ID on server if we have callLogId
        if (_currentConversationId != null &&
            _conversationMetadata.containsKey('callLogId')) {
          final callLogId = _conversationMetadata['callLogId'] as String;
          updateConversationId(callLogId, _currentConversationId!);
        }
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

      // Get conversation token with retry mechanism
      final response = await _getConversationTokenWithRetry(
        sessionId: sessionId,
        pairingToken: pairingToken,
        deviceToken: deviceToken,
      );

      _logDebug('📡 Edge Function response', data: {
        'statusCode': response.statusCode,
        'hasBody': response.body.isNotEmpty,
      });

      if (response.statusCode == 200) {
        final data = json.decode(response.body);

        if (data['conversationToken'] == null) {
          _logDebug('❌ No conversation token in response',
              data: {'responseData': data});
          throw ConversationException(
            'Failed to get conversation token from server',
            code: 'TOKEN_MISSING',
            debugInfo:
                'Edge Function returned success but no token: ${json.encode(data)}',
          );
        }

        _logDebug('✅ Conversation token received', data: {
          'hasToken': data['conversationToken'] != null,
          'tokenLength': data['conversationToken']?.length,
          'hasCallLogId': data['callLogId'] != null,
        });

        _currentSessionId = sessionId;

        // Start ElevenLabs session via native SDK using official API
        final conversationId = await startConversation(
          conversationToken: data['conversationToken'],
          agentId: data['agentId'], // Pass agent ID if available
          callLogId: data['callLogId'], // Pass call log ID for server update
          dynamicVariables: {
            'session_id': sessionId,
            'household_id': data['householdId'] ?? '',
            'relative_id': data['relativeId'] ?? '',
            'call_type': 'in_app_call',
            'device_call': 'true',
          },
        );

        _logDebug('✅ Native conversation started',
            data: {'conversationId': conversationId});

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
  Future<void> _updateCallLogWithConversationId(
      String callLogId, String conversationId, String sessionId) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final pairingToken = prefs.getString(AppConstants.keyPairingToken);
      final deviceToken = prefs.getString(AppConstants.keyDeviceToken);

      final response = await http.post(
        Uri.parse(
            '${AppConstants.supabaseUrl}/functions/v1/elevenlabs-device-call'),
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
  Future<bool> endElevenLabsCall(
    String sessionId, {
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
        Uri.parse(
            '${AppConstants.supabaseUrl}/functions/v1/elevenlabs-device-call'),
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

  // Cleanup resources when service is disposed
  void dispose() {
    _eventSubscription?.cancel();
    _conversationEventController.close();
    _nativeEventController.close();
  }
}
