import 'dart:io';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/call_data.dart';
import '../utils/constants.dart';
import 'callkit_service.dart';
import 'api_service.dart';

// Background message handler - must be top-level function
@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  if (kDebugMode) {
    print('📱 Background FCM message received: ${message.messageId}');
    print('📱 Notification title: ${message.notification?.title}');
    print('📱 Notification body: ${message.notification?.body}');
    print('📱 Data: ${message.data}');
  }

  // Handle incoming call in background
  if (message.data['type'] == 'incoming_call') {
    await _handleBackgroundIncomingCall(message.data);
  }
}

Future<void> _handleBackgroundIncomingCall(Map<String, dynamic> data) async {
  try {
    if (kDebugMode) {
      print('🔔 Processing background incoming call:');
      print('  - SessionId: ${data['sessionId']}');
      print('  - RelativeName: ${data['relativeName']}');
      print('  - CallType: ${data['callType']}');
      print('  - HouseholdId: ${data['householdId']}');
      print('  - RelativeId: ${data['relativeId']}');
    }

    final callData = CallData(
      sessionId: data['sessionId'] ?? '',
      relativeName: data['relativeName'] ?? 'Your Family',
      callType: data['callType'] ?? AppConstants.callTypeInApp,
      householdId: data['householdId'] ?? '',
      relativeId: data['relativeId'] ?? '',
      handle: data['handle'] ?? 'CallPanion',
      avatar: data['avatar'] ?? '',
      duration: data['duration'] ?? '30000',
    );

    if (kDebugMode) {
      print('📞 Background call data created: ${callData.toJsonString()}');
    }

    // Show CallKit incoming call interface
    await CallKitService.instance.showIncomingCall(callData);

    if (kDebugMode) {
      print('✅ Background incoming call processed successfully');
    }
  } catch (e) {
    if (kDebugMode) {
      print('❌ Error handling background incoming call: $e');
      print('❌ Data received: $data');
    }
  }
}

class FCMService {
  static final FCMService _instance = FCMService._internal();
  static FCMService get instance => _instance;
  FCMService._internal();

  FirebaseMessaging get _messaging => FirebaseMessaging.instance;
  String? _currentToken;

  Function(CallData)? onIncomingCall;
  Function(Map<String, dynamic>)? onCallScheduled;

  Future<void> initialize() async {
    if (kDebugMode) {
      print('🔧 Initializing FCM Service...');
    }

    // Set background message handler
    FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);

    // Request permissions
    await _requestPermissions();

    // Get initial token
    await _getToken();

    // Setup message handlers
    _setupMessageHandlers();

    if (kDebugMode) {
      print('✅ FCM Service initialized');
    }
  }

  Future<void> _requestPermissions() async {
    try {
      final settings = await _messaging.requestPermission(
        alert: true,
        announcement: false,
        badge: true,
        carPlay: false,
        criticalAlert: false,
        provisional: false,
        sound: true,
      );

      if (kDebugMode) {
        print('📱 FCM Permission status: ${settings.authorizationStatus}');
      }

      // For iOS, configure foreground presentation options
      if (Platform.isIOS) {
        await _messaging.setForegroundNotificationPresentationOptions(
          alert: true,
          badge: true,
          sound: true,
        );
      }
    } catch (e) {
      if (kDebugMode) {
        print('❌ Error requesting FCM permissions: $e');
      }
    }
  }

  Future<void> _getToken() async {
    try {
      final token = await _messaging.getToken();
      if (token != null) {
        _currentToken = token;
        await _saveToken(token);

        if (kDebugMode) {
          print('📱 FCM Token: ${token.substring(0, 20)}...');
          print(
              '📱 Token will be registered after device pairing or during app init');
        }
      }
    } catch (e) {
      if (kDebugMode) {
        print('❌ Error getting FCM token: $e');
      }
    }
  }

  // Public method to manually register token
  Future<bool> registerToken({String? customToken}) async {
    try {
      final token = customToken ?? _currentToken;
      if (token != null) {
        final success =
            await ApiService.instance.registerFCMToken(fcmToken: token);
        if (kDebugMode) {
          print(success
              ? '✅ FCM token registered successfully'
              : '❌ Failed to register FCM token');
        }
        return success;
      }
      return false;
    } catch (e) {
      if (kDebugMode) {
        print('❌ Error registering FCM token: $e');
      }
      return false;
    }
  }

  Future<void> _saveToken(String token) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(AppConstants.keyDeviceToken, token);
    } catch (e) {
      if (kDebugMode) {
        print('❌ Error saving FCM token: $e');
      }
    }
  }

  void _setupMessageHandlers() {
    // Handle token refresh
    _messaging.onTokenRefresh.listen((token) {
      _currentToken = token;
      _saveToken(token);

      // Only register if device is paired
      _registerTokenIfPaired(token);

      if (kDebugMode) {
        print('📱 FCM Token refreshed');
      }
    });

    // Handle foreground messages
    FirebaseMessaging.onMessage.listen((RemoteMessage message) {
      if (kDebugMode) {
        print('📱 Foreground FCM message received: ${message.messageId}');
        print('📱 Notification title: ${message.notification?.title}');
        print('📱 Notification body: ${message.notification?.body}');
        print('📱 Data: ${message.data}');
        print('📱 From: ${message.from}');
        print('📱 Sent time: ${message.sentTime}');
      }

      _handleForegroundMessage(message);
    });

    // Handle when user taps on notification
    FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
      if (kDebugMode) {
        print('📱 FCM message opened app: ${message.messageId}');
      }

      _handleMessageOpenedApp(message);
    });

    // Handle when app is opened from terminated state via notification
    _messaging.getInitialMessage().then((RemoteMessage? message) {
      if (message != null) {
        if (kDebugMode) {
          print(
              '📱 FCM message opened app from terminated state: ${message.messageId}');
        }
        _handleMessageOpenedApp(message);
      }
    });
  }

  void _handleForegroundMessage(RemoteMessage message) {
    final messageType = message.data['type'] ?? '';

    switch (messageType) {
      case 'incoming_call':
        _handleIncomingCallMessage(message.data);
        break;
      case 'call_scheduled':
        _handleCallScheduledMessage(message.data);
        break;
      case 'call_update':
        _handleCallUpdateMessage(message.data);
        break;
      default:
        if (kDebugMode) {
          print('📱 Unhandled message type: $messageType');
        }
    }
  }

  void _handleIncomingCallMessage(Map<String, dynamic> data) {
    try {
      // Enhanced validation for security
      final sessionId = data['sessionId'] ?? '';
      final householdId = data['householdId'] ?? '';
      final relativeId = data['relativeId'] ?? '';
      final messageType = data['type'] ?? '';

      if (kDebugMode) {
        print('🔔 Processing incoming call message:');
        print('  - Type: $messageType');
        print('  - SessionId: $sessionId');
        print('  - HouseholdId: $householdId');
        print('  - RelativeId: $relativeId');
        print('  - RelativeName: ${data['relativeName'] ?? 'Unknown'}');
      }

      if (sessionId.isEmpty || householdId.isEmpty || relativeId.isEmpty) {
        if (kDebugMode) {
          print('❌ Invalid incoming call data: missing required fields');
          print('  - SessionId empty: ${sessionId.isEmpty}');
          print('  - HouseholdId empty: ${householdId.isEmpty}');
          print('  - RelativeId empty: ${relativeId.isEmpty}');
        }
        return;
      }

      final callData = CallData(
        sessionId: sessionId,
        relativeName: data['relativeName'] ?? 'Your Family',
        callType: data['callType'] ?? AppConstants.callTypeInApp,
        householdId: householdId,
        relativeId: relativeId,
        handle: data['handle'] ?? 'CallPanion',
        avatar: data['avatar'] ?? '',
        duration: data['duration'] ?? '30000',
      );

      if (kDebugMode) {
        print('📞 Created call data: ${callData.toJsonString()}');
      }

      // Verify this call is for our paired device
      _verifyCallOwnership(callData).then((isValid) {
        if (isValid) {
          if (kDebugMode) {
            print('✅ Call ownership verified, showing CallKit interface');
          }

          // Show CallKit interface
          CallKitService.instance.showIncomingCall(callData);

          // Notify listeners
          if (onIncomingCall != null) {
            onIncomingCall!(callData);
          }

          if (kDebugMode) {
            print(
                '📞 Incoming call processed successfully: ${callData.sessionId}');
          }
        } else {
          if (kDebugMode) {
            print(
                '❌ Call ownership verification failed for session: $sessionId');
          }
        }
      }).catchError((error) {
        if (kDebugMode) {
          print('❌ Error during call ownership verification: $error');
        }
      });
    } catch (e) {
      if (kDebugMode) {
        print('❌ Error handling incoming call message: $e');
        print('❌ Message data: $data');
      }
    }
  }

  void _handleCallScheduledMessage(Map<String, dynamic> data) {
    if (onCallScheduled != null) {
      onCallScheduled!(data);
    }

    if (kDebugMode) {
      print('📅 Call scheduled notification: ${data['sessionId']}');
    }
  }

  void _handleCallUpdateMessage(Map<String, dynamic> data) {
    final status = data['status'] ?? '';
    final sessionId = data['sessionId'] ?? '';

    if (kDebugMode) {
      print('📱 Call update: $sessionId -> $status');
    }
  }

  void _handleMessageOpenedApp(RemoteMessage message) {
    final messageType = message.data['type'] ?? '';

    if (messageType == 'incoming_call') {
      // If user opened app via incoming call notification, handle it immediately
      _handleIncomingCallMessage(message.data);

      // Note: Navigation is now handled in main.dart to ensure direct navigation
      // This prevents conflicts and ensures calls go directly to CallScreen
    }
  }

  String? get currentToken => _currentToken;

  Future<String?> getSavedToken() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      return prefs.getString(AppConstants.keyDeviceToken);
    } catch (e) {
      if (kDebugMode) {
        print('❌ Error getting saved FCM token: $e');
      }
      return null;
    }
  }

  Future<void> _registerTokenIfPaired(String token) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final isPaired = prefs.getString(AppConstants.keyPairingToken) != null;

      if (isPaired) {
        await ApiService.instance.registerFCMToken(fcmToken: token);
        if (kDebugMode) {
          print('📱 FCM token re-registered after refresh');
        }
      }
    } catch (e) {
      if (kDebugMode) {
        print('❌ Error checking pairing status for token registration: $e');
      }
    }
  }
}

// Verify call ownership for security
Future<bool> _verifyCallOwnership(CallData callData) async {
  try {
    final prefs = await SharedPreferences.getInstance();
    final storedHouseholdId = prefs.getString(AppConstants.keyHouseholdId);
    final storedRelativeId = prefs.getString(AppConstants.keyRelativeId);

    // Basic validation: ensure this call is for our paired household/relative
    if (storedHouseholdId != null && storedRelativeId != null) {
      return callData.householdId == storedHouseholdId &&
          callData.relativeId == storedRelativeId;
    }

    // If not paired, reject the call for security
    if (kDebugMode) {
      print('❌ Device not properly paired - rejecting call');
    }
    return false;
  } catch (e) {
    if (kDebugMode) {
      print('❌ Error verifying call ownership: $e');
    }
    return false;
  }
}
