import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:intl/intl.dart';
import '../models/chat_message.dart';
import '../services/chat_service.dart';

class ChatScreen extends StatefulWidget {
  final String householdId;
  final String? householdName;

  const ChatScreen({
    super.key,
    required this.householdId,
    this.householdName,
  });

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  final TextEditingController _messageController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  final List<ChatMessage> _messages = [];

  bool _isLoading = true;
  bool _isSending = false;
  bool _isLoadingMore = false;
  bool _hasMoreMessages = true;
  File? _selectedImage;
  String? _imagePreview;
  bool _showScrollButton = false;
  String _floatingDate = '';
  String _householdName = 'Your Family';

  @override
  void initState() {
    super.initState();
    _initializeChat();
    _scrollController.addListener(_onScroll);
  }

  Future<void> _initializeChat() async {
    // Fetch household name first (quick)
    if (widget.householdName != null) {
      _householdName = widget.householdName!;
    } else {
      final name = await ChatService.instance.getHouseholdName(widget.householdId);
      if (name != null && mounted) {
        setState(() {
          _householdName = name;
        });
      }
    }

    // Then load messages and setup realtime
    await _loadMessages();
    _setupRealtimeSubscription();
  }

  @override
  void dispose() {
    ChatService.instance.unsubscribe();
    _messageController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollController.hasClients) {
      final isNearBottom = _scrollController.offset >=
          _scrollController.position.maxScrollExtent - 100;
      final isNearTop = _scrollController.offset < 100;

      if (_showScrollButton != !isNearBottom) {
        setState(() {
          _showScrollButton = !isNearBottom;
        });
      }

      // Load more messages when scrolling near top
      if (isNearTop && _hasMoreMessages && !_isLoadingMore) {
        _loadMoreMessages();
      }

      // Update floating date based on visible messages
      _updateFloatingDate();
    }
  }

  void _updateFloatingDate() {
    if (_messages.isEmpty || !_scrollController.hasClients) return;

    // Find the first visible message
    final scrollOffset = _scrollController.offset;
    final viewportHeight = _scrollController.position.viewportDimension;

    // Simple estimation: find message at current scroll position
    final estimatedIndex = (scrollOffset / 80).floor().clamp(0, _messages.length - 1);
    if (estimatedIndex < _messages.length) {
      final message = _messages[estimatedIndex];
      final newDate = _formatFloatingDate(message.createdAt);

      if (newDate != _floatingDate) {
        setState(() {
          _floatingDate = newDate;
        });
      }
    }
  }

  String _formatFloatingDate(String timestamp) {
    try {
      final dateTime = DateTime.parse(timestamp).toLocal();
      final now = DateTime.now();
      final today = DateTime(now.year, now.month, now.day);
      final messageDate = DateTime(dateTime.year, dateTime.month, dateTime.day);

      final difference = today.difference(messageDate).inDays;

      if (difference == 0) {
        return 'Today';
      } else if (difference == 1) {
        return 'Yesterday';
      } else if (difference < 7) {
        return DateFormat('EEEE').format(dateTime); // Day name
      } else {
        return DateFormat('dd MMM yyyy').format(dateTime);
      }
    } catch (e) {
      return '';
    }
  }

  Future<void> _loadMoreMessages() async {
    if (_isLoadingMore || !_hasMoreMessages || _messages.isEmpty) return;

    setState(() {
      _isLoadingMore = true;
    });

    try {
      // Get the oldest message timestamp
      final oldestMessage = _messages.first;
      final beforeTimestamp = oldestMessage.createdAt;

      if (kDebugMode) {
        print('[ChatScreen] Loading more messages before: $beforeTimestamp');
      }

      // Load older messages
      final olderMessages = await ChatService.instance.loadMessages(
        widget.householdId,
        before: beforeTimestamp,
        limit: 20,
      );

      if (olderMessages.isEmpty) {
        setState(() {
          _hasMoreMessages = false;
          _isLoadingMore = false;
        });
        return;
      }

      // Save current scroll position
      final currentScrollOffset = _scrollController.offset;

      setState(() {
        // Add older messages at the beginning
        _messages.insertAll(0, olderMessages);
        _isLoadingMore = false;
      });

      // Restore scroll position to prevent jump
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (_scrollController.hasClients) {
          _scrollController.jumpTo(currentScrollOffset + (olderMessages.length * 80));
        }
      });

      if (kDebugMode) {
        print('[ChatScreen] Loaded ${olderMessages.length} older messages');
      }
    } catch (e) {
      if (kDebugMode) {
        print('[ChatScreen] Error loading more messages: $e');
      }
      setState(() {
        _isLoadingMore = false;
      });

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to load older messages: ${e.toString().split(':').first}'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  Future<void> _loadMessages() async {
    setState(() {
      _isLoading = true;
    });

    try {
      final messages = await ChatService.instance.loadMessages(widget.householdId);
      setState(() {
        _messages.clear();
        _messages.addAll(messages);
        _isLoading = false;
      });

      // Scroll to bottom after loading
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _scrollToBottom(animate: false);
      });
    } catch (e) {
      if (kDebugMode) {
        print('[ChatScreen] Error loading messages: $e');
      }
      setState(() {
        _isLoading = false;
      });

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to load messages: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  void _setupRealtimeSubscription() {
    ChatService.instance.subscribeToMessages(
      widget.householdId,
      _onNewMessage,
    );
  }

  void _onNewMessage(ChatMessage message) {
    if (!mounted) return;

    // Check if message already exists
    final exists = _messages.any((m) => m.id == message.id);
    if (exists) {
      if (kDebugMode) {
        print('[ChatScreen] Message already exists, skipping');
      }
      return;
    }

    setState(() {
      // Remove temporary message if exists
      _messages.removeWhere((m) =>
          m.id.startsWith('temp-') && m.message == message.message);

      _messages.add(message);
    });

    // Auto-scroll to bottom if near bottom
    if (_scrollController.hasClients) {
      final isNearBottom = _scrollController.offset >=
          _scrollController.position.maxScrollExtent - 100;
      if (isNearBottom) {
        _scrollToBottom();
      }
    }
  }

  void _scrollToBottom({bool animate = true}) {
    if (!_scrollController.hasClients) return;

    if (animate) {
      _scrollController.animateTo(
        _scrollController.position.maxScrollExtent,
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeOut,
      );
    } else {
      _scrollController.jumpTo(_scrollController.position.maxScrollExtent);
    }
  }

  Future<void> _sendMessage() async {
    if ((_messageController.text.trim().isEmpty && _selectedImage == null) ||
        _isSending) {
      return;
    }

    final messageText = _messageController.text.trim();
    final imageFile = _selectedImage;

    setState(() {
      _isSending = true;
    });

    // Create temporary message for optimistic UI
    final tempMessage = ChatMessage(
      id: 'temp-${DateTime.now().millisecondsSinceEpoch}',
      householdId: widget.householdId,
      senderId: 'temp',
      senderType: 'elderly',
      message: messageText.isNotEmpty ? messageText : null,
      messageType: imageFile != null ? 'image' : 'text',
      imageUrl: _imagePreview,
      createdAt: DateTime.now().toIso8601String(),
    );

    setState(() {
      _messages.add(tempMessage);
      _messageController.clear();
      _selectedImage = null;
      _imagePreview = null;
    });

    // Scroll to bottom
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _scrollToBottom();
    });

    try {
      if (imageFile != null) {
        // Upload image first
        final imageUrl = await ChatService.instance.uploadImage(
          widget.householdId,
          imageFile,
        );

        // Send image message
        await ChatService.instance.sendImageMessage(
          widget.householdId,
          imageUrl,
          caption: messageText.isNotEmpty ? messageText : null,
        );
      } else {
        // Send text message
        await ChatService.instance.sendTextMessage(
          widget.householdId,
          messageText,
        );
      }

      if (kDebugMode) {
        print('[ChatScreen] Message sent successfully');
      }
    } catch (e) {
      if (kDebugMode) {
        print('[ChatScreen] Error sending message: $e');
      }

      // Remove temp message and restore input
      setState(() {
        _messages.removeWhere((m) => m.id == tempMessage.id);
        _messageController.text = messageText;
        _selectedImage = imageFile;
        _imagePreview = tempMessage.imageUrl;
      });

      if (mounted) {
        // Check if it's RLS policy error
        final isRLSError = e.toString().contains('row-level security') ||
                          e.toString().contains('42501');

        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              isRLSError
                ? 'Permission denied. Please contact support to enable chat for this device.'
                : 'Failed to send message: ${e.toString().split(':').first}'
            ),
            backgroundColor: Colors.red,
            duration: const Duration(seconds: 5),
            action: isRLSError ? SnackBarAction(
              label: 'Info',
              textColor: Colors.white,
              onPressed: () {
                showDialog(
                  context: context,
                  builder: (context) => AlertDialog(
                    title: const Text('Chat Permission Required'),
                    content: const Text(
                      'Your device needs permission to send messages.\n\n'
                      'Please ask your family member to:\n'
                      '1. Open the web dashboard\n'
                      '2. Enable chat permissions for this device\n\n'
                      'Or contact CallPanion support.'
                    ),
                    actions: [
                      TextButton(
                        onPressed: () => Navigator.pop(context),
                        child: const Text('OK'),
                      ),
                    ],
                  ),
                );
              },
            ) : null,
          ),
        );
      }
    } finally {
      setState(() {
        _isSending = false;
      });
    }
  }

  Future<void> _pickImage() async {
    try {
      final file = await ChatService.instance.pickImage();
      if (file != null) {
        setState(() {
          _selectedImage = file;
          _imagePreview = file.path;
        });
      }
    } catch (e) {
      if (kDebugMode) {
        print('[ChatScreen] Error picking image: $e');
      }

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error selecting image: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  void _removeImage() {
    setState(() {
      _selectedImage = null;
      _imagePreview = null;
    });
  }

  String _formatTime(String timestamp) {
    try {
      final dateTime = DateTime.parse(timestamp).toLocal();
      return DateFormat('hh:mm a').format(dateTime);
    } catch (e) {
      return '';
    }
  }


  Widget _buildMessageBubble(ChatMessage message) {
    // FIXED: In Flutter APK, 'elderly' sender is YOU (on the right)
    // 'family' sender is relatives/household members (on the left)
    final isFromYou = message.senderType == 'elderly';

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4.0),
      child: Row(
        mainAxisAlignment:
            isFromYou ? MainAxisAlignment.end : MainAxisAlignment.start,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (!isFromYou) ...[
            // Avatar for family/household (on the left)
            CircleAvatar(
              backgroundColor: Colors.grey[300],
              radius: 16,
              child: Text(
                _householdName.isNotEmpty
                    ? _householdName[0].toUpperCase()
                    : 'F',
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
            const SizedBox(width: 8),
          ],
          Flexible(
            child: Column(
              crossAxisAlignment: isFromYou
                  ? CrossAxisAlignment.end
                  : CrossAxisAlignment.start,
              children: [
                // Sender name
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 8.0),
                  child: Text(
                    isFromYou ? 'You' : _householdName,
                    style: TextStyle(
                      fontSize: 12,
                      color: Colors.grey[600],
                    ),
                  ),
                ),
                const SizedBox(height: 4),

                // Message bubble
                if (message.isTextMessage)
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 10,
                    ),
                    decoration: BoxDecoration(
                      color: isFromYou
                          ? const Color(0xFF2563EB)
                          : Colors.grey[200],
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Text(
                      message.message ?? '',
                      style: TextStyle(
                        fontSize: 15,
                        color: isFromYou ? Colors.white : Colors.black87,
                      ),
                    ),
                  )
                else if (message.isImageMessage)
                  Column(
                    crossAxisAlignment: isFromYou
                        ? CrossAxisAlignment.end
                        : CrossAxisAlignment.start,
                    children: [
                      // Image
                      if (message.id.startsWith('temp-'))
                        // Loading placeholder for temp image
                        Container(
                          width: 200,
                          height: 200,
                          decoration: BoxDecoration(
                            color: Colors.grey[300],
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: const Center(
                            child: CircularProgressIndicator(),
                          ),
                        )
                      else if (message.imageUrl != null)
                        ClipRRect(
                          borderRadius: BorderRadius.circular(12),
                          child: CachedNetworkImage(
                            imageUrl: message.imageUrl!,
                            width: 200,
                            fit: BoxFit.cover,
                            placeholder: (context, url) => Container(
                              width: 200,
                              height: 200,
                              color: Colors.grey[300],
                              child: const Center(
                                child: CircularProgressIndicator(),
                              ),
                            ),
                            errorWidget: (context, url, error) => Container(
                              width: 200,
                              height: 200,
                              color: Colors.grey[300],
                              child: const Icon(Icons.error),
                            ),
                          ),
                        ),

                      // Caption if exists
                      if (message.message != null &&
                          message.message!.isNotEmpty) ...[
                        const SizedBox(height: 4),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 16,
                            vertical: 10,
                          ),
                          decoration: BoxDecoration(
                            color: isFromYou
                                ? const Color(0xFF2563EB)
                                : Colors.grey[200],
                            borderRadius: BorderRadius.circular(16),
                          ),
                          child: Text(
                            message.message!,
                            style: TextStyle(
                              fontSize: 15,
                              color:
                                  isFromYou ? Colors.white : Colors.black87,
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),

                // Timestamp
                Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8.0,
                    vertical: 4.0,
                  ),
                  child: Text(
                    _formatTime(message.createdAt),
                    style: TextStyle(
                      fontSize: 11,
                      color: Colors.grey[600],
                    ),
                  ),
                ),
              ],
            ),
          ),
          if (isFromYou) ...[
            const SizedBox(width: 8),
            // Avatar for YOU (elderly user) on the right
            CircleAvatar(
              backgroundColor: const Color(0xFF2563EB),
              radius: 16,
              child: const Text(
                'Y',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: Text('Family Chat'),
        backgroundColor: const Color(0xFF2563EB),
        foregroundColor: Colors.white,
        elevation: 0,
      ),
      body: Column(
        children: [
          // Messages list
          Expanded(
            child: _isLoading
                ? const Center(
                    child: CircularProgressIndicator(
                      color: Color(0xFF2563EB),
                    ),
                  )
                : _messages.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              Icons.chat_bubble_outline,
                              size: 64,
                              color: Colors.grey[400],
                            ),
                            const SizedBox(height: 16),
                            Text(
                              'No messages yet',
                              style: TextStyle(
                                fontSize: 16,
                                color: Colors.grey[600],
                              ),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              'Start the conversation!',
                              style: TextStyle(
                                fontSize: 14,
                                color: Colors.grey[500],
                              ),
                            ),
                          ],
                        ),
                      )
                    : Stack(
                        children: [
                          Column(
                            children: [
                              if (_isLoadingMore)
                                Container(
                                  padding: const EdgeInsets.symmetric(vertical: 12),
                                  child: const Center(
                                    child: SizedBox(
                                      width: 20,
                                      height: 20,
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2,
                                        color: Color(0xFF2563EB),
                                      ),
                                    ),
                                  ),
                                ),
                              Expanded(
                                child: ListView.builder(
                                  controller: _scrollController,
                                  padding: const EdgeInsets.all(16),
                                  itemCount: _messages.length,
                                  itemBuilder: (context, index) {
                                    return _buildMessageBubble(_messages[index]);
                                  },
                                ),
                              ),
                            ],
                          ),
                          // Floating date island (WhatsApp style)
                          if (_floatingDate.isNotEmpty)
                            Positioned(
                              top: 16,
                              left: 0,
                              right: 0,
                              child: Center(
                                child: Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 16,
                                    vertical: 6,
                                  ),
                                  decoration: BoxDecoration(
                                    color: Colors.black.withOpacity(0.6),
                                    borderRadius: BorderRadius.circular(20),
                                  ),
                                  child: Text(
                                    _floatingDate,
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontSize: 12,
                                      fontWeight: FontWeight.w500,
                                    ),
                                  ),
                                ),
                              ),
                            ),
                          if (_showScrollButton)
                            Positioned(
                              bottom: 16,
                              right: 16,
                              child: FloatingActionButton.small(
                                onPressed: _scrollToBottom,
                                backgroundColor: const Color(0xFF2563EB),
                                child: const Icon(
                                  Icons.arrow_downward,
                                  color: Colors.white,
                                ),
                              ),
                            ),
                        ],
                      ),
          ),

          // Input area
          Container(
            decoration: BoxDecoration(
              color: Colors.white,
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.05),
                  blurRadius: 10,
                  offset: const Offset(0, -4),
                ),
              ],
            ),
            child: SafeArea(
              child: Padding(
                padding: const EdgeInsets.all(12.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Image preview
                    if (_imagePreview != null) ...[
                      Container(
                        margin: const EdgeInsets.only(bottom: 8),
                        child: Stack(
                          children: [
                            ClipRRect(
                              borderRadius: BorderRadius.circular(8),
                              child: _selectedImage != null
                                  ? Image.file(
                                      _selectedImage!,
                                      height: 100,
                                      width: 100,
                                      fit: BoxFit.cover,
                                    )
                                  : Container(
                                      height: 100,
                                      width: 100,
                                      color: Colors.grey[300],
                                    ),
                            ),
                            Positioned(
                              top: 4,
                              right: 4,
                              child: GestureDetector(
                                onTap: _removeImage,
                                child: Container(
                                  padding: const EdgeInsets.all(4),
                                  decoration: BoxDecoration(
                                    color: Colors.red,
                                    shape: BoxShape.circle,
                                  ),
                                  child: const Icon(
                                    Icons.close,
                                    size: 16,
                                    color: Colors.white,
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],

                    // Input row
                    Row(
                      children: [
                        // Image picker button
                        IconButton(
                          onPressed: _isSending ? null : _pickImage,
                          icon: const Icon(Icons.image),
                          color: const Color(0xFF2563EB),
                        ),

                        // Text field
                        Expanded(
                          child: TextField(
                            controller: _messageController,
                            enabled: !_isSending,
                            decoration: InputDecoration(
                              hintText: _imagePreview != null
                                  ? 'Add a caption (optional)...'
                                  : 'Type a message...',
                              border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(24),
                                borderSide: BorderSide(
                                  color: Colors.grey[300]!,
                                ),
                              ),
                              contentPadding: const EdgeInsets.symmetric(
                                horizontal: 16,
                                vertical: 10,
                              ),
                            ),
                            maxLines: null,
                            textCapitalization: TextCapitalization.sentences,
                            onSubmitted: (_) => _sendMessage(),
                          ),
                        ),

                        const SizedBox(width: 8),

                        // Send button
                        Container(
                          decoration: const BoxDecoration(
                            color: Color(0xFF2563EB),
                            shape: BoxShape.circle,
                          ),
                          child: IconButton(
                            onPressed: _isSending ? null : _sendMessage,
                            icon: _isSending
                                ? const SizedBox(
                                    width: 20,
                                    height: 20,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                      valueColor: AlwaysStoppedAnimation<Color>(
                                          Colors.white),
                                    ),
                                  )
                                : const Icon(Icons.send),
                            color: Colors.white,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
