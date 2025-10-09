// 🎯 HANYA GANTI METHOD _sendMessage() di chat_screen.dart
// Copy-paste method ini untuk replace method _sendMessage() yang lama

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
          e.toString().contains('42501') ||
          e.toString().contains('Forbidden');

      // Check if it's storage error
      final isStorageError = e.toString().contains('storage') ||
          e.toString().contains('Upload failed');

      String errorTitle = 'Failed to send message';
      String errorMessage = 'Please try again.';
      
      if (isRLSError) {
        errorTitle = 'Permission Error';
        errorMessage = 'Chat access not properly setup. Please restart the app and try again.';
      } else if (isStorageError) {
        errorTitle = 'Upload Failed';
        errorMessage = 'Failed to upload image. Please check your connection and try again.';
      }

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                errorTitle,
                style: GoogleFonts.fraunces(
                  fontWeight: FontWeight.bold,
                  fontSize: 14,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                errorMessage,
                style: GoogleFonts.fraunces(
                  fontSize: 13,
                ),
              ),
            ],
          ),
          backgroundColor: Colors.red,
          duration: const Duration(seconds: 5),
          action: SnackBarAction(
            label: 'Retry',
            textColor: Colors.white,
            onPressed: () {
              // Restore the message and try again
              setState(() {
                if (messageText.isNotEmpty) {
                  _messageController.text = messageText;
                }
                if (imageFile != null) {
                  _selectedImage = imageFile;
                  _imagePreview = tempMessage.imageUrl;
                }
              });
            },
          ),
        ),
      );
    }
  } finally {
    setState(() {
      _isSending = false;
    });
  }
}
