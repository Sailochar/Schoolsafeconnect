import 'package:flutter/material.dart';
import '../../core/api_service.dart';

class SosPanicScreen extends StatefulWidget {
  const SosPanicScreen({super.key});

  @override
  State<SosPanicScreen> createState() => _SosPanicScreenState();
}

class _SosPanicScreenState extends State<SosPanicScreen> {
  bool _isConfirming = false;
  bool _isTriggered = false;
  bool _isLoading = false;
  String? _alertCode;
  String? _incidentCode;
  final _remarksController = TextEditingController();

  Future<void> _handleTriggerSOS() async {
    setState(() {
      _isLoading = true;
    });

    try {
      final res = await ApiService.instance.post('/panic/trigger', {
        'remarks': _remarksController.text.trim().isEmpty ? 'Immediate SOS assistance requested.' : _remarksController.text.trim(),
        'location': {
          'latitude': 28.6139,
          'longitude': 77.2090,
          'addressText': 'School Campus / Transit Location'
        }
      });

      final panicData = res['data']['panicAlert'];
      final incidentData = res['data']['linkedIncident'];

      setState(() {
        _isTriggered = true;
        _isConfirming = false;
        _alertCode = panicData['alertCode'];
        _incidentCode = incidentData['incidentCode'];
      });
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to trigger SOS: ${e.toString()}'), backgroundColor: Colors.red),
      );
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Emergency Assistance (SOS)', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
        backgroundColor: const Color(0xFFDC2626),
        foregroundColor: Colors.white,
        elevation: 0,
      ),
      backgroundColor: const Color(0xFFFEF2F2),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (!_isTriggered) ...[
                const Text(
                  'Emergency Assistance Request',
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Color(0xFF991B1B)),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Triggering SOS immediately notifies the School Admin, Transport Coordinator, and designated Class Teacher with highest critical priority across In-App, Push, WhatsApp, and SMS.',
                  style: TextStyle(fontSize: 13, color: Color(0xFF7F1D1D), height: 1.4),
                ),
                const Spacer(),

                // Big Red SOS Button
                Center(
                  child: GestureDetector(
                    onTap: () {
                      setState(() {
                        _isConfirming = true;
                      });
                    },
                    child: Container(
                      width: 180,
                      height: 180,
                      decoration: BoxDecoration(
                        color: const Color(0xFFDC2626),
                        shape: BoxShape.circle,
                        boxShadow: [
                          BoxShadow(
                            color: const Color(0xFFDC2626).withOpacity(0.4),
                            blurRadius: 28,
                            spreadRadius: 8,
                          ),
                        ],
                      ),
                      child: const Center(
                        child: Text(
                          'SOS',
                          style: TextStyle(
                            fontSize: 48,
                            fontWeight: FontWeight.w900,
                            color: Colors.white,
                            letterSpacing: 2,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
                const Spacer(),

                // Confirmation Sheet
                if (_isConfirming)
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.1), blurRadius: 10)],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const Text(
                          'Confirm Critical Emergency Trigger',
                          style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Color(0xFF991B1B)),
                        ),
                        const SizedBox(height: 8),
                        TextField(
                          controller: _remarksController,
                          decoration: InputDecoration(
                            labelText: 'Emergency Details (Optional)',
                            hintText: 'e.g. Student injured on playground / transit delay',
                            filled: true,
                            fillColor: const Color(0xFFF8FAFC),
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                          ),
                        ),
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            Expanded(
                              child: TextButton(
                                onPressed: () => setState(() => _isConfirming = false),
                                child: const Text('Cancel', style: TextStyle(color: Color(0xFF64748B))),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: ElevatedButton(
                                onPressed: _isLoading ? null : _handleTriggerSOS,
                                style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFDC2626)),
                                child: _isLoading
                                    ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                                    : const Text('Confirm SOS', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
              ] else ...[
                // Triggered Confirmation State
                const Spacer(),
                const Icon(Icons.check_circle_outline, size: 80, color: Color(0xFF16A34A)),
                const SizedBox(height: 16),
                const Text(
                  'CRITICAL SOS ACTIVE',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: Color(0xFF16A34A)),
                ),
                const SizedBox(height: 8),
                Text(
                  'Emergency Alert ID: ${_alertCode ?? "Pending"}\nIncident ID: ${_incidentCode ?? "Pending"}\n\nSchool Admin and Emergency Response have been dispatched to your coordinates.',
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontSize: 13, color: Color(0xFF334155), height: 1.5),
                ),
                const Spacer(),
                ElevatedButton(
                  onPressed: () => Navigator.pop(context),
                  style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF0F172A), padding: const EdgeInsets.symmetric(vertical: 14)),
                  child: const Text('Return to Safety Dashboard', style: TextStyle(color: Colors.white)),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
