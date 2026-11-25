import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'constants.dart';

class ApiService {
  static final ApiService instance = ApiService._internal();
  ApiService._internal();

  final FlutterSecureStorage _storage = const FlutterSecureStorage();

  Future<String?> getToken() async {
    return await _storage.read(key: AppConstants.keyAccessToken);
  }

  Future<void> saveSession({
    required String accessToken,
    required String refreshToken,
    required String userCode,
    required String role,
    required String schoolCode,
    required String fullName,
    String? schoolName,
  }) async {
    await _storage.write(key: AppConstants.keyAccessToken, value: accessToken);
    await _storage.write(key: AppConstants.keyRefreshToken, value: refreshToken);
    await _storage.write(key: AppConstants.keyUserCode, value: userCode);
    await _storage.write(key: AppConstants.keyUserRole, value: role);
    await _storage.write(key: AppConstants.keySchoolCode, value: schoolCode);
    await _storage.write(key: AppConstants.keyUserFullName, value: fullName);
    if (schoolName != null && schoolName.isNotEmpty) {
      await _storage.write(key: 'user_school_name', value: schoolName);
    }
  }

  Future<void> clearSession() async {
    await _storage.deleteAll();
  }

  Future<String?> getUserCode() async {
    return await _storage.read(key: AppConstants.keyUserCode);
  }

  Future<String?> getUserRole() async {
    return await _storage.read(key: AppConstants.keyUserRole);
  }

  Future<String?> getSchoolCode() async {
    return await _storage.read(key: AppConstants.keySchoolCode);
  }

  Future<String> getSchoolName() async {
    final name = await _storage.read(key: 'user_school_name');
    if (name != null && name.trim().isNotEmpty && !name.startsWith('SSC-SCH-')) {
      return name;
    }
    return 'Vijay High school';
  }

  Future<String?> getFullName() async {
    return await _storage.read(key: AppConstants.keyUserFullName);
  }

  Future<Map<String, String>> _getHeaders() async {
    final token = await getToken();
    final headers = {
      'Content-Type': 'application/json',
      'X-Client-Type': 'MOBILE', // Strictly identify mobile app client
    };
    if (token != null) {
      headers['Authorization'] = 'Bearer $token';
    }
    return headers;
  }

  Future<Map<String, dynamic>> post(String endpoint, Map<String, dynamic> body) async {
    final headers = await _getHeaders();
    final response = await http.post(
      Uri.parse('${AppConstants.apiBaseUrl}$endpoint'),
      headers: headers,
      body: jsonEncode(body),
    );

    final data = jsonDecode(response.body);
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return data;
    } else {
      throw Exception(data['message'] ?? 'Network request failed: ${response.statusCode}');
    }
  }

  Future<Map<String, dynamic>> get(String endpoint) async {
    final headers = await _getHeaders();
    final response = await http.get(
      Uri.parse('${AppConstants.apiBaseUrl}$endpoint'),
      headers: headers,
    );

    final data = jsonDecode(response.body);
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return data;
    } else {
      throw Exception(data['message'] ?? 'Network request failed: ${response.statusCode}');
    }
  }

  Future<Map<String, dynamic>> put(String endpoint, [Map<String, dynamic>? body]) async {
    final headers = await _getHeaders();
    final response = await http.put(
      Uri.parse('${AppConstants.apiBaseUrl}$endpoint'),
      headers: headers,
      body: body != null ? jsonEncode(body) : null,
    );

    final data = jsonDecode(response.body);
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return data;
    } else {
      throw Exception(data['message'] ?? 'Network request failed: ${response.statusCode}');
    }
  }
}
