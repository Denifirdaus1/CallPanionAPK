import 'dart:async';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:image_picker/image_picker.dart';
import '../models/chat_message.dart';
import '../utils/constants.dart';
import 'chat_notification_service.dart';

class ChatService {
  static final ChatService instance = ChatService._internal();
  factory ChatService() => instance;
  ChatService._internal();

  // LAZY LOADING: Get Supabase client only when needed (after initialization)
  SupabaseClient get _supabase => Supabase.instance.client;
  RealtimeChannel? _channel;

  // Callback untuk menerima pesan baru
  Function(ChatMessage)? onNewMessage;

  /// Claim chat access for current device/user (lazy loading)
  /// This ensures device_pairs is updated with current Supabase user_id
  Future<void> claimChatAccess(String householdId) async {
    try {
      print('[ChatService] 🔐 Claiming chat access...');
      
      // Get pairing token from SharedPreferences
      final prefs = await SharedPreferences.getInstance();
      final pairingToken = prefs.getString(AppConstants.keyPairingToken);

      if (pairingToken == null) {
        throw Exception('No pairing token found. Please complete device pairing first.');
      }

      // Get current user session
      final user = _supabase.auth.currentUser;
      if (user == null) {
        throw Exception('Not authenticated. Please sign in first.');
      }

      print('[ChatService] Calling claim-chat-access edge function...');
      print('[ChatService] Household: $householdId');
      print('[ChatService] Token length: ${pairingToken.length}, Token: ${pairingToken.length > 8 ? pairingToken.substring(0, 8) + "..." : pairingToken}');

      // Call edge function to claim chat access (service role bypass RLS)
      final response = await _supabase.functions.invoke(
        'claim-chat-access',
        body: {
          'pairingToken': pairingToken,
          'householdId': householdId,
        },
      );

      if (response.status != 200) {
        throw Exception('Failed to claim chat access: ${response.data}');
      }

      print('[ChatService] ✅ Chat access claimed successfully');
    } catch (e) {
      print('[ChatService] ❌ Error claiming chat access: $e');
      rethrow;
    }
  }

  /// Load chat messages untuk household tertentu
  Future<List<ChatMessage>> loadMessages(
    String householdId, {
    int limit = 50,
    String? before,
  }) async {
    try {
      if (kDebugMode) {
        print('[ChatService] Loading messages for household: $householdId, before: $before');
      }

      var query = _supabase
          .from('chat_messages')
          .select()
          .eq('household_id', householdId)
          .isFilter('deleted_at', null);

      // If before timestamp provided, load messages older than that
      if (before != null) {
        query = query.lt('created_at', before);
      }

      final response = await query
          .order('created_at', ascending: false)
          .limit(limit);

      if (kDebugMode) {
        print('[ChatService] Loaded ${response.length} messages');
      }

      final messages = (response as List)
          .map((json) => ChatMessage.fromJson(json))
          .toList();
      
      // Reverse to show oldest first (ascending order for display)
      return messages.reversed.toList();
    } catch (e) {
      if (kDebugMode) {
        print('[ChatService] Error loading messages: $e');
      }
      rethrow;
    }
  }

  /// Subscribe ke realtime updates untuk chat
  void subscribeToMessages(String householdId, Function(ChatMessage) callback) {
    try {
      if (kDebugMode) {
        print('[ChatService] Subscribing to realtime for household: $householdId');
      }

      // Remove existing channel if any
      if (_channel != null) {
        _supabase.removeChannel(_channel!);
        _channel = null;
      }

      // Store callback
      onNewMessage = callback;

      // Create new channel
      _channel = _supabase.channel('family-chat-$householdId');

      _channel!
          .onPostgresChanges(
            event: PostgresChangeEvent.insert,
            schema: 'public',
            table: 'chat_messages',
            filter: PostgresChangeFilter(
              type: PostgresChangeFilterType.eq,
              column: 'household_id',
              value: householdId,
            ),
            callback: (payload) async {
              if (kDebugMode) {
                print('[ChatService] Realtime message received: ${payload.newRecord}');
              }
              try {
                final message = ChatMessage.fromJson(payload.newRecord);

                // Trigger notification if message from family (only when app in background)
                if (message.senderType == 'family') {
                  final householdName = await getHouseholdName(householdId) ?? 'Your Family';
                  final messagePreview = message.message ?? 'New message';

                  await ChatNotificationService.instance.showChatNotification(
                    householdId: householdId,
                    householdName: householdName,
                    messagePreview: messagePreview,
                  );
                }

                callback(message);
              } catch (e) {
                if (kDebugMode) {
                  print('[ChatService] Error parsing realtime message: $e');
                }
              }
            },
          )
          .subscribe((status, error) {
            if (kDebugMode) {
              print('[ChatService] Subscription status: $status');
              if (error != null) {
                print('[ChatService] Subscription error: $error');
              }
            }
            if (status == RealtimeSubscribeStatus.subscribed) {
              if (kDebugMode) {
                print('[ChatService] ✅ Successfully subscribed to realtime updates');
              }
            }
          });
    } catch (e) {
      if (kDebugMode) {
        print('[ChatService] Error subscribing to messages: $e');
      }
    }
  }

  /// Unsubscribe dari realtime updates
  void unsubscribe() {
    try {
      if (_channel != null) {
        _supabase.removeChannel(_channel!);
        _channel = null;
        onNewMessage = null;
        if (kDebugMode) {
          print('[ChatService] Unsubscribed from realtime');
        }
      }
    } catch (e) {
      if (kDebugMode) {
        print('[ChatService] Error unsubscribing: $e');
      }
    }
  }

  /// Send text message
  Future<ChatMessage> sendTextMessage(String householdId, String message) async {
    try {
      // Use Supabase Auth user ID instead of SharedPreferences
      final userId = _supabase.auth.currentUser?.id;

      if (userId == null) {
        throw Exception('User not authenticated');
      }

      if (kDebugMode) {
        print('[ChatService] Sending text message: $message');
      }

      final response = await _supabase.from('chat_messages').insert({
        'household_id': householdId,
        'sender_id': userId,
        'sender_type': 'elderly',
        'message': message,
        'message_type': 'text',
      }).select().single();

      if (kDebugMode) {
        print('[ChatService] Message sent successfully');
      }

      return ChatMessage.fromJson(response);
    } catch (e) {
      if (kDebugMode) {
        print('[ChatService] Error sending text message: $e');
      }
      rethrow;
    }
  }

  /// Upload image ke storage
  Future<String> uploadImage(String householdId, File imageFile) async {
    try {
      // Use Supabase Auth user ID for validation
      final userId = _supabase.auth.currentUser?.id;

      if (userId == null) {
        throw Exception('User not authenticated');
      }

      // Get file extension
      final fileExt = imageFile.path.split('.').last.toLowerCase();
      final fileName = '$householdId/${DateTime.now().millisecondsSinceEpoch}.$fileExt';

      if (kDebugMode) {
        print('[ChatService] Uploading image: $fileName');
      }

      // Upload to storage
      await _supabase.storage.from('family-chat-media').upload(
            fileName,
            imageFile,
            fileOptions: const FileOptions(
              cacheControl: '3600',
              upsert: false,
            ),
          );

      // Get public URL (no expiry)
      final publicUrl = _supabase.storage
          .from('family-chat-media')
          .getPublicUrl(fileName);

      if (kDebugMode) {
        print('[ChatService] Image uploaded successfully');
      }

      return publicUrl;
    } catch (e) {
      if (kDebugMode) {
        print('[ChatService] Error uploading image: $e');
      }
      rethrow;
    }
  }

  /// Send image message
  Future<ChatMessage> sendImageMessage(
    String householdId,
    String imageUrl, {
    String? caption,
  }) async {
    try {
      // Use Supabase Auth user ID instead of SharedPreferences
      final userId = _supabase.auth.currentUser?.id;

      if (userId == null) {
        throw Exception('User not authenticated');
      }

      if (kDebugMode) {
        print('[ChatService] Sending image message with URL: $imageUrl');
      }

      final response = await _supabase.from('chat_messages').insert({
        'household_id': householdId,
        'sender_id': userId,
        'sender_type': 'elderly',
        'image_url': imageUrl,
        'message': caption,
        'message_type': 'image',
      }).select().single();

      if (kDebugMode) {
        print('[ChatService] Image message sent successfully');
      }

      return ChatMessage.fromJson(response);
    } catch (e) {
      if (kDebugMode) {
        print('[ChatService] Error sending image message: $e');
      }
      rethrow;
    }
  }

  /// Mark message sebagai dibaca
  Future<void> markAsRead(String messageId) async {
    try {
      await _supabase
          .from('chat_messages')
          .update({'read_at': DateTime.now().toIso8601String()})
          .eq('id', messageId)
          .isFilter('read_at', null);

      if (kDebugMode) {
        print('[ChatService] Message marked as read: $messageId');
      }
    } catch (e) {
      if (kDebugMode) {
        print('[ChatService] Error marking message as read: $e');
      }
      rethrow;
    }
  }

  /// Pick image dari gallery
  Future<File?> pickImage() async {
    try {
      final ImagePicker picker = ImagePicker();
      final XFile? image = await picker.pickImage(
        source: ImageSource.gallery,
        maxWidth: 1920,
        maxHeight: 1920,
        imageQuality: 85,
      );

      if (image != null) {
        final file = File(image.path);

        // Check file size (max 5MB)
        final fileSize = await file.length();
        if (fileSize > 5 * 1024 * 1024) {
          throw Exception('Image size must be less than 5MB');
        }

        return file;
      }
      return null;
    } catch (e) {
      if (kDebugMode) {
        print('[ChatService] Error picking image: $e');
      }
      rethrow;
    }
  }

  /// Get household ID dari user yang sedang login
  Future<String?> getHouseholdId() async {
    try {
      final prefs = await SharedPreferences.getInstance();

      // Primary source: SharedPreferences (stored during pairing)
      final householdId = prefs.getString(AppConstants.keyHouseholdId);
      if (householdId != null && householdId.isNotEmpty) {
        if (kDebugMode) {
          print('[ChatService] ✅ Household ID from SharedPreferences: $householdId');
        }
        return householdId;
      }

      // Fallback: Try to get from database using Supabase Auth user ID
      final userId = _supabase.auth.currentUser?.id;
      if (userId == null) {
        if (kDebugMode) {
          print('[ChatService] ❌ User not authenticated');
        }
        return null;
      }

      if (kDebugMode) {
        print('[ChatService] Looking for household_id in database with userId: $userId');
      }

      // Try device_pairs table
      try {
        final devicePairs = await _supabase
            .from('device_pairs')
            .select('household_id')
            .eq('claimed_by', userId)
            .not('claimed_at', 'is', null)
            .limit(1);

        if (devicePairs.isNotEmpty) {
          final householdIdFromDB = devicePairs.first['household_id'] as String?;
          if (householdIdFromDB != null) {
            if (kDebugMode) {
              print('[ChatService] ✅ Household ID from device_pairs: $householdIdFromDB');
            }
            // Cache it for next time
            await prefs.setString(AppConstants.keyHouseholdId, householdIdFromDB);
            return householdIdFromDB;
          }
        }
      } catch (e) {
        if (kDebugMode) {
          print('[ChatService] Error querying device_pairs: $e');
        }
      }

      // Try relatives table using elderly_user_id
      try {
        final relatives = await _supabase
            .from('relatives')
            .select('household_id')
            .eq('elderly_user_id', userId)
            .limit(1);

        if (relatives.isNotEmpty) {
          final householdIdFromDB = relatives.first['household_id'] as String?;
          if (householdIdFromDB != null) {
            if (kDebugMode) {
              print('[ChatService] ✅ Household ID from relatives: $householdIdFromDB');
            }
            // Cache it for next time
            await prefs.setString(AppConstants.keyHouseholdId, householdIdFromDB);
            return householdIdFromDB;
          }
        }
      } catch (e) {
        if (kDebugMode) {
          print('[ChatService] Error querying relatives: $e');
        }
      }

      if (kDebugMode) {
        print('[ChatService] ❌ Household ID not found in any source');
      }
      return null;
    } catch (e) {
      if (kDebugMode) {
        print('[ChatService] Error getting household ID: $e');
      }
      return null;
    }
  }

  /// Get household name from household table
  Future<String?> getHouseholdName(String householdId) async {
    try {
      if (kDebugMode) {
        print('[ChatService] Fetching household name for: $householdId');
      }

      final response = await _supabase
          .from('households')
          .select('name')
          .eq('id', householdId)
          .maybeSingle();

      if (response != null && response['name'] != null) {
        final householdName = response['name'] as String;
        if (kDebugMode) {
          print('[ChatService] ✅ Household name: $householdName');
        }
        return householdName;
      }

      if (kDebugMode) {
        print('[ChatService] ❌ Household name not found');
      }
      return null;
    } catch (e) {
      if (kDebugMode) {
        print('[ChatService] Error getting household name: $e');
      }
      return null;
    }
  }
}
