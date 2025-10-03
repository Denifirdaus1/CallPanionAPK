import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:gal/gal.dart';
import 'package:http/http.dart' as http;
import 'package:permission_handler/permission_handler.dart';
import 'package:path_provider/path_provider.dart';
import '../models/chat_message.dart';

class GalleryImage {
  final String id;
  final String url;
  final String? caption;
  final DateTime createdAt;
  final String senderType;

  GalleryImage({
    required this.id,
    required this.url,
    this.caption,
    required this.createdAt,
    required this.senderType,
  });

  factory GalleryImage.fromChatMessage(ChatMessage message) {
    return GalleryImage(
      id: message.id,
      url: message.imageUrl ?? '',
      caption: message.message,
      createdAt: DateTime.parse(message.createdAt),
      senderType: message.senderType,
    );
  }
}

class GalleryService {
  static final GalleryService instance = GalleryService._internal();
  factory GalleryService() => instance;
  GalleryService._internal();

  final SupabaseClient _supabase = Supabase.instance.client;

  /// Load all images from chat messages for a household
  Future<List<GalleryImage>> loadGalleryImages(String householdId) async {
    try {
      if (kDebugMode) {
        print('[GalleryService] Loading images for household: $householdId');
      }

      final response = await _supabase
          .from('chat_messages')
          .select()
          .eq('household_id', householdId)
          .eq('message_type', 'image')
          .isFilter('deleted_at', null)
          .not('image_url', 'is', null) // image_url IS NOT NULL
          .order('created_at', ascending: false);

      if (kDebugMode) {
        print('[GalleryService] Loaded ${response.length} images');
      }

      return (response as List)
          .map((json) {
            try {
              final message = ChatMessage.fromJson(json);
              return GalleryImage.fromChatMessage(message);
            } catch (e) {
              if (kDebugMode) {
                print('[GalleryService] Error parsing message: $e');
              }
              return null;
            }
          })
          .where((image) => image != null)
          .cast<GalleryImage>()
          .toList();
    } catch (e) {
      if (kDebugMode) {
        print('[GalleryService] Error loading images: $e');
      }
      rethrow;
    }
  }

  /// Download image to device gallery
  Future<bool> downloadImageToGallery(String imageUrl, {String? fileName}) async {
    try {
      // Request storage permission
      final permissionStatus = await _requestStoragePermission();
      if (!permissionStatus) {
        if (kDebugMode) {
          print('[GalleryService] Storage permission denied');
        }
        return false;
      }

      if (kDebugMode) {
        print('[GalleryService] Downloading image: $imageUrl');
      }

      // Download image from URL
      final response = await http.get(Uri.parse(imageUrl));

      if (response.statusCode != 200) {
        if (kDebugMode) {
          print('[GalleryService] Failed to download image: ${response.statusCode}');
        }
        return false;
      }

      // Save to temporary file
      final tempDir = await getTemporaryDirectory();
      final tempFileName = fileName ?? 'callpanion_${DateTime.now().millisecondsSinceEpoch}';
      final tempFile = File('${tempDir.path}/$tempFileName.jpg');
      await tempFile.writeAsBytes(response.bodyBytes);

      // Save to gallery using gal package
      await Gal.putImage(tempFile.path);

      // Clean up temp file
      await tempFile.delete();

      if (kDebugMode) {
        print('[GalleryService] Image saved to gallery successfully');
      }

      return true;
    } catch (e) {
      if (kDebugMode) {
        print('[GalleryService] Error downloading image: $e');
      }
      return false;
    }
  }

  /// Request storage permission
  Future<bool> _requestStoragePermission() async {
    if (Platform.isAndroid) {
      // For Android 13+ (API 33+), we need photos permission
      if (await Permission.photos.isGranted) {
        return true;
      }

      final status = await Permission.photos.request();
      if (status.isGranted) {
        return true;
      }

      // Fallback to storage permission for older Android versions
      if (await Permission.storage.isGranted) {
        return true;
      }

      final storageStatus = await Permission.storage.request();
      return storageStatus.isGranted;
    } else if (Platform.isIOS) {
      // For iOS, photos permission
      if (await Permission.photos.isGranted) {
        return true;
      }

      final status = await Permission.photos.request();
      return status.isGranted;
    }

    return false;
  }

  /// Get image count for household
  Future<int> getImageCount(String householdId) async {
    try {
      final response = await _supabase
          .from('chat_messages')
          .select()
          .eq('household_id', householdId)
          .eq('message_type', 'image')
          .isFilter('deleted_at', null)
          .not('image_url', 'is', null);

      return (response as List).length;
    } catch (e) {
      if (kDebugMode) {
        print('[GalleryService] Error getting image count: $e');
      }
      return 0;
    }
  }
}
