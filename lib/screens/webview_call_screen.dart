import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:wakelock_plus/wakelock_plus.dart';
import '../services/api_service.dart';
import '../services/permission_service.dart';
import '../services/network_service.dart';
import '../utils/constants.dart';

class WebViewCallScreen extends StatefulWidget {
  final String sessionId;
  final String relativeName;

  const WebViewCallScreen({
    super.key,
    required this.sessionId,
    required this.relativeName,
  });

  @override
  State<WebViewCallScreen> createState() => _WebViewCallScreenState();
}

class _WebViewCallScreenState extends State<WebViewCallScreen> {
  late final WebViewController _controller;
  bool _isLoading = true;
  bool _hasError = false;
  String _errorMessage = '';
  int _callDuration = 0;
  late DateTime _callStartTime;
  bool _isCallActive = false;

  @override
  void initState() {
    super.initState();
    _initializeCall();
  }

  Future<void> _initializeCall() async {
    // Keep screen awake during call
    WakelockPlus.enable();

    // Check network connectivity
    if (!await NetworkService.hasStableConnection()) {
      setState(() {
        _hasError = true;
        _errorMessage = 'No stable internet connection. Please check your network and try again.';
        _isLoading = false;
      });
      return;
    }

    // Request permissions
    final permissionsGranted = await PermissionService.requestCallPermissions();
    if (!permissionsGranted) {
      setState(() {
        _hasError = true;
        _errorMessage = 'Microphone and camera permissions are required for calls.';
        _isLoading = false;
      });
      return;
    }

    _initializeWebView();
    _callStartTime = DateTime.now();
    _startDurationTimer();
  }

  void _initializeWebView() {
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setUserAgent('CallPanion-ElderlyApp/1.0.0 (Flutter)')
      ..enableZoom(false)
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageStarted: (String url) {
            setState(() {
              _isLoading = true;
              _hasError = false;
            });
            if (kDebugMode) {
              print('🌐 WebView started loading: $url');
            }
          },
          onPageFinished: (String url) {
            setState(() {
              _isLoading = false;
              _isCallActive = true;
            });

            // Inject JavaScript to handle call events
            _injectCallHandlers();

            if (kDebugMode) {
              print('🌐 WebView finished loading: $url');
            }
          },
          onWebResourceError: (WebResourceError error) {
            setState(() {
              _isLoading = false;
              _hasError = true;
              _errorMessage = 'Failed to load call interface: ${error.description}';
            });

            if (kDebugMode) {
              print('❌ WebView error: ${error.description}');
            }
          },
        ),
      )
      ..addJavaScriptChannel(
        'CallPanion',
        onMessageReceived: (JavaScriptMessage message) {
          _handleJavaScriptMessage(message.message);
        },
      );

    // Handle permission requests for WebRTC
    // Note: setOnPermissionRequest is not available in webview_flutter v4.4.2
    // WebRTC permissions are handled automatically by the WebView

    _loadCallInterface();
  }

  void _injectCallHandlers() {
    // Inject JavaScript to communicate with Flutter
    _controller.runJavaScript('''
      window.CallPanion = {
        postMessage: function(data) {
          // This will be intercepted by Flutter
          console.log('CallPanion message:', data);
        },
        endCall: function() {
          // Handle call end
          this.postMessage({type: 'call_ended'});
        }
      };
      
      // Override console.log to capture WebRTC logs
      const originalLog = console.log;
      console.log = function(...args) {
        originalLog.apply(console, args);
        if (args[0] && args[0].includes('WebRTC')) {
          window.CallPanion.postMessage({type: 'webrtc_log', message: args.join(' ')});
        }
      };
    ''');
  }

  void _loadCallInterface() {
    // URL yang akan load interface React dengan ElevenLabs integration
    final callUrl = '${AppConstants.webCallBaseUrl}?sessionId=${widget.sessionId}&autoStart=true&platform=flutter';

    if (kDebugMode) {
      print('🌐 Loading ElevenLabs call interface: $callUrl');
    }

    _controller.loadRequest(Uri.parse(callUrl));
  }

  void _handleJavaScriptMessage(String message) {
    if (kDebugMode) {
      print('📱 JavaScript message: $message');
    }

    try {
      // Handle different types of messages from the web interface
      if (message.contains('call_ended')) {
        _endCall();
      } else if (message.contains('call_started')) {
        setState(() {
          _isCallActive = true;
        });
      } else if (message.contains('call_error')) {
        setState(() {
          _hasError = true;
          _errorMessage = 'Call connection error';
        });
      }
    } catch (e) {
      if (kDebugMode) {
        print('❌ Error handling JavaScript message: $e');
      }
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

      // Update call status via API
      await ApiService.instance.updateCallStatus(
        sessionId: widget.sessionId,
        status: AppConstants.callStatusCompleted,
        action: 'end',
        duration: _callDuration,
      );

      if (kDebugMode) {
        print('📞 WebView call ended: ${widget.sessionId} (${_callDuration}s)');
      }

      // Return to main screen
      if (mounted) {
        Navigator.pop(context);
      }
    } catch (e) {
      if (kDebugMode) {
        print('❌ Error ending WebView call: $e');
      }
    }
  }

  Future<void> _reloadWebView() async {
    setState(() {
      _isLoading = true;
      _hasError = false;
      _errorMessage = '';
    });

    if (!await NetworkService.hasStableConnection()) {
      setState(() {
        _hasError = true;
        _errorMessage = 'Still no stable internet connection.';
        _isLoading = false;
      });
      return;
    }

    _loadCallInterface();
  }

  @override
  void dispose() {
    // Disable wakelock when leaving
    WakelockPlus.disable();
    super.dispose();
  }

  String _formatDuration(int seconds) {
    final minutes = seconds ~/ 60;
    final remainingSeconds = seconds % 60;
    return '${minutes.toString().padLeft(2, '0')}:${remainingSeconds.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: const Color(0xFF1E293B),
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () {
            _endCall();
          },
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              widget.relativeName,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 16,
                fontWeight: FontWeight.w600,
              ),
            ),
            if (_isCallActive)
              Text(
                _formatDuration(_callDuration),
                style: const TextStyle(
                  color: Color(0xFF94A3B8),
                  fontSize: 12,
                ),
              ),
          ],
        ),
        actions: [
          if (_hasError)
            IconButton(
              icon: const Icon(Icons.refresh, color: Colors.white),
              onPressed: _reloadWebView,
            ),
          IconButton(
            icon: const Icon(Icons.call_end, color: Color(0xFFEF4444)),
            onPressed: _endCall,
          ),
        ],
      ),
      body: Stack(
        children: [
          // WebView
          if (!_hasError)
            WebViewWidget(controller: _controller),

          // Error state
          if (_hasError)
            Center(
              child: Padding(
                padding: const EdgeInsets.all(24.0),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(
                      Icons.error_outline,
                      size: 64,
                      color: Color(0xFFEF4444),
                    ),
                    const SizedBox(height: 16),
                    const Text(
                      'Call Connection Error',
                      style: TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      _errorMessage.isNotEmpty
                          ? _errorMessage
                          : 'Unable to connect to call interface',
                      style: const TextStyle(
                        fontSize: 14,
                        color: Color(0xFF94A3B8),
                      ),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 24),
                    ElevatedButton.icon(
                      onPressed: _reloadWebView,
                      icon: const Icon(Icons.refresh),
                      label: const Text('Try Again'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF2563EB),
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(
                          horizontal: 24,
                          vertical: 12,
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    TextButton(
                      onPressed: _endCall,
                      child: const Text(
                        'End Call',
                        style: TextStyle(
                          color: Color(0xFFEF4444),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),

          // Loading indicator
          if (_isLoading && !_hasError)
            Container(
              color: const Color(0xFF1E293B),
              child: const Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    CircularProgressIndicator(
                      valueColor: AlwaysStoppedAnimation<Color>(Color(0xFF2563EB)),
                    ),
                    SizedBox(height: 16),
                    Text(
                      'Connecting to call...',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 16,
                      ),
                    ),
                  ],
                ),
              ),
            ),

          // Call status overlay
          if (_isCallActive && !_isLoading && !_hasError)
            Positioned(
              top: 16,
              left: 16,
              right: 16,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                decoration: BoxDecoration(
                  color: const Color(0xFF10B981).withOpacity(0.9),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Container(
                      width: 8,
                      height: 8,
                      decoration: const BoxDecoration(
                        color: Colors.white,
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 8),
                    const Text(
                      'Call Active',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}