import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:uuid/uuid.dart';
import '../utils/constants.dart';
import '../models/device_info.dart';

class ApiService {
  static final ApiService _instance = ApiService._internal();
  static ApiService get instance => _instance;
  ApiService._internal();

  final http.Client _httpClient = http.Client();

  Map<String, String> get _headers => {
    'Content-Type': 'application/json',
    'apikey': AppConstants.supabaseAnonKey,
    'Authorization': 'Bearer ${AppConstants.supabaseAnonKey}',
  };

  Future<bool> registerFCMToken({
    String? fcmToken,
    String? voipToken,
  }) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      String? userId = prefs.getString(AppConstants.keyUserId);
      final savedFcmToken = fcmToken ?? prefs.getString(AppConstants.keyDeviceToken);
      final savedVoipToken = voipToken ?? prefs.getString(AppConstants.keyVoipToken);

      // Generate user ID if not exists (for unlinked devices)
      if (userId == null) {
        userId = const Uuid().v4();
        await prefs.setString(AppConstants.keyUserId, userId);
        if (kDebugMode) {
          print('📱 Generated new user ID: $userId');
        }
      }

      if (savedFcmToken == null) {
        if (kDebugMode) {
          print('❌ Cannot register FCM token: missing FCM token');
        }
        return false;
      }

      // Check if device is paired - if so, use pairing info
      final pairingToken = prefs.getString(AppConstants.keyPairingToken);
      final relativeId = prefs.getString(AppConstants.keyRelativeId);
      final householdId = prefs.getString(AppConstants.keyHouseholdId);

      final deviceInfo = _getDeviceInfo();

      final body = {
        'userId': userId,
        'token': savedFcmToken,
        'platform': Platform.isIOS ? 'ios' : 'android',
        'deviceInfo': deviceInfo.toJson(),
        if (savedVoipToken != null) 'voipToken': savedVoipToken,
        if (pairingToken != null) 'pairingToken': pairingToken,
        if (relativeId != null) 'relativeId': relativeId,
        if (householdId != null) 'householdId': householdId,
        // Enhanced device info for security validation
        'deviceFingerprint': _generateDeviceFingerprint(),
      };

      final response = await _httpClient.post(
        Uri.parse(AppConstants.registerFcmTokenUrl),
        headers: _headers,
        body: jsonEncode(body),
      );

      if (response.statusCode == 200) {
        final responseData = jsonDecode(response.body);
        if (responseData['success'] == true) {
          if (kDebugMode) {
            print('✅ FCM token registered successfully for user: $userId');
            if (pairingToken != null) {
              print('📱 Device pairing info included in registration');
            }
          }
          return true;
        }
      }

      if (kDebugMode) {
        print('❌ Failed to register FCM token: ${response.statusCode} - ${response.body}');
      }
      return false;
    } catch (e) {
      if (kDebugMode) {
        print('❌ Error registering FCM token: $e');
      }
      return false;
    }
  }

  Future<bool> updateCallStatus({
    required String sessionId,
    required String status,
    required String action,
    String? callUuid,
    int? duration,
  }) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final pairingToken = prefs.getString(AppConstants.keyPairingToken);
      final deviceToken = prefs.getString(AppConstants.keyDeviceToken);

      final body = {
        'sessionId': sessionId,
        'status': status,
        'action': action,
        if (callUuid != null) 'callUuid': callUuid,
        if (duration != null) 'duration': duration,
        if (pairingToken != null) 'pairingToken': pairingToken,
        if (deviceToken != null) 'deviceToken': deviceToken,
      };

      final response = await _httpClient.post(
        Uri.parse('${AppConstants.supabaseUrl}/functions/v1/update-device-call-status'),
        headers: _headers,
        body: jsonEncode(body),
      );

      if (response.statusCode == 200) {
        final responseData = jsonDecode(response.body);
        if (responseData['success'] == true) {
          if (kDebugMode) {
            print('✅ Call status updated: $sessionId -> $status');
          }
          return true;
        }
      }

      if (kDebugMode) {
        print('❌ Failed to update call status: ${response.statusCode} - ${response.body}');
      }
      return false;
    } catch (e) {
      if (kDebugMode) {
        print('❌ Error updating call status: $e');
      }
      return false;
    }
  }

  Future<List<Map<String, dynamic>>> checkScheduledCalls({
    String? deviceToken,
    String? pairingToken,
  }) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final savedDeviceToken = deviceToken ?? prefs.getString(AppConstants.keyDeviceToken);
      final savedPairingToken = pairingToken ?? prefs.getString(AppConstants.keyPairingToken);

      if (savedDeviceToken == null && savedPairingToken == null) {
        if (kDebugMode) {
          print('❌ Cannot check scheduled calls: missing device/pairing token');
        }
        return [];
      }

      final body = <String, dynamic>{};
      if (savedDeviceToken != null) body['deviceToken'] = savedDeviceToken;
      if (savedPairingToken != null) body['pairingToken'] = savedPairingToken;

      final response = await _httpClient.post(
        Uri.parse(AppConstants.checkScheduledCallsUrl),
        headers: _headers,
        body: jsonEncode(body),
      );

      if (response.statusCode == 200) {
        final responseData = jsonDecode(response.body);
        if (responseData['success'] == true) {
          final calls = List<Map<String, dynamic>>.from(responseData['scheduledCalls'] ?? []);
          if (kDebugMode) {
            print('📅 Found ${calls.length} scheduled calls');
            print('📅 Response data: $responseData');
          }
          return calls;
        } else {
          if (kDebugMode) {
            print('❌ Server returned success=false: ${responseData['message'] ?? 'Unknown error'}');
          }
        }
      }

      if (kDebugMode) {
        print('❌ Failed to check scheduled calls: ${response.statusCode} - ${response.body}');
      }
      return [];
    } catch (e) {
      if (kDebugMode) {
        print('❌ Error checking scheduled calls: $e');
      }
      return [];
    }
  }

  DeviceInfo _getDeviceInfo() {
    return DeviceInfo(
      platform: Platform.isIOS ? 'ios' : 'android',
      model: Platform.isIOS ? 'iPhone' : 'Android',
      version: '1.0.0', // App version
      brand: Platform.isIOS ? 'Apple' : 'Android',
      additional: {
        'app_version': '1.0.0',
        'flutter_version': '3.10.0',
        'timestamp': DateTime.now().toIso8601String(),
        'device_fingerprint': _generateDeviceFingerprint(),
      },
    );
  }

  String _generateDeviceFingerprint() {
    // Generate a unique device fingerprint for security validation
    final platform = Platform.isIOS ? 'ios' : 'android';
    final timestamp = DateTime.now().millisecondsSinceEpoch.toString();
    final random = DateTime.now().microsecondsSinceEpoch.toString();
    return '$platform-$timestamp-$random';
  }

  Future<Map<String, dynamic>> claimPairingCode(String code) async {
    final prefs = await SharedPreferences.getInstance();
    final userId = prefs.getString(AppConstants.keyUserId);

    if (userId == null) {
      throw Exception('User ID not found');
    }

    final response = await http.post(
      Uri.parse('${AppConstants.supabaseUrl}/functions/v1/pair-claim'),
      headers: {
        'apikey': AppConstants.supabaseAnonKey,
        'Content-Type': 'application/json',
      },
      body: jsonEncode({
        'user_id': userId,
        'pairing_code': code,
      }),
    );

    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    } else {
      final errorBody = jsonDecode(response.body);
      throw Exception(errorBody['error'] ?? 'Failed to claim pairing code');
    }
  }

  void dispose() {
    _httpClient.close();
  }
}