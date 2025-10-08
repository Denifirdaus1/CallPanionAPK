import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/call_data.dart';
import '../utils/constants.dart';
import 'chat_notification_service.dart';

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

    // Update chat notification service
    ChatNotificationService.instance.setAppForegroundState(true);

    if (kDebugMode) {
      print('📱 App resumed from background');
    }

    // REMOVED: _checkForPendingCall() - no longer needed
    // Call handling is done directly by CallKit service
  }

  Future<void> _handleAppMovedToBackground() async {
    _isAppInForeground = false;

    // Update chat notification service
    ChatNotificationService.instance.setAppForegroundState(false);

    if (kDebugMode) {
      print('📱 App moved to background');
    }
  }

  Future<void> _handleIncomingCallAccepted(Map<dynamic, dynamic> data) async {
    if (kDebugMode) {
      print('📞 Incoming call accepted while in background: $data');
    }

    // REMOVED: Storing pending call data - no longer needed
    // Navigation happens directly from CallKit accept event in CallKitService
    // No need to store or resume pending calls via app lifecycle

    if (kDebugMode) {
      print('📞 Call will be handled directly by CallKit service');
    }
  }

  /// REMOVED: _checkForPendingCall() - no longer needed
  /// Call navigation happens directly from CallKit accept event

  /// REMOVED: _storePendingCall() - no longer needed
  /// No need to store pending call data

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