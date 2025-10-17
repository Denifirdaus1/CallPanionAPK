import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'services/callkit_service.dart';
import 'services/fcm_service.dart';
import 'services/permission_service.dart';
import 'services/network_service.dart';
import 'services/supabase_auth_service.dart';
import 'services/chat_notification_service.dart';
import 'services/app_lifecycle_service.dart';
import 'services/schedule_reminder_service.dart';
import 'screens/main_screen.dart';
import 'screens/call_screen.dart';
import 'models/call_data.dart';
import 'utils/constants.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // LAZY LOADING: Supabase initialization moved to when user opens chat/gallery
  // This ensures app startup is fast and call screen is NEVER blocked
  // Supabase will be initialized on-demand in main_screen.dart when needed

  // Initialize Firebase
  await Firebase.initializeApp();

  // Initialize Network Service
  await NetworkService.initialize(
    onConnectivityChanged: (isConnected) {
      print('Network connectivity changed: $isConnected');
    },
  );

  // Check initial permissions
  final permissionsGranted = await PermissionService.checkCallPermissions();
  if (!permissionsGranted) {
    print('Some permissions are missing - will request when needed');
  }

  // Initialize CallKit service
  await CallKitService.instance.initialize();

  // Initialize FCM service
  await FCMService.instance.initialize();

  // Initialize Chat Notification Service (for local notifications)
  await ChatNotificationService.instance.initialize();

  // Initialize App Lifecycle Service (for foreground/background tracking)
  await AppLifecycleService.instance.initialize();

  // Initialize Schedule Reminder Service (for call time reminders)
  await ScheduleReminderService.instance.initialize();

  // ElevenLabs service is auto-initialized (singleton pattern)
  // No explicit initialize() method needed

  runApp(const CallPanionElderlyApp());
}

class CallPanionElderlyApp extends StatefulWidget {
  const CallPanionElderlyApp({super.key});

  @override
  State<CallPanionElderlyApp> createState() => _CallPanionElderlyAppState();
}

class _CallPanionElderlyAppState extends State<CallPanionElderlyApp> with WidgetsBindingObserver {
  final GlobalKey<NavigatorState> _navigatorKey = GlobalKey<NavigatorState>();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _setupCallKitNavigation();
    // REMOVED: _checkForPendingCallOnStartup() to prevent auto-navigation
    // Call screen navigation ONLY happens from explicit CallKit accept event
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    super.didChangeAppLifecycleState(state);

    // Update chat notification service about app state
    if (state == AppLifecycleState.resumed) {
      // App in foreground
      ChatNotificationService.instance.setAppForegroundState(true);
      if (kDebugMode) {
        print('📱 App resumed - chat notifications disabled');
      }
    } else if (state == AppLifecycleState.paused || state == AppLifecycleState.inactive) {
      // App in background
      ChatNotificationService.instance.setAppForegroundState(false);
      if (kDebugMode) {
        print('📱 App backgrounded - chat notifications enabled');
      }
    }
  }

  void _setupCallKitNavigation() {
    // Set up CallKit callbacks for navigation - this takes priority over MainScreen
    CallKitService.instance.onCallAccepted = (sessionId, callType) {
      if (kDebugMode) {
        print('📞 ===== CALL ACCEPTED - PRIORITIZING NAVIGATION =====');
        print('📞 Session ID: $sessionId');
        print('📞 Call Type: $callType');
      }

      // Get current call data to extract relative name
      final currentCall = CallKitService.instance.currentCall;
      final relativeName = currentCall?.relativeName ?? 'Family Member';

      if (kDebugMode) {
        print('📞 Relative Name: $relativeName');
        print('📞 IMMEDIATE navigation to CallScreen (no delays)');
      }

      // PRIORITY: Navigate immediately - no post frame callback needed
      // This ensures WebRTC connection starts as fast as possible
      if (_navigatorKey.currentState != null) {
        _navigatorKey.currentState!.push(
          MaterialPageRoute(
            builder: (context) => CallScreen(
              sessionId: sessionId,
              relativeName: relativeName,
              callType: callType,
            ),
          ),
        );

        if (kDebugMode) {
          print('✅ Navigation to CallScreen completed');
        }
      } else {
        if (kDebugMode) {
          print('⚠️ Navigator not ready, using post frame callback...');
        }
        // Fallback: Use post frame callback if navigator not ready yet
        WidgetsBinding.instance.addPostFrameCallback((_) {
          _navigatorKey.currentState?.push(
            MaterialPageRoute(
              builder: (context) => CallScreen(
                sessionId: sessionId,
                relativeName: relativeName,
                callType: callType,
              ),
            ),
          );
        });
      }
    };
  }

  /// DISABLED: This function was causing auto-navigation to call screen on app open
  /// Call navigation should ONLY happen from explicit CallKit accept event
  /// Pending call data is now cleared immediately after use in CallKit service
  // Future<void> _checkForPendingCallOnStartup() async {
  //   // This function is intentionally disabled to prevent auto-call on app open
  // }

  void _navigateToCallScreen(String sessionId, String callType) {
    // Get current call data to extract relative name
    final currentCall = CallKitService.instance.currentCall;
    final relativeName = currentCall?.relativeName ?? 'Family Member';

    if (kDebugMode) {
      print('📞 Navigating to CallScreen: $sessionId, type: $callType');
    }

    _navigatorKey.currentState?.push(
      MaterialPageRoute(
        builder: (context) => CallScreen(
          sessionId: sessionId,
          relativeName: relativeName,
          callType: callType,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      navigatorKey: _navigatorKey,
      title: 'CallPanion',
      theme: ThemeData(
        primarySwatch: Colors.blue,
        fontFamily: 'Roboto',
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF2563EB),
          brightness: Brightness.light,
        ),
      ),
      // Always show MainScreen immediately - initialization happens in background
      // If there's a pending call, navigation will happen via callback
      home: const MainScreen(),
      debugShowCheckedModeBanner: false,
    );
  }
}
