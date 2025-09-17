import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:uuid/uuid.dart';
import '../services/callkit_service.dart';
import '../services/fcm_service.dart';
import '../services/api_service.dart';
import '../services/app_lifecycle_service.dart';
import '../models/call_data.dart';
import '../utils/constants.dart';
import '../utils/connection_test.dart';
import 'call_screen.dart';
// Removed webview_call_screen.dart import - using native ElevenLabs WebRTC only
import 'pairing_screen.dart';

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

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _initializeApp();
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

  Future<void> _initializeApp() async {
    try {
      setState(() {
        _status = 'Initializing CallPanion...';
      });

      // Setup CallKit callbacks first
      _setupCallKitCallbacks();

      // Setup FCM callbacks
      _setupFCMCallbacks();

      // Setup App Lifecycle callbacks and check for pending calls IMMEDIATELY
      _setupAppLifecycleCallbacks();

      // Check for pending calls first - this takes priority over everything else
      await _checkForPendingCalls();

      // Only continue with full initialization if there's no pending call
      if (_currentCall == null) {
        // Check device pairing status
        await _checkDeviceStatus();

        // Register tokens with server
        await _registerTokens();

        // Check for any pending scheduled calls
        await _checkForScheduledCalls();

        setState(() {
          _isLoading = false;
          _status = _isDevicePaired ? 'Ready for calls' : 'Device not paired';
        });
      }

      if (kDebugMode) {
        print('✅ App initialization completed');
      }
    } catch (e) {
      setState(() {
        _isLoading = false;
        _status = 'Error initializing app';
      });

      if (kDebugMode) {
        print('❌ Error initializing app: $e');
      }
    }
  }

  void _setupCallKitCallbacks() {
    CallKitService.instance.onIncomingCall = (callData) {
      setState(() {
        _currentCall = callData;
      });
    };

    CallKitService.instance.onCallAccepted = (sessionId, callType) {
      // Navigate immediately when call is accepted
      _navigateToCallScreen(sessionId, callType);
    };

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

      // Navigate immediately to call screen for incoming calls
      if (mounted) {
        _navigateToCallScreen(callData.sessionId, callData.callType);
      }
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

      // Automatically navigate to call screen when app resumes with pending call
      if (mounted) {
        _navigateToCallScreen(callData.sessionId, callData.callType);
      }
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

  Future<void> _checkForPendingCalls() async {
    try {
      // Initialize AppLifecycleService and check for pending calls
      await AppLifecycleService.instance.initialize();

      // Check if there's a pending call from when app was closed
      final prefs = await SharedPreferences.getInstance();
      final pendingCallData = prefs.getString(AppConstants.keyPendingCall);

      if (pendingCallData != null) {
        // Clear stored pending call
        await prefs.remove(AppConstants.keyPendingCall);

        // Parse and trigger call navigation immediately
        final callData = CallData.fromJsonString(pendingCallData);
        if (callData != null) {
          if (kDebugMode) {
            print('📞 Found pending call, navigating immediately: ${callData.sessionId}');
          }

          setState(() {
            _currentCall = callData;
            _isLoading = false;
            _status = 'Connecting to ${callData.relativeName}...';
          });

          // Navigate immediately without waiting for full initialization
          WidgetsBinding.instance.addPostFrameCallback((_) {
            _navigateToCallScreen(callData.sessionId, callData.callType);
          });
        }
      }
    } catch (e) {
      if (kDebugMode) {
        print('❌ Error checking pending calls: $e');
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

  void _navigateToCallScreen(String sessionId, String callType) {
    if (callType == AppConstants.callTypeInApp) {
      // For in-app calls, use native call screen with ElevenLabs WebRTC
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (context) => CallScreen(
            sessionId: sessionId,
            relativeName: _relativeName ?? 'Your Family',
            callType: callType,
          ),
        ),
      );
    } else {
      // For all other call types, also use native call screen with ElevenLabs WebRTC
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (context) => CallScreen(
            sessionId: sessionId,
            relativeName: _relativeName ?? 'Your Family',
            callType: callType,
          ),
        ),
      );
    }
  }

  void _manualRefresh() {
    setState(() {
      _isLoading = true;
    });
    _initializeApp();
  }

  void _navigateToPairing() {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => const PairingScreen(),
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
                            children: results.entries.map((entry) =>
                                Text('${entry.key}: ${entry.value ? "✅" : "❌"}')
                            ).toList(),
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
                    padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
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