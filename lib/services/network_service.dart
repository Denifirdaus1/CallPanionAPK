import 'package:connectivity_plus/connectivity_plus.dart';
import 'dart:async';

class NetworkService {
  static final Connectivity _connectivity = Connectivity();
  static StreamSubscription<List<ConnectivityResult>>? _subscription;
  static Function(bool)? _onConnectivityChanged;

  static bool _isConnected = true;

  static bool get isConnected => _isConnected;

  static Future<void> initialize({Function(bool)? onConnectivityChanged}) async {
    _onConnectivityChanged = onConnectivityChanged;

    // Check initial connectivity
    final result = await _connectivity.checkConnectivity();
    _updateConnectionStatus(result);

    // Listen for connectivity changes
    _subscription = _connectivity.onConnectivityChanged.listen(_updateConnectionStatus);
  }

  static void _updateConnectionStatus(List<ConnectivityResult> results) {
    final wasConnected = _isConnected;
    // Consider connected if any of the results is not none
    _isConnected = results.any((result) => result != ConnectivityResult.none);

    if (wasConnected != _isConnected) {
      _onConnectivityChanged?.call(_isConnected);
    }
  }

  static Future<bool> hasStableConnection() async {
    final results = await _connectivity.checkConnectivity();

    // Consider WiFi and mobile data as stable connections
    return results.any((result) =>
    result == ConnectivityResult.wifi || result == ConnectivityResult.mobile);
  }

  static Future<bool> hasHighBandwidthConnection() async {
    final results = await _connectivity.checkConnectivity();

    // WiFi is generally more stable for video calls
    return results.any((result) => result == ConnectivityResult.wifi);
  }

  static void dispose() {
    _subscription?.cancel();
    _subscription = null;
  }
}