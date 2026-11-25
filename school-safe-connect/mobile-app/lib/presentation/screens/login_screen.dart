import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../core/api_service.dart';
import '../../core/constants.dart';
import 'parent_home_screen.dart';
import 'teacher_home_screen.dart';
import 'driver_home_screen.dart';

enum LoginView {
  login,
  otp,
  forgotPassword,
  register,
  registrationSuccess,
  checkStatus,
}

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  LoginView _currentView = LoginView.login;
  bool _isLoading = false;
  String? _errorMessage;
  String? _successMessage;
  Timer? _bannerAutoDismissTimer;
  String? _lastScheduledBannerKey;

  void _ensureBannerAutoDismiss() {
    final key = '${_errorMessage ?? ''}|${_successMessage ?? ''}';
    if (key == '|') {
      _bannerAutoDismissTimer?.cancel();
      _lastScheduledBannerKey = null;
      return;
    }
    if (key != _lastScheduledBannerKey) {
      _lastScheduledBannerKey = key;
      _bannerAutoDismissTimer?.cancel();
      _bannerAutoDismissTimer = Timer(const Duration(milliseconds: 4500), () {
        if (mounted) {
          setState(() {
            _errorMessage = null;
            _successMessage = null;
            _lastScheduledBannerKey = null;
          });
        }
      });
    }
  }

  // Login Controllers
  final _identifierController = TextEditingController();
  final _passwordController = TextEditingController();
  final _otpController = TextEditingController();
  String? _tempToken;
  String? _maskedTarget;

  // Forgot Password Controllers
  final _forgotIdentifierController = TextEditingController();
  final _forgotOtpController = TextEditingController();
  final _newPasswordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  String? _resetToken;
  bool _forgotOtpSent = false;

  // Register Controllers
  String _selectedRole = AppConstants.roleParent;
  final _regSchoolCodeController = TextEditingController(text: 'SSC-SCH-1001');
  final _regFullNameController = TextEditingController();
  final _regEmailController = TextEditingController();
  final _regPhoneController = TextEditingController();
  final _regPasswordController = TextEditingController();
  final _regConfirmPasswordController = TextEditingController();

  // Parent-specific fields
  final _admissionNoController = TextEditingController();
  final _childNameController = TextEditingController();
  final _gradeController = TextEditingController(text: '6');
  final _sectionController = TextEditingController(text: 'A');
  String _relationship = 'MOTHER';
  bool _consentAccepted = false;

  // Registration Success details
  Map<String, dynamic>? _lastRegisteredUser;

  // Status Check Controllers
  final _statusIdentifierController = TextEditingController();
  Map<String, dynamic>? _statusResult;

  @override
  void dispose() {
    _bannerAutoDismissTimer?.cancel();
    _identifierController.dispose();
    _passwordController.dispose();
    _otpController.dispose();
    _forgotIdentifierController.dispose();
    _forgotOtpController.dispose();
    _newPasswordController.dispose();
    _confirmPasswordController.dispose();
    _regSchoolCodeController.dispose();
    _regFullNameController.dispose();
    _regEmailController.dispose();
    _regPhoneController.dispose();
    _regPasswordController.dispose();
    _regConfirmPasswordController.dispose();
    _admissionNoController.dispose();
    _childNameController.dispose();
    _gradeController.dispose();
    _sectionController.dispose();
    _statusIdentifierController.dispose();
    super.dispose();
  }

  void _setView(LoginView view) {
    setState(() {
      _currentView = view;
      _errorMessage = null;
      _successMessage = null;
    });
  }

  // ==========================================
  // AUTH ACTION 1: LOGIN STEP 1
  // ==========================================
  Future<void> _handleLoginStep1() async {
    if (_identifierController.text.trim().isEmpty || _passwordController.text.isEmpty) {
      setState(() => _errorMessage = 'Please enter your login identifier and password.');
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
      _successMessage = null;
    });

    try {
      final res = await ApiService.instance.post('/auth/login', {
        'identifier': _identifierController.text.trim(),
        'password': _passwordController.text,
        'clientType': 'MOBILE',
      });

      final data = res['data'];
      if (data != null && data['requires2FA'] == true) {
        setState(() {
          _currentView = LoginView.otp;
          _tempToken = data['tempToken'];
          _maskedTarget = data['maskedPhone'] ?? data['maskedEmail'];
        });
      }
    } catch (e) {
      final errStr = e.toString().replaceAll('Exception: ', '');
      if (errStr.contains('PENDING')) {
        _showPendingApprovalDialog();
      } else {
        setState(() => _errorMessage = errStr);
      }
    } finally {
      setState(() => _isLoading = false);
    }
  }

  // ==========================================
  // AUTH ACTION 2: VERIFY 2FA
  // ==========================================
  Future<void> _handleVerify2FA() async {
    if (_otpController.text.trim().length != 6) {
      setState(() => _errorMessage = 'Please enter the complete 6-digit OTP code.');
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final res = await ApiService.instance.post('/auth/verify-2fa', {
        'tempToken': _tempToken,
        'otp': _otpController.text.trim(),
        'deviceDetails': {
          'deviceId': 'flutter-mobile-device',
          'deviceModel': 'Mobile App Client',
          'appVersion': '1.0.0',
        }
      });

      final data = res['data'];
      final user = data['user'];

      await ApiService.instance.saveSession(
        accessToken: data['accessToken'],
        refreshToken: data['refreshToken'],
        userCode: user['userCode'] ?? '',
        role: user['role'] ?? '',
        schoolCode: user['schoolCode'] ?? '',
        fullName: user['fullName'] ?? '',
        schoolName: user['schoolName'] ?? 'Vijay High school',
      );

      if (!mounted) return;
      if (user['role'] == AppConstants.roleParent) {
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(builder: (_) => const ParentHomeScreen()),
        );
      } else if (user['role'] == AppConstants.roleClassTeacher || user['role'] == AppConstants.roleSubjectTeacher) {
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(builder: (_) => const TeacherHomeScreen()),
        );
      } else if (user['role'] == AppConstants.roleDriver) {
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(builder: (_) => const DriverHomeScreen()),
        );
      } else {
        setState(() {
          _errorMessage = 'Administrative accounts must log in via the Web Dashboard.';
        });
      }
    } catch (e) {
      setState(() => _errorMessage = e.toString().replaceAll('Exception: ', ''));
    } finally {
      setState(() => _isLoading = false);
    }
  }

  // ==========================================
  // AUTH ACTION 3: FORGOT PASSWORD STEP 1
  // ==========================================
  Future<void> _handleForgotStep1() async {
    if (_forgotIdentifierController.text.trim().isEmpty) {
      setState(() => _errorMessage = 'Please enter your registered email, phone, or User ID.');
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
      _successMessage = null;
    });

    try {
      final res = await ApiService.instance.post('/auth/forgot-password', {
        'identifier': _forgotIdentifierController.text.trim(),
      });

      setState(() {
        _forgotOtpSent = true;
        _resetToken = res['data']?['resetToken'];
        _successMessage = res['message'] ?? 'Password reset verification code dispatched.';
      });
    } catch (e) {
      setState(() => _errorMessage = e.toString().replaceAll('Exception: ', ''));
    } finally {
      setState(() => _isLoading = false);
    }
  }

  // ==========================================
  // AUTH ACTION 4: FORGOT PASSWORD STEP 2 (RESET)
  // ==========================================
  Future<void> _handleForgotStep2() async {
    if (_forgotOtpController.text.trim().length != 6) {
      setState(() => _errorMessage = 'Please enter the 6-digit reset code.');
      return;
    }
    if (_newPasswordController.text.length < 8) {
      setState(() => _errorMessage = 'Password must be at least 8 characters.');
      return;
    }
    if (_newPasswordController.text != _confirmPasswordController.text) {
      setState(() => _errorMessage = 'Passwords do not match.');
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final res = await ApiService.instance.post('/auth/reset-password', {
        'resetToken': _resetToken,
        'otp': _forgotOtpController.text.trim(),
        'newPassword': _newPasswordController.text,
      });

      _setView(LoginView.login);
      setState(() {
        _successMessage = res['message'] ?? 'Password reset successful! You can now sign in.';
        _forgotOtpSent = false;
        _forgotIdentifierController.clear();
        _forgotOtpController.clear();
        _newPasswordController.clear();
        _confirmPasswordController.clear();
      });
    } catch (e) {
      setState(() => _errorMessage = e.toString().replaceAll('Exception: ', ''));
    } finally {
      setState(() => _isLoading = false);
    }
  }

  // ==========================================
  // AUTH ACTION 5: REGISTER NEW USER
  // ==========================================
  Future<void> _handleRegister() async {
    if (_regSchoolCodeController.text.trim().isEmpty) {
      setState(() => _errorMessage = 'School code is required (e.g. SSC-SCH-1001).');
      return;
    }
    if (_regFullNameController.text.trim().isEmpty) {
      setState(() => _errorMessage = 'Full Name is required.');
      return;
    }
    if (_regEmailController.text.trim().isEmpty) {
      setState(() => _errorMessage = 'Email address is required.');
      return;
    }
    if (_regPhoneController.text.trim().isEmpty) {
      setState(() => _errorMessage = 'Phone number is required.');
      return;
    }
    if (_regPasswordController.text.length < 8) {
      setState(() => _errorMessage = 'Password must be at least 8 characters long.');
      return;
    }
    if (_regPasswordController.text != _regConfirmPasswordController.text) {
      setState(() => _errorMessage = 'Passwords do not match.');
      return;
    }

    if (_selectedRole == AppConstants.roleParent) {
      if (_admissionNoController.text.trim().isEmpty) {
        setState(() => _errorMessage = 'Student admission number is required.');
        return;
      }
      if (_childNameController.text.trim().isEmpty) {
        setState(() => _errorMessage = 'Child full name is required.');
        return;
      }
      if (!_consentAccepted) {
        setState(() => _errorMessage = 'Parental consent acceptance is required.');
        return;
      }
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final Map<String, dynamic> payload = {
        'schoolCode': _regSchoolCodeController.text.trim().toUpperCase(),
        'role': _selectedRole,
        'fullName': _regFullNameController.text.trim(),
        'email': _regEmailController.text.trim().toLowerCase(),
        'phone': _regPhoneController.text.trim(),
        'password': _regPasswordController.text,
      };

      if (_selectedRole == AppConstants.roleParent) {
        payload['studentAdmissionNumber'] = _admissionNoController.text.trim();
        payload['childFullName'] = _childNameController.text.trim();
        payload['childGrade'] = _gradeController.text.trim();
        payload['childSection'] = _sectionController.text.trim().toUpperCase();
        payload['relationship'] = _relationship;
        payload['consentAccepted'] = true;
      }

      final res = await ApiService.instance.post('/auth/register', payload);

      setState(() {
        _lastRegisteredUser = {
          'fullName': _regFullNameController.text.trim(),
          'email': _regEmailController.text.trim(),
          'phone': _regPhoneController.text.trim(),
          'role': _selectedRole,
          'schoolCode': _regSchoolCodeController.text.trim().toUpperCase(),
          'childName': _childNameController.text.trim(),
          'admissionNo': _admissionNoController.text.trim(),
          ...?(res['data'] is Map<String, dynamic> ? res['data'] : null),
        };
        _currentView = LoginView.registrationSuccess;
      });
    } catch (e) {
      setState(() => _errorMessage = e.toString().replaceAll('Exception: ', ''));
    } finally {
      setState(() => _isLoading = false);
    }
  }

  // ==========================================
  // AUTH ACTION 6: CHECK REGISTRATION STATUS
  // ==========================================
  Future<void> _handleCheckStatus() async {
    final query = _statusIdentifierController.text.trim();
    if (query.isEmpty) {
      setState(() => _errorMessage = 'Please enter your registered email, phone, or User Code.');
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
      _statusResult = null;
    });

    try {
      final res = await ApiService.instance.get('/auth/registration-status?identifier=${Uri.encodeComponent(query)}');
      setState(() {
        _statusResult = res['data'];
      });
    } catch (e) {
      setState(() => _errorMessage = e.toString().replaceAll('Exception: ', ''));
    } finally {
      setState(() => _isLoading = false);
    }
  }

  // Dialog shown when applicant logs in with PENDING status
  void _showPendingApprovalDialog() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Row(
          children: [
            Icon(Icons.hourglass_top_rounded, color: Color(0xFFF59E0B), size: 28),
            SizedBox(width: 8),
            Text('Approval Pending', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          ],
        ),
        content: const Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Your registration application is currently under review by the School Administrator.',
              style: TextStyle(fontSize: 14, color: Color(0xFF334155)),
            ),
            SizedBox(height: 12),
            Text(
              'Once verified, your official Serial Identity Code (e.g. SSC-SCH-1001-PAR-001) will be generated and you will be able to log in.',
              style: TextStyle(fontSize: 13, color: Color(0xFF64748B)),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('OK'),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.of(ctx).pop();
              _statusIdentifierController.text = _identifierController.text.trim();
              _setView(LoginView.checkStatus);
              _handleCheckStatus();
            },
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF0284C7)),
            child: const Text('Check Status', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  // ==========================================
  // MAIN BUILD METHOD
  // ==========================================
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 20.0),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // App Logo & Header
                Center(
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(16),
                    child: Image.asset(
                      'assets/logo.png',
                      height: 75,
                      width: 75,
                      fit: BoxFit.contain,
                      errorBuilder: (context, error, stackTrace) => Container(
                        width: 68,
                        height: 68,
                        decoration: BoxDecoration(
                          color: const Color(0xFF0284C7).withValues(alpha: 0.12),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(
                          Icons.shield_outlined,
                          size: 36,
                          color: Color(0xFF0284C7),
                        ),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                const Text(
                  'School Safe Connect',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF0F172A),
                    letterSpacing: -0.5,
                  ),
                ),
                const SizedBox(height: 4),
                const Text(
                  'Safety, Transport & Class Portal',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 13, color: Color(0xFF64748B)),
                ),
                const SizedBox(height: 24),

                // Error Banner (Auto-dismisses in 4.5s + X close button)
                if (_errorMessage != null) ...[
                  Builder(builder: (_) {
                    _ensureBannerAutoDismiss();
                    return Container(
                      margin: const EdgeInsets.only(bottom: 16),
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFEF2F2),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: const Color(0xFFFCA5A5)),
                      ),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.center,
                        children: [
                          const Icon(Icons.error_outline, color: Color(0xFFB91C1C), size: 18),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              _errorMessage!,
                              style: const TextStyle(color: Color(0xFFB91C1C), fontSize: 13),
                            ),
                          ),
                          IconButton(
                            icon: const Icon(Icons.close, color: Color(0xFFB91C1C), size: 18),
                            padding: EdgeInsets.zero,
                            constraints: const BoxConstraints(),
                            tooltip: 'Dismiss',
                            onPressed: () {
                              _bannerAutoDismissTimer?.cancel();
                              setState(() => _errorMessage = null);
                            },
                          ),
                        ],
                      ),
                    );
                  }),
                ],

                // Success Banner (Auto-dismisses in 4.5s + X close button)
                if (_successMessage != null) ...[
                  Builder(builder: (_) {
                    _ensureBannerAutoDismiss();
                    return Container(
                      margin: const EdgeInsets.only(bottom: 16),
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF0FDF4),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: const Color(0xFF86EFAC)),
                      ),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.center,
                        children: [
                          const Icon(Icons.check_circle_outline, color: Color(0xFF15803D), size: 18),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              _successMessage!,
                              style: const TextStyle(color: Color(0xFF15803D), fontSize: 13),
                            ),
                          ),
                          IconButton(
                            icon: const Icon(Icons.close, color: Color(0xFF15803D), size: 18),
                            padding: EdgeInsets.zero,
                            constraints: const BoxConstraints(),
                            tooltip: 'Dismiss',
                            onPressed: () {
                              _bannerAutoDismissTimer?.cancel();
                              setState(() => _successMessage = null);
                            },
                          ),
                        ],
                      ),
                    );
                  }),
                ],

                // Active View Container
                Container(
                  padding: const EdgeInsets.all(22),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.04),
                        blurRadius: 16,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: _buildCurrentView(),
                ),

                const SizedBox(height: 20),
                const Text(
                  'Multi-Tenant School Safety Platform\nContinuous Identity & Forensic Watermarking Protection',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 11, color: Color(0xFF94A3B8)),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildCurrentView() {
    switch (_currentView) {
      case LoginView.login:
        return _buildCredentialsForm();
      case LoginView.otp:
        return _buildOtpForm();
      case LoginView.forgotPassword:
        return _buildForgotPasswordForm();
      case LoginView.register:
        return _buildRegisterForm();
      case LoginView.registrationSuccess:
        return _buildRegistrationSuccessView();
      case LoginView.checkStatus:
        return _buildCheckStatusView();
    }
  }

  // ==========================================
  // VIEW 1: LOGIN FORM
  // ==========================================
  Widget _buildCredentialsForm() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Text(
          'Sign In',
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF1E293B)),
        ),
        const SizedBox(height: 16),
        TextField(
          controller: _identifierController,
          decoration: InputDecoration(
            labelText: 'Phone, Email, or Serial ID',
            hintText: 'e.g. SSC-SCH-1001-PAR-001 or parent@email.com',
            prefixIcon: const Icon(Icons.person_outline, size: 20),
            filled: true,
            fillColor: const Color(0xFFF8FAFC),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
            ),
          ),
        ),
        const SizedBox(height: 14),
        TextField(
          controller: _passwordController,
          obscureText: true,
          decoration: InputDecoration(
            labelText: 'Password',
            prefixIcon: const Icon(Icons.lock_outline, size: 20),
            filled: true,
            fillColor: const Color(0xFFF8FAFC),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
            ),
          ),
        ),
        const SizedBox(height: 8),

        // Forgot Password Link
        Align(
          alignment: Alignment.centerRight,
          child: TextButton(
            onPressed: () => _setView(LoginView.forgotPassword),
            style: TextButton.styleFrom(visualDensity: VisualDensity.compact),
            child: const Text('Forgot Password?', style: TextStyle(fontSize: 12, color: Color(0xFF0284C7), fontWeight: FontWeight.w600)),
          ),
        ),
        const SizedBox(height: 12),

        // Submit Button
        SizedBox(
          height: 48,
          child: ElevatedButton(
            onPressed: _isLoading ? null : _handleLoginStep1,
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF0284C7),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              elevation: 0,
            ),
            child: _isLoading
                ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                : const Text('Continue with 2FA', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: Colors.white)),
          ),
        ),
        const SizedBox(height: 18),
        const Divider(),
        const SizedBox(height: 10),

        // Register New User Link
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Text("Don't have an account? ", style: TextStyle(fontSize: 13, color: Color(0xFF64748B))),
            GestureDetector(
              onTap: () => _setView(LoginView.register),
              child: const Text('Register Here', style: TextStyle(fontSize: 13, color: Color(0xFF0284C7), fontWeight: FontWeight.bold)),
            ),
          ],
        ),
        const SizedBox(height: 8),

        // Check Status Link
        Center(
          child: TextButton.icon(
            icon: const Icon(Icons.search, size: 16, color: Color(0xFF64748B)),
            label: const Text('Check Approval Status', style: TextStyle(fontSize: 12, color: Color(0xFF64748B))),
            onPressed: () => _setView(LoginView.checkStatus),
          ),
        ),
      ],
    );
  }

  // ==========================================
  // VIEW 2: 2FA OTP FORM
  // ==========================================
  Widget _buildOtpForm() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Text(
          'Security Verification',
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF1E293B)),
        ),
        const SizedBox(height: 8),
        Text(
          'Enter the 6-digit OTP code dispatched to ${_maskedTarget ?? "your registered contact"}.',
          style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
        ),
        const SizedBox(height: 20),
        TextField(
          controller: _otpController,
          keyboardType: TextInputType.number,
          maxLength: 6,
          textAlign: TextAlign.center,
          style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold, letterSpacing: 8),
          decoration: InputDecoration(
            counterText: '',
            hintText: '••••••',
            filled: true,
            fillColor: const Color(0xFFF8FAFC),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
            ),
          ),
        ),
        const SizedBox(height: 20),
        SizedBox(
          height: 48,
          child: ElevatedButton(
            onPressed: _isLoading ? null : _handleVerify2FA,
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF0284C7),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              elevation: 0,
            ),
            child: _isLoading
                ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                : const Text('Verify & Enter App', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: Colors.white)),
          ),
        ),
        const SizedBox(height: 12),
        TextButton(
          onPressed: () {
            _setView(LoginView.login);
            _otpController.clear();
          },
          child: const Text('Back to Sign In', style: TextStyle(fontSize: 12, color: Color(0xFF64748B))),
        ),
      ],
    );
  }

  // ==========================================
  // VIEW 3: FORGOT PASSWORD FORM
  // ==========================================
  Widget _buildForgotPasswordForm() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            IconButton(
              icon: const Icon(Icons.arrow_back, size: 20),
              onPressed: () => _setView(LoginView.login),
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(),
            ),
            const SizedBox(width: 8),
            const Text(
              'Reset Password',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF1E293B)),
            ),
          ],
        ),
        const SizedBox(height: 12),

        if (!_forgotOtpSent) ...[
          const Text(
            'Enter your registered email, phone number, or User ID to receive a verification reset code.',
            style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _forgotIdentifierController,
            decoration: InputDecoration(
              labelText: 'Email, Phone, or Serial ID',
              hintText: 'e.g. user@gmail.com',
              prefixIcon: const Icon(Icons.account_circle_outlined, size: 20),
              filled: true,
              fillColor: const Color(0xFFF8FAFC),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
            ),
          ),
          const SizedBox(height: 20),
          SizedBox(
            height: 48,
            child: ElevatedButton(
              onPressed: _isLoading ? null : _handleForgotStep1,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF0284C7),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
              child: _isLoading
                  ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                  : const Text('Send Reset Code', style: TextStyle(fontWeight: FontWeight.w600, color: Colors.white)),
            ),
          ),
        ] else ...[
          const Text(
            'Enter the 6-digit verification code received and choose your new password.',
            style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
          ),
          const SizedBox(height: 14),
          TextField(
            controller: _forgotOtpController,
            keyboardType: TextInputType.number,
            maxLength: 6,
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold, letterSpacing: 6),
            decoration: InputDecoration(
              labelText: '6-Digit Reset Code',
              counterText: '',
              filled: true,
              fillColor: const Color(0xFFF8FAFC),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _newPasswordController,
            obscureText: true,
            decoration: InputDecoration(
              labelText: 'New Password',
              prefixIcon: const Icon(Icons.lock_outline, size: 20),
              filled: true,
              fillColor: const Color(0xFFF8FAFC),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _confirmPasswordController,
            obscureText: true,
            decoration: InputDecoration(
              labelText: 'Confirm New Password',
              prefixIcon: const Icon(Icons.lock_outline, size: 20),
              filled: true,
              fillColor: const Color(0xFFF8FAFC),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
            ),
          ),
          const SizedBox(height: 20),
          SizedBox(
            height: 48,
            child: ElevatedButton(
              onPressed: _isLoading ? null : _handleForgotStep2,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF0284C7),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
              child: _isLoading
                  ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                  : const Text('Update Password & Sign In', style: TextStyle(fontWeight: FontWeight.w600, color: Colors.white)),
            ),
          ),
        ],

        const SizedBox(height: 12),
        Center(
          child: TextButton(
            onPressed: () => _setView(LoginView.login),
            child: const Text('Cancel & Return to Login', style: TextStyle(fontSize: 12, color: Color(0xFF64748B))),
          ),
        ),
      ],
    );
  }

  // ==========================================
  // VIEW 4: NEW USER REGISTRATION FORM
  // ==========================================
  Widget _buildRegisterForm() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            IconButton(
              icon: const Icon(Icons.arrow_back, size: 20),
              onPressed: () => _setView(LoginView.login),
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(),
            ),
            const SizedBox(width: 8),
            const Text(
              'New User Registration',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF1E293B)),
            ),
          ],
        ),
        const SizedBox(height: 6),
        const Text(
          'Register for school safety access. Approval request will be sent to the School Admin.',
          style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
        ),
        const SizedBox(height: 16),

        // Role Selector Chips
        const Text('SELECT YOUR ROLE', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF475569))),
        const SizedBox(height: 8),
        Row(
          children: [
            _buildRoleChip(AppConstants.roleParent, 'Parent / Guardian', Icons.family_restroom),
            const SizedBox(width: 6),
            _buildRoleChip(AppConstants.roleClassTeacher, 'Teacher', Icons.school),
            const SizedBox(width: 6),
            _buildRoleChip(AppConstants.roleDriver, 'Bus Driver', Icons.directions_bus),
          ],
        ),
        const SizedBox(height: 16),

        // School Code
        TextField(
          controller: _regSchoolCodeController,
          decoration: InputDecoration(
            labelText: 'School Code (Provided by School)',
            hintText: 'e.g. SSC-SCH-1001',
            prefixIcon: const Icon(Icons.business_outlined, size: 20),
            filled: true,
            fillColor: const Color(0xFFF8FAFC),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
          ),
        ),
        const SizedBox(height: 12),

        // Full Name
        TextField(
          controller: _regFullNameController,
          decoration: InputDecoration(
            labelText: 'Full Name',
            prefixIcon: const Icon(Icons.badge_outlined, size: 20),
            filled: true,
            fillColor: const Color(0xFFF8FAFC),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
          ),
        ),
        const SizedBox(height: 12),

        // Email
        TextField(
          controller: _regEmailController,
          keyboardType: TextInputType.emailAddress,
          decoration: InputDecoration(
            labelText: 'Email Address',
            prefixIcon: const Icon(Icons.email_outlined, size: 20),
            filled: true,
            fillColor: const Color(0xFFF8FAFC),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
          ),
        ),
        const SizedBox(height: 12),

        // Phone
        TextField(
          controller: _regPhoneController,
          keyboardType: TextInputType.phone,
          decoration: InputDecoration(
            labelText: 'Mobile Number',
            hintText: '+919876543210',
            prefixIcon: const Icon(Icons.phone_outlined, size: 20),
            filled: true,
            fillColor: const Color(0xFFF8FAFC),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
          ),
        ),
        const SizedBox(height: 12),

        // Password & Confirm
        TextField(
          controller: _regPasswordController,
          obscureText: true,
          decoration: InputDecoration(
            labelText: 'Create Password',
            prefixIcon: const Icon(Icons.lock_outline, size: 20),
            filled: true,
            fillColor: const Color(0xFFF8FAFC),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
          ),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _regConfirmPasswordController,
          obscureText: true,
          decoration: InputDecoration(
            labelText: 'Confirm Password',
            prefixIcon: const Icon(Icons.lock_outline, size: 20),
            filled: true,
            fillColor: const Color(0xFFF8FAFC),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
          ),
        ),

        // Parent Verification Fields
        if (_selectedRole == AppConstants.roleParent) ...[
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: const Color(0xFFF0FDF4),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: const Color(0xFFBBF7D0)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Row(
                  children: [
                    Icon(Icons.verified_user_outlined, size: 16, color: Color(0xFF16A34A)),
                    SizedBox(width: 6),
                    Text('Student Verification Details', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF166534))),
                  ],
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: _admissionNoController,
                  decoration: InputDecoration(
                    labelText: 'Student Admission No.',
                    hintText: 'e.g. ADM-2026-001',
                    filled: true,
                    fillColor: Colors.white,
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _childNameController,
                  decoration: InputDecoration(
                    labelText: 'Child Full Name',
                    filled: true,
                    fillColor: Colors.white,
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _gradeController,
                        decoration: InputDecoration(
                          labelText: 'Grade / Class',
                          hintText: '6',
                          filled: true,
                          fillColor: Colors.white,
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: TextField(
                        controller: _sectionController,
                        decoration: InputDecoration(
                          labelText: 'Section',
                          hintText: 'A',
                          filled: true,
                          fillColor: Colors.white,
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                DropdownButtonFormField<String>(
                  value: _relationship,
                  items: const [
                    DropdownMenuItem(value: 'MOTHER', child: Text('Mother')),
                    DropdownMenuItem(value: 'FATHER', child: Text('Father')),
                    DropdownMenuItem(value: 'LEGAL_GUARDIAN', child: Text('Legal Guardian')),
                  ],
                  onChanged: (val) {
                    if (val != null) setState(() => _relationship = val);
                  },
                  decoration: InputDecoration(
                    labelText: 'Relationship to Child',
                    filled: true,
                    fillColor: Colors.white,
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                ),
                const SizedBox(height: 8),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Checkbox(
                      value: _consentAccepted,
                      onChanged: (val) => setState(() => _consentAccepted = val ?? false),
                    ),
                    const Expanded(
                      child: Padding(
                        padding: EdgeInsets.only(top: 8.0),
                        child: Text(
                          'I confirm that I am the legal parent/guardian of this student and consent to identity verification and school safety communications.',
                          style: TextStyle(fontSize: 11, color: Color(0xFF334155)),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],

        const SizedBox(height: 20),

        // Submit Approval Request
        SizedBox(
          height: 48,
          child: ElevatedButton(
            onPressed: _isLoading ? null : _handleRegister,
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF0284C7),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            child: _isLoading
                ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                : const Text('Submit Approval Request', style: TextStyle(fontWeight: FontWeight.w600, color: Colors.white)),
          ),
        ),
        const SizedBox(height: 12),
        Center(
          child: TextButton(
            onPressed: () => _setView(LoginView.login),
            child: const Text('Already have an account? Sign In', style: TextStyle(fontSize: 13, color: Color(0xFF0284C7))),
          ),
        ),
      ],
    );
  }

  Widget _buildRoleChip(String role, String label, IconData icon) {
    final isSelected = _selectedRole == role;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _selectedRole = role),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
          decoration: BoxDecoration(
            color: isSelected ? const Color(0xFF0284C7) : const Color(0xFFF1F5F9),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(
              color: isSelected ? const Color(0xFF0284C7) : const Color(0xFFCBD5E1),
            ),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 18, color: isSelected ? Colors.white : const Color(0xFF475569)),
              const SizedBox(height: 4),
              Text(
                label,
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                  color: isSelected ? Colors.white : const Color(0xFF334155),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ==========================================
  // VIEW 5: REGISTRATION SUCCESS VIEW
  // ==========================================
  Widget _buildRegistrationSuccessView() {
    final reg = _lastRegisteredUser ?? {};
    final role = reg['role'] ?? 'USER';
    final roleDisplay = role == AppConstants.roleParent
        ? 'Parent / Guardian'
        : role == AppConstants.roleDriver
            ? 'Bus Driver'
            : 'Teacher';

    final exampleCode = role == AppConstants.roleParent
        ? '${reg['schoolCode'] ?? 'SSC-SCH-1001'}-PAR-XXX'
        : role == AppConstants.roleDriver
            ? '${reg['schoolCode'] ?? 'SSC-SCH-1001'}-DRV-XXX'
            : '${reg['schoolCode'] ?? 'SSC-SCH-1001'}-TCH-XXX';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Center(
          child: Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              color: const Color(0xFF22C55E).withValues(alpha: 0.15),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.check_circle_outline, color: Color(0xFF16A34A), size: 36),
          ),
        ),
        const SizedBox(height: 12),
        const Text(
          'Approval Request Submitted!',
          textAlign: TextAlign.center,
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
        ),
        const SizedBox(height: 6),
        const Text(
          'Your account is in PENDING status awaiting verification and approval by the School Administrator.',
          textAlign: TextAlign.center,
          style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
        ),
        const SizedBox(height: 16),

        // Serial Code Notice Card
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: const Color(0xFFEFF6FF),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFFBFDBFE)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Row(
                children: [
                  Icon(Icons.badge_outlined, size: 18, color: Color(0xFF1D4ED8)),
                  SizedBox(width: 6),
                  Text('Serial Identity Code Assignment', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF1E40AF))),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                'Upon School Admin approval, your unique serial code formatted as [$exampleCode] will be generated automatically and visible in your dashboard.',
                style: const TextStyle(fontSize: 12, color: Color(0xFF1E3A8A)),
              ),
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.info_outline, size: 14, color: Color(0xFF0284C7)),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        'School: ${reg['schoolCode'] ?? 'SSC-SCH-1001'} | Role: $roleDisplay',
                        style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF0369A1)),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),

        // Application Summary
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: const Color(0xFFF8FAFC),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Applicant: ${reg['fullName'] ?? ''}', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
              Text('Contact: ${reg['email'] ?? ''} | ${reg['phone'] ?? ''}', style: const TextStyle(fontSize: 11, color: Color(0xFF64748B))),
              if (reg['childName'] != null && reg['childName'].toString().isNotEmpty) ...[
                const SizedBox(height: 4),
                Text('Child: ${reg['childName']} (Adm: ${reg['admissionNo'] ?? ''})', style: const TextStyle(fontSize: 11, color: Color(0xFF0369A1))),
              ],
            ],
          ),
        ),
        const SizedBox(height: 20),

        // Action Buttons
        SizedBox(
          height: 46,
          child: ElevatedButton(
            onPressed: () => _setView(LoginView.login),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF0284C7),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            child: const Text('Return to Sign In', style: TextStyle(fontWeight: FontWeight.w600, color: Colors.white)),
          ),
        ),
        const SizedBox(height: 10),
        SizedBox(
          height: 42,
          child: OutlinedButton.icon(
            icon: const Icon(Icons.sync, size: 16),
            label: const Text('Check Approval Status'),
            onPressed: () {
              _statusIdentifierController.text = reg['email'] ?? '';
              _setView(LoginView.checkStatus);
              _handleCheckStatus();
            },
            style: OutlinedButton.styleFrom(
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
          ),
        ),
      ],
    );
  }

  // ==========================================
  // VIEW 6: CHECK APPROVAL STATUS VIEW
  // ==========================================
  Widget _buildCheckStatusView() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            IconButton(
              icon: const Icon(Icons.arrow_back, size: 20),
              onPressed: () => _setView(LoginView.login),
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(),
            ),
            const SizedBox(width: 8),
            const Text(
              'Application Status',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF1E293B)),
            ),
          ],
        ),
        const SizedBox(height: 6),
        const Text(
          'Check whether your School Administrator has verified and approved your serial identity code.',
          style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
        ),
        const SizedBox(height: 16),
        TextField(
          controller: _statusIdentifierController,
          decoration: InputDecoration(
            labelText: 'Registered Email or Phone',
            hintText: 'e.g. parent@email.com',
            prefixIcon: const Icon(Icons.search, size: 20),
            filled: true,
            fillColor: const Color(0xFFF8FAFC),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
          ),
        ),
        const SizedBox(height: 12),
        SizedBox(
          height: 46,
          child: ElevatedButton(
            onPressed: _isLoading ? null : _handleCheckStatus,
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF0284C7),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            child: _isLoading
                ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                : const Text('Check Status', style: TextStyle(fontWeight: FontWeight.w600, color: Colors.white)),
          ),
        ),

        if (_statusResult != null) ...[
          const SizedBox(height: 20),
          _buildStatusResultCard(_statusResult!),
        ],

        const SizedBox(height: 16),
        Center(
          child: TextButton(
            onPressed: () => _setView(LoginView.login),
            child: const Text('Back to Sign In', style: TextStyle(fontSize: 12, color: Color(0xFF64748B))),
          ),
        ),
      ],
    );
  }

  Widget _buildStatusResultCard(Map<String, dynamic> status) {
    final currentStatus = status['status'] ?? 'PENDING';
    final userCode = status['userCode'];
    final isApproved = currentStatus == 'ACTIVE' && userCode != null;
    final isPending = currentStatus == 'PENDING';

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isApproved ? const Color(0xFFF0FDF4) : const Color(0xFFFFFBEB),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isApproved ? const Color(0xFF86EFAC) : const Color(0xFFFDE68A),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                status['fullName'] ?? 'Applicant',
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: isApproved ? const Color(0xFF16A34A) : const Color(0xFFD97706),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  isApproved ? 'VERIFIED & ACTIVE' : 'PENDING APPROVAL',
                  style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text('Role: ${status['role'] ?? ''} | School: ${status['schoolCode'] ?? ''}', style: const TextStyle(fontSize: 12, color: Color(0xFF475569))),
          const SizedBox(height: 12),

          if (isApproved) ...[
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: const Color(0xFF22C55E)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('YOUR GENERATED SERIAL IDENTITY CODE:', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFF15803D))),
                  const SizedBox(height: 4),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        userCode,
                        style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF166534), letterSpacing: 1),
                      ),
                      IconButton(
                        icon: const Icon(Icons.copy, size: 18, color: Color(0xFF16A34A)),
                        tooltip: 'Copy Code',
                        onPressed: () {
                          Clipboard.setData(ClipboardData(text: userCode));
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('Identity code copied to clipboard!')),
                          );
                        },
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () {
                  _identifierController.text = userCode;
                  _setView(LoginView.login);
                },
                style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF16A34A)),
                child: const Text('Proceed to Sign In with Code', style: TextStyle(color: Colors.white)),
              ),
            ),
          ] else if (isPending) ...[
            const Row(
              children: [
                Icon(Icons.access_time, size: 16, color: Color(0xFFD97706)),
                SizedBox(width: 6),
                Expanded(
                  child: Text(
                    'Your application is in queue with the School Administrator. Your serial code will be generated as soon as your child record or staff credentials are confirmed.',
                    style: TextStyle(fontSize: 11, color: Color(0xFF92400E)),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}
