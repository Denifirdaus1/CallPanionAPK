import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter_callkit_incoming/flutter_callkit_incoming.dart';
import 'package:flutter_callkit_incoming/entities/entities.dart';
import 'package:uuid/uuid.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/call_data.dart';
import '../utils/constants.dart';
import 'api_service.dart';
import 'elevenlabs_call_service.dart';

class CallKitService {
  static final CallKitService _instance = CallKitService._internal();
  static CallKitService get instance => _instance;
  CallKitService._internal();

  final Uuid _uuid = const Uuid();
  String? _currentCallUuid;
  CallData? _currentCall;

  Function(CallData)? onIncomingCall;
  Function(String, String)? onCallAccepted;
  Function(String)? onCallDeclined;
  Function(String)? onCallEnded;

  Future<void> initialize() async {
    if (kDebugMode) {
      print('🔧 Initializing CallKit Service...');
    }

    // Request permissions
    await _requestPermissions();

    // Setup CallKit event listeners
    _setupCallKitListeners();

    if (kDebugMode) {
      print('✅ CallKit Service initialized');
    }
  }

  Future<void> _requestPermissions() async {
    try {
      // Request notification permissions
      await FlutterCallkitIncoming.requestNotificationPermission({
        'title': 'Callpanion Notification',
        'rationaleMessagePermission':
            'Callpanion needs notification permission to show incoming calls from your family.',
        'postNotificationMessageRequired':
            'Please enable notifications in Settings to receive calls from your loved ones.',
      });

      // For Android 14+, request full screen intent permission
      if (Platform.isAndroid) {
        final canUseFullScreenIntent =
            await FlutterCallkitIncoming.canUseFullScreenIntent();
        if (!canUseFullScreenIntent) {
          await FlutterCallkitIncoming.requestFullIntentPermission();
        }
      }

      if (kDebugMode) {
        print('✅ CallKit permissions requested');
      }
    } catch (e) {
      if (kDebugMode) {
        print('❌ Error requesting permissions: $e');
      }
    }
  }

  void _setupCallKitListeners() {
    FlutterCallkitIncoming.onEvent.listen((CallEvent? event) {
      if (event == null) return;

      if (kDebugMode) {
        print('📞 CallKit Event: ${event.event}');
        print('📞 Call Data: ${event.body}');
      }

      switch (event.event) {
        case Event.actionCallIncoming:
          _handleIncomingCall(event);
          break;
        case Event.actionCallAccept:
          _handleCallAccept(event);
          break;
        case Event.actionCallDecline:
          _handleCallDecline(event);
          break;
        case Event.actionCallEnded:
          _handleCallEnded(event);
          break;
        case Event.actionCallTimeout:
          _handleCallTimeout(event);
          break;
        case Event.actionCallCallback:
          _handleCallCallback(event);
          break;
        case Event.actionDidUpdateDevicePushTokenVoip:
          _handleVoIPTokenUpdate(event);
          break;
        default:
          if (kDebugMode) {
            print('📞 Unhandled CallKit event: ${event.event}');
          }
      }
    });
  }

  Future<void> showIncomingCall(CallData callData) async {
    try {
      _currentCallUuid = _uuid.v4();
      _currentCall = callData;

      final callKitParams = CallKitParams(
        id: _currentCallUuid!,
        nameCaller: 'Callpanion',
        appName: 'Callpanion',
        avatar: callData.avatar ?? '',
        handle: callData.handle ?? 'Callpanion',
        type: 0, // 0 = audio call (phone icon), 1 = video call
        textAccept: 'Answer',
        textDecline: 'Decline',
        duration: int.tryParse(callData.duration ?? '30000') ?? 30000,
        extra: <String, dynamic>{
          'sessionId': callData.sessionId,
          'callType': callData.callType,
          'householdId': callData.householdId,
          'relativeId': callData.relativeId,
        },
        headers: <String, dynamic>{'platform': 'flutter_elderly'},
        missedCallNotification: const NotificationParams(
          showNotification: true,
          isShowCallback: false, // Hide callback button on missed-call banner
          subtitle: 'Missed call from Callpanion',
        ),
        callingNotification: const NotificationParams(
          showNotification: true,
          isShowCallback: true,
          subtitle: 'Calling with Callpanion...',
          callbackText: 'Hang Up',
        ),
        android: const AndroidParams(
          isCustomNotification: true,
          isShowLogo: true,
          ringtonePath: 'system_ringtone_default',
          backgroundColor: '#E38B6F',
          actionColor: '#0F3B2E',
          textColor: '#ffffff',
          incomingCallNotificationChannelName: 'Callpanion Incoming Call',
          missedCallNotificationChannelName: 'Callpanion Missed Call',
          isShowCallID: false,
          isShowFullLockedScreen: true,
        ),
        ios: const IOSParams(
          iconName: 'CallKitLogo',
          handleType: 'generic',
          supportsVideo: true,
          maximumCallGroups: 2,
          maximumCallsPerCallGroup: 1,
          audioSessionMode: 'voiceChat',
          audioSessionActive: true,
          audioSessionPreferredSampleRate: 44100.0,
          audioSessionPreferredIOBufferDuration: 0.005,
          supportsDTMF: true,
          supportsHolding: true,
          supportsGrouping: false,
          supportsUngrouping: false,
          ringtonePath: 'system_ringtone_default',
        ),
      );

      await FlutterCallkitIncoming.showCallkitIncoming(callKitParams);

      if (kDebugMode) {
        print('📞 Incoming call shown for: ${callData.relativeName}');
      }
    } catch (e) {
      if (kDebugMode) {
        print('❌ Error showing incoming call: $e');
      }
    }
  }

  void _handleIncomingCall(CallEvent event) {
    // This is triggered when a CallKit call is displayed
    if (onIncomingCall != null && _currentCall != null) {
      onIncomingCall!(_currentCall!);
    }
  }

  void _handleCallAccept(CallEvent event) async {
    try {
      final callUuid = event.body['id'] as String?;
      final extra = _convertMapToStringDynamic(event.body['extra']);

      if (kDebugMode) {
        print('📞 Call accept event received:');
        print('  - CallUuid: $callUuid');
        print('  - Extra data: $extra');
      }

      if (callUuid != null && extra != null) {
        final sessionId = extra['sessionId'] as String?;
        final callType = extra['callType'] as String?;
        final householdId = extra['householdId'] as String?;
        final relativeId = extra['relativeId'] as String?;
        final relativeName = 'Callpanion';

        if (kDebugMode) {
          print('📞 Extracted call data:');
          print('  - SessionId: $sessionId');
          print('  - CallType: $callType');
          print('  - HouseholdId: $householdId');
          print('  - RelativeId: $relativeId');
          print('  - RelativeName: $relativeName');
        }

        if (sessionId != null) {
          if (kDebugMode) {
            print('📞 Updating call status to active...');
          }

          // Update call status to active via API
          await ApiService.instance.updateCallStatus(
            sessionId: sessionId,
            status: AppConstants.callStatusActive,
            action: 'accept',
            callUuid: callUuid,
          );

          // Mark call as connected in CallKit
          await FlutterCallkitIncoming.setCallConnected(callUuid);

          // Create call data
          final callData = CallData(
            sessionId: sessionId,
            relativeName: relativeName,
            callType: callType ?? AppConstants.callTypeInApp,
            householdId: householdId ?? '',
            relativeId: relativeId ?? '',
          );

          // Update current call
          _currentCall = callData;

          // IMPORTANT: Clear any old pending call data to prevent auto-navigation on app restart
          final prefs = await SharedPreferences.getInstance();
          await prefs.remove(AppConstants.keyPendingCall);

          // Navigate immediately if we have an onCallAccepted callback
          if (onCallAccepted != null && callType != null) {
            if (kDebugMode) {
              print(
                '📞 Triggering navigation callback (direct from accept)...',
              );
            }
            // Direct navigation without delay - prioritize call connection
            onCallAccepted!(sessionId, callType);
          }

          // Note: ElevenLabs WebRTC call will be started in CallScreen
          // This ensures proper navigation and UI state management

          if (kDebugMode) {
            print('✅ Call accepted successfully: $sessionId');
          }
        } else {
          if (kDebugMode) {
            print('❌ SessionId is null in call accept');
          }
        }
      } else {
        if (kDebugMode) {
          print('❌ Missing callUuid or extra data in call accept');
        }
      }
    } catch (e) {
      if (kDebugMode) {
        print('❌ Error handling call accept: $e');
        print('❌ Event body: ${event.body}');
      }
    }
  }

  void _handleCallDecline(CallEvent event) async {
    try {
      final callUuid = event.body['id'] as String?;
      final extra = _convertMapToStringDynamic(event.body['extra']);

      if (callUuid != null && extra != null) {
        final sessionId = extra['sessionId'] as String?;

        if (sessionId != null) {
          // Update call status to declined via API
          await ApiService.instance.updateCallStatus(
            sessionId: sessionId,
            status: AppConstants.callStatusDeclined,
            action: 'decline',
            callUuid: callUuid,
          );

          if (onCallDeclined != null) {
            onCallDeclined!(sessionId);
          }

          if (kDebugMode) {
            print('📞 Call declined: $sessionId');
          }
        }
      }

      _clearCurrentCall();
    } catch (e) {
      if (kDebugMode) {
        print('❌ Error handling call decline: $e');
      }
    }
  }

  void _handleCallEnded(CallEvent event) async {
    try {
      final callUuid = event.body['id'] as String?;
      final extra = _convertMapToStringDynamic(event.body['extra']);

      if (callUuid != null && extra != null) {
        final sessionId = extra['sessionId'] as String?;

        if (sessionId != null) {
          final callType = extra['callType'] as String?;

          // Force end ElevenLabs WebRTC call if it's an in-app call
          if (callType == AppConstants.callTypeInApp) {
            // Always try to cleanup ElevenLabs WebRTC regardless of previous state
            await ElevenLabsCallService.instance.forceEndCall(sessionId);
            if (kDebugMode) {
              print('🎙️ ElevenLabs WebRTC call force ended');
            }
          }

          // Update call status to completed via API
          await ApiService.instance.updateCallStatus(
            sessionId: sessionId,
            status: AppConstants.callStatusCompleted,
            action: 'end',
            callUuid: callUuid,
          );

          if (onCallEnded != null) {
            onCallEnded!(sessionId);
          }

          if (kDebugMode) {
            print('📞 Call ended: $sessionId');
          }
        }
      }

      _clearCurrentCall();
    } catch (e) {
      if (kDebugMode) {
        print('❌ Error handling call end: $e');
      }
    }
  }

  void _handleCallTimeout(CallEvent event) async {
    try {
      final callUuid = event.body['id'] as String?;
      final extra = _convertMapToStringDynamic(event.body['extra']);

      if (callUuid != null && extra != null) {
        final sessionId = extra['sessionId'] as String?;

        if (sessionId != null) {
          // Update call status to missed via API
          await ApiService.instance.updateCallStatus(
            sessionId: sessionId,
            status: AppConstants.callStatusMissed,
            action: 'timeout',
            callUuid: callUuid,
          );

          if (kDebugMode) {
            print('📞 Call timeout: $sessionId');
          }
        }
      }

      _clearCurrentCall();
    } catch (e) {
      if (kDebugMode) {
        print('❌ Error handling call timeout: $e');
      }
    }
  }

  void _handleCallCallback(CallEvent event) {
    // Handle "call back" or notification click action
    if (kDebugMode) {
      print('📞 Call notification clicked - navigating to active call');
    }

    // When user clicks notification during active call, navigate to CallScreen
    if (_currentCall != null && _currentCallUuid != null) {
      final sessionId = _currentCall!.sessionId;
      final callType = _currentCall!.callType;

      if (kDebugMode) {
        print('📞 Navigating to active call: $sessionId');
      }

      // Trigger navigation callback
      if (onCallAccepted != null) {
        onCallAccepted!(sessionId, callType);
      }
    } else {
      if (kDebugMode) {
        print('⚠️ No active call found for callback');
      }
    }
  }

  void _handleVoIPTokenUpdate(CallEvent event) async {
    try {
      final deviceToken = await FlutterCallkitIncoming.getDevicePushTokenVoIP();
      if (deviceToken != null) {
        // Save VoIP token and register with server
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString(AppConstants.keyVoipToken, deviceToken);

        // Register the VoIP token with the server
        await ApiService.instance.registerFCMToken(voipToken: deviceToken);

        if (kDebugMode) {
          print('📱 VoIP token updated: ${deviceToken.substring(0, 10)}...');
        }
      }
    } catch (e) {
      if (kDebugMode) {
        print('❌ Error handling VoIP token update: $e');
      }
    }
  }

  Future<void> endCurrentCall() async {
    if (_currentCallUuid != null) {
      await FlutterCallkitIncoming.endCall(_currentCallUuid!);
      _clearCurrentCall();
    }
  }

  void _clearCurrentCall() {
    _currentCallUuid = null;
    _currentCall = null;
  }

  Future<String?> getVoIPToken() async {
    try {
      return await FlutterCallkitIncoming.getDevicePushTokenVoIP();
    } catch (e) {
      if (kDebugMode) {
        print('❌ Error getting VoIP token: $e');
      }
      return null;
    }
  }

  // Getter for current call data
  CallData? get currentCall => _currentCall;

  /// REMOVED: _storePendingCallData() - no longer needed
  /// Call navigation happens directly from CallKit accept event
  /// No need to store pending call data for app lifecycle

  /// Helper method to safely convert Map<Object?, Object?> to Map<String, dynamic>
  Map<String, dynamic>? _convertMapToStringDynamic(dynamic input) {
    if (input == null) return null;

    try {
      if (input is Map<String, dynamic>) {
        return input;
      } else if (input is Map) {
        final Map<String, dynamic> converted = {};
        input.forEach((key, value) {
          final stringKey = key?.toString() ?? '';
          converted[stringKey] = value;
        });
        return converted;
      }
    } catch (e) {
      if (kDebugMode) {
        print('❌ Error converting map: $e');
      }
    }

    return null;
  }
}
