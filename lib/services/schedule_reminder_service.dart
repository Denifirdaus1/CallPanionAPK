import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:timezone/timezone.dart' as tz;
import 'package:timezone/data/latest_all.dart' as tz;

class ScheduleReminderService {
  static final ScheduleReminderService instance =
      ScheduleReminderService._internal();
  factory ScheduleReminderService() => instance;
  ScheduleReminderService._internal();

  final FlutterLocalNotificationsPlugin _notificationsPlugin =
      FlutterLocalNotificationsPlugin();

  bool _isInitialized = false;

  // Notification IDs for each schedule
  static const int morningReminderId = 100;
  static const int afternoonReminderId = 101;
  static const int eveningReminderId = 102;

  /// Initialize schedule reminder notifications
  Future<void> initialize() async {
    if (_isInitialized) return;

    try {
      // Initialize timezone data
      tz.initializeTimeZones();

      const androidSettings =
          AndroidInitializationSettings('@mipmap/ic_launcher');
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

      // Create notification channel for schedule reminders
      const androidChannel = AndroidNotificationChannel(
        'schedule_reminders',
        'Schedule Reminders',
        description:
            'Reminders for upcoming scheduled calls with your family',
        importance: Importance.high,
        playSound: true,
        enableVibration: true,
        showBadge: true,
      );

      await _notificationsPlugin
          .resolvePlatformSpecificImplementation<
              AndroidFlutterLocalNotificationsPlugin>()
          ?.createNotificationChannel(androidChannel);

      _isInitialized = true;

      if (kDebugMode) {
        print('[ScheduleReminder] ✅ Initialized');
      }
    } catch (e) {
      if (kDebugMode) {
        print('[ScheduleReminder] ❌ Error initializing: $e');
      }
    }
  }

  /// Schedule all daily reminders based on call times
  /// Reminders are set 10 minutes before each call time
  Future<void> scheduleAllReminders({
    String? morningTime,
    String? afternoonTime,
    String? eveningTime,
    String? timezone,
    required bool isActive,
  }) async {
    try {
      if (!_isInitialized) {
        await initialize();
      }

      // Cancel all existing reminders first
      await cancelAllReminders();

      // Only schedule if schedule is active
      if (!isActive) {
        if (kDebugMode) {
          print('[ScheduleReminder] Schedule inactive - not scheduling reminders');
        }
        return;
      }

      // Get timezone location
      final tz.Location location = _getLocation(timezone);

      // Schedule morning reminder
      if (morningTime != null && morningTime.isNotEmpty) {
        await _scheduleReminder(
          id: morningReminderId,
          time: morningTime,
          label: 'Morning',
          location: location,
        );
      }

      // Schedule afternoon reminder
      if (afternoonTime != null && afternoonTime.isNotEmpty) {
        await _scheduleReminder(
          id: afternoonReminderId,
          time: afternoonTime,
          label: 'Afternoon',
          location: location,
        );
      }

      // Schedule evening reminder
      if (eveningTime != null && eveningTime.isNotEmpty) {
        await _scheduleReminder(
          id: eveningReminderId,
          time: eveningTime,
          label: 'Evening',
          location: location,
        );
      }

      if (kDebugMode) {
        print('[ScheduleReminder] ✅ All reminders scheduled');
      }
    } catch (e) {
      if (kDebugMode) {
        print('[ScheduleReminder] ❌ Error scheduling reminders: $e');
      }
    }
  }

  /// Schedule a single reminder 10 minutes before call time
  Future<void> _scheduleReminder({
    required int id,
    required String time,
    required String label,
    required tz.Location location,
  }) async {
    try {
      // Parse time (format: HH:mm or HH:mm:ss)
      final parts = time.split(':');
      if (parts.length < 2) {
        if (kDebugMode) {
          print('[ScheduleReminder] Invalid time format: $time');
        }
        return;
      }

      final hour = int.parse(parts[0]);
      final minute = int.parse(parts[1]);

      // Calculate reminder time (10 minutes before)
      int reminderHour = hour;
      int reminderMinute = minute - 10;

      if (reminderMinute < 0) {
        reminderMinute += 60;
        reminderHour -= 1;
        if (reminderHour < 0) {
          reminderHour += 24; // Handle midnight crossing
        }
      }

      // Get current time in the specified timezone
      final now = tz.TZDateTime.now(location);

      // Create scheduled time for today
      var scheduledDate = tz.TZDateTime(
        location,
        now.year,
        now.month,
        now.day,
        reminderHour,
        reminderMinute,
      );

      // If time has already passed today, schedule for tomorrow
      if (scheduledDate.isBefore(now)) {
        scheduledDate = scheduledDate.add(const Duration(days: 1));
      }

      const androidDetails = AndroidNotificationDetails(
        'schedule_reminders',
        'Schedule Reminders',
        channelDescription:
            'Reminders for upcoming scheduled calls with your family',
        importance: Importance.high,
        priority: Priority.high,
        playSound: true,
        enableVibration: true,
        icon: '@mipmap/ic_launcher',
        styleInformation: BigTextStyleInformation(
          'Your family will call you in 10 minutes. Please keep the app open to receive the call.',
        ),
      );

      const iosDetails = DarwinNotificationDetails(
        presentAlert: true,
        presentBadge: true,
        presentSound: true,
        interruptionLevel: InterruptionLevel.timeSensitive,
      );

      const notificationDetails = NotificationDetails(
        android: androidDetails,
        iOS: iosDetails,
      );

      // Schedule daily notification
      await _notificationsPlugin.zonedSchedule(
        id,
        'Upcoming $label Call',
        'Your family will call in 10 minutes. Please open CallPanion app.',
        scheduledDate,
        notificationDetails,
        androidScheduleMode: AndroidScheduleMode.exactAllowWhileIdle,
        uiLocalNotificationDateInterpretation:
            UILocalNotificationDateInterpretation.absoluteTime,
        matchDateTimeComponents: DateTimeComponents.time, // Repeat daily
      );

      if (kDebugMode) {
        print(
            '[ScheduleReminder] ✅ Scheduled $label reminder at ${scheduledDate.hour.toString().padLeft(2, '0')}:${scheduledDate.minute.toString().padLeft(2, '0')}');
      }
    } catch (e) {
      if (kDebugMode) {
        print('[ScheduleReminder] ❌ Error scheduling $label reminder: $e');
      }
    }
  }

  /// Get timezone location
  tz.Location _getLocation(String? timezone) {
    try {
      if (timezone != null && timezone.isNotEmpty) {
        return tz.getLocation(timezone);
      }
    } catch (e) {
      if (kDebugMode) {
        print('[ScheduleReminder] ⚠️ Invalid timezone: $timezone, using local');
      }
    }
    // Default to local timezone
    return tz.local;
  }

  /// Cancel all scheduled reminders
  Future<void> cancelAllReminders() async {
    try {
      await _notificationsPlugin.cancel(morningReminderId);
      await _notificationsPlugin.cancel(afternoonReminderId);
      await _notificationsPlugin.cancel(eveningReminderId);

      if (kDebugMode) {
        print('[ScheduleReminder] ✅ All reminders cancelled');
      }
    } catch (e) {
      if (kDebugMode) {
        print('[ScheduleReminder] ❌ Error cancelling reminders: $e');
      }
    }
  }

  /// Cancel specific reminder
  Future<void> cancelReminder(int id) async {
    try {
      await _notificationsPlugin.cancel(id);
      if (kDebugMode) {
        print('[ScheduleReminder] ✅ Cancelled reminder: $id');
      }
    } catch (e) {
      if (kDebugMode) {
        print('[ScheduleReminder] ❌ Error cancelling reminder: $e');
      }
    }
  }

  /// Handle notification tap (bring user to main screen)
  void _onNotificationTapped(NotificationResponse response) {
    if (kDebugMode) {
      print('[ScheduleReminder] 📱 Notification tapped: ${response.payload}');
    }
    // Navigation handled by app - user should already be in app when tapping
  }

  /// Get pending notifications (for debugging)
  Future<List<PendingNotificationRequest>> getPendingReminders() async {
    try {
      final pending = await _notificationsPlugin.pendingNotificationRequests();
      if (kDebugMode) {
        print('[ScheduleReminder] 📋 Pending reminders: ${pending.length}');
        for (final notif in pending) {
          print('  - ID ${notif.id}: ${notif.title}');
        }
      }
      return pending;
    } catch (e) {
      if (kDebugMode) {
        print('[ScheduleReminder] ❌ Error getting pending reminders: $e');
      }
      return [];
    }
  }
}
