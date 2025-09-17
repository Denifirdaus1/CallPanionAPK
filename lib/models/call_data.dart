import 'dart:convert';
import 'package:json_annotation/json_annotation.dart';

part 'call_data.g.dart';

@JsonSerializable()
class CallData {
  final String sessionId;
  final String relativeName;
  final String callType;
  final String householdId;
  final String relativeId;
  final String? handle;
  final String? avatar;
  final String? duration;
  final DateTime? scheduledTime;

  CallData({
    required this.sessionId,
    required this.relativeName,
    required this.callType,
    required this.householdId,
    required this.relativeId,
    this.handle,
    this.avatar,
    this.duration,
    this.scheduledTime,
  });

  factory CallData.fromJson(Map<String, dynamic> json) => _$CallDataFromJson(json);
  Map<String, dynamic> toJson() => _$CallDataToJson(this);

  CallData copyWith({
    String? sessionId,
    String? relativeName,
    String? callType,
    String? householdId,
    String? relativeId,
    String? handle,
    String? avatar,
    String? duration,
    DateTime? scheduledTime,
  }) {
    return CallData(
      sessionId: sessionId ?? this.sessionId,
      relativeName: relativeName ?? this.relativeName,
      callType: callType ?? this.callType,
      householdId: householdId ?? this.householdId,
      relativeId: relativeId ?? this.relativeId,
      handle: handle ?? this.handle,
      avatar: avatar ?? this.avatar,
      duration: duration ?? this.duration,
      scheduledTime: scheduledTime ?? this.scheduledTime,
    );
  }

  // JSON serialization methods
  String toJsonString() {
    return jsonEncode({
      'sessionId': sessionId,
      'relativeName': relativeName,
      'callType': callType,
      'householdId': householdId,
      'relativeId': relativeId,
      'scheduledTime': scheduledTime?.toIso8601String(),
      'avatar': avatar,
      'handle': handle,
      'duration': duration,
    });
  }

  static CallData? fromJsonString(String jsonString) {
    try {
      final Map<String, dynamic> data = jsonDecode(jsonString);
      return CallData(
        sessionId: data['sessionId'] ?? '',
        relativeName: data['relativeName'] ?? '',
        callType: data['callType'] ?? '',
        householdId: data['householdId'] ?? '',
        relativeId: data['relativeId'] ?? '',
        scheduledTime: data['scheduledTime'] != null ? DateTime.parse(data['scheduledTime']) : null,
        avatar: data['avatar'],
        handle: data['handle'],
        duration: data['duration'],
      );
    } catch (e) {
      return null;
    }
  }

  @override
  String toString() {
    return 'CallData(sessionId: $sessionId, relativeName: $relativeName, callType: $callType, householdId: $householdId, relativeId: $relativeId, scheduledTime: $scheduledTime, avatar: $avatar, handle: $handle, duration: $duration)';
  }
}