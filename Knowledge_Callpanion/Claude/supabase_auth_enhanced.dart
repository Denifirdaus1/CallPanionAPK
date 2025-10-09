import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../utils/constants.dart';

/// Service for managing Supabase authentication for elderly app
/// Creates anonymous sessions linked to device pairing
class SupabaseAuthService {
  static final SupabaseAuthService instance = SupabaseAuthService._internal();
  factory SupabaseAuthService() => instance;
  SupabaseAuthService._internal();

  // LAZY LOADING: Get Supabase client only when needed (after initialization)
  SupabaseClient get _supabase => Supabase.instance.client;

  /// Check if user is authenticated
  bool get isAuthenticated => _supabase.auth.currentUser != null;

  /// Get current user ID (for debugging)
  String? get currentUserId => _supabase.auth.currentUser?.id;

  /// Initialize authentication - restore session if exists
  Future<void> initialize() async {
    try {
      // Check if we have a stored session
      final prefs = await SharedPreferences.getInstance();
      final storedSession = prefs.getString(AppConstants.keySupabaseSession);

      if (storedSession != null && storedSession.isNotEmpty) {
        if (kDebugMode) {
          print('[SupabaseAuth] Found stored session, restoring...');
        }
        // Session will be automatically restored by Supabase Flutter
      }

      // Check current auth state
      final currentUser = _supabase.auth.currentUser;
      if (currentUser != null) {
        if (kDebugMode) {
          print('[SupabaseAuth] ✅ User authenticated: ${currentUser.id}');
        }
      } else {
        if (kDebugMode) {
          print('[SupabaseAuth] ⚠️ No authenticated user');
        }
      }
    } catch (e) {
      if (kDebugMode) {
        print('[SupabaseAuth] ❌ Error initializing auth: $e');
      }
    }
  }

  /// 🎯 MAIN METHOD: Ensure chat access with auto-update device_pairs
  /// This replaces manual migration by automatically updating device_pairs
  /// with the current authenticated user_id
  Future<bool> ensureChatAccess() async {
    try {
      if (kDebugMode) {
        print('[SupabaseAuth] 🔐 Ensuring chat access...');
      }

      // Step 1: Check if authenticated, if not sign in anonymously
      String? userId = currentUserId;
      
      if (userId == null) {
        if (kDebugMode) {
          print('[SupabaseAuth] Not authenticated, signing in anonymously...');
        }
        final signInSuccess = await signInAnonymously();
        if (!signInSuccess) {
          if (kDebugMode) {
            print('[SupabaseAuth] ❌ Failed to sign in anonymously');
          }
          return false;
        }
        userId = currentUserId;
      }

      if (userId == null) {
        if (kDebugMode) {
          print('[SupabaseAuth] ❌ No user ID after authentication');
        }
        return false;
      }

      if (kDebugMode) {
        print('[SupabaseAuth] ✅ Authenticated with user_id: $userId');
      }

      // Step 2: Update device_pairs with current user_id for RLS access
      final updateSuccess = await _updateDevicePairWithUserId(userId);
      
      if (!updateSuccess) {
        if (kDebugMode) {
          print('[SupabaseAuth] ⚠️ Failed to update device_pairs, but continuing...');
        }
        // Don't fail completely - user might still have access
      }

      if (kDebugMode) {
        print('[SupabaseAuth] ✅ Chat access ensured successfully!');
      }
      
      return true;
    } catch (e) {
      if (kDebugMode) {
        print('[SupabaseAuth] ❌ Error ensuring chat access: $e');
      }
      return false;
    }
  }

  /// Sign in anonymously when device is paired
  /// This creates a Supabase auth session for the device
  Future<bool> signInAnonymously() async {
    try {
      if (kDebugMode) {
        print('[SupabaseAuth] Signing in anonymously...');
      }

      final response = await _supabase.auth.signInAnonymously();

      if (response.user != null) {
        // Store session
        await _storeSession();

        if (kDebugMode) {
          print('[SupabaseAuth] ✅ Anonymous sign in successful: ${response.user!.id}');
        }
        return true;
      }

      return false;
    } catch (e) {
      if (kDebugMode) {
        print('[SupabaseAuth] ❌ Error signing in anonymously: $e');
      }
      return false;
    }
  }

  /// Ensure device_pairs is updated with current user_id
  /// Public method that can be called even if already authenticated
  Future<void> ensureDevicePairUpdated() async {
    final userId = currentUserId;
    if (userId != null) {
      await _updateDevicePairWithUserId(userId);
    }
  }

  /// 🎯 CRITICAL: Update device_pairs table with the Supabase anonymous user_id
  /// This allows RLS policies to identify this device for chat access
  /// Returns true if update successful, false otherwise
  Future<bool> _updateDevicePairWithUserId(String userId) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final pairingToken = prefs.getString(AppConstants.keyPairingToken);
      final householdId = prefs.getString(AppConstants.keyHouseholdId);

      if (pairingToken == null || householdId == null) {
        if (kDebugMode) {
          print('[SupabaseAuth] ⚠️ No pairing token or household ID found');
        }
        return false;
      }

      if (kDebugMode) {
        print('[SupabaseAuth] Updating device_pairs with user_id: $userId');
        print('[SupabaseAuth] Household ID: $householdId');
        print('[SupabaseAuth] Pairing Token: $pairingToken');
      }

      // First, get existing device_info to merge with
      final existingPair = await _supabase
          .from('device_pairs')
          .select('device_info')
          .eq('pair_token', pairingToken)
          .eq('household_id', householdId)
          .maybeSingle();

      if (existingPair == null) {
        if (kDebugMode) {
          print('[SupabaseAuth] ⚠️ No device_pair found with this token and household');
        }
        return false;
      }

      // Merge existing device_info with new user_id fields
      Map<String, dynamic> updatedDeviceInfo = {};
      if (existingPair['device_info'] != null) {
        updatedDeviceInfo = Map<String, dynamic>.from(existingPair['device_info'] as Map);
      }

      // Add/update the user ID fields - THIS IS THE KEY!
      updatedDeviceInfo['anonymous_user_id'] = userId;
      updatedDeviceInfo['supabase_user_id'] = userId;
      updatedDeviceInfo['rls_updated_at'] = DateTime.now().toIso8601String();

      if (kDebugMode) {
        print('[SupabaseAuth] Updated device_info: $updatedDeviceInfo');
      }

      // Update with merged device_info AND claimed_by
      await _supabase
          .from('device_pairs')
          .update({
            'device_info': updatedDeviceInfo,
            'claimed_by': userId, // Also update claimed_by for direct check
          })
          .eq('pair_token', pairingToken)
          .eq('household_id', householdId);

      if (kDebugMode) {
        print('[SupabaseAuth] ✅ device_pairs updated successfully!');
        print('[SupabaseAuth] User now has RLS access to chat');
      }
      
      return true;
    } catch (e) {
      if (kDebugMode) {
        print('[SupabaseAuth] ❌ Error updating device_pairs: $e');
      }
      return false;
    }
  }

  /// Sign in with email and password (for future use if needed)
  Future<bool> signInWithEmail(String email, String password) async {
    try {
      if (kDebugMode) {
        print('[SupabaseAuth] Signing in with email: $email');
      }

      final response = await _supabase.auth.signInWithPassword(
        email: email,
        password: password,
      );

      if (response.user != null) {
        await _storeSession();

        if (kDebugMode) {
          print('[SupabaseAuth] ✅ Email sign in successful: ${response.user!.id}');
        }
        return true;
      }

      return false;
    } catch (e) {
      if (kDebugMode) {
        print('[SupabaseAuth] ❌ Error signing in with email: $e');
      }
      return false;
    }
  }

  /// Store current session to SharedPreferences
  Future<void> _storeSession() async {
    try {
      final session = _supabase.auth.currentSession;
      if (session != null) {
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString(AppConstants.keySupabaseSession, session.accessToken);

        if (kDebugMode) {
          print('[SupabaseAuth] Session stored');
        }
      }
    } catch (e) {
      if (kDebugMode) {
        print('[SupabaseAuth] ❌ Error storing session: $e');
      }
    }
  }

  /// Sign out
  Future<void> signOut() async {
    try {
      await _supabase.auth.signOut();

      // Clear stored session
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(AppConstants.keySupabaseSession);

      if (kDebugMode) {
        print('[SupabaseAuth] ✅ Signed out');
      }
    } catch (e) {
      if (kDebugMode) {
        print('[SupabaseAuth] ❌ Error signing out: $e');
      }
    }
  }

  /// Listen to auth state changes
  Stream<AuthState> get authStateChanges => _supabase.auth.onAuthStateChange;
}
