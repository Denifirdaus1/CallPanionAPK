import 'package:json_annotation/json_annotation.dart';

part 'device_info.g.dart';

@JsonSerializable()
class DeviceInfo {
  final String platform;
  final String? model;
  final String? version;
  final String? brand;
  final String? deviceId;
  final Map<String, dynamic>? additional;

  DeviceInfo({
    required this.platform,
    this.model,
    this.version,
    this.brand,
    this.deviceId,
    this.additional,
  });

  factory DeviceInfo.fromJson(Map<String, dynamic> json) => _$DeviceInfoFromJson(json);
  Map<String, dynamic> toJson() => _$DeviceInfoToJson(this);

  static DeviceInfo createDefault() {
    return DeviceInfo(
      platform: 'unknown',
      model: 'unknown',
      version: '1.0.0',
      brand: 'unknown',
    );
  }
}