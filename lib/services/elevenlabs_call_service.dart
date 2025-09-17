import 'package:http/http.dart' as http;
import 'dart:convert';
import 'package:flutter/services.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/call_data.dart';
import '../utils/constants.dart';

class ElevenLabsCallService {
  static final ElevenLabsCallService _instance = ElevenLabsCallService._internal();
  static ElevenLabsCallService get instance => _instance;
  ElevenLabsCallService._internal();

  static const _channel = MethodChannel('elevenlabs_bridge');
  bool _isCallActive = false;
  String? _currentSessionId;

  // Start ElevenLabs WebRTC call when user accepts
  Future<Map<String, dynamic>?> startElevenLabsCall(String sessionId) async {
    try {
      // Request microphone permission
      if (!await _requestMicrophonePermission()) {
        print('❌ Microphone permission denied');
        return null;
      }

      // Get pairing token and device token for authentication
      final prefs = await SharedPreferences.getInstance();
      final pairingToken = prefs.getString(AppConstants.keyPairingToken);
      final deviceToken = prefs.getString(AppConstants.keyDeviceToken);

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

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        print('✅ ElevenLabs conversation token received: ${data['conversationToken'] != null}');

        _currentSessionId = sessionId;

        // Start ElevenLabs session via native SDK
        final conversationId = await _channel.invokeMethod<String>('startSession', {
          'conversationToken': data['conversationToken'],
          'dynamicVariables': {
            'session_id': sessionId,
            'secret__household_id': data['householdId'],
            'secret__relative_id': data['relativeId'],
            'call_type': 'in_app_call',
            'device_call': 'true',
          },
        });

        // Update call log with conversation ID if available
        if (conversationId != null && data['callLogId'] != null) {
          await _updateCallLogWithConversationId(
              data['callLogId'], conversationId, sessionId);
        }

        _isCallActive = true;

        return data;
      } else {
        print('❌ Failed to start ElevenLabs call: ${response.body}');
        // Show error to user
        throw Exception('Failed to get conversation token: ${response.statusCode}');
      }
    } catch (e) {
      print('❌ Error starting ElevenLabs call: $e');
      // Ensure call state is reset on error
      _isCallActive = false;
      _currentSessionId = null;
      rethrow;
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
      // End session via native SDK first
      await _channel.invokeMethod('endSession');

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

  // Check if call is active
  bool get isCallActive => _isCallActive;

  // Get current session ID
  String? get currentSessionId => _currentSessionId;

  // Mute/unmute microphone
  Future<void> setMicrophoneMuted(bool muted) async {
    await _channel.invokeMethod('setMicMuted', {'muted': muted});
    print(muted ? '🔇 Microphone muted' : '🎤 Microphone unmuted');
  }
}