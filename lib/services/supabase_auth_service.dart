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

        // NOTE: device_pairs update is now handled by claim-chat-access edge function
        // to avoid RLS permission issues and ensure proper user ID mapping

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

  // REMOVED: ensureDevicePairUpdated() and _updateDevicePairWithUserId()
  // These functions are now redundant because claim-chat-access edge function
  // handles updating device_pairs with user ID using service role.
  // Keeping this code would cause:
  // 1. Duplicate updates to device_pairs table
  // 2. Potential race conditions
  // 3. RLS permission errors when Flutter tries to update directly

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
