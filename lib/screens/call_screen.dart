import 'dart:async';
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
    // The call is already accepted at this point, so we're connecting
    // Start connection immediately without delay
    _connectToCall();
    _setupConversationEvents();
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
    setState(() {
      _isCallActive = true;
      _callStartTime = DateTime.now();
    });

    // Start duration timer
    _startDurationTimer();

    // ElevenLabs WebRTC connection for in-app calls
    if (widget.callType == AppConstants.callTypeInApp) {
      // Check if ElevenLabs call is already active
      final isActive = ElevenLabsCallService.instance.isCallActive;
      if (kDebugMode) {
        print('🎙️ ElevenLabs WebRTC status: $isActive');
      }

      // Start ElevenLabs call with optimized connection
      try {
        final result = await ElevenLabsCallService.instance
            .startElevenLabsCall(widget.sessionId);
        if (kDebugMode) {
          print('🎙️ ElevenLabs WebRTC started: ${result != null}');
        }
      } catch (e) {
        if (kDebugMode) {
          print('❌ Error starting ElevenLabs call: $e');
        }

        // Try with retry logic if first attempt fails
        await _startElevenLabsWithRetry();
      }
    }

    if (kDebugMode) {
      print('📞 Call connected: ${widget.sessionId}');
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

  void _sendContextualUpdate() async {
    // Show dialog to get contextual update from user
    final TextEditingController controller = TextEditingController();

    final result = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Send Contextual Update'),
        content: TextField(
          controller: controller,
          decoration: const InputDecoration(
            hintText: 'Enter additional context for the AI...',
            border: OutlineInputBorder(),
          ),
          maxLines: 3,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, controller.text),
            child: const Text('Send'),
          ),
        ],
      ),
    );

    if (result != null && result.isNotEmpty) {
      try {
        await ElevenLabsCallService.instance.sendContextualUpdate(result);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Contextual update sent'),
              backgroundColor: Colors.green,
              duration: Duration(seconds: 2),
            ),
          );
        }
      } catch (e) {
        if (mounted) {
          _showErrorSnackBar('Failed to send contextual update: $e');
        }
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

                  // Conversation status
                  if (_conversationId != null) ...[
                    const SizedBox(height: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: const Color(0xFF10B981).withOpacity(0.2),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Text(
                        'AI Connected',
                        style: TextStyle(
                          fontSize: 12,
                          color: Color(0xFF10B981),
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
                        color: const Color(0xFF374151).withOpacity(0.5),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: const Color(0xFF10B981).withOpacity(0.3),
                        ),
                      ),
                      child: Row(
                        children: [
                          const Icon(
                            Icons.smart_toy,
                            size: 16,
                            color: Color(0xFF10B981),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              _lastMessage!,
                              style: const TextStyle(
                                fontSize: 12,
                                color: Color(0xFFE5E7EB),
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
                                  ? const Color(0xFFF59E0B)
                                  : const Color(0xFF2563EB),
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

                      // Contextual update button
                      GestureDetector(
                        onTap: _sendContextualUpdate,
                        child: Container(
                          width: 64,
                          height: 64,
                          decoration: BoxDecoration(
                            color: const Color(0xFF374151),
                            borderRadius: BorderRadius.circular(32),
                          ),
                          child: const Icon(
                            Icons.edit_note,
                            size: 28,
                            color: Colors.white,
                          ),
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
                            child: const Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(
                                  Icons.thumb_down,
                                  size: 16,
                                  color: Color(0xFFEF4444),
                                ),
                                SizedBox(width: 4),
                                Text(
                                  'Negative',
                                  style: TextStyle(
                                    fontSize: 12,
                                    color: Color(0xFFEF4444),
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
                              color: const Color(0xFF10B981).withOpacity(0.2),
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(
                                color: const Color(0xFF10B981).withOpacity(0.3),
                              ),
                            ),
                            child: const Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(
                                  Icons.thumb_up,
                                  size: 16,
                                  color: Color(0xFF10B981),
                                ),
                                SizedBox(width: 4),
                                Text(
                                  'Positive',
                                  style: TextStyle(
                                    fontSize: 12,
                                    color: Color(0xFF10B981),
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
                      color: const Color(0xFF374151).withOpacity(0.3),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(
                          Icons.info_outline,
                          size: 16,
                          color: Color(0xFF94A3B8),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            _isAgentSpeaking
                                ? 'AI is speaking...'
                                : 'AI companion is listening to your conversation',
                            style: const TextStyle(
                              fontSize: 12,
                              color: Color(0xFF94A3B8),
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
