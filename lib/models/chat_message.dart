import 'package:json_annotation/json_annotation.dart';

part 'chat_message.g.dart';

@JsonSerializable()
class ChatMessage {
  final String id;
  @JsonKey(name: 'household_id')
  final String householdId;
  @JsonKey(name: 'sender_id')
  final String senderId;
  @JsonKey(name: 'sender_type')
  final String senderType; // 'family' or 'elderly'
  final String? message;
  @JsonKey(name: 'message_type')
  final String messageType; // 'text' or 'image'
  @JsonKey(name: 'image_url')
  final String? imageUrl;
  @JsonKey(name: 'read_at')
  final String? readAt;
  @JsonKey(name: 'deleted_at')
  final String? deletedAt;
  @JsonKey(name: 'created_at')
  final String createdAt;

  ChatMessage({
    required this.id,
    required this.householdId,
    required this.senderId,
    required this.senderType,
    this.message,
    required this.messageType,
    this.imageUrl,
    this.readAt,
    this.deletedAt,
    required this.createdAt,
  });

  factory ChatMessage.fromJson(Map<String, dynamic> json) =>
      _$ChatMessageFromJson(json);

  Map<String, dynamic> toJson() => _$ChatMessageToJson(this);

  bool get isFromFamily => senderType == 'family';
  bool get isTextMessage => messageType == 'text';
  bool get isImageMessage => messageType == 'image';
  bool get isRead => readAt != null;

  ChatMessage copyWith({
    String? id,
    String? householdId,
    String? senderId,
    String? senderType,
    String? message,
    String? messageType,
    String? imageUrl,
    String? readAt,
    String? deletedAt,
    String? createdAt,
  }) {
    return ChatMessage(
      id: id ?? this.id,
      householdId: householdId ?? this.householdId,
      senderId: senderId ?? this.senderId,
      senderType: senderType ?? this.senderType,
      message: message ?? this.message,
      messageType: messageType ?? this.messageType,
      imageUrl: imageUrl ?? this.imageUrl,
      readAt: readAt ?? this.readAt,
      deletedAt: deletedAt ?? this.deletedAt,
      createdAt: createdAt ?? this.createdAt,
    );
  }
}
