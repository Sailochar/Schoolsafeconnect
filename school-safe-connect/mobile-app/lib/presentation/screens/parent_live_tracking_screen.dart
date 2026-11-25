import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';
import '../../core/api_service.dart';

class ParentLiveTrackingScreen extends StatefulWidget {
  final String studentCode;
  final String studentName;

  const ParentLiveTrackingScreen({
    super.key,
    required this.studentCode,
    required this.studentName,
  });

  @override
  State<ParentLiveTrackingScreen> createState() => _ParentLiveTrackingScreenState();
}

class _ParentLiveTrackingScreenState extends State<ParentLiveTrackingScreen> {
  bool _isLoading = true;
  String? _errorMessage;
  Map<String, dynamic>? _trackingData;
  Timer? _refreshTimer;
  final MapController _mapController = MapController();

  bool _autoLockOnBus = false; // Default OFF: never shift map when user zooms/pans!
  bool _hasCenteredInitially = false;
  LatLng? _myPersonLocation;

  @override
  void initState() {
    super.initState();
    _fetchBusLocation();
    _refreshTimer = Timer.periodic(const Duration(seconds: 5), (_) => _fetchBusLocation());
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    super.dispose();
  }

  Future<void> _fetchBusLocation() async {
    try {
      final res = await ApiService.instance.get(
        '/transport/parent/student/${widget.studentCode}/location',
      );
      if (mounted) {
        final data = res['data'];
        setState(() {
          _trackingData = data;
          _errorMessage = null;
          _isLoading = false;
        });

        final loc = data?['location'];
        if (loc != null && loc['latitude'] != null && loc['longitude'] != null) {
          final busPt = LatLng((loc['latitude'] as num).toDouble(), (loc['longitude'] as num).toDouble());
          if (!_hasCenteredInitially) {
            _hasCenteredInitially = true;
            Future.delayed(const Duration(milliseconds: 250), () {
              if (mounted) {
                try {
                  _mapController.move(busPt, 13.5);
                } catch (_) {}
              }
            });
          } else if (_autoLockOnBus) {
            try {
              _mapController.move(busPt, _mapController.camera.zoom);
            } catch (_) {}
          }
        }
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

  Future<void> _findMyCurrentLocation() async {
    try {
      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied || permission == LocationPermission.deniedForever) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Please allow Location permission to see your current location.')),
          );
        }
        return;
      }

      final pos = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
        timeLimit: const Duration(seconds: 6),
      );
      final pt = LatLng(pos.latitude, pos.longitude);
      if (mounted) {
        setState(() {
          _myPersonLocation = pt;
          _autoLockOnBus = false;
        });
        try {
          _mapController.move(pt, 14.5);
        } catch (_) {}
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Unable to read current device location.')),
        );
      }
    }
  }

  List<LatLng> _extractRoutePoints(Map<String, dynamic>? route) {
    final pts = <LatLng>[];
    if (route == null) return pts;

    final start = route['startLocation']?['coordinates'];
    if (start is List && start.length == 2) {
      pts.add(LatLng((start[1] as num).toDouble(), (start[0] as num).toDouble()));
    }
    final stops = route['stops'];
    if (stops is List) {
      final sorted = List<Map<String, dynamic>>.from(
        stops.whereType<Map>().map((e) => Map<String, dynamic>.from(e)),
      )..sort((a, b) => ((a['sequenceOrder'] ?? 0) as num).compareTo((b['sequenceOrder'] ?? 0) as num));
      for (final s in sorted) {
        final c = s['coordinates'];
        if (c is List && c.length == 2) {
          pts.add(LatLng((c[1] as num).toDouble(), (c[0] as num).toDouble()));
        }
      }
    }
    final end = route['endLocation']?['coordinates'];
    if (end is List && end.length == 2) {
      pts.add(LatLng((end[1] as num).toDouble(), (end[0] as num).toDouble()));
    }
    return pts;
  }

  List<LatLng> _extractTrailPoints(dynamic rawTrail) {
    if (rawTrail is! List) return [];
    final pts = <LatLng>[];
    for (final p in rawTrail) {
      if (p is List && p.length == 2) {
        pts.add(LatLng((p[0] as num).toDouble(), (p[1] as num).toDouble()));
      }
    }
    return pts;
  }

  @override
  Widget build(BuildContext context) {
    final location = _trackingData?['location'];
    final trip = _trackingData?['trip'];
    final route = _trackingData?['route'];
    final stops = (route?['stops'] is List) ? (route['stops'] as List) : [];
    final delaySeconds = _trackingData?['configuredDelaySeconds'] ?? 30;
    final isLive = _trackingData?['isActive'] == true;
    final tripStatus = _trackingData?['tripStatus'] ?? trip?['status'] ?? 'SCHEDULED';

    final busLat = (location?['latitude'] as num?)?.toDouble() ?? 17.385044;
    final busLng = (location?['longitude'] as num?)?.toDouble() ?? 78.486671;
    final busPoint = LatLng(busLat, busLng);
    final routePoints = _extractRoutePoints(route != null ? Map<String, dynamic>.from(route) : null);
    final trailPoints = _extractTrailPoints(_trackingData?['trail']);

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: Text('Bus Tracking - ${widget.studentName}', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
        backgroundColor: Colors.white,
        foregroundColor: const Color(0xFF1E293B),
        elevation: 0,
        actions: [
          IconButton(
            onPressed: _fetchBusLocation,
            icon: const Icon(Icons.sync, color: Color(0xFF2563EB)),
            tooltip: 'Refresh GPS location',
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _errorMessage != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24.0),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.directions_bus_filled_outlined, size: 64, color: Colors.blueGrey),
                        const SizedBox(height: 16),
                        Text(
                          _errorMessage!,
                          textAlign: TextAlign.center,
                          style: const TextStyle(fontSize: 15, color: Color(0xFF475569)),
                        ),
                        const SizedBox(height: 24),
                        OutlinedButton.icon(
                          onPressed: () {
                            setState(() => _isLoading = true);
                            _fetchBusLocation();
                          },
                          icon: const Icon(Icons.refresh),
                          label: const Text('Retry'),
                        )
                      ],
                    ),
                  ),
                )
              : Column(
                  children: [
                    Container(
                      color: const Color(0xFFEFF6FF),
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                      child: Row(
                        children: [
                          const Icon(Icons.lock_clock, size: 16, color: Color(0xFF2563EB)),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              'Security Delay Active: Bus GPS delayed by ${delaySeconds}s for student transit safety.',
                              style: const TextStyle(fontSize: 11, color: Color(0xFF1E40AF), fontWeight: FontWeight.w600),
                            ),
                          ),
                        ],
                      ),
                    ),

                    // INTERACTIVE LIVE GPS MAP VIEW
                    Expanded(
                      flex: 5,
                      child: Container(
                        margin: const EdgeInsets.all(12),
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
                                initialCenter: busPoint,
                                initialZoom: 13.5,
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
                                if (trailPoints.length >= 2)
                                  PolylineLayer(
                                    polylines: [
                                      Polyline(
                                        points: trailPoints,
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
                                        width: 60,
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
                                        width: 64,
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
                                      final c = st['coordinates'];
                                      if (c is! List || c.length != 2) return null;
                                      return Marker(
                                        point: LatLng((c[1] as num).toDouble(), (c[0] as num).toDouble()),
                                        width: 24,
                                        height: 24,
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
                                    Marker(
                                      point: busPoint,
                                      width: 46,
                                      height: 46,
                                      child: Container(
                                        decoration: BoxDecoration(
                                          color: isLive
                                              ? (tripStatus == 'DELAYED' ? const Color(0xFFDC2626) : const Color(0xFF2563EB))
                                              : const Color(0xFF64748B),
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

                            Positioned(
                              top: 10,
                              left: 10,
                              right: 10,
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                                    decoration: BoxDecoration(
                                      color: Colors.white.withValues(alpha: 0.95),
                                      borderRadius: BorderRadius.circular(14),
                                      boxShadow: const [BoxShadow(color: Colors.black12, blurRadius: 4)],
                                    ),
                                    child: Text(
                                      '${busLat.toStringAsFixed(4)}, ${busLng.toStringAsFixed(4)} • ${location?['speedKmph'] ?? 0} km/h',
                                      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                                    ),
                                  ),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                                    decoration: BoxDecoration(
                                      color: isLive
                                          ? (tripStatus == 'DELAYED' ? const Color(0xFFDC2626) : const Color(0xFF16A34A))
                                          : const Color(0xFF475569),
                                      borderRadius: BorderRadius.circular(14),
                                    ),
                                    child: Text(
                                      tripStatus.toString(),
                                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 11),
                                    ),
                                  ),
                                ],
                              ),
                            ),

                            // Map Action Buttons: Bus Location, My Location, Fix/Free Pan Toggle
                            Positioned(
                              bottom: 10,
                              left: 10,
                              right: 10,
                              child: Wrap(
                                spacing: 6,
                                runSpacing: 6,
                                alignment: WrapAlignment.end,
                                children: [
                                  _mapControlBtn(
                                    label: '🚌 Bus Location',
                                    bg: Colors.white,
                                    fg: const Color(0xFF0369A1),
                                    onTap: () => _mapController.move(busPoint, 14.5),
                                  ),
                                  _mapControlBtn(
                                    label: '📍 My Location',
                                    bg: Colors.white,
                                    fg: const Color(0xFF7C3AED),
                                    onTap: _findMyCurrentLocation,
                                  ),
                                  _mapControlBtn(
                                    label: _autoLockOnBus ? '🔒 Fixed on Bus' : '🔓 Free Zoom',
                                    bg: _autoLockOnBus ? const Color(0xFF059669) : Colors.white,
                                    fg: _autoLockOnBus ? Colors.white : const Color(0xFF334155),
                                    onTap: () => setState(() => _autoLockOnBus = !_autoLockOnBus),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),

                    // Route & Stops Details Sheet
                    Expanded(
                      flex: 4,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
                        decoration: const BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.vertical(top: Radius.circular(22)),
                          boxShadow: [BoxShadow(color: Colors.black12, blurRadius: 8, offset: Offset(0, -2))],
                        ),
                        child: ListView(
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      'Bus: ${_trackingData?['registrationNumber'] ?? _trackingData?['busCode'] ?? 'School Transit'}',
                                      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                                    ),
                                    Text(
                                      'Route: ${_trackingData?['routeName'] ?? _trackingData?['routeCode'] ?? 'Main Route'}',
                                      style: const TextStyle(fontSize: 12, color: Color(0xFF0284C7), fontWeight: FontWeight.w600),
                                    ),
                                  ],
                                ),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFF1F5F9),
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: Text(
                                    _trackingData?['busCode'] ?? '',
                                    style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFF334155)),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 8),
                            Row(
                              children: [
                                const Icon(Icons.pin_drop, size: 18, color: Color(0xFF0D9488)),
                                const SizedBox(width: 6),
                                Expanded(
                                  child: Text(
                                    'Assigned Stop: ${_trackingData?['assignedStopName'] ?? 'Main Gate'}',
                                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF334155)),
                                  ),
                                ),
                              ],
                            ),
                            if (_trackingData?['driver'] != null) ...[
                              const SizedBox(height: 6),
                              Row(
                                children: [
                                  const Icon(Icons.sensors, size: 16, color: Color(0xFF16A34A)),
                                  const SizedBox(width: 6),
                                  Expanded(
                                    child: Text(
                                      'Driver GPS Feed: ${_trackingData!['driver']['fullName']} (${_trackingData!['driver']['userCode']})',
                                      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF15803D)),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                            if (route != null) ...[
                              const Divider(height: 18),
                              const Text('ROUTE PLACES & TIMINGS', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFF64748B))),
                              const SizedBox(height: 6),
                              _stopLine('START', route['startLocation']?['name'] ?? 'Origin', 'Origin', const Color(0xFF16A34A)),
                              ...stops.asMap().entries.map((entry) {
                                final idx = entry.key;
                                final st = entry.value;
                                return _stopLine(
                                  '${idx + 1}',
                                  st['stopName'] ?? 'Stop ${idx + 1}',
                                  'Pickup ${st['scheduledPickupTime'] ?? '-'} • Drop ${st['scheduledDropTime'] ?? '-'}',
                                  const Color(0xFF0284C7),
                                );
                              }),
                              _stopLine('END', route['endLocation']?['name'] ?? 'School Campus', 'Destination', const Color(0xFF0F172A)),
                            ],
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
    );
  }

  Widget _mapControlBtn({required String label, required Color bg, required Color fg, required VoidCallback onTap}) {
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

  Widget _stopLine(String badge, String name, String timeInfo, Color color) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Container(
            width: 38,
            padding: const EdgeInsets.symmetric(vertical: 2),
            alignment: Alignment.center,
            decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(5)),
            child: Text(badge, style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: color)),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(name, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF1E293B))),
          ),
          Text(timeInfo, style: const TextStyle(fontSize: 10, color: Color(0xFF64748B))),
        ],
      ),
    );
  }
}
