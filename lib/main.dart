import 'package:flutter/material.dart';
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

  runApp(const CallPanionElderlyApp());
}

class CallPanionElderlyApp extends StatefulWidget {
  const CallPanionElderlyApp({super.key});

  @override
  State<CallPanionElderlyApp> createState() => _CallPanionElderlyAppState();
}

class _CallPanionElderlyAppState extends State<CallPanionElderlyApp> {
  final GlobalKey<NavigatorState> _navigatorKey = GlobalKey<NavigatorState>();
  bool _shouldShowMainScreen = true;
  CallData? _pendingCall;

  @override
  void initState() {
    super.initState();
    _setupCallKitNavigation();
    _checkForPendingCallOnStartup();
  }

  void _setupCallKitNavigation() {
    // Set up CallKit callbacks for navigation
    CallKitService.instance.onCallAccepted = (sessionId, callType) {
      if (callType == AppConstants.callTypeInApp) {
        // Navigate to native call screen
        _navigateToCallScreen(sessionId);
      }
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
          setState(() {
            _shouldShowMainScreen = false;
            _pendingCall = callData;
          });

          // Navigate directly to call screen without full initialization
          WidgetsBinding.instance.addPostFrameCallback((_) {
            _navigateToCallScreen(callData.sessionId);
          });
        }
      }
    } catch (e) {
      print('❌ Error checking pending calls on startup: $e');
    }
  }

  void _navigateToCallScreen(String sessionId) {
    // Get current call data to extract relative name
    final currentCall = CallKitService.instance.currentCall;
    final relativeName = currentCall?.relativeName ?? 'Family Member';

    _navigatorKey.currentState?.push(
      MaterialPageRoute(
        builder: (context) => CallScreen(
          sessionId: sessionId,
          relativeName: relativeName,
          callType: AppConstants.callTypeInApp,
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
      home: _shouldShowMainScreen 
        ? const MainScreen() 
        : Scaffold(
            body: Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const CircularProgressIndicator(),
                  const SizedBox(height: 16),
                  Text(
                    _pendingCall != null 
                      ? 'Connecting to ${_pendingCall!.relativeName}...' 
                      : 'Connecting to call...',
                    style: const TextStyle(fontSize: 16),
                  ),
                ],
              ),
            ),
          ),
      debugShowCheckedModeBanner: false,
    );
  }
}