import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'services/callkit_service.dart';
import 'services/fcm_service.dart';
import 'services/permission_service.dart';
import 'services/network_service.dart';
import 'screens/main_screen.dart';
import 'screens/call_screen.dart';
import 'models/call_data.dart';
import 'utils/constants.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

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

  // ElevenLabs service is auto-initialized (singleton pattern)
  // No explicit initialize() method needed

  runApp(const CallPanionElderlyApp());
}

class CallPanionElderlyApp extends StatefulWidget {
  const CallPanionElderlyApp({super.key});

  @override
  State<CallPanionElderlyApp> createState() => _CallPanionElderlyAppState();
}

class _CallPanionElderlyAppState extends State<CallPanionElderlyApp> {
  final GlobalKey<NavigatorState> _navigatorKey = GlobalKey<NavigatorState>();

  @override
  void initState() {
    super.initState();
    _setupCallKitNavigation();
    _checkForPendingCallOnStartup();
  }

  void _setupCallKitNavigation() {
    // Set up CallKit callbacks for navigation - this takes priority over MainScreen
    CallKitService.instance.onCallAccepted = (sessionId, callType) {
      if (kDebugMode) {
        print(
            '📞 Call accepted in main.dart - navigating directly to CallScreen');
      }

      // Get current call data to extract relative name
      final currentCall = CallKitService.instance.currentCall;
      final relativeName = currentCall?.relativeName ?? 'Family Member';

      if (kDebugMode) {
        print('📞 Immediate navigation to CallScreen: $sessionId');
      }

      // Use post frame callback to ensure navigator is ready
      WidgetsBinding.instance.addPostFrameCallback((_) {
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
        } else {
          if (kDebugMode) {
            print('⚠️ Navigator not ready, retrying...');
          }
          // Retry after a short delay
          Future.delayed(const Duration(milliseconds: 100), () {
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
      });
    };
  }

  /// Check for pending calls when app starts
  Future<void> _checkForPendingCallOnStartup() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final pendingCallData = prefs.getString(AppConstants.keyPendingCall);

      if (pendingCallData != null) {
        // Clear stored pending call
        await prefs.remove(AppConstants.keyPendingCall);

        // Parse call data
        final callData = CallData.fromJsonString(pendingCallData);
        if (callData != null) {
          if (kDebugMode) {
            print('📞 Found pending call on startup: ${callData.sessionId}');
          }

          // Navigate directly to call screen immediately after first frame
          WidgetsBinding.instance.addPostFrameCallback((_) {
            _navigateToCallScreen(callData.sessionId, callData.callType);
          });
          return; // Exit early to skip showing MainScreen
        }
      }
    } catch (e) {
      if (kDebugMode) {
        print('❌ Error checking pending calls on startup: $e');
      }
    }
  }

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
