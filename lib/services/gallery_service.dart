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

  // LAZY LOADING: Get Supabase client only when needed (after initialization)
  SupabaseClient get _supabase => Supabase.instance.client;

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
  Future<Map<String, dynamic>> downloadImageToGallery(String imageUrl, {String? fileName}) async {
    try {
      // Request storage permission
      final permissionStatus = await _requestStoragePermission();
      if (!permissionStatus) {
        if (kDebugMode) {
          print('[GalleryService] Storage permission denied');
        }
        return {
          'success': false,
          'message': 'Storage permission denied. Please enable it in app settings.',
        };
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
        return {
          'success': false,
          'message': 'Failed to download image (Error ${response.statusCode})',
        };
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

      return {
        'success': true,
        'message': 'Image saved to gallery',
      };
    } catch (e) {
      if (kDebugMode) {
        print('[GalleryService] Error downloading image: $e');
      }
      return {
        'success': false,
        'message': 'Error: ${e.toString().split(':').first}',
      };
    }
  }

  /// Request storage permission
  Future<bool> _requestStoragePermission() async {
    if (Platform.isAndroid) {
      // Try photos permission first (Android 13+)
      var photosStatus = await Permission.photos.status;
      if (photosStatus.isGranted) {
        if (kDebugMode) {
          print('[GalleryService] ✅ Photos permission already granted');
        }
        return true;
      }

      // Request photos permission
      photosStatus = await Permission.photos.request();
      if (photosStatus.isGranted) {
        if (kDebugMode) {
          print('[GalleryService] ✅ Photos permission granted');
        }
        return true;
      }

      // If photos permission is permanently denied, try storage permission (older Android)
      if (photosStatus.isPermanentlyDenied) {
        if (kDebugMode) {
          print('[GalleryService] Photos permission permanently denied, trying storage...');
        }

        var storageStatus = await Permission.storage.status;
        if (storageStatus.isGranted) {
          return true;
        }

        storageStatus = await Permission.storage.request();
        if (storageStatus.isGranted) {
          if (kDebugMode) {
            print('[GalleryService] ✅ Storage permission granted');
          }
          return true;
        }

        // Open app settings if still denied
        if (storageStatus.isPermanentlyDenied) {
          if (kDebugMode) {
            print('[GalleryService] Opening app settings for permission');
          }
          await openAppSettings();
        }
        return false;
      }

      if (kDebugMode) {
        print('[GalleryService] ❌ Photos permission denied');
      }
      return false;
    } else if (Platform.isIOS) {
      // For iOS, photos permission
      var status = await Permission.photos.status;
      if (status.isGranted) {
        return true;
      }

      status = await Permission.photos.request();
      if (status.isGranted) {
        if (kDebugMode) {
          print('[GalleryService] ✅ iOS Photos permission granted');
        }
        return true;
      }

      if (status.isPermanentlyDenied) {
        if (kDebugMode) {
          print('[GalleryService] Opening iOS app settings for permission');
        }
        await openAppSettings();
      }

      return false;
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

  /// Get household name from household table
  Future<String?> getHouseholdName(String householdId) async {
    try {
      if (kDebugMode) {
        print('[GalleryService] Fetching household name for: $householdId');
      }

      final response = await _supabase
          .from('households')
          .select('name')
          .eq('id', householdId)
          .maybeSingle();

      if (response != null && response['name'] != null) {
        final householdName = response['name'] as String;
        if (kDebugMode) {
          print('[GalleryService] ✅ Household name: $householdName');
        }
        return householdName;
      }

      if (kDebugMode) {
        print('[GalleryService] ❌ Household name not found');
      }
      return null;
    } catch (e) {
      if (kDebugMode) {
        print('[GalleryService] Error getting household name: $e');
      }
      return null;
    }
  }
}
