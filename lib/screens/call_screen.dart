import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:google_fonts/google_fonts.dart';
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

  // ElevenLabs conversation state
  String? _conversationId;
  String? _lastMessage;
  bool _isAgentSpeaking = false;
  bool _canSendFeedback = false;
  double _vadScore = 0.0;

  // Event subscriptions
  StreamSubscription<ConversationEvent>? _conversationEventSubscription;

  @override
  void initState() {
    super.initState();

    if (kDebugMode) {
      print('🎙️ CallScreen initialized for session: ${widget.sessionId}');
      print('🎙️ Call type: ${widget.callType}');
    }

    // The call is already accepted at this point, so we're connecting
    // Setup conversation events first
    _setupConversationEvents();

    // Start connection immediately without delay - PRIORITIZE WebRTC CONNECTION
    _connectToCall();
  }

  void _setupConversationEvents() {
    _conversationEventSubscription =
        ElevenLabsCallService.instance.conversationEvents.listen(
      (ConversationEvent event) {
        if (mounted) {
          setState(() {
            switch (event.type) {
              case ConversationEventType.conversationConnected:
                _conversationId = event.data['conversationId'] as String?;
                break;
              case ConversationEventType.conversationEvent:
                if (event.data['type'] == 'message') {
                  _lastMessage = event.data['message'] as String?;
                  _isAgentSpeaking = event.data['source'] == 'agent';
                } else if (event.data['type'] == 'feedbackAvailable') {
                  _canSendFeedback = event.data['canSend'] as bool? ?? false;
                } else if (event.data['type'] == 'vadScore') {
                  _vadScore = (event.data['score'] as num?)?.toDouble() ?? 0.0;
                }
                break;
              case ConversationEventType.conversationFailed:
                _showErrorSnackBar(
                    'Conversation failed: ${event.data['error']}');
                break;
              case ConversationEventType.conversationEnded:
                _endCall();
                break;
              default:
                break;
            }
          });
        }
      },
      onError: (error) {
        if (mounted) {
          _showErrorSnackBar('Conversation error: $error');
        }
      },
    );
  }

  void _showErrorSnackBar(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: Colors.red,
        duration: const Duration(seconds: 3),
      ),
    );
  }

  void _connectToCall() async {
    // ALWAYS log for crash debugging (even in release mode)
    print('[CallScreen] 🎙️ Starting call connection process...');
    print('[CallScreen] SessionId: ${widget.sessionId}');
    print('[CallScreen] CallType: ${widget.callType}');

    try {
      setState(() {
        _isCallActive = true;
        _callStartTime = DateTime.now();
      });

      // Start duration timer
      _startDurationTimer();

      // ElevenLabs WebRTC connection for in-app calls - HIGHEST PRIORITY
      if (widget.callType == AppConstants.callTypeInApp) {
        print('[CallScreen] 🎙️ PRIORITY: Starting ElevenLabs WebRTC connection...');

        // Check if ElevenLabs call is already active
        final isActive = ElevenLabsCallService.instance.isCallActive;
        print('[CallScreen] Is ElevenLabs already active: $isActive');

        if (isActive) {
          print('[CallScreen] ⚠️ ElevenLabs call already active - ending previous call first');
          // End any existing call before starting new one
          await ElevenLabsCallService.instance.forceEndCall(widget.sessionId);
        }

        // Start ElevenLabs call with optimized connection - NO DELAYS
        print('[CallScreen] Starting ElevenLabs call...');
        try {
          final result = await ElevenLabsCallService.instance
              .startElevenLabsCall(widget.sessionId);
          print('[CallScreen] ✅ ElevenLabs WebRTC started successfully: ${result != null}');
        } catch (e, stackTrace) {
          print('[CallScreen] ❌ Error starting ElevenLabs call: $e');
          print('[CallScreen] Stack trace: $stackTrace');

          // Try with retry logic if first attempt fails
          await _startElevenLabsWithRetry();
        }
      }

      print('[CallScreen] ✅ Call connected: ${widget.sessionId}');
    } catch (e, stackTrace) {
      print('[CallScreen] 💥 FATAL ERROR in _connectToCall: $e');
      print('[CallScreen] Stack trace: $stackTrace');
      rethrow;
    }
  }

  Future<void> _startElevenLabsWithRetry() async {
    int attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      try {
        attempts++;
        if (kDebugMode) {
          print('🎙️ ElevenLabs connection attempt $attempts/$maxAttempts');
        }

        final result = await ElevenLabsCallService.instance
            .startElevenLabsCall(widget.sessionId);
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
            print('🔄 Retrying ElevenLabs connection in 1 second...');
          }
          await Future.delayed(const Duration(seconds: 1));
        }
      } catch (e) {
        if (kDebugMode) {
          print('❌ Error starting ElevenLabs call (attempt $attempts): $e');
        }

        // If not the last attempt, wait before retrying
        if (attempts < maxAttempts) {
          await Future.delayed(const Duration(milliseconds: 500));
        }
      }
    }

    // All attempts failed - show error but don't end call immediately
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
              'Voice assistant connection failed - call may continue without AI'),
          backgroundColor: Colors.orange,
          duration: Duration(seconds: 3),
        ),
      );
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
    // Prevent multiple end call attempts
    if (!_isCallActive) {
      if (kDebugMode) {
        print('⚠️ Call already ended, skipping duplicate end call');
      }
      return;
    }

    try {
      setState(() {
        _isCallActive = false;
      });

      if (kDebugMode) {
        print('📞 Starting call cleanup for: ${widget.sessionId}');
      }

      // End ElevenLabs WebRTC call first for in-app calls (before Supabase)
      if (widget.callType == AppConstants.callTypeInApp) {
        try {
          final success =
              await ElevenLabsCallService.instance.endElevenLabsCall(
            widget.sessionId,
            summary: 'Call completed',
            duration: _callDuration,
          );
          if (kDebugMode) {
            print('🎙️ ElevenLabs WebRTC ended: $success');
          }
        } catch (e) {
          if (kDebugMode) {
            print('❌ Error ending ElevenLabs call: $e');
          }
        }
      }

      // Update call status via API
      try {
        await ApiService.instance.updateCallStatus(
          sessionId: widget.sessionId,
          status: AppConstants.callStatusCompleted,
          action: 'end',
          duration: _callDuration,
        );
      } catch (e) {
        if (kDebugMode) {
          print('❌ Error updating call status: $e');
        }
      }

      // Also end the CallKit call to ensure proper cleanup
      try {
        await CallKitService.instance.endCurrentCall();
      } catch (e) {
        if (kDebugMode) {
          print('❌ Error ending CallKit call: $e');
        }
      }

      if (kDebugMode) {
        print(
            '📞 Call ended successfully: ${widget.sessionId} (${_callDuration}s)');
      }

      // Return to main screen
      if (mounted) {
        Navigator.pop(context);
      }
    } catch (e) {
      if (kDebugMode) {
        print('❌ Fatal error ending call: $e');
      }
      // Still try to close the screen even if cleanup fails
      if (mounted) {
        Navigator.pop(context);
      }
    }
  }

  @override
  void dispose() {
    // Cancel event subscription
    _conversationEventSubscription?.cancel();

    // Don't call async _endCall() in dispose - it's already handled by end button
    // Just ensure cleanup happens
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

  void _sendFeedback(bool isPositive) async {
    try {
      await ElevenLabsCallService.instance.sendFeedback(isPositive);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Feedback sent: ${isPositive ? "👍" : "👎"}'),
            backgroundColor: Colors.green,
            duration: const Duration(seconds: 2),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        _showErrorSnackBar('Failed to send feedback: $e');
      }
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
      backgroundColor: Colors.white,
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
                      color: const Color(0xFFE38B6F),
                      borderRadius: BorderRadius.circular(60),
                      border: Border.all(
                        color: const Color(0xFFE4B8AC),
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
                    'Callpanion',
                    style: GoogleFonts.fraunces(
                      fontSize: 24,
                      fontWeight: FontWeight.w700,
                      color: const Color(0xFF0F3B2E),
                    ),
                    textAlign: TextAlign.center,
                  ),

                  const SizedBox(height: 8),

                  // Call status and duration
                  Text(
                    _isCallActive
                        ? _formatDuration(_callDuration)
                        : 'Connecting...',
                    style: GoogleFonts.fraunces(
                      fontSize: 16,
                      fontWeight: FontWeight.w400,
                      color: const Color(0xFF0F3B2E).withOpacity(0.7),
                    ),
                  ),

                  // Conversation status
                  if (_conversationId != null) ...[
                    const SizedBox(height: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: const Color(0xFFE38B6F).withOpacity(0.2),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(
                        'AI Connected',
                        style: GoogleFonts.fraunces(
                          fontSize: 12,
                          color: const Color(0xFFE38B6F),
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ],

                  // Last message from AI
                  if (_lastMessage != null && _isAgentSpeaking) ...[
                    const SizedBox(height: 16),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF8F9FA),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: const Color(0xFFE4B8AC),
                        ),
                      ),
                      child: Row(
                        children: [
                          Icon(
                            Icons.smart_toy,
                            size: 16,
                            color: const Color(0xFFE38B6F),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              _lastMessage!,
                              style: GoogleFonts.fraunces(
                                fontSize: 12,
                                color: const Color(0xFF0F3B2E),
                                fontWeight: FontWeight.w400,
                              ),
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],

                  const SizedBox(height: 16),

                  // Call type indicator
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      color: const Color(0xFFE38B6F).withOpacity(0.2),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(
                        color: const Color(0xFFE38B6F).withOpacity(0.3),
                      ),
                    ),
                    child: Text(
                      widget.callType == AppConstants.callTypeInApp
                          ? 'ElevenLabs Callpanion Agent'
                          : 'Voice Call',
                      style: GoogleFonts.fraunces(
                        fontSize: 12,
                        color: const Color(0xFFE38B6F),
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
                    // Audio wave animation based on VAD score
                    Container(
                      height: 80,
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: List.generate(5, (index) {
                          final baseHeight = 10.0;
                          final maxHeight = 40.0;
                          final vadMultiplier = _vadScore.clamp(0.0, 1.0);
                          final height = _isCallActive
                              ? baseHeight +
                                  (maxHeight - baseHeight) *
                                      vadMultiplier *
                                      (0.5 + (index * 0.1))
                              : baseHeight;

                          return AnimatedContainer(
                            duration:
                                Duration(milliseconds: 200 + (index * 50)),
                            width: 4,
                            height: height,
                            margin: const EdgeInsets.symmetric(horizontal: 2),
                            decoration: BoxDecoration(
                              color: _isMuted
                                  ? const Color(0xFFE4B8AC)
                                  : const Color(0xFFE38B6F),
                              borderRadius: BorderRadius.circular(2),
                            ),
                          );
                        }),
                      ),
                    ),

                    const SizedBox(height: 16),

                    Text(
                      _isMuted ? 'Microphone Muted' : 'Listening...',
                      style: GoogleFonts.fraunces(
                        fontSize: 14,
                        fontWeight: FontWeight.w400,
                        color: const Color(0xFF0F3B2E).withOpacity(0.7),
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
                                ? const Color(0xFFE4B8AC)
                                : const Color(0xFFE38B6F),
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

                      // Loud speaker indicator (always ON)
                      Container(
                        width: 64,
                        height: 64,
                        decoration: BoxDecoration(
                          color: const Color(0xFFE4B8AC),
                          borderRadius: BorderRadius.circular(32),
                        ),
                        child: const Icon(
                          Icons.volume_up,
                          size: 28,
                          color: Colors.white,
                        ),
                      ),
                    ],
                  ),

                  const SizedBox(height: 16),

                  // Feedback buttons (only show when feedback is available)
                  if (_canSendFeedback) ...[
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        GestureDetector(
                          onTap: () => _sendFeedback(false),
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 16, vertical: 8),
                            decoration: BoxDecoration(
                              color: const Color(0xFFEF4444).withOpacity(0.2),
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(
                                color: const Color(0xFFEF4444).withOpacity(0.3),
                              ),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Icon(
                                  Icons.thumb_down,
                                  size: 16,
                                  color: Color(0xFFEF4444),
                                ),
                                const SizedBox(width: 4),
                                Text(
                                  'Negative',
                                  style: GoogleFonts.fraunces(
                                    fontSize: 12,
                                    color: const Color(0xFFEF4444),
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                        const SizedBox(width: 16),
                        GestureDetector(
                          onTap: () => _sendFeedback(true),
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 16, vertical: 8),
                            decoration: BoxDecoration(
                              color: const Color(0xFFE38B6F).withOpacity(0.2),
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(
                                color: const Color(0xFFE38B6F).withOpacity(0.3),
                              ),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Icon(
                                  Icons.thumb_up,
                                  size: 16,
                                  color: Color(0xFFE38B6F),
                                ),
                                const SizedBox(width: 4),
                                Text(
                                  'Positive',
                                  style: GoogleFonts.fraunces(
                                    fontSize: 12,
                                    color: const Color(0xFFE38B6F),
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                  ],

                  // Call info
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF8F9FA),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: const Color(0xFFE4B8AC),
                      ),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          Icons.info_outline,
                          size: 16,
                          color: const Color(0xFF0F3B2E).withOpacity(0.7),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            _isAgentSpeaking
                                ? 'AI is speaking...'
                                : 'AI companion is listening to your conversation',
                            style: GoogleFonts.fraunces(
                              fontSize: 12,
                              fontWeight: FontWeight.w400,
                              color: const Color(0xFF0F3B2E).withOpacity(0.7),
                            ),
                            textAlign: TextAlign.center,
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
