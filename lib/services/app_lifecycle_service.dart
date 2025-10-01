import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/call_data.dart';
import '../utils/constants.dart';

class AppLifecycleService {
  static final AppLifecycleService _instance = AppLifecycleService._internal();
  static AppLifecycleService get instance => _instance;
  AppLifecycleService._internal();

  static const platform = MethodChannel('app.lovable.callpanion/lifecycle');

  bool _isAppInForeground = true;
  CallData? _pendingCall;

  // Callbacks
  Function(CallData)? onPendingCallResume;

  Future<void> initialize() async {
    try {
      // Setup method channel for lifecycle events
      platform.setMethodCallHandler(_handleMethodCall);

      if (kDebugMode) {
        print('✅ App Lifecycle Service initialized');
      }
    } catch (e) {
      if (kDebugMode) {
        print('❌ Error initializing App Lifecycle Service: $e');
      }
    }
  }

  Future<dynamic> _handleMethodCall(MethodCall call) async {
    switch (call.method) {
      case 'app_resumed_from_background':
        await _handleAppResumedFromBackground();
        break;
      case 'app_moved_to_background':
        await _handleAppMovedToBackground();
        break;
      case 'incoming_call_accepted':
        final data = call.arguments as Map<dynamic, dynamic>;
        await _handleIncomingCallAccepted(data);
        break;
      default:
        if (kDebugMode) {
          print('🔔 Unhandled method call: ${call.method}');
        }
    }
  }

  Future<void> _handleAppResumedFromBackground() async {
    _isAppInForeground = true;

    if (kDebugMode) {
      print('📱 App resumed from background');
    }

    // Check if there's a pending call to display
    await _checkForPendingCall();
  }

  Future<void> _handleAppMovedToBackground() async {
    _isAppInForeground = false;

    if (kDebugMode) {
      print('📱 App moved to background');
    }
  }

  Future<void> _handleIncomingCallAccepted(Map<dynamic, dynamic> data) async {
    if (kDebugMode) {
      print('📞 Incoming call accepted while in background: $data');
    }

    // Store call data for when app resumes
    final callData = CallData(
      sessionId: data['sessionId']?.toString() ?? '',
      relativeName: data['relativeName']?.toString() ?? 'Your Family',
      callType: data['callType']?.toString() ?? AppConstants.callTypeInApp,
      householdId: data['householdId']?.toString() ?? '',
      relativeId: data['relativeId']?.toString() ?? '',
    );

    // Always store the call data for proper handling
    _pendingCall = callData;
    await _storePendingCall(callData);

    // Note: Navigation is now handled in main.dart to ensure direct navigation
    // This prevents conflicts and ensures calls go directly to CallScreen
  }

  Future<void> _checkForPendingCall() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final pendingCallData = prefs.getString(AppConstants.keyPendingCall);

      if (pendingCallData != null) {
        // Clear stored pending call
        await prefs.remove(AppConstants.keyPendingCall);

        // Parse call data
        final data = CallData.fromJsonString(pendingCallData);
        if (data != null) {
          if (kDebugMode) {
            print('📞 Found pending call: ${data.sessionId}');
          }
          // Note: Navigation is now handled in main.dart to ensure direct navigation
          // This prevents conflicts and ensures calls go directly to CallScreen
        }
      }
    } catch (e) {
      if (kDebugMode) {
        print('❌ Error checking pending call: $e');
      }
    }
  }

  Future<void> _storePendingCall(CallData callData) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(
          AppConstants.keyPendingCall, callData.toJsonString());

      if (kDebugMode) {
        print('💾 Stored pending call: ${callData.sessionId}');
      }
    } catch (e) {
      if (kDebugMode) {
        print('❌ Error storing pending call: $e');
      }
    }
  }

  Future<void> clearPendingCall() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(AppConstants.keyPendingCall);
      _pendingCall = null;

      if (kDebugMode) {
        print('🗑️ Cleared pending call');
      }
    } catch (e) {
      if (kDebugMode) {
        print('❌ Error clearing pending call: $e');
      }
    }
  }

  // Bring app to foreground when call is accepted
  Future<void> bringAppToForeground() async {
    try {
      await platform.invokeMethod('bring_app_to_foreground');

      if (kDebugMode) {
        print('📱 Bringing app to foreground');
      }
    } catch (e) {
      if (kDebugMode) {
        print('❌ Error bringing app to foreground: $e');
      }
    }
  }

  bool get isAppInForeground => _isAppInForeground;
  CallData? get pendingCall => _pendingCall;
}
