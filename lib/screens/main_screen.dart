import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:uuid/uuid.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../services/callkit_service.dart';
import '../services/fcm_service.dart';
import '../services/api_service.dart';
import '../services/app_lifecycle_service.dart';
import '../services/supabase_auth_service.dart';
import '../models/call_data.dart';
import '../utils/constants.dart';
import '../utils/connection_test.dart';
// Removed webview_call_screen.dart import - using native ElevenLabs WebRTC only
import 'pairing_screen.dart';
import 'chat_screen.dart';
import 'gallery_screen.dart';
import '../services/chat_service.dart';

class MainScreen extends StatefulWidget {
  const MainScreen({super.key});

  @override
  State<MainScreen> createState() => _MainScreenState();
}

class _MainScreenState extends State<MainScreen> with WidgetsBindingObserver {
  bool _isDevicePaired = false;
  bool _isLoading = true;
  String _status = 'Checking device status...';
  String? _relativeName;
  CallData? _currentCall;
  String? _householdId;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    // Initialize in background without blocking UI
    _initializeInBackground();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    super.didChangeAppLifecycleState(state);

    if (state == AppLifecycleState.resumed) {
      // Check for scheduled calls when app becomes active
      _checkForScheduledCalls();
    }
  }

  /// Initialize app components in background without blocking UI
  Future<void> _initializeInBackground() async {
    try {
      // Setup callbacks first (non-blocking)
      _setupCallKitCallbacks();
      _setupFCMCallbacks();
      _setupAppLifecycleCallbacks();

      // Always start with UI ready state - no loading screen
      if (mounted) {
        setState(() {
          _isLoading = false;
          _status = 'Ready for calls';
        });
      }

      // Check if recently initialized
      final recentlyInitialized = await _isRecentlyInitialized();

      if (recentlyInitialized) {
        // Skip full initialization if recently done (within 10 minutes)
        // Just check device status quickly in background
        await _checkDeviceStatus();

        // REMOVED: Supabase auth from quick init - moved to lazy loading
        // This ensures call screen is NEVER blocked

        if (mounted) {
          setState(() {
            _status = _isDevicePaired ? 'Ready for calls' : 'Device not paired';
          });
        }

        if (kDebugMode) {
          print('✅ Quick initialization (cached)');
        }
      } else {
        // Perform essential initialization tasks in background
        await _performEssentialInitialization();

        // Mark as initialized
        await _markAsInitialized();

        // Update status based on pairing
        if (mounted) {
          setState(() {
            _status = _isDevicePaired ? 'Ready for calls' : 'Device not paired';
          });
        }

        if (kDebugMode) {
          print('✅ Full initialization completed');
        }
      }

      // Continue with non-essential background tasks
      _performBackgroundTasks();
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
          _status = 'Ready for calls';
        });
      }

      if (kDebugMode) {
        print('❌ Error in background initialization: $e');
      }
    }
  }

  /// Perform essential initialization tasks that are required for app to function
  Future<void> _performEssentialInitialization() async {
    try {
      // Check device pairing status (essential)
      await _checkDeviceStatus();

      // REMOVED: Supabase auth - moved to lazy loading (only when user opens chat/gallery)
      // This ensures call screen is NEVER blocked by chat feature initialization

      // Register tokens with server (essential for notifications)
      await _registerTokens();

      if (kDebugMode) {
        print('✅ Essential initialization completed');
      }
    } catch (e) {
      if (kDebugMode) {
        print('❌ Error in essential initialization: $e');
      }
    }
  }

  /// Perform background tasks without blocking UI
  Future<void> _performBackgroundTasks() async {
    try {
      // Check for any pending scheduled calls (non-essential)
      await _checkForScheduledCalls();

      if (kDebugMode) {
        print('✅ Background tasks completed');
      }
    } catch (e) {
      if (kDebugMode) {
        print('❌ Error in background tasks: $e');
      }
    }
  }

  void _setupCallKitCallbacks() {
    CallKitService.instance.onIncomingCall = (callData) {
      setState(() {
        _currentCall = callData;
      });
    };

    // Note: onCallAccepted is now handled in main.dart to ensure direct navigation
    // This prevents conflicts and ensures calls go directly to CallScreen

    CallKitService.instance.onCallDeclined = (sessionId) {
      setState(() {
        _currentCall = null;
        _status = 'Call declined';
      });
    };

    CallKitService.instance.onCallEnded = (sessionId) {
      setState(() {
        _currentCall = null;
        _status = 'Call ended';
      });

      // Return to main screen if in call screen
      if (Navigator.canPop(context)) {
        Navigator.popUntil(context, (route) => route.isFirst);
      }
    };
  }

  void _setupFCMCallbacks() {
    FCMService.instance.onIncomingCall = (callData) {
      setState(() {
        _currentCall = callData;
        _status = 'Incoming call from ${callData.relativeName}';
      });

      // Note: Navigation is now handled in main.dart to ensure direct navigation
      // This prevents conflicts and ensures calls go directly to CallScreen
    };

    FCMService.instance.onCallScheduled = (data) {
      setState(() {
        _status = 'Call scheduled with your family';
      });
    };
  }

  void _setupAppLifecycleCallbacks() {
    AppLifecycleService.instance.onPendingCallResume = (callData) {
      if (kDebugMode) {
        print('📞 Resuming pending call: ${callData.sessionId}');
      }

      setState(() {
        _currentCall = callData;
        _isLoading = false;
        _status = 'Connecting to ${callData.relativeName}...';
      });

      // Note: Navigation is now handled in main.dart to ensure direct navigation
      // This prevents conflicts and ensures calls go directly to CallScreen
    };
  }

  Future<void> _checkDeviceStatus() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final pairingToken = prefs.getString(AppConstants.keyPairingToken);
      final userId = prefs.getString(AppConstants.keyUserId);
      final savedRelativeName = prefs.getString(AppConstants.keyRelativeName);

      setState(() {
        _isDevicePaired = pairingToken != null && userId != null;
        _relativeName = savedRelativeName;
      });

      // Get household ID for chat
      if (_isDevicePaired) {
        final householdId = await ChatService.instance.getHouseholdId();
        setState(() {
          _householdId = householdId;
        });
      }

      if (kDebugMode) {
        print('📱 Device paired: $_isDevicePaired');
        print('📱 Relative name: $_relativeName');
        print('📱 Household ID: $_householdId');
      }
    } catch (e) {
      if (kDebugMode) {
        print('❌ Error checking device status: $e');
      }
    }
  }

  /// Check if app was recently initialized to avoid redundant initialization
  Future<bool> _isRecentlyInitialized() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final lastInitTime = prefs.getInt('last_init_time') ?? 0;
      final now = DateTime.now().millisecondsSinceEpoch;
      final timeDiff = now - lastInitTime;

      // If initialized within last 10 minutes, skip full initialization
      return timeDiff < 10 * 60 * 1000;
    } catch (e) {
      return false;
    }
  }

  /// Mark app as recently initialized
  Future<void> _markAsInitialized() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setInt(
          'last_init_time', DateTime.now().millisecondsSinceEpoch);
    } catch (e) {
      if (kDebugMode) {
        print('❌ Error marking as initialized: $e');
      }
    }
  }

  /// LAZY LOADING: Initialize Supabase and authenticate when needed
  /// This is called only when user opens chat or gallery features
  Future<void> _ensureSupabaseAuth() async {
    try {
      // Only authenticate if device is paired
      if (!_isDevicePaired) {
        return;
      }

      // Try to get Supabase instance - if it throws, we need to initialize
      try {
        final _ = Supabase.instance.client;
        if (kDebugMode) {
          print('🔐 Supabase already initialized');
        }
      } catch (e) {
        // Supabase not initialized yet - initialize now
        if (kDebugMode) {
          print('🔐 Initializing Supabase (lazy loading)...');
        }
        await Supabase.initialize(
          url: 'https://umjtepmdwfyfhdzbkyli.supabase.co',
          anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtanRlcG1kd2Z5ZmhkemJreWxpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MDUyNTksImV4cCI6MjA3MDQ4MTI1OX0.BhMkFrAOfeGw2ImHDXSTVmgM6P--L3lq9pNKDX3XzWE',
        );
        await SupabaseAuthService.instance.initialize();
      }

      // Check if already authenticated
      if (SupabaseAuthService.instance.isAuthenticated) {
        if (kDebugMode) {
          print('🔐 Already authenticated with Supabase: ${SupabaseAuthService.instance.currentUserId}');
        }
        return;
      }

      // Sign in anonymously for chat access
      if (kDebugMode) {
        print('🔐 Authenticating with Supabase for chat access...');
      }

      final authSuccess = await SupabaseAuthService.instance.signInAnonymously();
      if (authSuccess) {
        if (kDebugMode) {
          print('✅ Supabase authentication successful');
        }
      } else {
        if (kDebugMode) {
          print('⚠️ Supabase authentication failed');
        }
      }
    } catch (e) {
      if (kDebugMode) {
        print('❌ Error ensuring Supabase auth: $e');
      }
    }
  }

  Future<void> _registerTokens() async {
    try {
      // Always ensure user ID is generated for device identification
      await _ensureUserIdGenerated();

      // Only register tokens if device is paired
      if (_isDevicePaired) {
        // Register FCM token
        final fcmSuccess = await FCMService.instance.registerToken();

        // Get and register VoIP token (iOS only)
        final voipToken = await CallKitService.instance.getVoIPToken();
        if (voipToken != null) {
          await ApiService.instance.registerFCMToken(voipToken: voipToken);
        }

        if (kDebugMode) {
          print('✅ Tokens registered with server (FCM: $fcmSuccess)');
        }
      } else {
        if (kDebugMode) {
          print('🔄 Device not paired yet, skipping token registration');
        }
      }
    } catch (e) {
      if (kDebugMode) {
        print('❌ Error registering tokens: $e');
      }
    }
  }

  Future<void> _ensureUserIdGenerated() async {
    final prefs = await SharedPreferences.getInstance();
    String? userId = prefs.getString(AppConstants.keyUserId);

    if (userId == null) {
      userId = const Uuid().v4();
      await prefs.setString(AppConstants.keyUserId, userId);
      if (kDebugMode) {
        print('📱 Generated user ID for device: $userId');
      }
    } else {
      if (kDebugMode) {
        print('📱 Using existing user ID: $userId');
      }
    }
  }

  Future<void> _checkForScheduledCalls() async {
    try {
      final scheduledCalls = await ApiService.instance.checkScheduledCalls();

      if (scheduledCalls.isNotEmpty) {
        final nextCall = scheduledCalls.first;
        final callData = CallData(
          sessionId: nextCall['id'] ?? '',
          relativeName: _relativeName ?? 'Your Family',
          callType: nextCall['call_type'] ?? AppConstants.callTypeInApp,
          householdId: nextCall['household_id'] ?? '',
          relativeId: nextCall['relative_id'] ?? '',
          scheduledTime: DateTime.tryParse(nextCall['scheduled_time'] ?? ''),
        );

        // Check if call is due within next 2 minutes
        final now = DateTime.now();
        final scheduledTime = callData.scheduledTime;

        if (scheduledTime != null) {
          final timeDiff = scheduledTime.difference(now).inMinutes;

          if (timeDiff <= 2 && timeDiff >= -1) {
            // Show incoming call interface
            await CallKitService.instance.showIncomingCall(callData);

            setState(() {
              _currentCall = callData;
              _status = 'Incoming call from ${callData.relativeName}';
            });
          }
        }
      }
    } catch (e) {
      if (kDebugMode) {
        print('❌ Error checking scheduled calls: $e');
      }
    }
  }

  void _manualRefresh() async {
    setState(() {
      _isLoading = true;
      _status = 'Refreshing...';
    });

    // Clear cache to force full initialization
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('last_init_time');

    // Perform full initialization
    await _performEssentialInitialization();

    // Mark as initialized
    await _markAsInitialized();

    // Continue with background tasks
    _performBackgroundTasks();
  }

  void _navigateToPairing() {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => const PairingScreen(),
      ),
    );
  }

  void _navigateToChat() async {
    if (_householdId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Unable to load chat. Please try refreshing.'),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }

    // LAZY LOADING: Ensure auth only when user opens chat
    await _ensureSupabaseAuth();

    if (!mounted) return;

    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => ChatScreen(
          householdId: _householdId!,
          relativeName: _relativeName ?? 'Your Family',
        ),
      ),
    );
  }

  void _navigateToGallery() async {
    if (_householdId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Unable to load gallery. Please try refreshing.'),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }

    // LAZY LOADING: Ensure auth only when user opens gallery
    await _ensureSupabaseAuth();

    if (!mounted) return;

    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => GalleryScreen(
          householdId: _householdId!,
          relativeName: _relativeName ?? 'Your Family',
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              // App Logo/Icon
              Container(
                width: 120,
                height: 120,
                decoration: BoxDecoration(
                  color: const Color(0xFF2563EB),
                  borderRadius: BorderRadius.circular(60),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFF2563EB).withOpacity(0.3),
                      blurRadius: 20,
                      offset: const Offset(0, 10),
                    ),
                  ],
                ),
                child: const Icon(
                  Icons.phone,
                  size: 60,
                  color: Colors.white,
                ),
              ),

              const SizedBox(height: 32),

              // App Title
              const Text(
                'CallPanion',
                style: TextStyle(
                  fontSize: 32,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF1E293B),
                ),
              ),

              const SizedBox(height: 8),

              // Subtitle
              Text(
                _relativeName != null
                    ? 'Hello, $_relativeName!'
                    : 'Stay Connected with Family',
                style: const TextStyle(
                  fontSize: 18,
                  color: Color(0xFF64748B),
                ),
                textAlign: TextAlign.center,
              ),

              const SizedBox(height: 48),

              // Status Card
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.05),
                      blurRadius: 10,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Column(
                  children: [
                    // Status Icon
                    Container(
                      width: 64,
                      height: 64,
                      decoration: BoxDecoration(
                        color: _isDevicePaired
                            ? const Color(0xFF10B981).withOpacity(0.1)
                            : const Color(0xFFF59E0B).withOpacity(0.1),
                        borderRadius: BorderRadius.circular(32),
                      ),
                      child: Icon(
                        _isLoading
                            ? Icons.sync
                            : _isDevicePaired
                                ? Icons.check_circle
                                : Icons.warning,
                        size: 32,
                        color: _isDevicePaired
                            ? const Color(0xFF10B981)
                            : const Color(0xFFF59E0B),
                      ),
                    ),

                    const SizedBox(height: 16),

                    // Status Text
                    Text(
                      _status,
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF374151),
                      ),
                      textAlign: TextAlign.center,
                    ),

                    // Pairing button when not paired
                    if (!_isDevicePaired && !_isLoading) ...[
                      const SizedBox(height: 24),
                      SizedBox(
                        width: double.infinity,
                        height: 48,
                        child: ElevatedButton.icon(
                          onPressed: () => _navigateToPairing(),
                          icon: const Icon(Icons.link),
                          label: const Text('Pair Device'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF2563EB),
                            foregroundColor: Colors.white,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                          ),
                        ),
                      ),
                    ],

                    if (_currentCall != null) ...[
                      const SizedBox(height: 16),
                      Text(
                        'Call from ${_currentCall!.relativeName}',
                        style: const TextStyle(
                          fontSize: 14,
                          color: Color(0xFF6B7280),
                        ),
                        textAlign: TextAlign.center,
                      ),
                    ],
                  ],
                ),
              ),

              const SizedBox(height: 32),

              // Chat and Gallery Buttons (only show when paired)
              if (_isDevicePaired && _householdId != null) ...[
                SizedBox(
                  width: double.infinity,
                  height: 56,
                  child: ElevatedButton.icon(
                    onPressed: _navigateToChat,
                    icon: const Icon(Icons.chat_bubble, size: 24),
                    label: const Text(
                      'Open Family Chat',
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                    ),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF10B981),
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                      elevation: 2,
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  height: 56,
                  child: ElevatedButton.icon(
                    onPressed: _navigateToGallery,
                    icon: const Icon(Icons.photo_library, size: 24),
                    label: const Text(
                      'Memories',
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                    ),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF8B5CF6),
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                      elevation: 2,
                    ),
                  ),
                ),
                const SizedBox(height: 16),
              ],

              // Test Connection Button (Debug)
              if (kDebugMode) ...[
                ElevatedButton(
                  onPressed: () async {
                    final results = await ConnectionTest.testAllConnections();
                    if (mounted) {
                      showDialog(
                        context: context,
                        builder: (context) => AlertDialog(
                          title: const Text('Connection Test Results'),
                          content: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: results.entries
                                .map((entry) => Text(
                                    '${entry.key}: ${entry.value ? "✅" : "❌"}'))
                                .toList(),
                          ),
                          actions: [
                            TextButton(
                              onPressed: () => Navigator.pop(context),
                              child: const Text('OK'),
                            ),
                          ],
                        ),
                      );
                    }
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF10B981),
                    foregroundColor: Colors.white,
                  ),
                  child: const Text('Test Connections'),
                ),
                const SizedBox(height: 16),
              ],

              // Refresh Button
              if (!_isLoading)
                ElevatedButton.icon(
                  onPressed: _manualRefresh,
                  icon: const Icon(Icons.refresh),
                  label: const Text('Refresh Status'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF2563EB),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(
                        horizontal: 24, vertical: 12),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                ),

              // Loading Indicator
              if (_isLoading)
                const CircularProgressIndicator(
                  valueColor: AlwaysStoppedAnimation<Color>(Color(0xFF2563EB)),
                ),

              const SizedBox(height: 48),

              // Instructions
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: const Color(0xFFF1F5F9),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Column(
                  children: [
                    Icon(
                      Icons.info_outline,
                      size: 24,
                      color: Color(0xFF475569),
                    ),
                    SizedBox(height: 8),
                    Text(
                      'Your family can call you anytime. You\'ll receive native call notifications even when the app is closed.',
                      style: TextStyle(
                        fontSize: 14,
                        color: Color(0xFF475569),
                      ),
                      textAlign: TextAlign.center,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
