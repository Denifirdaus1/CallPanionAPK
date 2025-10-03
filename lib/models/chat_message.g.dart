// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'chat_message.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ChatMessage _$ChatMessageFromJson(Map<String, dynamic> json) => ChatMessage(
      id: json['id'] as String,
      householdId: json['household_id'] as String,
      senderId: json['sender_id'] as String,
      senderType: json['sender_type'] as String,
      message: json['message'] as String?,
      messageType: json['message_type'] as String,
      imageUrl: json['image_url'] as String?,
      readAt: json['read_at'] as String?,
      deletedAt: json['deleted_at'] as String?,
      createdAt: json['created_at'] as String,
    );

Map<String, dynamic> _$ChatMessageToJson(ChatMessage instance) =>
    <String, dynamic>{
      'id': instance.id,
      'household_id': instance.householdId,
      'sender_id': instance.senderId,
      'sender_type': instance.senderType,
      'message': instance.message,
      'message_type': instance.messageType,
      'image_url': instance.imageUrl,
      'read_at': instance.readAt,
      'deleted_at': instance.deletedAt,
      'created_at': instance.createdAt,
    };
