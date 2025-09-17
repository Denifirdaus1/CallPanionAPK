// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'device_info.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

DeviceInfo _$DeviceInfoFromJson(Map<String, dynamic> json) => DeviceInfo(
      platform: json['platform'] as String,
      model: json['model'] as String?,
      version: json['version'] as String?,
      brand: json['brand'] as String?,
      deviceId: json['deviceId'] as String?,
      additional: json['additional'] as Map<String, dynamic>?,
    );

Map<String, dynamic> _$DeviceInfoToJson(DeviceInfo instance) =>
    <String, dynamic>{
      'platform': instance.platform,
      'model': instance.model,
      'version': instance.version,
      'brand': instance.brand,
      'deviceId': instance.deviceId,
      'additional': instance.additional,
    };
