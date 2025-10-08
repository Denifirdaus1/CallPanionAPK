import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:uuid/uuid.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:google_fonts/google_fonts.dart';
import '../services/callkit_service.dart';
import '../services/fcm_service.dart';
import '../services/api_service.dart';
import '../services/app_lifecycle_service.dart';
import '../services/supabase_auth_service.dart';
import '../services/permission_service.dart';
import '../models/call_data.dart';
import '../utils/constants.dart';
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
  // REMOVED: _householdId - now lazy loaded when user clicks chat/gallery button

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
      // 1. Request ALL essential permissions FIRST (CRITICAL for calls)
      await _requestEssentialPermissions();

      // 2. Check device pairing status (essential)
      await _checkDeviceStatus();

      // REMOVED: Supabase auth - moved to lazy loading (only when user opens chat/gallery)
      // This ensures call screen is NEVER blocked by chat feature initialization

      // 3. Register tokens with server (essential for notifications)
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

  /// Request essential permissions (microphone, notification, camera)
  Future<void> _requestEssentialPermissions() async {
    try {
      if (kDebugMode) {
        print('🎤 Requesting essential permissions...');
      }

      final results = await PermissionService.requestAllEssentialPermissions();

      final micGranted = results['microphone'] ?? false;
      final notifGranted = results['notification'] ?? false;
      final cameraGranted = results['camera'] ?? false;

      if (kDebugMode) {
        print(
            '✅ Permissions - Mic: $micGranted, Notif: $notifGranted, Camera: $cameraGranted');
      }

      // Update status if microphone denied (CRITICAL)
      if (!micGranted && mounted) {
        setState(() {
          _status = 'Microphone permission required for calls';
        });
      }
    } catch (e) {
      if (kDebugMode) {
        print('❌ Error requesting permissions: $e');
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

      // REMOVED: Household ID loading moved to lazy loading (when user clicks chat button)
      // This ensures main screen loads FAST without any chat-related delays

      if (kDebugMode) {
        print('📱 Device paired: $_isDevicePaired');
        print('📱 Relative name: $_relativeName');
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
          anonKey:
              'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtanRlcG1kd2Z5ZmhkemJreWxpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MDUyNTksImV4cCI6MjA3MDQ4MTI1OX0.BhMkFrAOfeGw2ImHDXSTVmgM6P--L3lq9pNKDX3XzWE',
        );
        await SupabaseAuthService.instance.initialize();
      }

      // Check if already authenticated
      if (SupabaseAuthService.instance.isAuthenticated) {
        if (kDebugMode) {
          print(
              '🔐 Already authenticated with Supabase: ${SupabaseAuthService.instance.currentUserId}');
        }

        // IMPORTANT: Even if already authenticated, ensure device_pairs is updated
        // This handles the case where user was authenticated before the RLS fix
        await SupabaseAuthService.instance.ensureDevicePairUpdated();
        return;
      }

      // Sign in anonymously for chat access
      if (kDebugMode) {
        print('🔐 Authenticating with Supabase for chat access...');
      }

      final authSuccess =
          await SupabaseAuthService.instance.signInAnonymously();
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

  void _navigateToPairing() {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => const PairingScreen(),
      ),
    );
  }

  void _navigateToChat() async {
    // INSTANT NAVIGATION: Navigate immediately, load data inside chat screen
    if (kDebugMode) {
      print('🔐 Chat button clicked - instant navigation...');
    }

    // LAZY LOADING: Get household ID quickly from SharedPreferences (sync)
    final prefs = await SharedPreferences.getInstance();
    final householdId = prefs.getString(AppConstants.keyHouseholdId);

    if (householdId == null) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Unable to load chat. Please check your pairing.'),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }

    if (!mounted) return;

    // INSTANT NAVIGATION: Navigate immediately without waiting for Supabase auth
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => ChatScreen(
          householdId: householdId,
          householdName: null, // Will be fetched inside chat screen
        ),
      ),
    );

    // BACKGROUND: Initialize Supabase after navigation (non-blocking)
    _ensureSupabaseAuth();
  }

  void _navigateToGallery() async {
    // INSTANT NAVIGATION: Navigate immediately, load data inside gallery screen
    if (kDebugMode) {
      print('🖼️ Gallery button clicked - instant navigation...');
    }

    // LAZY LOADING: Get household ID quickly from SharedPreferences (sync)
    final prefs = await SharedPreferences.getInstance();
    final householdId = prefs.getString(AppConstants.keyHouseholdId);

    if (householdId == null) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Unable to load gallery. Please check your pairing.'),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }

    if (!mounted) return;

    // INSTANT NAVIGATION: Navigate immediately without waiting for Supabase auth
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => GalleryScreen(
          householdId: householdId,
          householdName: null, // Will be fetched inside gallery screen
        ),
      ),
    );

    // BACKGROUND: Initialize Supabase after navigation (non-blocking)
    _ensureSupabaseAuth();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const SizedBox(height: 32),

              // App Title
              Text(
                'Callpanion',
                style: GoogleFonts.fraunces(
                  fontSize: 42,
                  fontWeight: FontWeight.w700,
                  color: const Color(0xFFE38B6F),
                ),
              ),

              const SizedBox(height: 8),

              // Subtitle
              Text(
                _relativeName != null
                    ? 'Hello, $_relativeName!'
                    : 'Stay Connected with Family',
                style: GoogleFonts.fraunces(
                  fontSize: 18,
                  fontWeight: FontWeight.w400,
                  color: const Color(0xFF0F3B2E),
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
                            ? const Color(0xFFE38B6F).withOpacity(0.1)
                            : const Color(0xFFE38B6F).withOpacity(0.1),
                        borderRadius: BorderRadius.circular(32),
                      ),
                      child: Icon(
                        _isLoading
                            ? Icons.sync
                            : _isDevicePaired
                                ? Icons.check_circle
                                : Icons.warning,
                        size: 32,
                        color: const Color(0xFFE38B6F),
                      ),
                    ),

                    const SizedBox(height: 16),

                    // Status Text
                    Text(
                      _status,
                      style: GoogleFonts.fraunces(
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                        color: const Color(0xFFE38B6F),
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
                          label: Text(
                            'Pair Device',
                            style: GoogleFonts.fraunces(
                              fontSize: 16,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFFE38B6F),
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
                        style: GoogleFonts.fraunces(
                          fontSize: 14,
                          fontWeight: FontWeight.w400,
                          color: const Color(0xFF0F3B2E),
                        ),
                        textAlign: TextAlign.center,
                      ),
                    ],
                  ],
                ),
              ),

              const SizedBox(height: 32),

              // Microphone Permission Warning
              FutureBuilder<bool>(
                future: PermissionService.isMicrophoneGranted(),
                builder: (context, snapshot) {
                  final micGranted = snapshot.data ?? true;

                  if (micGranted) return const SizedBox.shrink();

                  return Container(
                    width: double.infinity,
                    margin: const EdgeInsets.only(bottom: 16),
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFEF2F2),
                      border: Border.all(color: const Color(0xFFFCA5A5)),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Column(
                      children: [
                        const Icon(
                          Icons.mic_off,
                          color: Color(0xFFDC2626),
                          size: 32,
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'Microphone Permission Required',
                          style: GoogleFonts.fraunces(
                            fontSize: 14,
                            fontWeight: FontWeight.bold,
                            color: const Color(0xFFDC2626),
                          ),
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'Microphone is required for conversational calls',
                          style: GoogleFonts.fraunces(
                            fontSize: 12,
                            fontWeight: FontWeight.w400,
                            color: const Color(0xFF991B1B),
                          ),
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 12),
                        SizedBox(
                          width: double.infinity,
                          child: ElevatedButton.icon(
                            onPressed: () async {
                              await PermissionService.openSettings();
                            },
                            icon: const Icon(Icons.settings, size: 16),
                            label: Text(
                              'Open Settings',
                              style: GoogleFonts.fraunces(
                                fontSize: 14,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFFDC2626),
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(vertical: 8),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(8),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  );
                },
              ),

              // Chat and Gallery Buttons (only show when paired - NO LOADING REQUIRED)
              if (_isDevicePaired) ...[
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 32),
                  child: SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: ElevatedButton.icon(
                      onPressed: _navigateToChat,
                      icon: Image.asset(
                        'assets/icon/Chat.png',
                        width: 20,
                        height: 20,
                        color: Colors.white,
                        errorBuilder: (context, error, stackTrace) {
                          // Fallback ke icon default jika Chat.png tidak ditemukan
                          return const Icon(
                            Icons.chat_bubble,
                            size: 20,
                            color: Colors.white,
                          );
                        },
                      ),
                      label: Text(
                        'Open Family Chat',
                        style: GoogleFonts.fraunces(
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFE38B6F),
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(20),
                        ),
                        elevation: 1,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 32),
                  child: SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: ElevatedButton.icon(
                      onPressed: _navigateToGallery,
                      icon: const Icon(Icons.photo_library, size: 20),
                      label: Text(
                        'Your Gallery',
                        style: GoogleFonts.fraunces(
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFE38B6F),
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(20),
                        ),
                        elevation: 1,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 48),
              ],

              // Footer Info - Moved to bottom
              Container(
                margin: const EdgeInsets.only(top: 32),
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(
                    color: const Color(0xFFE4B8AC),
                    width: 1,
                  ),
                ),
                child: Column(
                  children: [
                    Icon(
                      Icons.info_outline,
                      size: 28,
                      color: const Color(0xFFE38B6F),
                    ),
                    const SizedBox(height: 12),
                    Text(
                      'Your family schedules 3 calls daily',
                      style: GoogleFonts.fraunces(
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                        color: const Color(0xFF0F3B2E),
                      ),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'You\'ll receive native call notifications and have conversations with Callpanion AI agent',
                      style: GoogleFonts.fraunces(
                        fontSize: 14,
                        fontWeight: FontWeight.w400,
                        color: const Color(0xFF0F3B2E).withOpacity(0.7),
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
