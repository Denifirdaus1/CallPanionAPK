import 'package:permission_handler/permission_handler.dart';
import 'package:flutter/foundation.dart';
import 'dart:io';

class PermissionService {
  static final PermissionService instance = PermissionService._internal();
  factory PermissionService() => instance;
  PermissionService._internal();

  /// Request all essential permissions for conversational calls
  static Future<Map<String, bool>> requestAllEssentialPermissions() async {
    final results = <String, bool>{};

    try {
      if (kDebugMode) {
        print('[PermissionService] 🎤 Requesting essential permissions...');
      }

      // Request permissions together for better UX
      Map<Permission, PermissionStatus> permissions = await [
        Permission.microphone,      // CRITICAL for calls
        Permission.notification,    // CRITICAL for incoming calls
        Permission.camera,          // For future video calls
      ].request();

      results['microphone'] = permissions[Permission.microphone]?.isGranted ?? false;
      results['notification'] = permissions[Permission.notification]?.isGranted ?? false;
      results['camera'] = permissions[Permission.camera]?.isGranted ?? false;

      // For Android 12+, also request Bluetooth permissions
      if (Platform.isAndroid) {
        final bluetoothPermission = await Permission.bluetoothConnect.request();
        results['bluetooth'] = bluetoothPermission.isGranted;
      }

      if (kDebugMode) {
        print('[PermissionService] ✅ Permission results: $results');
      }

      return results;
    } catch (e) {
      if (kDebugMode) {
        print('[PermissionService] ❌ Error requesting permissions: $e');
      }
      return results;
    }
  }

  /// Request only call-critical permissions (mic + notification)
  static Future<bool> requestCallPermissions() async {
    try {
      Map<Permission, PermissionStatus> permissions = await [
        Permission.microphone,
        Permission.notification,
      ].request();

      // For Android 12+, also request Bluetooth permissions
      if (Platform.isAndroid) {
        final bluetoothPermission = await Permission.bluetoothConnect.request();
        permissions[Permission.bluetoothConnect] = bluetoothPermission;
      }

      // Check if all CRITICAL permissions are granted
      bool micGranted = permissions[Permission.microphone]?.isGranted ?? false;
      bool notifGranted = permissions[Permission.notification]?.isGranted ?? false;

      if (kDebugMode) {
        print('[PermissionService] Critical - Mic: $micGranted, Notif: $notifGranted');
      }

      return micGranted && notifGranted;
    } catch (e) {
      if (kDebugMode) {
        print('[PermissionService] Error requesting call permissions: $e');
      }
      return false;
    }
  }

  /// Check if all call permissions are granted
  static Future<bool> checkCallPermissions() async {
    final micStatus = await Permission.microphone.status;
    final notificationStatus = await Permission.notification.status;

    bool allGranted = micStatus == PermissionStatus.granted &&
        notificationStatus == PermissionStatus.granted;

    // For Android 12+, check Bluetooth permission
    if (Platform.isAndroid) {
      final bluetoothStatus = await Permission.bluetoothConnect.status;
      allGranted = allGranted && (bluetoothStatus == PermissionStatus.granted ||
                                   bluetoothStatus == PermissionStatus.denied);
    }

    return allGranted;
  }

  /// Check if microphone is granted
  static Future<bool> isMicrophoneGranted() async {
    final status = await Permission.microphone.status;
    return status.isGranted;
  }

  /// Open app settings
  static Future<void> openSettings() async {
    try {
      await openAppSettings();
    } catch (e) {
      if (kDebugMode) {
        print('[PermissionService] Error opening settings: $e');
      }
    }
  }
}