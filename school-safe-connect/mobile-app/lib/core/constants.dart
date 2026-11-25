import 'package:flutter/foundation.dart';

/**
 * Core Constants for School Safe Connect Mobile Application
 */

class AppConstants {
  static const String appName = 'School Safe Connect';
  static String get apiBaseUrl => (kIsWeb || defaultTargetPlatform == TargetPlatform.windows)
      ? 'http://localhost:5000/api/v1'
      : 'http://10.0.2.2:5000/api/v1';
  static String get socketUrl => (kIsWeb || defaultTargetPlatform == TargetPlatform.windows)
      ? 'http://localhost:5000'
      : 'http://10.0.2.2:5000';

  // Role Constants
  static const String roleParent = 'PARENT';
  static const String roleClassTeacher = 'CLASS_TEACHER';
  static const String roleSubjectTeacher = 'SUBJECT_TEACHER';
  static const String roleDriver = 'DRIVER';

  // Storage Keys
  static const String keyAccessToken = 'ssc_access_token';
  static const String keyRefreshToken = 'ssc_refresh_token';
  static const String keyUserRole = 'ssc_user_role';
  static const String keyUserCode = 'ssc_user_code';
  static const String keySchoolCode = 'ssc_school_code';
  static const String keyUserFullName = 'ssc_user_fullname';
}
