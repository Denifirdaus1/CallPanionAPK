import 'package:permission_handler/permission_handler.dart';
import 'dart:io';

class PermissionService {
  static Future<bool> requestCallPermissions() async {
    Map<Permission, PermissionStatus> permissions = await [
      Permission.microphone,
      Permission.notification,
    ].request();

    // For Android 12+, also request Bluetooth permissions
    if (Platform.isAndroid) {
      final bluetoothPermission = await Permission.bluetoothConnect.request();
      permissions[Permission.bluetoothConnect] = bluetoothPermission;
    }

    // Check if all required permissions are granted
    bool allGranted = permissions.values.every(
            (status) => status == PermissionStatus.granted || status == PermissionStatus.permanentlyDenied
    );

    return allGranted;
  }

  static Future<bool> checkCallPermissions() async {
    final micStatus = await Permission.microphone.status;
    final notificationStatus = await Permission.notification.status;

    bool allGranted = micStatus == PermissionStatus.granted &&
        notificationStatus == PermissionStatus.granted;

    // For Android 12+, check Bluetooth permission
    if (Platform.isAndroid) {
      final bluetoothStatus = await Permission.bluetoothConnect.status;
      allGranted = allGranted && bluetoothStatus == PermissionStatus.granted;
    }

    return allGranted;
  }

  static Future<void> openAppSettings() async {
    await openAppSettings();
  }
}