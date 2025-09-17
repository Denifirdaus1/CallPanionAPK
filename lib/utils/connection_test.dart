import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:flutter/foundation.dart';
import 'constants.dart';

class ConnectionTest {
  static Future<bool> testSupabaseConnection() async {
    try {
      final response = await http.get(
        Uri.parse('${AppConstants.supabaseUrl}/rest/v1/'),
        headers: {
          'apikey': AppConstants.supabaseAnonKey,
          'Content-Type': 'application/json',
        },
      );

      if (kDebugMode) {
        print('🔗 Supabase connection test: ${response.statusCode}');
      }

      return response.statusCode == 200;
    } catch (e) {
      if (kDebugMode) {
        print('❌ Supabase connection failed: $e');
      }
      return false;
    }
  }

  static Future<Map<String, bool>> testAllConnections() async {
    final results = <String, bool>{};

    // Test Supabase connection
    results['supabase'] = await testSupabaseConnection();

    // Test FCM registration endpoint
    try {
      final response = await http.post(
        Uri.parse(AppConstants.registerFcmTokenUrl),
        headers: {
          'apikey': AppConstants.supabaseAnonKey,
          'Content-Type': 'application/json',
        },
        body: jsonEncode({'test': true}),
      );

      results['fcm_endpoint'] = response.statusCode != 500;

      if (kDebugMode) {
        print('🔗 FCM endpoint test: ${response.statusCode}');
      }
    } catch (e) {
      results['fcm_endpoint'] = false;
      if (kDebugMode) {
        print('❌ FCM endpoint test failed: $e');
      }
    }

    // Test call status endpoint
    try {
      final response = await http.post(
        Uri.parse(AppConstants.updateCallStatusUrl),
        headers: {
          'apikey': AppConstants.supabaseAnonKey,
          'Content-Type': 'application/json',
        },
        body: jsonEncode({'test': true}),
      );

      results['call_status_endpoint'] = response.statusCode != 500;

      if (kDebugMode) {
        print('🔗 Call status endpoint test: ${response.statusCode}');
      }
    } catch (e) {
      results['call_status_endpoint'] = false;
      if (kDebugMode) {
        print('❌ Call status endpoint test failed: $e');
      }
    }

    return results;
  }
}