// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'call_data.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

CallData _$CallDataFromJson(Map<String, dynamic> json) => CallData(
      sessionId: json['sessionId'] as String,
      relativeName: json['relativeName'] as String,
      callType: json['callType'] as String,
      householdId: json['householdId'] as String,
      relativeId: json['relativeId'] as String,
      handle: json['handle'] as String?,
      avatar: json['avatar'] as String?,
      duration: json['duration'] as String?,
      scheduledTime: json['scheduledTime'] == null
          ? null
          : DateTime.parse(json['scheduledTime'] as String),
    );

Map<String, dynamic> _$CallDataToJson(CallData instance) => <String, dynamic>{
      'sessionId': instance.sessionId,
      'relativeName': instance.relativeName,
      'callType': instance.callType,
      'householdId': instance.householdId,
      'relativeId': instance.relativeId,
      'handle': instance.handle,
      'avatar': instance.avatar,
      'duration': instance.duration,
      'scheduledTime': instance.scheduledTime?.toIso8601String(),
    };
