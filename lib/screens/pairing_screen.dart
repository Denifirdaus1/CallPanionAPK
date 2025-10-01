import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/api_service.dart';
import '../services/fcm_service.dart';
import '../utils/constants.dart';

class PairingScreen extends StatefulWidget {
  const PairingScreen({super.key});

  @override
  State<PairingScreen> createState() => _PairingScreenState();
}

class _PairingScreenState extends State<PairingScreen> {
  final TextEditingController _codeController = TextEditingController();
  bool _isLoading = false;
  String? _errorMessage;

  @override
  void dispose() {
    _codeController.dispose();
    super.dispose();
  }

  Future<void> _submitPairingCode() async {
    final code = _codeController.text.trim();
    
    if (code.isEmpty) {
      setState(() {
        _errorMessage = 'Please enter a pairing code';
      });
      return;
    }

    if (code.length != 6) {
      setState(() {
        _errorMessage = 'Pairing code must be 6 digits';
      });
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final result = await ApiService.instance.claimPairingCode(code);
      
      if (result['success'] == true) {
        // Save pairing data
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString(AppConstants.keyPairingToken, result['pairing_token'] ?? '');
        await prefs.setString(AppConstants.keyRelativeName, result['relative_name'] ?? '');
        await prefs.setString(AppConstants.keyHouseholdId, result['household_id'] ?? '');
        await prefs.setString(AppConstants.keyRelativeId, result['relative_id'] ?? '');
        
        // Re-register FCM token so backend links this device to the paired user
        try {
          final fcmSuccess = await FCMService.instance.registerToken();
          if (kDebugMode) {
            print('📱 FCM token re-registered after pairing: $fcmSuccess');
          }
        } catch (e) {
          if (kDebugMode) {
            print('❌ Error re-registering FCM token after pairing: $e');
          }
        }
        
        // Navigate back to main screen
        if (mounted) {
          Navigator.of(context).pop(true); // Return true to indicate success
        }
      } else {
        setState(() {
          _errorMessage = result['error'] ?? 'Failed to pair device';
        });
      }
    } catch (e) {
      setState(() {
        _errorMessage = 'Connection error: $e';
      });
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF7F5F4),
      appBar: AppBar(
        title: const Text('Device Pairing'),
        backgroundColor: const Color(0xFFF7F5F4),
        elevation: 0,
        foregroundColor: const Color(0xFF2563EB),
      ),
      body: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Logo
            Container(
              width: 120,
              height: 120,
              decoration: const BoxDecoration(
                color: Color(0xFF2563EB),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.phone,
                size: 60,
                color: Colors.white,
              ),
            ),
            
            const SizedBox(height: 32),
            
            // Title
            const Text(
              'Connect to Your Family',
              style: TextStyle(
                fontSize: 28,
                fontWeight: FontWeight.bold,
                color: Color(0xFF1F2937),
              ),
              textAlign: TextAlign.center,
            ),
            
            const SizedBox(height: 16),
            
            // Description
            const Text(
              'Enter the 6-digit code provided by your family to connect this device',
              style: TextStyle(
                fontSize: 16,
                color: Color(0xFF6B7280),
              ),
              textAlign: TextAlign.center,
            ),
            
            const SizedBox(height: 48),
            
            // Pairing code input
            Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: _errorMessage != null ? Colors.red : const Color(0xFFE5E7EB),
                  width: 2,
                ),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.05),
                    blurRadius: 10,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: TextField(
                controller: _codeController,
                keyboardType: TextInputType.number,
                maxLength: 6,
                style: const TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 8,
                ),
                textAlign: TextAlign.center,
                decoration: const InputDecoration(
                  hintText: '000000',
                  hintStyle: TextStyle(
                    color: Color(0xFFD1D5DB),
                    letterSpacing: 8,
                  ),
                  border: InputBorder.none,
                  contentPadding: EdgeInsets.symmetric(vertical: 20),
                  counterText: '',
                ),
                onChanged: (value) {
                  if (_errorMessage != null) {
                    setState(() {
                      _errorMessage = null;
                    });
                  }
                },
                onSubmitted: (value) {
                  if (value.length == 6) {
                    _submitPairingCode();
                  }
                },
              ),
            ),
            
            if (_errorMessage != null) ...[
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.red.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.red.withOpacity(0.3)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.error_outline, color: Colors.red, size: 20),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        _errorMessage!,
                        style: const TextStyle(color: Colors.red, fontSize: 14),
                      ),
                    ),
                  ],
                ),
              ),
            ],
            
            const SizedBox(height: 32),
            
            // Submit button
            SizedBox(
              height: 56,
              child: ElevatedButton(
                onPressed: _isLoading ? null : _submitPairingCode,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF2563EB),
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                  ),
                  elevation: 0,
                ),
                child: _isLoading
                    ? const SizedBox(
                        width: 24,
                        height: 24,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                        ),
                      )
                    : const Text(
                        'Connect Device',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
              ),
            ),
            
            const SizedBox(height: 24),
            
            // Help text
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: const Color(0xFFF3F4F6),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Icon(
                        Icons.info_outline,
                        color: Color(0xFF6B7280),
                        size: 20,
                      ),
                      const SizedBox(width: 8),
                      const Text(
                        'Need help?',
                        style: TextStyle(
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF374151),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    '• Ask your family member to generate a pairing code\n'
                    '• The code is 6 digits and expires after 10 minutes\n'
                    '• Make sure your device is connected to the internet',
                    style: TextStyle(
                      color: Color(0xFF6B7280),
                      fontSize: 14,
                      height: 1.5,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}