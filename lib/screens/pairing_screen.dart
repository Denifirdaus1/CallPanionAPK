import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:google_fonts/google_fonts.dart';
import '../services/api_service.dart';
import '../services/fcm_service.dart';
import '../services/supabase_auth_service.dart';
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
  bool _showScanner = false;
  MobileScannerController? _scannerController;

  @override
  void dispose() {
    _codeController.dispose();
    _scannerController?.dispose();
    super.dispose();
  }

  void _toggleScanner() {
    setState(() {
      _showScanner = !_showScanner;
      if (_showScanner) {
        _scannerController = MobileScannerController(
          detectionSpeed: DetectionSpeed.noDuplicates,
        );
      } else {
        _scannerController?.dispose();
        _scannerController = null;
      }
    });
  }

  void _handleQRCodeScanned(String code) {
    // Close scanner
    _toggleScanner();

    // Extract 6-digit code from QR
    final cleanCode = code.replaceAll(RegExp(r'[^0-9]'), '');

    if (cleanCode.length >= 6) {
      _codeController.text = cleanCode.substring(0, 6);
      // Auto-submit after scanning
      _submitPairingCode();
    } else {
      setState(() {
        _errorMessage = 'Invalid QR code format';
      });
    }
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
        await prefs.setString(
            AppConstants.keyPairingToken, result['pairing_token'] ?? '');
        await prefs.setString(
            AppConstants.keyRelativeName, result['relative_name'] ?? '');
        await prefs.setString(
            AppConstants.keyHouseholdId, result['household_id'] ?? '');
        await prefs.setString(
            AppConstants.keyRelativeId, result['relative_id'] ?? '');

        // IMPORTANT: Authenticate with Supabase so RLS policies work
        if (kDebugMode) {
          print('🔐 Authenticating with Supabase for chat access...');
        }

        final authSuccess =
            await SupabaseAuthService.instance.signInAnonymously();
        if (authSuccess) {
          if (kDebugMode) {
            print('✅ Supabase authentication successful');
          }
        } else {
          if (kDebugMode) {
            print('⚠️ Supabase authentication failed - chat may not work');
          }
        }

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
      backgroundColor: Colors.white,
      appBar: AppBar(
        title: Text(
          'Device Pairing',
          style: GoogleFonts.fraunces(
            fontSize: 20,
            fontWeight: FontWeight.w600,
            color: const Color(0xFF0F3B2E),
          ),
        ),
        backgroundColor: Colors.white,
        elevation: 0,
        foregroundColor: const Color(0xFF0F3B2E),
        surfaceTintColor: Colors.white,
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Container(
            height: 1,
            color: const Color(0xFFE38B6F),
          ),
        ),
      ),
      body: _showScanner ? _buildScannerView() : _buildManualInputView(),
    );
  }

  Widget _buildScannerView() {
    return Stack(
      children: [
        MobileScanner(
          controller: _scannerController,
          onDetect: (capture) {
            final List<Barcode> barcodes = capture.barcodes;
            for (final barcode in barcodes) {
              if (barcode.rawValue != null) {
                _handleQRCodeScanned(barcode.rawValue!);
                break;
              }
            }
          },
        ),
        // Overlay with instructions
        Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.center,
              colors: [
                Colors.black.withValues(alpha: 0.7),
                Colors.transparent,
              ],
            ),
          ),
        ),
        SafeArea(
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  children: [
                    Row(
                      children: [
                        IconButton(
                          icon: const Icon(Icons.close, color: Colors.white),
                          onPressed: _toggleScanner,
                        ),
                        Expanded(
                          child: Text(
                            'Scan QR Code',
                            style: GoogleFonts.fraunces(
                              color: Colors.white,
                              fontSize: 20,
                              fontWeight: FontWeight.w700,
                            ),
                            textAlign: TextAlign.center,
                          ),
                        ),
                        const SizedBox(width: 48),
                      ],
                    ),
                    const SizedBox(height: 16),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 12,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.2),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(
                        'Point your camera at the QR code\nshown on the web dashboard',
                        style: GoogleFonts.fraunces(
                          color: Colors.white,
                          fontSize: 14,
                          fontWeight: FontWeight.w400,
                        ),
                        textAlign: TextAlign.center,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        // Scanner frame
        Center(
          child: Container(
            width: 250,
            height: 250,
            decoration: BoxDecoration(
              border: Border.all(
                color: Colors.white,
                width: 3,
              ),
              borderRadius: BorderRadius.circular(16),
            ),
          ),
        ),
        // Bottom manual input option
        Align(
          alignment: Alignment.bottomCenter,
          child: Container(
            margin: const EdgeInsets.all(24),
            child: ElevatedButton.icon(
              onPressed: _toggleScanner,
              icon: const Icon(Icons.keyboard),
              label: Text(
                'Enter Code Manually',
                style: GoogleFonts.fraunces(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                ),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.white,
                foregroundColor: const Color(0xFF0F3B2E),
                padding: const EdgeInsets.symmetric(
                  horizontal: 24,
                  vertical: 16,
                ),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(20),
                ),
                elevation: 1,
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildManualInputView() {
    return Padding(
      padding: const EdgeInsets.all(24.0),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SizedBox(height: 40),

          // Title
          Text(
            'Connect to Your Family',
            style: GoogleFonts.fraunces(
              fontSize: 32,
              fontWeight: FontWeight.w700,
              color: const Color(0xFF0F3B2E),
            ),
            textAlign: TextAlign.center,
          ),

          const SizedBox(height: 16),

          // Description
          Text(
            'Scan the QR code or enter the 6-digit code from your family dashboard',
            style: GoogleFonts.fraunces(
              fontSize: 16,
              fontWeight: FontWeight.w400,
              color: const Color(0xFF0F3B2E).withOpacity(0.7),
            ),
            textAlign: TextAlign.center,
          ),

          const SizedBox(height: 32),

          // QR Scanner Button
          SizedBox(
            height: 56,
            child: OutlinedButton.icon(
              onPressed: _isLoading ? null : _toggleScanner,
              icon: const Icon(Icons.qr_code_scanner, size: 28),
              label: Text(
                'Scan QR Code',
                style: GoogleFonts.fraunces(
                  fontSize: 18,
                  fontWeight: FontWeight.w600,
                ),
              ),
              style: OutlinedButton.styleFrom(
                foregroundColor: const Color(0xFFE38B6F),
                side: const BorderSide(
                  color: Color(0xFFE38B6F),
                  width: 2,
                ),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(20),
                ),
              ),
            ),
          ),

          const SizedBox(height: 24),

          // Divider
          Row(
            children: [
              Expanded(child: Divider(color: const Color(0xFFE4B8AC))),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Text(
                  'OR',
                  style: GoogleFonts.fraunces(
                    color: const Color(0xFF0F3B2E).withOpacity(0.6),
                    fontWeight: FontWeight.w500,
                    fontSize: 14,
                  ),
                ),
              ),
              Expanded(child: Divider(color: const Color(0xFFE4B8AC))),
            ],
          ),

          const SizedBox(height: 24),

          // Pairing code input
          Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(
                color: _errorMessage != null
                    ? Colors.red
                    : const Color(0xFFE4B8AC),
                width: 2,
              ),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.05),
                  blurRadius: 10,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: TextField(
              controller: _codeController,
              keyboardType: TextInputType.number,
              maxLength: 6,
              style: GoogleFonts.fraunces(
                fontSize: 24,
                fontWeight: FontWeight.w700,
                letterSpacing: 8,
                color: const Color(0xFF0F3B2E),
              ),
              textAlign: TextAlign.center,
              decoration: InputDecoration(
                hintText: '000000',
                hintStyle: GoogleFonts.fraunces(
                  color: const Color(0xFFE4B8AC),
                  letterSpacing: 8,
                  fontWeight: FontWeight.w400,
                ),
                border: InputBorder.none,
                contentPadding: const EdgeInsets.symmetric(vertical: 20),
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
                color: Colors.red.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.red.withValues(alpha: 0.3)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.error_outline, color: Colors.red, size: 20),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      _errorMessage!,
                      style: GoogleFonts.fraunces(
                        color: Colors.red,
                        fontSize: 14,
                        fontWeight: FontWeight.w500,
                      ),
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
                backgroundColor: const Color(0xFFE38B6F),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(20),
                ),
                elevation: 1,
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
                  : Text(
                      'Connect Device',
                      style: GoogleFonts.fraunces(
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
              color: const Color(0xFFF8F9FA),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: const Color(0xFFE4B8AC),
                width: 1,
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(
                      Icons.info_outline,
                      color: const Color(0xFF0F3B2E).withOpacity(0.7),
                      size: 20,
                    ),
                    const SizedBox(width: 8),
                    Text(
                      'Need help?',
                      style: GoogleFonts.fraunces(
                        fontWeight: FontWeight.w600,
                        color: const Color(0xFF0F3B2E),
                        fontSize: 16,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  '• Ask your family member to open the dashboard\n'
                  '• Scan the QR code or enter the 6-digit code\n'
                  '• The code expires after 10 minutes\n'
                  '• Make sure your device is connected to the internet',
                  style: GoogleFonts.fraunces(
                    color: const Color(0xFF0F3B2E).withOpacity(0.7),
                    fontSize: 14,
                    height: 1.5,
                    fontWeight: FontWeight.w400,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
