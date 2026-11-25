import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';
import '../../core/api_service.dart';
import 'sos_panic_screen.dart';
import 'login_screen.dart';
import '../widgets/school_welcome_greeting.dart';

class DriverHomeScreen extends StatefulWidget {
  const DriverHomeScreen({super.key});

  @override
  State<DriverHomeScreen> createState() => _DriverHomeScreenState();
}

class _DriverHomeScreenState extends State<DriverHomeScreen> {
  bool _isLoading = true;
  bool _hasShownGreeting = false;
  String? _errorMessage;
  String? _gpsNotice;
  Timer? _noticeAutoDismissTimer;
  String? _lastNoticeKey;
  String? _driverUserCode;
  String? _driverFullName;
  String? _driverSchoolCode;
  String? _driverSchoolName;

  Map<String, dynamic>? _assignedBus;
  Map<String, dynamic>? _assignedRoute;
  bool _isTripActive = false;
  String? _activeTripId;
  String? _activeBusCode;
  String? _activeRouteCode;
  String _currentStatus = 'NOT_STARTED';
  String _gpsMode = 'MANUAL_OR_GPS'; // MANUAL_OR_GPS | DEVICE_GPS | ROUTE_SIM

  final MapController _mapController = MapController();
  Timer? _telemetryTimer;
  StreamSubscription<Position>? _gpsPositionStream;

  // Bus GPS Coordinates & User's Own Location
  double _lat = 17.4483;
  double _lng = 78.3915;
  double _speed = 0.0;
  double _accuracy = 6.0;
  int _pingsSent = 0;
  LatLng? _myPersonLocation;
  bool _autoLockMap = false; // Default OFF: user can freely zoom/pan without map snapping back!
  String _currentStopLabel = 'Route Origin';

  int _waypointIndex = 0;
  double _segmentProgress = 0.0;
  final List<LatLng> _liveTrail = [];

  @override
  void initState() {
    super.initState();
    _loadDriverAssignment();
  }

  @override
  void dispose() {
    _noticeAutoDismissTimer?.cancel();
    _telemetryTimer?.cancel();
    _gpsPositionStream?.cancel();
    super.dispose();
  }

  void _ensureNoticeAutoDismiss() {
    final key = '${_errorMessage ?? ''}|${_gpsNotice ?? ''}';
    if (key == '|') {
      _noticeAutoDismissTimer?.cancel();
      _lastNoticeKey = null;
      return;
    }
    if (key != _lastNoticeKey) {
      _lastNoticeKey = key;
      _noticeAutoDismissTimer?.cancel();
      _noticeAutoDismissTimer = Timer(const Duration(milliseconds: 4500), () {
        if (mounted) {
          setState(() {
            _errorMessage = null;
            _gpsNotice = null;
            _lastNoticeKey = null;
          });
        }
      });
    }
  }

  double _distanceKm(double lat1, double lon1, double lat2, double lon2) {
    const r = 6371.0;
    final dLat = (lat2 - lat1) * math.pi / 180.0;
    final dLon = (lon2 - lon1) * math.pi / 180.0;
    final a = math.sin(dLat / 2) * math.sin(dLat / 2) +
        math.cos(lat1 * math.pi / 180.0) *
            math.cos(lat2 * math.pi / 180.0) *
            math.sin(dLon / 2) *
            math.sin(dLon / 2);
    return r * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a));
  }

  List<LatLng> _extractRouteWaypoints(Map<String, dynamic>? route) {
    final points = <LatLng>[];
    if (route == null) return points;

    final startCoords = route['startLocation']?['coordinates'];
    if (startCoords is List && startCoords.length == 2) {
      points.add(LatLng((startCoords[1] as num).toDouble(), (startCoords[0] as num).toDouble()));
    }

    final stops = route['stops'];
    if (stops is List) {
      final sorted = List<Map<String, dynamic>>.from(
        stops.whereType<Map>().map((e) => Map<String, dynamic>.from(e)),
      )..sort((a, b) => ((a['sequenceOrder'] ?? 0) as num).compareTo((b['sequenceOrder'] ?? 0) as num));

      for (final s in sorted) {
        final c = s['coordinates'];
        if (c is List && c.length == 2) {
          points.add(LatLng((c[1] as num).toDouble(), (c[0] as num).toDouble()));
        }
      }
    }

    final endCoords = route['endLocation']?['coordinates'];
    if (endCoords is List && endCoords.length == 2) {
      points.add(LatLng((endCoords[1] as num).toDouble(), (endCoords[0] as num).toDouble()));
    }
    return points;
  }

  Future<void> _findMyCurrentLocation({bool alsoUpdateBus = false}) async {
    try {
      final serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Location services are disabled on this device.')),
          );
        }
        return;
      }

      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied || permission == LocationPermission.deniedForever) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Location permission denied. Tap any route stop or tap the map to set bus location.')),
          );
        }
        return;
      }

      final pos = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.bestForNavigation,
        timeLimit: const Duration(seconds: 6),
      );

      final myPt = LatLng(pos.latitude, pos.longitude);
      final waypoints = _extractRouteWaypoints(_assignedRoute);
      String? farNotice;
      if (waypoints.isNotEmpty) {
        final minDist = waypoints.map((w) => _distanceKm(myPt.latitude, myPt.longitude, w.latitude, w.longitude)).reduce(math.min);
        if (minDist > 60) {
          farNotice = 'Browser IP location is ${minDist.toStringAsFixed(0)} km from route. Tap "Set Here" on your current stop or tap map to pin exact bus GPS.';
        }
      }

      if (mounted) {
        setState(() {
          _myPersonLocation = myPt;
          _gpsNotice = farNotice;
        });

        if (alsoUpdateBus) {
          await _setBusLocationManually(
            pos.latitude,
            pos.longitude,
            label: 'Device GPS',
            resetTrail: true,
            centerOnce: true,
          );
        } else {
          try {
            _mapController.move(myPt, 14.5);
          } catch (_) {}
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not read device GPS. Tap a route stop or tap the map to set location.')),
        );
      }
    }
  }

  /// Directly sets the driver's bus GPS location (from Stop "Set Here", Map Tap, or Device GPS)
  /// and broadcasts it live immediately to School Admin & Parents.
  Future<void> _setBusLocationManually(
    double lat,
    double lng, {
    required String label,
    bool resetTrail = false,
    bool centerOnce = false,
  }) async {
    setState(() {
      _lat = double.parse(lat.toStringAsFixed(6));
      _lng = double.parse(lng.toStringAsFixed(6));
      _currentStopLabel = label;
      _gpsNotice = null;
      _gpsMode = 'MANUAL_OR_GPS';
      if (resetTrail) {
        _liveTrail
          ..clear()
          ..add(LatLng(_lat, _lng));
      } else {
        _liveTrail.add(LatLng(_lat, _lng));
      }
    });

    if (centerOnce) {
      try {
        _mapController.move(LatLng(_lat, _lng), 14.5);
      } catch (_) {}
    }

    if (_isTripActive && _activeTripId != null) {
      try {
        await ApiService.instance.post('/transport/telemetry/location', {
          'tripId': _activeTripId,
          'busCode': _activeBusCode,
          'routeCode': _activeRouteCode,
          'latitude': _lat,
          'longitude': _lng,
          'speedKmph': _speed,
          'accuracyMeters': 5.0,
          'deviceTimestamp': DateTime.now().toIso8601String(),
          'resetTrail': resetTrail,
          'visibleNow': true,
        });
        if (mounted) {
          setState(() => _pingsSent += 1);
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              backgroundColor: const Color(0xFF059669),
              duration: const Duration(seconds: 2),
              content: Text('Bus GPS updated to $label (${_lat.toStringAsFixed(4)}, ${_lng.toStringAsFixed(4)})'),
            ),
          );
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('GPS update error: ${e.toString().replaceAll('Exception: ', '')}')),
          );
        }
      }
    } else if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          duration: const Duration(seconds: 2),
          content: Text('Start position set to $label. Click "Start Morning Route" to broadcast live.'),
        ),
      );
    }
  }

  Future<void> _loadDriverAssignment() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });
    try {
      final code = await ApiService.instance.getUserCode();
      final name = await ApiService.instance.getFullName();
      final schoolCode = await ApiService.instance.getSchoolCode();
      final schoolName = await ApiService.instance.getSchoolName();

      if (!_hasShownGreeting && mounted) {
        _hasShownGreeting = true;
        SchoolWelcomeGreeting.show(
          context,
          schoolName: schoolName,
          userName: name ?? 'Driver',
          role: 'Transport Driver',
        );
      }

      Map<String, dynamic>? assignmentData;
      try {
        final res = await ApiService.instance.get('/transport/driver/assignment');
        assignmentData = res['data'];
      } catch (_) {}

      final bus = assignmentData?['bus'];
      final route = assignmentData?['route'];
      final activeTrip = assignmentData?['activeTrip'];
      final latestLoc = assignmentData?['latestLocation'];

      final routePts = _extractRouteWaypoints(route != null ? Map<String, dynamic>.from(route) : null);
      double initialLat = routePts.isNotEmpty ? routePts.first.latitude : _lat;
      double initialLng = routePts.isNotEmpty ? routePts.first.longitude : _lng;

      // Only restore latestLoc if it's reasonably near the route (prevents stale Hyderabad IP-jump from locking map)
      if (latestLoc != null && latestLoc['latitude'] != null && latestLoc['longitude'] != null) {
        final locLat = (latestLoc['latitude'] as num).toDouble();
        final locLng = (latestLoc['longitude'] as num).toDouble();
        if (routePts.isEmpty ||
            routePts.map((w) => _distanceKm(locLat, locLng, w.latitude, w.longitude)).reduce(math.min) < 80) {
          initialLat = locLat;
          initialLng = locLng;
        }
      }

      if (mounted) {
        setState(() {
          _driverUserCode = code;
          _driverFullName = name;
          _driverSchoolCode = schoolCode;
          _driverSchoolName = schoolName;
          _assignedBus = bus != null ? Map<String, dynamic>.from(bus) : null;
          _assignedRoute = route != null ? Map<String, dynamic>.from(route) : null;
          _activeBusCode = bus?['busCode'];
          _activeRouteCode = route?['routeCode'];
          _lat = initialLat;
          _lng = initialLng;
          _currentStopLabel = route?['startLocation']?['name'] ?? 'Route Origin';
          _liveTrail
            ..clear()
            ..add(LatLng(initialLat, initialLng));

          if (activeTrip != null) {
            _isTripActive = true;
            _activeTripId = activeTrip['tripId'];
            _activeBusCode = activeTrip['busCode'] ?? _activeBusCode;
            _activeRouteCode = activeTrip['routeCode'] ?? _activeRouteCode;
            _currentStatus = activeTrip['status'] ?? 'IN_TRANSIT';
            _startTelemetryLoop();
          } else {
            _isTripActive = false;
            _activeTripId = null;
            _currentStatus = 'NOT_STARTED';
          }
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = e.toString().replaceAll('Exception: ', '');
          _isLoading = false;
        });
      }
    }
  }

  void _startTelemetryLoop() {
    _telemetryTimer?.cancel();
    _telemetryTimer = Timer.periodic(const Duration(seconds: 5), (_) => _sendTelemetry());
  }

  Future<void> _startTrip({String tripType = 'MORNING_PICKUP'}) async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final payload = <String, dynamic>{
        'tripType': tripType,
        'initialLocation': {
          'latitude': _lat,
          'longitude': _lng,
        },
      };
      if (_activeBusCode != null && _activeBusCode!.isNotEmpty) {
        payload['busCode'] = _activeBusCode;
      }
      if (_activeRouteCode != null && _activeRouteCode!.isNotEmpty) {
        payload['routeCode'] = _activeRouteCode;
      }

      final res = await ApiService.instance.post('/transport/trips/start', payload);
      final tripData = res['data'];
      final returnedBus = tripData?['bus'];
      final returnedRoute = tripData?['route'];

      if (mounted) {
        setState(() {
          _isTripActive = true;
          _activeTripId = tripData?['tripId'];
          _activeBusCode = tripData?['busCode'] ?? _activeBusCode;
          _activeRouteCode = tripData?['routeCode'] ?? _activeRouteCode;
          if (returnedBus != null) _assignedBus = Map<String, dynamic>.from(returnedBus);
          if (returnedRoute != null) _assignedRoute = Map<String, dynamic>.from(returnedRoute);
          _currentStatus = tripData?['status'] ?? 'IN_TRANSIT';
          _pingsSent = 1;
          _liveTrail
            ..clear()
            ..add(LatLng(_lat, _lng));
          _isLoading = false;
        });

        _startTelemetryLoop();

        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            backgroundColor: Color(0xFF059669),
            content: Text('Trip started! Tap "Set Here" on any stop or tap map to update live bus location anytime.'),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = e.toString().replaceAll('Exception: ', '');
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _sendTelemetry({bool manualPing = false}) async {
    if (!_isTripActive || _activeTripId == null) return;

    if (_gpsMode == 'DEVICE_GPS') {
      try {
        final pos = await Geolocator.getCurrentPosition(
          desiredAccuracy: LocationAccuracy.high,
          timeLimit: const Duration(seconds: 3),
        );
        final waypoints = _extractRouteWaypoints(_assignedRoute);
        final tooFar = waypoints.isNotEmpty &&
            waypoints.map((w) => _distanceKm(pos.latitude, pos.longitude, w.latitude, w.longitude)).reduce(math.min) > 80;
        if (!tooFar) {
          _lat = double.parse(pos.latitude.toStringAsFixed(6));
          _lng = double.parse(pos.longitude.toStringAsFixed(6));
          _speed = pos.speed > 0 ? double.parse((pos.speed * 3.6).toStringAsFixed(1)) : 0.0;
          _accuracy = pos.accuracy > 0 ? pos.accuracy : 6.0;
        } else if (mounted && _gpsNotice == null) {
          setState(() {
            _gpsNotice = 'Device browser returned ISP IP location (>80km away). Tap "Set Here" on your stop or tap the map.';
          });
        }
      } catch (_) {}
    } else if (_gpsMode == 'ROUTE_SIM') {
      final waypoints = _extractRouteWaypoints(_assignedRoute);
      if (waypoints.length >= 2) {
        if (_waypointIndex >= waypoints.length - 1) {
          _waypointIndex = 0;
          _segmentProgress = 0.0;
        }
        final from = waypoints[_waypointIndex];
        final to = waypoints[_waypointIndex + 1];
        _segmentProgress += 0.20;
        if (_segmentProgress >= 1.0) {
          _segmentProgress = 0.0;
          _waypointIndex = (_waypointIndex + 1) % (waypoints.length - 1);
        }
        _lat = double.parse((from.latitude + (to.latitude - from.latitude) * _segmentProgress).toStringAsFixed(6));
        _lng = double.parse((from.longitude + (to.longitude - from.longitude) * _segmentProgress).toStringAsFixed(6));
        _speed = 28.5;
      }
    }

    try {
      await ApiService.instance.post('/transport/telemetry/location', {
        'tripId': _activeTripId,
        'busCode': _activeBusCode,
        'routeCode': _activeRouteCode,
        'latitude': _lat,
        'longitude': _lng,
        'speedKmph': _speed,
        'accuracyMeters': _accuracy,
        'deviceTimestamp': DateTime.now().toIso8601String(),
        'visibleNow': manualPing,
      });

      if (mounted) {
        setState(() {
          _pingsSent += 1;
          final pt = LatLng(_lat, _lng);
          if (_liveTrail.isEmpty || _liveTrail.last != pt) {
            _liveTrail.add(pt);
            if (_liveTrail.length > 40) _liveTrail.removeAt(0);
          }
        });
        // ONLY pan map if user explicitly enabled Lock/Fix on Bus! Never interrupt free zooming/panning!
        if (_autoLockMap) {
          try {
            _mapController.move(LatLng(_lat, _lng), _mapController.camera.zoom);
          } catch (_) {}
        }
      }
    } catch (_) {}
  }

  Future<void> _updateTripStatus(String status) async {
    if (_activeTripId == null) return;
    try {
      final body = <String, dynamic>{'status': status};
      if (status == 'DELAYED') {
        body['delayedByMinutes'] = 15;
        body['delayReason'] = 'Heavy traffic along school route';
      }

      await ApiService.instance.put('/transport/trips/$_activeTripId/status', body);

      if (status == 'COMPLETED') {
        _telemetryTimer?.cancel();
        setState(() {
          _isTripActive = false;
          _activeTripId = null;
          _currentStatus = 'COMPLETED';
        });
      } else {
        setState(() {
          _currentStatus = status;
        });
      }

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Trip status updated to $status')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Update failed: ${e.toString().replaceAll('Exception: ', '')}')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    _ensureNoticeAutoDismiss();
    final routePoints = _extractRouteWaypoints(_assignedRoute);
    final busCenter = LatLng(_lat, _lng);
    final stops = (_assignedRoute?['stops'] is List) ? (_assignedRoute!['stops'] as List) : [];

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        leading: Padding(
          padding: const EdgeInsets.all(8.0),
          child: Image.asset(
            'assets/logo.png',
            fit: BoxFit.contain,
            errorBuilder: (_, __, ___) => const Icon(Icons.directions_bus, color: Color(0xFF0284C7)),
          ),
        ),
        title: const Text('Driver Transit Console', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 17)),
        backgroundColor: Colors.white,
        foregroundColor: const Color(0xFF1E293B),
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: Color(0xFF0284C7)),
            tooltip: 'Reload Route & Bus Assignment',
            onPressed: _loadDriverAssignment,
          ),
          IconButton(
            icon: const Icon(Icons.emergency_outlined, color: Colors.red),
            tooltip: 'Transport SOS',
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const SosPanicScreen()),
            ),
          ),
          IconButton(
            icon: const Icon(Icons.logout),
            tooltip: 'Sign Out',
            onPressed: () async {
              _telemetryTimer?.cancel();
              await ApiService.instance.clearSession();
              if (context.mounted) {
                Navigator.of(context).pushReplacement(
                  MaterialPageRoute(builder: (_) => const LoginScreen()),
                );
              }
            },
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Driver Identity & Assigned Bus Card
                  Container(
                    margin: const EdgeInsets.only(bottom: 12),
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Row(
                              children: [
                                Container(
                                  padding: const EdgeInsets.all(6),
                                  decoration: BoxDecoration(color: const Color(0xFF0D9488).withValues(alpha: 0.12), shape: BoxShape.circle),
                                  child: const Icon(Icons.directions_bus, color: Color(0xFF0D9488), size: 18),
                                ),
                                const SizedBox(width: 8),
                                Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(_driverFullName ?? 'Fleet Driver', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                                    Text('${_driverSchoolName ?? 'Vijay High school'} • ${_driverUserCode ?? ''}', style: const TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                                  ],
                                ),
                              ],
                            ),
                            Row(
                              children: [
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                  decoration: BoxDecoration(color: const Color(0xFFDCFCE7), borderRadius: BorderRadius.circular(4)),
                                  child: const Text('VERIFIED DRIVER', style: TextStyle(color: Color(0xFF166534), fontSize: 9, fontWeight: FontWeight.bold)),
                                ),
                                IconButton(
                                  icon: const Icon(Icons.copy, size: 15, color: Color(0xFF0D9488)),
                                  onPressed: () {
                                    if (_driverUserCode != null) {
                                      Clipboard.setData(ClipboardData(text: _driverUserCode!));
                                      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Driver code copied!')));
                                    }
                                  },
                                ),
                              ],
                            ),
                          ],
                        ),
                        const Divider(height: 14),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Text('ASSIGNED BUS', style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: Color(0xFF64748B))),
                                  Text(
                                    _assignedBus != null
                                        ? '${_assignedBus!['registrationNumber']} (${_assignedBus!['busCode']})'
                                        : 'Auto-Assigned Bus',
                                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                                  ),
                                ],
                              ),
                            ),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.end,
                                children: [
                                  const Text('ASSIGNED ROUTE', style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: Color(0xFF64748B))),
                                  Text(
                                    _assignedRoute != null ? '${_assignedRoute!['routeName']}' : 'Default Campus Route',
                                    textAlign: TextAlign.end,
                                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF0284C7)),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),

                  if (_errorMessage != null)
                    Container(
                      margin: const EdgeInsets.only(bottom: 10),
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFEF2F2),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: const Color(0xFFFCA5A5)),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.error_outline, size: 16, color: Color(0xFFDC2626)),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              _errorMessage!,
                              style: const TextStyle(fontSize: 11, color: Color(0xFFB91C1C), fontWeight: FontWeight.w600),
                            ),
                          ),
                          InkWell(
                            onTap: () => setState(() => _errorMessage = null),
                            child: const Padding(
                              padding: EdgeInsets.all(2),
                              child: Icon(Icons.close, size: 16, color: Color(0xFFB91C1C)),
                            ),
                          ),
                        ],
                      ),
                    ),

                  if (_gpsNotice != null)
                    Container(
                      margin: const EdgeInsets.only(bottom: 10),
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFFFBEB),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: const Color(0xFFFCD34D)),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.info_outline, size: 16, color: Color(0xFFD97706)),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              _gpsNotice!,
                              style: const TextStyle(fontSize: 11, color: Color(0xFF92400E), fontWeight: FontWeight.w600),
                            ),
                          ),
                          InkWell(
                            onTap: () => setState(() => _gpsNotice = null),
                            child: const Padding(
                              padding: EdgeInsets.all(2),
                              child: Icon(Icons.close, size: 16, color: Color(0xFF92400E)),
                            ),
                          ),
                        ],
                      ),
                    ),

                  // INTERACTIVE LIVE GPS MAP (Tap map to pin bus location! Free zoom/pan by default!)
                  Container(
                    height: 310,
                    margin: const EdgeInsets.only(bottom: 14),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: const Color(0xFFCBD5E1)),
                    ),
                    clipBehavior: Clip.antiAlias,
                    child: Stack(
                      children: [
                        FlutterMap(
                          mapController: _mapController,
                          options: MapOptions(
                            initialCenter: busCenter,
                            initialZoom: 12.5,
                            onTap: (tapPos, latLng) {
                              _setBusLocationManually(
                                latLng.latitude,
                                latLng.longitude,
                                label: 'Pinned Map Location',
                                resetTrail: false,
                                centerOnce: false,
                              );
                            },
                          ),
                          children: [
                            TileLayer(
                              urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                              userAgentPackageName: 'com.schoolsafeconnect.app',
                            ),
                            if (routePoints.length >= 2)
                              PolylineLayer(
                                polylines: [
                                  Polyline(
                                    points: routePoints,
                                    strokeWidth: 4,
                                    color: const Color(0xFF0284C7).withValues(alpha: 0.75),
                                  ),
                                ],
                              ),
                            if (_liveTrail.length >= 2)
                              PolylineLayer(
                                polylines: [
                                  Polyline(
                                    points: _liveTrail,
                                    strokeWidth: 5,
                                    color: const Color(0xFF16A34A),
                                  ),
                                ],
                              ),
                            MarkerLayer(
                              markers: [
                                if (routePoints.isNotEmpty)
                                  Marker(
                                    point: routePoints.first,
                                    width: 64,
                                    height: 26,
                                    child: Container(
                                      alignment: Alignment.center,
                                      decoration: BoxDecoration(
                                        color: const Color(0xFF16A34A),
                                        borderRadius: BorderRadius.circular(12),
                                        border: Border.all(color: Colors.white, width: 2),
                                      ),
                                      child: const Text('START', style: TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.bold)),
                                    ),
                                  ),
                                if (routePoints.length >= 2)
                                  Marker(
                                    point: routePoints.last,
                                    width: 68,
                                    height: 26,
                                    child: Container(
                                      alignment: Alignment.center,
                                      decoration: BoxDecoration(
                                        color: const Color(0xFF0F172A),
                                        borderRadius: BorderRadius.circular(12),
                                        border: Border.all(color: Colors.white, width: 2),
                                      ),
                                      child: const Text('SCHOOL', style: TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.bold)),
                                    ),
                                  ),
                                ...stops.asMap().entries.map((entry) {
                                  final idx = entry.key;
                                  final st = entry.value;
                                  final coords = st['coordinates'];
                                  if (coords is! List || coords.length != 2) return null;
                                  return Marker(
                                    point: LatLng((coords[1] as num).toDouble(), (coords[0] as num).toDouble()),
                                    width: 26,
                                    height: 26,
                                    child: Container(
                                      alignment: Alignment.center,
                                      decoration: BoxDecoration(
                                        color: Colors.white,
                                        shape: BoxShape.circle,
                                        border: Border.all(color: const Color(0xFF0284C7), width: 2.5),
                                      ),
                                      child: Text('${idx + 1}', style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFF0284C7))),
                                    ),
                                  );
                                }).whereType<Marker>(),
                                if (_myPersonLocation != null)
                                  Marker(
                                    point: _myPersonLocation!,
                                    width: 96,
                                    height: 26,
                                    child: Container(
                                      alignment: Alignment.center,
                                      decoration: BoxDecoration(
                                        color: const Color(0xFF7C3AED),
                                        borderRadius: BorderRadius.circular(12),
                                        border: Border.all(color: Colors.white, width: 2),
                                      ),
                                      child: const Text('📍 My Location', style: TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.bold)),
                                    ),
                                  ),
                                // Live Bus Marker
                                Marker(
                                  point: busCenter,
                                  width: 44,
                                  height: 44,
                                  child: Container(
                                    decoration: BoxDecoration(
                                      color: _isTripActive ? const Color(0xFF2563EB) : const Color(0xFF64748B),
                                      shape: BoxShape.circle,
                                      border: Border.all(color: Colors.white, width: 3),
                                      boxShadow: const [BoxShadow(color: Colors.black26, blurRadius: 8)],
                                    ),
                                    child: const Icon(Icons.directions_bus, color: Colors.white, size: 22),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                        // Top GPS Info & Live Badge
                        Positioned(
                          top: 8,
                          left: 8,
                          right: 8,
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Flexible(
                                child: Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                                  decoration: BoxDecoration(
                                    color: Colors.white.withValues(alpha: 0.95),
                                    borderRadius: BorderRadius.circular(20),
                                    boxShadow: const [BoxShadow(color: Colors.black12, blurRadius: 4)],
                                  ),
                                  child: Text(
                                    '$_currentStopLabel • ${_lat.toStringAsFixed(4)}, ${_lng.toStringAsFixed(4)}',
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                                  ),
                                ),
                              ),
                              const SizedBox(width: 6),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
                                decoration: BoxDecoration(
                                  color: _isTripActive ? const Color(0xFF16A34A) : const Color(0xFF475569),
                                  borderRadius: BorderRadius.circular(20),
                                ),
                                child: Text(
                                  _isTripActive ? '● LIVE ($_pingsSent)' : 'STANDBY',
                                  style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
                                ),
                              ),
                            ],
                          ),
                        ),
                        // Bottom Map Controls: Bus Location, My Location, Fix/Free Pan Toggle
                        Positioned(
                          bottom: 10,
                          left: 10,
                          right: 10,
                          child: Wrap(
                            spacing: 6,
                            runSpacing: 6,
                            alignment: WrapAlignment.end,
                            children: [
                              _mapChip(
                                label: '🚌 Bus Location',
                                bg: Colors.white,
                                fg: const Color(0xFF0369A1),
                                onTap: () => _mapController.move(busCenter, 14.5),
                              ),
                              _mapChip(
                                label: '📍 My Location',
                                bg: Colors.white,
                                fg: const Color(0xFF7C3AED),
                                onTap: () => _findMyCurrentLocation(alsoUpdateBus: false),
                              ),
                              _mapChip(
                                label: _autoLockMap ? '🔒 Fixed on Bus' : '🔓 Free Zoom/Pan',
                                bg: _autoLockMap ? const Color(0xFF059669) : Colors.white,
                                fg: _autoLockMap ? Colors.white : const Color(0xFF334155),
                                onTap: () => setState(() => _autoLockMap = !_autoLockMap),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),

                  // Transit Controls & GPS Mode Selector
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: _isTripActive ? const Color(0xFF0F172A) : Colors.white,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: _isTripActive ? const Color(0xFF0F172A) : const Color(0xFFE2E8F0)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              _isTripActive ? 'ACTIVE TRIP • $_currentStatus' : 'READY TO START TRANSIT',
                              style: TextStyle(
                                color: _isTripActive ? Colors.greenAccent : const Color(0xFF64748B),
                                fontWeight: FontWeight.bold,
                                fontSize: 12,
                              ),
                            ),
                            Text(
                              'Tap map or stop below to update GPS',
                              style: TextStyle(color: _isTripActive ? Colors.white60 : const Color(0xFF64748B), fontSize: 10),
                            ),
                          ],
                        ),
                        const SizedBox(height: 10),
                        // 3 GPS Mode Chips
                        Wrap(
                          spacing: 6,
                          runSpacing: 6,
                          children: [
                            ChoiceChip(
                              label: const Text('📍 Pin / Stop GPS', style: TextStyle(fontSize: 11)),
                              selected: _gpsMode == 'MANUAL_OR_GPS',
                              onSelected: (_) => setState(() => _gpsMode = 'MANUAL_OR_GPS'),
                            ),
                            ChoiceChip(
                              label: const Text('📡 Real Device GPS', style: TextStyle(fontSize: 11)),
                              selected: _gpsMode == 'DEVICE_GPS',
                              onSelected: (_) async {
                                setState(() => _gpsMode = 'DEVICE_GPS');
                                await _findMyCurrentLocation(alsoUpdateBus: true);
                              },
                            ),
                            ChoiceChip(
                              label: const Text('🛣️ Route Auto-Drive', style: TextStyle(fontSize: 11)),
                              selected: _gpsMode == 'ROUTE_SIM',
                              onSelected: (_) => setState(() => _gpsMode = 'ROUTE_SIM'),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        if (!_isTripActive) ...[
                          Row(
                            children: [
                              Expanded(
                                child: ElevatedButton.icon(
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: const Color(0xFF2563EB),
                                    foregroundColor: Colors.white,
                                    padding: const EdgeInsets.symmetric(vertical: 14),
                                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                  ),
                                  onPressed: () => _startTrip(tripType: 'MORNING_PICKUP'),
                                  icon: const Icon(Icons.wb_sunny_outlined, size: 18),
                                  label: const Text('Start Morning Route', style: TextStyle(fontWeight: FontWeight.bold)),
                                ),
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: ElevatedButton.icon(
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: const Color(0xFF0D9488),
                                    foregroundColor: Colors.white,
                                    padding: const EdgeInsets.symmetric(vertical: 14),
                                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                  ),
                                  onPressed: () => _startTrip(tripType: 'AFTERNOON_DROP'),
                                  icon: const Icon(Icons.home_outlined, size: 18),
                                  label: const Text('Start Afternoon Drop', style: TextStyle(fontWeight: FontWeight.bold)),
                                ),
                              ),
                            ],
                          ),
                        ] else ...[
                          Wrap(
                            spacing: 8,
                            runSpacing: 8,
                            children: [
                              _statusButton('AT_PICKUP', 'At Pickup Stop'),
                              _statusButton('IN_TRANSIT', 'In Transit'),
                              _statusButton('DELAYED', 'Traffic Delay'),
                              _statusButton('AT_DROP', 'At Drop / School'),
                            ],
                          ),
                          const SizedBox(height: 14),
                          Row(
                            children: [
                              Expanded(
                                child: OutlinedButton.icon(
                                  style: OutlinedButton.styleFrom(
                                    foregroundColor: Colors.greenAccent,
                                    side: const BorderSide(color: Colors.greenAccent),
                                    padding: const EdgeInsets.symmetric(vertical: 12),
                                  ),
                                  onPressed: () => _sendTelemetry(manualPing: true),
                                  icon: const Icon(Icons.my_location, size: 16),
                                  label: const Text('Broadcast GPS Now'),
                                ),
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: ElevatedButton.icon(
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: const Color(0xFFDC2626),
                                    foregroundColor: Colors.white,
                                    padding: const EdgeInsets.symmetric(vertical: 12),
                                  ),
                                  onPressed: () => _updateTripStatus('COMPLETED'),
                                  icon: const Icon(Icons.stop, size: 16),
                                  label: const Text('Complete Trip'),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ],
                    ),
                  ),

                  if (_errorMessage != null)
                    Container(
                      margin: const EdgeInsets.only(top: 12),
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFEF2F2),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: const Color(0xFFFCA5A5)),
                      ),
                      child: Text(
                        _errorMessage!,
                        style: const TextStyle(color: Color(0xFFB91C1C), fontSize: 12, fontWeight: FontWeight.w600),
                        textAlign: TextAlign.center,
                      ),
                    ),

                  // ROUTE PLACES WITH ONE-TAP "SET HERE" TO UPDATE CURRENT BUS LOCATION!
                  if (_assignedRoute != null) ...[
                    const SizedBox(height: 16),
                    Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Route Places: ${_assignedRoute!['routeName']} (Tap "Set Here" to update live location)',
                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF0F172A)),
                          ),
                          const SizedBox(height: 10),
                          if (_assignedRoute!['startLocation']?['coordinates'] is List)
                            _routeStopRow(
                              'START',
                              _assignedRoute!['startLocation']?['name'] ?? 'Origin',
                              'Route Start',
                              const Color(0xFF16A34A),
                              (_assignedRoute!['startLocation']['coordinates'][1] as num).toDouble(),
                              (_assignedRoute!['startLocation']['coordinates'][0] as num).toDouble(),
                            ),
                          ...stops.asMap().entries.map((entry) {
                            final idx = entry.key;
                            final st = entry.value;
                            final coords = st['coordinates'];
                            if (coords is! List || coords.length != 2) return const SizedBox.shrink();
                            return _routeStopRow(
                              '${idx + 1}',
                              st['stopName'] ?? 'Stop ${idx + 1}',
                              'Pickup ${st['scheduledPickupTime'] ?? '-'} • Drop ${st['scheduledDropTime'] ?? '-'}',
                              const Color(0xFF0284C7),
                              (coords[1] as num).toDouble(),
                              (coords[0] as num).toDouble(),
                            );
                          }),
                          if (_assignedRoute!['endLocation']?['coordinates'] is List)
                            _routeStopRow(
                              'END',
                              _assignedRoute!['endLocation']?['name'] ?? 'School Campus',
                              'Destination',
                              const Color(0xFF0F172A),
                              (_assignedRoute!['endLocation']['coordinates'][1] as num).toDouble(),
                              (_assignedRoute!['endLocation']['coordinates'][0] as num).toDouble(),
                            ),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            ),
    );
  }

  Widget _mapChip({required String label, required Color bg, required Color fg, required VoidCallback onTap}) {
    return Material(
      color: bg.withValues(alpha: 0.95),
      borderRadius: BorderRadius.circular(18),
      elevation: 2,
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          child: Text(label, style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: fg)),
        ),
      ),
    );
  }

  Widget _routeStopRow(String badge, String title, String subtitle, Color color, double lat, double lng) {
    final isCurrent = _currentStopLabel == title;
    return Container(
      margin: const EdgeInsets.symmetric(vertical: 4),
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
      decoration: BoxDecoration(
        color: isCurrent ? const Color(0xFFECFDF5) : Colors.transparent,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: isCurrent ? const Color(0xFF10B981) : Colors.transparent),
      ),
      child: Row(
        children: [
          Container(
            width: 38,
            padding: const EdgeInsets.symmetric(vertical: 3),
            alignment: Alignment.center,
            decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(6)),
            child: Text(badge, style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: color)),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF1E293B))),
                Text('$subtitle • ${lat.toStringAsFixed(4)}, ${lng.toStringAsFixed(4)}', style: const TextStyle(fontSize: 10, color: Color(0xFF64748B))),
              ],
            ),
          ),
          TextButton.icon(
            onPressed: () => _setBusLocationManually(lat, lng, label: title, resetTrail: true, centerOnce: true),
            icon: const Icon(Icons.my_location, size: 14),
            label: Text(isCurrent ? 'Current ✓' : 'Set Here', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
            style: TextButton.styleFrom(
              foregroundColor: isCurrent ? const Color(0xFF059669) : const Color(0xFF0284C7),
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            ),
          ),
        ],
      ),
    );
  }

  Widget _statusButton(String status, String label) {
    final isSelected = _currentStatus == status;
    return ChoiceChip(
      label: Text(label, style: const TextStyle(fontSize: 12)),
      selected: isSelected,
      onSelected: (_) => _updateTripStatus(status),
      selectedColor: const Color(0xFFDBEAFE),
      labelStyle: TextStyle(
        color: isSelected ? const Color(0xFF1D4ED8) : const Color(0xFF334155),
        fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
      ),
    );
  }
}
