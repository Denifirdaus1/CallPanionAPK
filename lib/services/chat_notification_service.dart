import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../utils/constants.dart';

class ChatNotificationService {
  static final ChatNotificationService instance = ChatNotificationService._internal();
  factory ChatNotificationService() => instance;
  ChatNotificationService._internal();

  final FlutterLocalNotificationsPlugin _notificationsPlugin =
      FlutterLocalNotificationsPlugin();

  bool _isInitialized = false;
  bool _isAppInForeground = true;

  /// Initialize local notifications for chat
  Future<void> initialize() async {
    if (_isInitialized) return;

    try {
      const androidSettings = AndroidInitializationSettings('@mipmap/ic_launcher');
      const iosSettings = DarwinInitializationSettings(
        requestAlertPermission: true,
        requestBadgePermission: true,
        requestSoundPermission: true,
      );

      const initSettings = InitializationSettings(
        android: androidSettings,
        iOS: iosSettings,
      );

      await _notificationsPlugin.initialize(
        initSettings,
        onDidReceiveNotificationResponse: _onNotificationTapped,
      );

      // Create notification channel for chat
      const androidChannel = AndroidNotificationChannel(
        'chat_messages',
        'Chat Messages',
        description: 'Notifications for new chat messages from family',
        importance: Importance.high,
        playSound: true,
        enableVibration: true,
      );

      await _notificationsPlugin
          .resolvePlatformSpecificImplementation<
              AndroidFlutterLocalNotificationsPlugin>()
          ?.createNotificationChannel(androidChannel);

      _isInitialized = true;

      if (kDebugMode) {
        print('[ChatNotification]  Initialized');
      }
    } catch (e) {
      if (kDebugMode) {
        print('[ChatNotification] L Error initializing: $e');
      }
    }
  }

  /// Set app foreground state
  void setAppForegroundState(bool isForeground) {
    _isAppInForeground = isForeground;
    if (kDebugMode) {
      print('[ChatNotification] App ${isForeground ? "in foreground" : "in background"}');
    }
  }

  /// Show chat notification (only when app is in background)
  Future<void> showChatNotification({
    required String householdId,
    required String householdName,
    required String messagePreview,
  }) async {
    // IMPORTANT: Don't show notification if app is in foreground
    if (_isAppInForeground) {
      if (kDebugMode) {
        print('[ChatNotification] =� App in foreground, skipping notification');
      }
      return;
    }

    try {
      if (!_isInitialized) {
        await initialize();
      }

      const androidDetails = AndroidNotificationDetails(
        'chat_messages',
        'Chat Messages',
        channelDescription: 'Notifications for new chat messages from family',
        importance: Importance.high,
        priority: Priority.high,
        playSound: true,
        enableVibration: true,
        icon: '@mipmap/ic_launcher',
      );

      const iosDetails = DarwinNotificationDetails(
        presentAlert: true,
        presentBadge: true,
        presentSound: true,
      );

      const notificationDetails = NotificationDetails(
        android: androidDetails,
        iOS: iosDetails,
      );

      // Store household ID for navigation
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('pending_chat_household_id', householdId);

      await _notificationsPlugin.show(
        householdId.hashCode, // Use household ID hash as notification ID
        householdName,
        'New message from your family',
        notificationDetails,
        payload: householdId,
      );

      if (kDebugMode) {
        print('[ChatNotification]  Shown for household: $householdName');
      }
    } catch (e) {
      if (kDebugMode) {
        print('[ChatNotification] L Error showing notification: $e');
      }
    }
  }

  /// Handle notification tap
  void _onNotificationTapped(NotificationResponse response) {
    if (kDebugMode) {
      print('[ChatNotification] = Notification tapped: ${response.payload}');
    }

    // The navigation will be handled by main.dart using the stored household ID
    // No direct navigation here since we don't have BuildContext
  }

  /// Cancel all chat notifications
  Future<void> cancelAllNotifications() async {
    try {
      await _notificationsPlugin.cancelAll();
      if (kDebugMode) {
        print('[ChatNotification] =� All notifications cancelled');
      }
    } catch (e) {
      if (kDebugMode) {
        print('[ChatNotification] Error cancelling notifications: $e');
      }
    }
  }

  /// Cancel notification for specific household
  Future<void> cancelNotification(String householdId) async {
    try {
      await _notificationsPlugin.cancel(householdId.hashCode);
      if (kDebugMode) {
        print('[ChatNotification] =� Cancelled notification for: $householdId');
      }
    } catch (e) {
      if (kDebugMode) {
        print('[ChatNotification] Error cancelling notification: $e');
      }
    }
  }
}
