import 'package:flutter/material.dart';
import 'dart:async';
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
import '../services/schedule_reminder_service.dart';
import '../models/call_data.dart';
import '../utils/constants.dart';
// Removed webview_call_screen.dart import - using native ElevenLabs WebRTC only
import 'pairing_screen.dart';
import 'chat_screen.dart';
import 'gallery_screen.dart';
// import '../services/chat_service.dart';

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

  // Realtime schedule state
  String? _morningTime;
  String? _afternoonTime;
  String? _eveningTime;
  String? _scheduleTimezone;
  bool? _scheduleActive;
  bool _isScheduleLoading = false;
  StreamSubscription<List<Map<String, dynamic>>>? _scheduleStreamSub;

  // UI state for collapsible section
  bool _isImportantInfoExpanded = false;

  // Cache microphone permission status to avoid repeated checks
  bool? _microphoneGranted;
  bool _isCheckingMicPermission = false;

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
    _scheduleStreamSub?.cancel();
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

      // Continue with non-essential background tasks (non-blocking)
      _performBackgroundTasks();

      // Check microphone permission in background (cached for performance, non-blocking)
      unawaited(_checkMicrophonePermission());

      // Initialize schedule feature (fetch + realtime) when paired
      await _initScheduleFeature();
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

      // Cache microphone permission status
      if (mounted) {
        setState(() {
          _microphoneGranted = micGranted;
          // Update status if microphone denied (CRITICAL)
          if (!micGranted) {
            _status = 'Microphone permission required for calls';
          }
        });
      }
    } catch (e) {
      if (kDebugMode) {
        print('❌ Error requesting permissions: $e');
      }
    }
  }

  /// Check and cache microphone permission
  Future<void> _checkMicrophonePermission() async {
    if (_isCheckingMicPermission) return;

    setState(() {
      _isCheckingMicPermission = true;
    });

    try {
      final granted = await PermissionService.isMicrophoneGranted();
      if (mounted) {
        setState(() {
          _microphoneGranted = granted;
          _isCheckingMicPermission = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _microphoneGranted = true; // Default to true to avoid blocking UI
          _isCheckingMicPermission = false;
        });
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

  Future<void> _initScheduleFeature() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final relativeId = prefs.getString(AppConstants.keyRelativeId);
      if (!_isDevicePaired || relativeId == null) {
        return;
      }

      // Ensure Supabase is ready
      await _ensureSupabaseAuth();

      // Initial load
      await _loadSchedule(relativeId);

      // Start realtime stream
      _startScheduleStream(relativeId);
    } catch (_) {}
  }

  Future<void> _loadSchedule(String relativeId) async {
    try {
      setState(() {
        _isScheduleLoading = true;
      });

      final client = Supabase.instance.client;
      final query = await client
          .from('schedules')
          .select(
              'id, morning_time, afternoon_time, evening_time, timezone, active')
          .eq('relative_id', relativeId)
          .limit(1)
          .maybeSingle();

      if (query != null) {
        setState(() {
          _morningTime = query['morning_time'] as String?;
          _afternoonTime = query['afternoon_time'] as String?;
          _eveningTime = query['evening_time'] as String?;
          _scheduleTimezone = query['timezone'] as String?;
          _scheduleActive = query['active'] as bool?;
        });

        // Schedule reminders after loading schedule
        await _scheduleReminders();
      }
    } catch (e) {
      if (kDebugMode) {
        print('❌ Error loading schedule: $e');
      }
    } finally {
      if (mounted) {
        setState(() {
          _isScheduleLoading = false;
        });
      }
    }
  }

  void _startScheduleStream(String relativeId) {
    _scheduleStreamSub?.cancel();
    final client = Supabase.instance.client;
    final stream = client
        .from('schedules')
        .stream(primaryKey: ['id'])
        .eq('relative_id', relativeId)
        .limit(1);

    _scheduleStreamSub = stream.listen((rows) {
      if (rows.isNotEmpty) {
        final row = rows.first;
        if (mounted) {
          // Only update if values actually changed (avoid unnecessary rebuilds)
          final newMorning = row['morning_time'] as String?;
          final newAfternoon = row['afternoon_time'] as String?;
          final newEvening = row['evening_time'] as String?;
          final newTimezone = row['timezone'] as String?;
          final newActive = row['active'] as bool?;

          if (newMorning != _morningTime ||
              newAfternoon != _afternoonTime ||
              newEvening != _eveningTime ||
              newTimezone != _scheduleTimezone ||
              newActive != _scheduleActive) {
            setState(() {
              _morningTime = newMorning;
              _afternoonTime = newAfternoon;
              _eveningTime = newEvening;
              _scheduleTimezone = newTimezone;
              _scheduleActive = newActive;
            });

            // Re-schedule reminders when schedule changes
            unawaited(_scheduleReminders());
          }
        }
      }
    });
  }

  String _formatTime(String? time) {
    if (time == null || time.isEmpty) return '--:--';
    // Expect formats like HH:mm or HH:mm:ss
    final parts = time.split(':');
    if (parts.length >= 2) {
      return '${parts[0].padLeft(2, '0')}:${parts[1].padLeft(2, '0')}';
    }
    return time;
  }

  String _timezoneAbbr(String? timezone) {
    if (timezone == null) return '';
    switch (timezone) {
      case 'Asia/Jakarta':
        return 'WIB';
      case 'Asia/Makassar':
        return 'WITA';
      case 'Asia/Jayapura':
        return 'WIT';
      default:
        return timezone;
    }
  }

  /// Schedule reminder notifications 10 minutes before each call time
  Future<void> _scheduleReminders() async {
    try {
      if (kDebugMode) {
        print('📅 Scheduling reminders for call times...');
      }

      await ScheduleReminderService.instance.scheduleAllReminders(
        morningTime: _morningTime,
        afternoonTime: _afternoonTime,
        eveningTime: _eveningTime,
        timezone: _scheduleTimezone,
        isActive: _scheduleActive ?? false,
      );

      if (kDebugMode) {
        print('✅ Reminders scheduled successfully');
        // Debug: Show pending notifications
        await ScheduleReminderService.instance.getPendingReminders();
      }
    } catch (e) {
      if (kDebugMode) {
        print('❌ Error scheduling reminders: $e');
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

        // NOTE: device_pairs update is now handled by claim-chat-access edge function
        // when user first opens ChatScreen, not during MainScreen initialization
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
    ).then((result) async {
      if (result == true && mounted) {
        // Auto refresh after successful pairing without leaving the app
        setState(() {
          _status = 'Finalizing setup...';
        });

        await _checkDeviceStatus();
        await _registerTokens();
        await _initScheduleFeature();

        if (!mounted) return;
        setState(() {
          _status = _isDevicePaired ? 'Ready for calls' : 'Device not paired';
        });

        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'Device paired successfully. You are ready to receive calls.',
              style: GoogleFonts.fraunces(
                  fontSize: 13, fontWeight: FontWeight.w600),
            ),
            backgroundColor: const Color(0xFFE38B6F),
            duration: const Duration(seconds: 3),
          ),
        );
      }
    });
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
      backgroundColor: const Color(0xFFFAFAFA),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20.0),
          child: Column(
            children: [
              const SizedBox(height: 16),

              // Header with App Title and Status
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Callpanion',
                          style: GoogleFonts.fraunces(
                            fontSize: 32,
                            fontWeight: FontWeight.w700,
                            color: const Color(0xFFE38B6F),
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          _relativeName != null
                              ? 'Hello, $_relativeName!'
                              : 'Stay Connected',
                          style: GoogleFonts.fraunces(
                            fontSize: 16,
                            fontWeight: FontWeight.w400,
                            color: const Color(0xFF0F3B2E),
                          ),
                        ),
                      ],
                    ),
                  ),
                  // Small status indicator
                  if (!_isLoading)
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: _isDevicePaired
                            ? const Color(0xFF16A34A).withOpacity(0.1)
                            : const Color(0xFFEF4444).withOpacity(0.1),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Icon(
                        _isDevicePaired ? Icons.check_circle : Icons.warning,
                        size: 20,
                        color: _isDevicePaired
                            ? const Color(0xFF16A34A)
                            : const Color(0xFFEF4444),
                      ),
                    ),
                ],
              ),

              const SizedBox(height: 24),

              // Pair Device Button (only show if not paired)
              if (!_isDevicePaired && !_isLoading) ...[
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    border:
                        Border.all(color: const Color(0xFFE38B6F), width: 2),
                  ),
                  child: Column(
                    children: [
                      const Icon(
                        Icons.link_off,
                        size: 40,
                        color: Color(0xFFE38B6F),
                      ),
                      const SizedBox(height: 12),
                      Text(
                        'Device not paired',
                        style: GoogleFonts.fraunces(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                          color: const Color(0xFF0F3B2E),
                        ),
                      ),
                      const SizedBox(height: 16),
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
                  ),
                ),
                const SizedBox(height: 24),
              ],

              // Call Times Section (at the top)
              if (_isDevicePaired) ...[
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.05),
                        blurRadius: 8,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            'Today\'s Calls',
                            style: GoogleFonts.fraunces(
                              fontSize: 18,
                              fontWeight: FontWeight.w700,
                              color: const Color(0xFF0F3B2E),
                            ),
                          ),
                          if (_scheduleActive != null)
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 10, vertical: 4),
                              decoration: BoxDecoration(
                                color: (_scheduleActive ?? false)
                                    ? const Color(0xFF16A34A)
                                    : const Color(0xFF9CA3AF),
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Text(
                                (_scheduleActive ?? false) ? 'On' : 'Off',
                                style: GoogleFonts.fraunces(
                                  color: Colors.white,
                                  fontSize: 11,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                        ],
                      ),
                      if (_scheduleTimezone != null &&
                          _scheduleTimezone!.isNotEmpty)
                        Padding(
                          padding: const EdgeInsets.only(top: 4),
                          child: Text(
                            '${_timezoneAbbr(_scheduleTimezone)} timezone',
                            style: GoogleFonts.fraunces(
                              fontSize: 11,
                              color: const Color(0xFF6B7280),
                            ),
                          ),
                        ),
                      const SizedBox(height: 16),
                      if (_isScheduleLoading)
                        const Center(
                          child: Padding(
                            padding: EdgeInsets.all(20),
                            child: CircularProgressIndicator(strokeWidth: 2),
                          ),
                        )
                      else
                        Row(
                          children: [
                            Expanded(
                              child: _TimeCard(
                                  label: 'Morning',
                                  time: _formatTime(_morningTime),
                                  icon: Icons.wb_sunny),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: _TimeCard(
                                  label: 'Afternoon',
                                  time: _formatTime(_afternoonTime),
                                  icon: Icons.wb_cloudy),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: _TimeCard(
                                  label: 'Evening',
                                  time: _formatTime(_eveningTime),
                                  icon: Icons.nights_stay),
                            ),
                          ],
                        ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),

                // Chat and Gallery Buttons
                Row(
                  children: [
                    Expanded(
                      child: SizedBox(
                        height: 56,
                        child: ElevatedButton(
                          onPressed: _navigateToChat,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFFE38B6F),
                            foregroundColor: Colors.white,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                            elevation: 2,
                          ),
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const Icon(Icons.chat_bubble, size: 22),
                              const SizedBox(height: 2),
                              Text(
                                'Chat',
                                style: GoogleFonts.fraunces(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: SizedBox(
                        height: 56,
                        child: ElevatedButton(
                          onPressed: _navigateToGallery,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFFE38B6F),
                            foregroundColor: Colors.white,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                            elevation: 2,
                          ),
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const Icon(Icons.photo_library, size: 22),
                              const SizedBox(height: 2),
                              Text(
                                'Gallery',
                                style: GoogleFonts.fraunces(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
              ],

              // Microphone Permission Warning (using cached value for performance)
              if (_microphoneGranted == false)
                Container(
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
                        size: 28,
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Microphone Required',
                        style: GoogleFonts.fraunces(
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                          color: const Color(0xFFDC2626),
                        ),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 12),
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton.icon(
                          onPressed: () async {
                            await PermissionService.openSettings();
                            // Re-check permission after user returns
                            unawaited(_checkMicrophonePermission());
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
                            padding: const EdgeInsets.symmetric(vertical: 10),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(8),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),

              // Collapsible Important Info Section
              Container(
                width: double.infinity,
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFE4B8AC), width: 1),
                ),
                child: Column(
                  children: [
                    InkWell(
                      onTap: () {
                        setState(() {
                          _isImportantInfoExpanded = !_isImportantInfoExpanded;
                        });
                      },
                      borderRadius: BorderRadius.circular(12),
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Row(
                          children: [
                            const Icon(Icons.info_outline,
                                color: Color(0xFFE38B6F), size: 20),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                'How to Use',
                                style: GoogleFonts.fraunces(
                                  fontSize: 15,
                                  fontWeight: FontWeight.w600,
                                  color: const Color(0xFF0F3B2E),
                                ),
                              ),
                            ),
                            Icon(
                              _isImportantInfoExpanded
                                  ? Icons.expand_less
                                  : Icons.expand_more,
                              color: const Color(0xFFE38B6F),
                            ),
                          ],
                        ),
                      ),
                    ),
                    if (_isImportantInfoExpanded) ...[
                      const Divider(height: 1),
                      Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Keep this app open to receive calls reliably.',
                              style: GoogleFonts.fraunces(
                                fontSize: 13,
                                color: const Color(0xFF0F3B2E),
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                            const SizedBox(height: 12),
                            _GuideStep(
                                number: 1, text: 'Wait for call notification'),
                            _GuideStep(number: 2, text: 'Tap Accept to answer'),
                            _GuideStep(
                                number: 3, text: 'Wait for timer to appear'),
                            _GuideStep(
                                number: 4,
                                text: 'Tap notification to open call'),
                            _GuideStep(
                                number: 5, text: 'Wait for agent to connect'),
                            _GuideStep(
                                number: 6, text: 'Press End Call when done'),
                          ],
                        ),
                      ),
                    ],
                  ],
                ),
              ),

              const SizedBox(height: 16),

              // Footer: Why keeping the app open near call time matters
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFE4B8AC), width: 1),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.04),
                      blurRadius: 6,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(Icons.notification_important,
                        color: Color(0xFFE38B6F), size: 20),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Why keep the app open near call time?',
                            style: GoogleFonts.fraunces(
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                              color: const Color(0xFF0F3B2E),
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            'To receive the incoming call faster and more reliably. When the app is open or running in the background, notifications and the call screen can appear without delay, so you won\'t miss the call.',
                            style: GoogleFonts.fraunces(
                              fontSize: 12,
                              fontWeight: FontWeight.w400,
                              color: const Color(0xFF0F3B2E),
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'Tip: 5–10 minutes before the scheduled time, open the app and leave it on. This helps ensure the agent connects smoothly and quickly when the call starts.',
                            style: GoogleFonts.fraunces(
                              fontSize: 12,
                              fontWeight: FontWeight.w400,
                              color: const Color(0xFF0F3B2E),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 32),
            ],
          ),
        ),
      ),
    );
  }
}

// Make this widget const-friendly by moving GoogleFonts calls to variables
class _GuideStep extends StatelessWidget {
  final int number;
  final String text;

  const _GuideStep({required this.number, required this.text});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 22,
            height: 22,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: const Color(0xFFE38B6F).withOpacity(0.1),
              borderRadius: BorderRadius.circular(11),
            ),
            child: Text(
              '$number',
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: Color(0xFFE38B6F),
                fontFamily: 'Fraunces',
              ),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              text,
              style: const TextStyle(
                fontSize: 13,
                color: Color(0xFF0F3B2E),
                fontWeight: FontWeight.w400,
                fontFamily: 'Fraunces',
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _TimeCard extends StatelessWidget {
  final String label;
  final String time;
  final IconData icon;

  const _TimeCard({
    required this.label,
    required this.time,
    required this.icon,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFFAFAFA),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(0xFFE4B8AC).withOpacity(0.3)),
      ),
      child: Column(
        children: [
          Icon(
            icon,
            size: 20,
            color: const Color(0xFFE38B6F).withOpacity(0.7),
          ),
          const SizedBox(height: 6),
          Text(
            time,
            style: GoogleFonts.fraunces(
              fontSize: 18,
              fontWeight: FontWeight.w700,
              color: const Color(0xFF0F3B2E),
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: GoogleFonts.fraunces(
              fontSize: 10,
              color: const Color(0xFF6B7280),
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }
}
