import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import '../services/api_service.dart';
import '../services/elevenlabs_call_service.dart';
import '../services/callkit_service.dart';
import '../utils/constants.dart';

class CallScreen extends StatefulWidget {
  final String sessionId;
  final String relativeName;
  final String callType;

  const CallScreen({
    super.key,
    required this.sessionId,
    required this.relativeName,
    required this.callType,
  });

  @override
  State<CallScreen> createState() => _CallScreenState();
}

class _CallScreenState extends State<CallScreen> {
  bool _isCallActive = false;
  bool _isMuted = false;
  int _callDuration = 0;
  late DateTime _callStartTime;

  @override
  void initState() {
    super.initState();
    // The call is already accepted at this point, so we're connecting
    // Start connection immediately without delay
    _connectToCall();
  }

  void _connectToCall() async {
    setState(() {
      _isCallActive = true;
      _callStartTime = DateTime.now();
    });

    // Start duration timer
    _startDurationTimer();

    // ElevenLabs WebRTC is already started by CallKitService
    // We just need to connect to the existing session
    if (widget.callType == AppConstants.callTypeInApp) {
      // Check if ElevenLabs call is active
      final isActive = ElevenLabsCallService.instance.isCallActive;
      if (kDebugMode) {
        print('🎙️ ElevenLabs WebRTC status: $isActive');
      }

      // Try to start the connection immediately without retry logic for faster connection
      try {
        final result = await ElevenLabsCallService.instance.startElevenLabsCall(widget.sessionId);
        if (kDebugMode) {
          print('🎙️ ElevenLabs WebRTC started: ${result != null}');
        }
      } catch (e) {
        if (kDebugMode) {
          print('❌ Error starting ElevenLabs call: $e');
        }
        
        // Try once more with retry logic if first attempt fails
        await _startElevenLabsWithRetry();
      }
    }

    if (kDebugMode) {
      print('📞 Call connected: ${widget.sessionId}');
    }
  }

  Future<void> _startElevenLabsWithRetry() async {
    int attempts = 0;
    const maxAttempts = 2;

    while (attempts < maxAttempts) {
      try {
        attempts++;
        if (kDebugMode) {
          print('🎙️ ElevenLabs connection attempt $attempts/$maxAttempts');
        }

        final result = await ElevenLabsCallService.instance.startElevenLabsCall(widget.sessionId);
        if (kDebugMode) {
          print('🎙️ ElevenLabs WebRTC started: ${result != null}');
        }

        if (result != null) {
          // Success - exit retry loop
          return;
        }

        // If not the last attempt, wait before retrying
        if (attempts < maxAttempts) {
          if (kDebugMode) {
            print('🔄 Retrying ElevenLabs connection in 2 seconds...');
          }
          await Future.delayed(const Duration(seconds: 2));
        }
      } catch (e) {
        if (kDebugMode) {
          print('❌ Error starting ElevenLabs call (attempt $attempts): $e');
        }

        // If not the last attempt, wait before retrying
        if (attempts < maxAttempts) {
          await Future.delayed(const Duration(seconds: 1));
        }
      }
    }

    // All attempts failed - show error and end call
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Failed to connect to voice assistant after retries'),
          backgroundColor: Colors.red,
        ),
      );
      // End the CallKit call to prevent UI from getting stuck
      await CallKitService.instance.endCurrentCall();
      Navigator.pop(context);
    }
  }

  void _startDurationTimer() {
    Future.delayed(const Duration(seconds: 1), () {
      if (_isCallActive && mounted) {
        setState(() {
          _callDuration = DateTime.now().difference(_callStartTime).inSeconds;
        });
        _startDurationTimer();
      }
    });
  }

  Future<void> _endCall() async {
    try {
      setState(() {
        _isCallActive = false;
      });

      // End ElevenLabs WebRTC call first for in-app calls (before Supabase)
      if (widget.callType == AppConstants.callTypeInApp) {
        final success = await ElevenLabsCallService.instance.endElevenLabsCall(
          widget.sessionId,
          summary: 'Call completed',
          duration: _callDuration,
        );
        if (kDebugMode) {
          print('🎙️ ElevenLabs WebRTC ended: $success');
        }
      }

      // Update call status via API
      await ApiService.instance.updateCallStatus(
        sessionId: widget.sessionId,
        status: AppConstants.callStatusCompleted,
        action: 'end',
        duration: _callDuration,
      );

      // Also end the CallKit call to ensure proper cleanup
      await CallKitService.instance.endCurrentCall();

      if (kDebugMode) {
        print('📞 Call ended: ${widget.sessionId} (${_callDuration}s)');
      }

      // Return to main screen
      if (mounted) {
        Navigator.pop(context);
      }
    } catch (e) {
      if (kDebugMode) {
        print('❌ Error ending call: $e');
      }
    }
  }

  @override
  void dispose() {
    // Ensure call cleanup when screen is disposed
    if (_isCallActive) {
      _endCall();
    }
    super.dispose();
  }

  void _toggleMute() {
    setState(() {
      _isMuted = !_isMuted;
    });

    // Apply mute to ElevenLabs WebRTC
    if (widget.callType == AppConstants.callTypeInApp) {
      ElevenLabsCallService.instance.setMicrophoneMuted(_isMuted);
    }

    if (kDebugMode) {
      print('🔇 Mute toggled: $_isMuted');
    }
  }

  String _formatDuration(int seconds) {
    final minutes = seconds ~/ 60;
    final remainingSeconds = seconds % 60;
    return '${minutes.toString().padLeft(2, '0')}:${remainingSeconds.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF1E293B),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              // Top section
              Column(
                children: [
                  const SizedBox(height: 48),

                  // Avatar
                  Container(
                    width: 120,
                    height: 120,
                    decoration: BoxDecoration(
                      color: const Color(0xFF2563EB),
                      borderRadius: BorderRadius.circular(60),
                      border: Border.all(
                        color: Colors.white.withOpacity(0.2),
                        width: 3,
                      ),
                    ),
                    child: const Icon(
                      Icons.person,
                      size: 60,
                      color: Colors.white,
                    ),
                  ),

                  const SizedBox(height: 24),

                  // Caller name
                  Text(
                    widget.relativeName,
                    style: const TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                    textAlign: TextAlign.center,
                  ),

                  const SizedBox(height: 8),

                  // Call status and duration
                  Text(
                    _isCallActive
                        ? _formatDuration(_callDuration)
                        : 'Connecting...',
                    style: const TextStyle(
                      fontSize: 16,
                      color: Color(0xFF94A3B8),
                    ),
                  ),

                  const SizedBox(height: 16),

                  // Call type indicator
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      color: const Color(0xFF10B981).withOpacity(0.2),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(
                        color: const Color(0xFF10B981).withOpacity(0.3),
                      ),
                    ),
                    child: Text(
                      widget.callType == AppConstants.callTypeInApp
                          ? 'AI Companion Call'
                          : 'Voice Call',
                      style: const TextStyle(
                        fontSize: 12,
                        color: Color(0xFF10B981),
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),

              // Middle section - Call visualization
              if (_isCallActive)
                Column(
                  children: [
                    // Audio wave animation (placeholder)
                    Container(
                      height: 80,
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: List.generate(5, (index) {
                          return AnimatedContainer(
                            duration: Duration(milliseconds: 300 + (index * 100)),
                            width: 4,
                            height: _isCallActive
                                ? 20 + (index * 10).toDouble()
                                : 10,
                            margin: const EdgeInsets.symmetric(horizontal: 2),
                            decoration: BoxDecoration(
                              color: const Color(0xFF2563EB),
                              borderRadius: BorderRadius.circular(2),
                            ),
                          );
                        }),
                      ),
                    ),

                    const SizedBox(height: 16),

                    Text(
                      _isMuted ? 'Microphone Muted' : 'Listening...',
                      style: const TextStyle(
                        fontSize: 14,
                        color: Color(0xFF94A3B8),
                      ),
                    ),
                  ],
                ),

              // Bottom section - Controls
              Column(
                children: [
                  // Call controls
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                    children: [
                      // Mute button
                      GestureDetector(
                        onTap: _toggleMute,
                        child: Container(
                          width: 64,
                          height: 64,
                          decoration: BoxDecoration(
                            color: _isMuted
                                ? const Color(0xFFF59E0B)
                                : const Color(0xFF374151),
                            borderRadius: BorderRadius.circular(32),
                          ),
                          child: Icon(
                            _isMuted ? Icons.mic_off : Icons.mic,
                            size: 28,
                            color: Colors.white,
                          ),
                        ),
                      ),

                      // End call button
                      GestureDetector(
                        onTap: _endCall,
                        child: Container(
                          width: 72,
                          height: 72,
                          decoration: BoxDecoration(
                            color: const Color(0xFFEF4444),
                            borderRadius: BorderRadius.circular(36),
                          ),
                          child: const Icon(
                            Icons.call_end,
                            size: 32,
                            color: Colors.white,
                          ),
                        ),
                      ),

                      // Speaker button (placeholder)
                      GestureDetector(
                        onTap: () {
                          // Toggle speaker
                        },
                        child: Container(
                          width: 64,
                          height: 64,
                          decoration: BoxDecoration(
                            color: const Color(0xFF374151),
                            borderRadius: BorderRadius.circular(32),
                          ),
                          child: const Icon(
                            Icons.volume_up,
                            size: 28,
                            color: Colors.white,
                          ),
                        ),
                      ),
                    ],
                  ),

                  const SizedBox(height: 32),

                  // Call info
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: const Color(0xFF374151).withOpacity(0.3),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          Icons.info_outline,
                          size: 16,
                          color: Color(0xFF94A3B8),
                        ),
                        SizedBox(width: 8),
                        Text(
                          'AI companion is analyzing your conversation',
                          style: TextStyle(
                            fontSize: 12,
                            color: Color(0xFF94A3B8),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}