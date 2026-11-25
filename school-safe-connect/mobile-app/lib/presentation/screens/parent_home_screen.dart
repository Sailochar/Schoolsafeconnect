import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/api_service.dart';
import 'sos_panic_screen.dart';
import 'parent_live_tracking_screen.dart';
import 'login_screen.dart';
import '../widgets/school_welcome_greeting.dart';

class ParentHomeScreen extends StatefulWidget {
  const ParentHomeScreen({super.key});

  @override
  State<ParentHomeScreen> createState() => _ParentHomeScreenState();
}

class _ParentHomeScreenState extends State<ParentHomeScreen> {
  int _currentIndex = 0;
  bool _isLoading = true;
  bool _hasShownGreeting = false;
  String? _errorMessage;
  List<dynamic> _students = [];
  List<dynamic> _assignments = [];
  List<dynamic> _notices = [];
  Map<String, dynamic>? _timetableData;
  dynamic _selectedStudent;
  String? _parentUserCode;
  String? _parentFullName;
  String? _parentSchoolCode;
  String? _parentSchoolName;
  String _noticeFilter = 'ALL'; // ALL | EXAM | URGENT | ANNOUNCEMENT

  final TextEditingController _queryController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadParentData();
  }

  Future<void> _loadParentData() async {
    setState(() => _isLoading = true);
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
          userName: name ?? 'Parent',
          role: 'Parent',
        );
      }

      final studentsRes = await ApiService.instance.get('/students/my-children');
      final fetchedStudents = studentsRes['data']?['students'] ?? [];

      dynamic activeStudent = fetchedStudents.isNotEmpty ? fetchedStudents[0] : null;

      List<dynamic> assignments = [];
      List<dynamic> notices = [];
      Map<String, dynamic>? timetableData;

      if (activeStudent != null && activeStudent['classCode'] != null) {
        try {
          final assignRes = await ApiService.instance.get(
            '/assignments?classCode=${activeStudent['classCode']}',
          );
          assignments = assignRes['data']?['assignments'] ?? [];
        } catch (_) {}

        try {
          final noticeRes = await ApiService.instance.get(
            '/notices?classCode=${activeStudent['classCode']}',
          );
          notices = noticeRes['data']?['notices'] ?? [];
        } catch (_) {}

        try {
          final ttRes = await ApiService.instance.get('/timetable/my-schedule');
          if (ttRes['data'] is Map) {
            timetableData = Map<String, dynamic>.from(ttRes['data']);
          }
        } catch (_) {}
      }

      if (mounted) {
        setState(() {
          _parentUserCode = code;
          _parentFullName = name;
          _parentSchoolCode = schoolCode;
          _parentSchoolName = schoolName;
          _students = fetchedStudents;
          _selectedStudent = activeStudent;
          _assignments = assignments;
          _notices = notices;
          _timetableData = timetableData;
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

  Future<void> _markAssignmentViewed(String assignmentCode) async {
    if (_selectedStudent == null) return;
    try {
      await ApiService.instance.post('/assignments/$assignmentCode/viewed', {
        'studentCode': _selectedStudent['studentCode'],
      });
      await _loadParentData();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(backgroundColor: Color(0xFF059669), content: Text('Homework marked as viewed. Teacher updated!')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed: ${e.toString().replaceAll('Exception: ', '')}')),
        );
      }
    }
  }

  Future<void> _showAskTeacherDialog() async {
    if (_selectedStudent == null) return;
    List<dynamic> myQueries = [];
    try {
      final res = await ApiService.instance.get('/assignments/queries/my?studentCode=${_selectedStudent['studentCode']}');
      myQueries = res['data']?['queries'] ?? [];
    } catch (_) {}

    if (!mounted) return;
    String queryType = 'NORMAL';
    final subjectCtrl = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setModalState) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: const Text('Teacher Communication & Queries', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  '1 normal query/day allowed. Safety, Medical, Bullying, or Panic concerns bypass the daily limit.',
                  style: TextStyle(fontSize: 11, color: Colors.blueGrey),
                ),
                const SizedBox(height: 10),
                DropdownButtonFormField<String>(
                  value: queryType,
                  decoration: const InputDecoration(labelText: 'Query Category', isDense: true, border: OutlineInputBorder()),
                  items: const [
                    DropdownMenuItem(value: 'NORMAL', child: Text('Normal Query (1/day limit)')),
                    DropdownMenuItem(value: 'SAFETY', child: Text('Safety Concern (Bypasses Limit)')),
                    DropdownMenuItem(value: 'MEDICAL', child: Text('Medical Concern (Bypasses Limit)')),
                    DropdownMenuItem(value: 'BULLYING', child: Text('Bullying Report (Bypasses Limit)')),
                  ],
                  onChanged: (v) => setModalState(() => queryType = v ?? 'NORMAL'),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: subjectCtrl,
                  decoration: const InputDecoration(labelText: 'Subject', isDense: true, border: OutlineInputBorder()),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _queryController,
                  maxLines: 3,
                  decoration: const InputDecoration(hintText: 'Enter your query for the class teacher...', border: OutlineInputBorder()),
                ),
                if (myQueries.isNotEmpty) ...[
                  const Divider(height: 20),
                  const Text('Recent Queries & Teacher Replies:', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 6),
                  ...myQueries.take(3).map((q) => Container(
                        margin: const EdgeInsets.only(bottom: 8),
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF8FAFC),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: const Color(0xFFE2E8F0)),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('${q['queryType']} • ${q['status']}', style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFF0284C7))),
                            Text(q['message'] ?? '', style: const TextStyle(fontSize: 11)),
                            if (q['reply']?['message'] != null)
                              Padding(
                                padding: const EdgeInsets.only(top: 4),
                                child: Text('Teacher Reply: ${q['reply']['message']}', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF047857))),
                              ),
                            if (q['status'] != 'ESCALATED')
                              Align(
                                alignment: Alignment.centerRight,
                                child: TextButton(
                                  onPressed: () async {
                                    try {
                                      await ApiService.instance.post('/assignments/queries/${q['queryCode']}/escalate', {
                                        'reason': 'Unresolved safety concern escalated by parent',
                                      });
                                      if (mounted) {
                                        Navigator.of(ctx).pop();
                                        ScaffoldMessenger.of(context).showSnackBar(
                                          const SnackBar(backgroundColor: Color(0xFFDC2626), content: Text('Concern escalated directly to School Admin!')),
                                        );
                                      }
                                    } catch (_) {}
                                  },
                                  child: const Text('Escalate to School Admin', style: TextStyle(fontSize: 10, color: Color(0xFFDC2626))),
                                ),
                              ),
                          ],
                        ),
                      )),
                ],
              ],
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.of(ctx).pop(), child: const Text('Close')),
            ElevatedButton(
              onPressed: () async {
                if (_queryController.text.trim().isEmpty) return;
                try {
                  await ApiService.instance.post('/assignments/queries', {
                    'studentCode': _selectedStudent['studentCode'],
                    'classCode': _selectedStudent['classCode'],
                    'queryType': queryType,
                    'subject': subjectCtrl.text.trim().isEmpty ? 'Parent Query' : subjectCtrl.text.trim(),
                    'message': _queryController.text.trim(),
                  });
                  _queryController.clear();
                  if (mounted) {
                    Navigator.of(ctx).pop();
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(backgroundColor: Color(0xFF059669), content: Text('Query sent to Class Teacher successfully.')),
                    );
                  }
                } catch (e) {
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text('Failed: ${e.toString().replaceAll('Exception: ', '')}')),
                    );
                  }
                }
              },
              child: const Text('Submit Query'),
            ),
          ],
        ),
      ),
    );
  }

  void _openDocumentAttachment(Map<String, dynamic> att) {
    final url = att['fileUrl']?.toString();
    final name = att['fileName']?.toString() ?? 'Document';
    final fileType = att['fileType']?.toString() ?? '';
    final isPdf = name.toLowerCase().endsWith('.pdf') || fileType.contains('pdf');
    final isDoc = name.toLowerCase().endsWith('.doc') || name.toLowerCase().endsWith('.docx') || fileType.contains('word') || fileType.contains('msword');
    final isText = name.toLowerCase().endsWith('.txt') || fileType.contains('text');

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Row(
          children: [
            Icon(
              isPdf ? Icons.picture_as_pdf : isDoc ? Icons.description : Icons.article,
              color: isPdf ? const Color(0xFFDC2626) : isDoc ? const Color(0xFF2563EB) : const Color(0xFF0D9488),
              size: 24,
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                name,
                style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: const Color(0xFFF1F5F9),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                children: [
                  Text(
                    isPdf ? '📄 PDF Document' : isDoc ? '📝 Word Document' : isText ? '✍️ Text File' : '📎 Document File',
                    style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF334155)),
                  ),
                  if (att['fileSize'] != null) ...[
                    const Spacer(),
                    Text(
                      '${((att['fileSize'] as num) / 1024).toStringAsFixed(1)} KB',
                      style: const TextStyle(fontSize: 10, color: Color(0xFF64748B)),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 12),
            const Text('Document Location & Direct Link:', style: TextStyle(fontSize: 11, color: Color(0xFF64748B))),
            const SizedBox(height: 4),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: SelectableText(
                url ?? 'No URL provided',
                style: const TextStyle(fontSize: 10, fontFamily: 'monospace', color: Color(0xFF0284C7)),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () {
              if (url != null) {
                Clipboard.setData(ClipboardData(text: url));
                ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Document link copied to clipboard!')));
              }
            },
            child: const Text('Copy Link'),
          ),
          if (url != null)
            ElevatedButton.icon(
              onPressed: () async {
                try {
                  final uri = Uri.parse(url);
                  await launchUrl(uri, mode: LaunchMode.externalApplication);
                } catch (_) {
                  Clipboard.setData(ClipboardData(text: url));
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Link copied to clipboard (open in new tab).')),
                    );
                  }
                }
              },
              icon: const Icon(Icons.open_in_new, size: 14),
              label: const Text('Open / Download'),
            ),
          TextButton(onPressed: () => Navigator.of(ctx).pop(), child: const Text('Close')),
        ],
      ),
    );
  }

  Widget _buildImportantExamNoticeBanner() {
    final alertNotices = _notices.where((n) {
      final prio = n['priority']?.toString() ?? 'NORMAL';
      final cat = n['category']?.toString() ?? 'GENERAL';
      return prio == 'CRITICAL' || prio == 'IMPORTANT' || cat == 'EXAM';
    }).toList();

    if (alertNotices.isEmpty) return const SizedBox.shrink();

    final topNotice = alertNotices.first;
    final cat = topNotice['category']?.toString() ?? 'GENERAL';
    final prio = topNotice['priority']?.toString() ?? 'NORMAL';
    final isExam = cat == 'EXAM' || topNotice['examDetails'] != null;
    final exam = topNotice['examDetails'] is Map ? topNotice['examDetails'] : null;

    final bgColor = isExam ? const Color(0xFFEFF6FF) : const Color(0xFFFEF2F2);
    final borderColor = isExam ? const Color(0xFF93C5FD) : const Color(0xFFFCA5A5);
    final headerColor = isExam ? const Color(0xFF1E40AF) : const Color(0xFF991B1B);

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: borderColor, width: 1.5),
        boxShadow: [
          BoxShadow(color: borderColor.withValues(alpha: 0.15), blurRadius: 8, offset: const Offset(0, 3)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Icon(
                    isExam ? Icons.school : Icons.campaign,
                    size: 18,
                    color: headerColor,
                  ),
                  const SizedBox(width: 6),
                  Text(
                    isExam ? 'ACTIVE EXAM NOTIFICATION' : 'IMPORTANT NOTICE ALERT',
                    style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: headerColor),
                  ),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: isExam ? const Color(0xFF1D4ED8) : const Color(0xFFDC2626),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  prio,
                  style: const TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.bold),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            topNotice['title'] ?? 'Notice',
            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: Color(0xFF0F172A)),
          ),
          const SizedBox(height: 4),
          Text(
            topNotice['content'] ?? '',
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontSize: 12, color: Color(0xFF475569)),
          ),
          if (isExam && exam != null) ...[
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: const Color(0xFFBFDBFE)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.event, size: 14, color: Color(0xFF2563EB)),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      '${exam['subject'] ?? 'Subject'} • Date: ${exam['examDate'] != null ? exam['examDate'].toString().split('T').first : 'Scheduled'} (${exam['startTime'] ?? ''})',
                      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF1E3A8A)),
                    ),
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: 10),
          Align(
            alignment: Alignment.centerRight,
            child: InkWell(
              onTap: () {
                setState(() {
                  _currentIndex = 2; // Switch to Notices Tab
                  if (isExam) _noticeFilter = 'EXAM';
                });
              },
              child: Text(
                isExam ? 'View Exam Routine & Syllabus →' : 'View Full Notice →',
                style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: headerColor),
              ),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        leading: Padding(
          padding: const EdgeInsets.all(8.0),
          child: Image.asset(
            'assets/logo.png',
            fit: BoxFit.contain,
            errorBuilder: (_, __, ___) => const Icon(Icons.security, color: Color(0xFF0284C7)),
          ),
        ),
        title: const Text('School Safe Connect', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 17)),
        backgroundColor: Colors.white,
        foregroundColor: const Color(0xFF1E293B),
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.emergency_outlined, color: Colors.red),
            tooltip: 'Trigger Panic SOS',
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const SosPanicScreen()),
            ),
          ),
          IconButton(
            icon: const Icon(Icons.logout),
            tooltip: 'Sign Out',
            onPressed: () async {
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
          : _errorMessage != null
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.error_outline, size: 48, color: Colors.redAccent),
                      const SizedBox(height: 12),
                      Text(_errorMessage!),
                      const SizedBox(height: 16),
                      ElevatedButton(
                        onPressed: _loadParentData,
                        child: const Text('Retry'),
                      )
                    ],
                  ),
                )
              : _buildTabContent(),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        onTap: (idx) => setState(() => _currentIndex = idx),
        selectedItemColor: const Color(0xFF2563EB),
        unselectedItemColor: const Color(0xFF94A3B8),
        type: BottomNavigationBarType.fixed,
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.home_outlined), label: 'Home'),
          BottomNavigationBarItem(icon: Icon(Icons.assignment_outlined), label: 'Tasks'),
          BottomNavigationBarItem(icon: Icon(Icons.campaign_outlined), label: 'Notices'),
          BottomNavigationBarItem(icon: Icon(Icons.directions_bus_outlined), label: 'Transport'),
        ],
      ),
    );
  }

  Widget _buildTabContent() {
    switch (_currentIndex) {
      case 0:
        return _buildHomeTab();
      case 1:
        return _buildAssignmentsTab();
      case 2:
        return _buildNoticesTab();
      case 3:
        return _buildTransportTab();
      default:
        return const SizedBox();
    }
  }

  Widget _buildHomeTab() {
    return RefreshIndicator(
      onRefresh: _loadParentData,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Official Parent Serial Identity Card
          Container(
            margin: const EdgeInsets.only(bottom: 16),
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFFE2E8F0)),
              boxShadow: [
                BoxShadow(color: Colors.black.withValues(alpha: 0.03), blurRadius: 10, offset: const Offset(0, 4)),
              ],
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
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(color: const Color(0xFF0284C7).withValues(alpha: 0.1), shape: BoxShape.circle),
                          child: const Icon(Icons.badge_outlined, color: Color(0xFF0284C7), size: 20),
                        ),
                        const SizedBox(width: 8),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(_parentFullName ?? 'Verified Parent', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                            Text(_parentSchoolName ?? 'Vijay High school', style: const TextStyle(fontSize: 11, color: Color(0xFF64748B), fontWeight: FontWeight.w500)),
                          ],
                        ),
                      ],
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: const Color(0xFFDCFCE7),
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(color: const Color(0xFF86EFAC)),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.check_circle, size: 12, color: Color(0xFF16A34A)),
                          SizedBox(width: 4),
                          Text('VERIFIED', style: TextStyle(color: Color(0xFF166534), fontSize: 10, fontWeight: FontWeight.bold)),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                const Divider(height: 1),
                const SizedBox(height: 10),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('OFFICIAL SERIAL IDENTITY CODE', style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: Color(0xFF64748B))),
                        const SizedBox(height: 2),
                        Text(
                          _parentUserCode ?? 'SSC-SCH-1001-PAR-001',
                          style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Color(0xFF0284C7), letterSpacing: 0.8),
                        ),
                      ],
                    ),
                    IconButton(
                      icon: const Icon(Icons.copy, size: 18, color: Color(0xFF0284C7)),
                      tooltip: 'Copy Code',
                      onPressed: () {
                        if (_parentUserCode != null) {
                          Clipboard.setData(ClipboardData(text: _parentUserCode!));
                          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Identity code copied!')));
                        }
                      },
                    ),
                  ],
                ),
              ],
            ),
          ),

          // Child selector / summary card
          if (_selectedStudent != null)
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF1E3A8A), Color(0xFF2563EB)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(16),
                boxShadow: [
                  BoxShadow(color: Colors.blue.withOpacity(0.2), blurRadius: 8, offset: const Offset(0, 4))
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        _selectedStudent['fullName'] ?? 'Student Name',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: Colors.white24,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          _selectedStudent['classCode'] ?? 'Class',
                          style: const TextStyle(color: Colors.white, fontSize: 12),
                        ),
                      )
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Student Code: ${_selectedStudent['studentCode']}',
                    style: const TextStyle(color: Colors.white70, fontSize: 13),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      const Icon(Icons.verified, color: Colors.greenAccent, size: 16),
                      const SizedBox(width: 4),
                      Text(
                        'Status: ${_selectedStudent['status'] ?? 'ACTIVE'}',
                        style: const TextStyle(color: Colors.white, fontSize: 12),
                      ),
                    ],
                  )
                ],
              ),
            ),

          const SizedBox(height: 16),

          // Pinned Active Exam Notification or Important Notice Alert
          _buildImportantExamNoticeBanner(),

          // Master School Timetable Card
          _buildTimetableCard(),

          const SizedBox(height: 16),

          // Quick Action Cards
          const Text(
            'Safety & Services',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF1E293B)),
          ),
          const SizedBox(height: 12),

          Row(
            children: [
              Expanded(
                child: _buildActionTile(
                  icon: Icons.assignment_turned_in_outlined,
                  title: 'Report Card',
                  subtitle: 'Exams & Grades',
                  color: const Color(0xFF4F46E5),
                  onTap: _showReportCardDialog,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _buildActionTile(
                  icon: Icons.directions_bus_filled,
                  title: 'Bus Tracking',
                  subtitle: 'Delayed Location',
                  color: const Color(0xFF2563EB),
                  onTap: () {
                    if (_selectedStudent == null) return;
                    Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => ParentLiveTrackingScreen(
                          studentCode: _selectedStudent['studentCode'],
                          studentName: _selectedStudent['fullName'] ?? 'Student',
                        ),
                      ),
                    );
                  },
                ),
              ),
            ],
          ),

          const SizedBox(height: 12),

          Row(
            children: [
              Expanded(
                child: _buildActionTile(
                  icon: Icons.question_answer_outlined,
                  title: 'Ask Teacher',
                  subtitle: '1 Query / Day',
                  color: const Color(0xFF7C3AED),
                  onTap: _showAskTeacherDialog,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _buildActionTile(
                  icon: Icons.warning_amber_rounded,
                  title: 'Emergency SOS',
                  subtitle: 'Instant Alert',
                  color: const Color(0xFFDC2626),
                  onTap: () => Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const SosPanicScreen()),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildTimetableCard() {
    final liveStatus = _timetableData?['liveStatus'] is Map
        ? Map<String, dynamic>.from(_timetableData!['liveStatus'])
        : null;
    final today = _timetableData?['today']?.toString() ?? 'TODAY';
    final todaySessions = (_timetableData?['todaySessions'] is List)
        ? (_timetableData!['todaySessions'] as List)
        : <dynamic>[];
    final activeSession = liveStatus?['activeSession'] is Map
        ? Map<String, dynamic>.from(liveStatus!['activeSession'])
        : null;
    final nextSession = liveStatus?['nextSession'] is Map
        ? Map<String, dynamic>.from(liveStatus!['nextSession'])
        : null;

    return Container(
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
                  const Icon(Icons.calendar_month, size: 18, color: Color(0xFF0284C7)),
                  const SizedBox(width: 6),
                  Text(
                    'Class Timetable ($today)',
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: Color(0xFF0F172A)),
                  ),
                ],
              ),
              TextButton(
                onPressed: _showFullTimetableDialog,
                style: TextButton.styleFrom(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2), minimumSize: Size.zero),
                child: const Text('Full Week →', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
            decoration: BoxDecoration(
              color: const Color(0xFFEFF6FF),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: const Color(0xFFBFDBFE)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Daily Schedule: ${todaySessions.length} Periods Scheduled',
                  style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF1D4ED8)),
                ),
                const SizedBox(height: 2),
                if (activeSession != null)
                  Text(
                    'Now: ${activeSession['subject'] ?? activeSession['title']} (${activeSession['startTime']} - ${activeSession['endTime']})${activeSession['teacherName'] != null ? ' • ${activeSession['teacherName']}' : ''}',
                    style: const TextStyle(fontSize: 11, color: Color(0xFF334155), fontWeight: FontWeight.w600),
                  )
                else if (nextSession != null)
                  Text(
                    'Next: ${nextSession['subject'] ?? nextSession['title']} (${nextSession['startTime']} - ${nextSession['endTime']})',
                    style: const TextStyle(fontSize: 11, color: Color(0xFF334155)),
                  )
                else
                  const Text(
                    'School Schedule Active • Academic classes running as scheduled.',
                    style: TextStyle(fontSize: 10, color: Color(0xFF475569)),
                  ),
              ],
            ),
          ),
          if (todaySessions.isNotEmpty) ...[
            const SizedBox(height: 10),
            SizedBox(
              height: 64,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: todaySessions.length,
                separatorBuilder: (_, __) => const SizedBox(width: 8),
                itemBuilder: (ctx, i) {
                  final s = todaySessions[i];
                  final isBreak = s['isBreak'] == true;
                  final isNow = activeSession != null && activeSession['sessionId'] == s['sessionId'];
                  return Container(
                    width: 140,
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: isNow
                          ? const Color(0xFF0284C7)
                          : isBreak
                              ? const Color(0xFFFFFBEB)
                              : const Color(0xFFF8FAFC),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(
                        color: isNow
                            ? const Color(0xFF0284C7)
                            : isBreak
                                ? const Color(0xFFFCD34D)
                                : const Color(0xFFE2E8F0),
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          '${s['startTime']} - ${s['endTime']}',
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                            color: isNow ? Colors.white70 : const Color(0xFF64748B),
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          s['subject']?.toString() ?? s['title']?.toString() ?? 'Period',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                            color: isNow ? Colors.white : const Color(0xFF0F172A),
                          ),
                        ),
                        if (!isBreak && (s['teacherName'] != null || s['teacherCode'] != null))
                          Text(
                            s['teacherName']?.toString() ?? s['teacherCode']?.toString() ?? '',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 9,
                              color: isNow ? Colors.white70 : const Color(0xFF64748B),
                            ),
                          ),
                      ],
                    ),
                  );
                },
              ),
            ),
          ],
        ],
      ),
    );
  }

  void _showFullTimetableDialog() {
    final week = _timetableData?['week'] is Map ? Map<String, dynamic>.from(_timetableData!['week']) : <String, dynamic>{};
    const days = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
    String selectedDay = _timetableData?['today']?.toString() ?? 'MON';
    if (!days.contains(selectedDay)) selectedDay = 'MON';

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setModalState) {
          final dayDoc = week[selectedDay];
          final sessions = (dayDoc is Map && dayDoc['sessions'] is List) ? (dayDoc['sessions'] as List) : <dynamic>[];
          return AlertDialog(
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            title: Text(
              'Weekly Timetable • ${_timetableData?['classCode'] ?? ''}',
              style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
            ),
            content: SizedBox(
              width: 360,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Academic Schedule: Period timings, assigned teachers, and subject classrooms.',
                    style: TextStyle(fontSize: 10, color: Color(0xFF475569)),
                  ),
                  const SizedBox(height: 10),
                  SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Row(
                      children: days.map((d) {
                        final active = d == selectedDay;
                        return Padding(
                          padding: const EdgeInsets.only(right: 6),
                          child: ChoiceChip(
                            label: Text(d, style: const TextStyle(fontSize: 11)),
                            selected: active,
                            onSelected: (_) => setModalState(() => selectedDay = d),
                          ),
                        );
                      }).toList(),
                    ),
                  ),
                  const SizedBox(height: 10),
                  if (sessions.isEmpty)
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 20),
                      child: Center(child: Text('No periods scheduled for this day.', style: TextStyle(fontSize: 12, color: Colors.blueGrey))),
                    )
                  else
                    ConstrainedBox(
                      constraints: const BoxConstraints(maxHeight: 300),
                      child: ListView.separated(
                        shrinkWrap: true,
                        itemCount: sessions.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 6),
                        itemBuilder: (c, i) {
                          final s = sessions[i];
                          final isBreak = s['isBreak'] == true;
                          return Container(
                            padding: const EdgeInsets.all(10),
                            decoration: BoxDecoration(
                              color: isBreak ? const Color(0xFFFFFBEB) : const Color(0xFFF8FAFC),
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(color: isBreak ? const Color(0xFFFCD34D) : const Color(0xFFE2E8F0)),
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(s['subject']?.toString() ?? s['title']?.toString() ?? 'Period', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                                      if (!isBreak && (s['teacherName'] != null || s['teacherCode'] != null))
                                        Text('Teacher: ${s['teacherName'] ?? s['teacherCode']}', style: const TextStyle(fontSize: 10, color: Color(0xFF64748B))),
                                    ],
                                  ),
                                ),
                                Text(
                                  '${s['startTime']} - ${s['endTime']}',
                                  style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF0284C7)),
                                ),
                              ],
                            ),
                          );
                        },
                      ),
                    ),
                ],
              ),
            ),
            actions: [
              TextButton(onPressed: () => Navigator.of(ctx).pop(), child: const Text('Close')),
            ],
          );
        },
      ),
    );
  }

  Future<void> _showReportCardDialog() async {
    if (_selectedStudent == null) return;
    final studentCode = _selectedStudent['studentCode']?.toString() ?? '';
    final studentName = _selectedStudent['fullName']?.toString() ?? 'Student';

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => const Center(child: CircularProgressIndicator()),
    );

    Map<String, dynamic>? reportCard;
    try {
      final res = await ApiService.instance.get('/students/$studentCode/report-card');
      reportCard = res['data'] is Map ? Map<String, dynamic>.from(res['data']) : null;
    } catch (_) {}

    if (!mounted) return;
    Navigator.of(context, rootNavigator: true).pop(); // dismiss loading

    final assessments = (reportCard?['assessments'] is List)
        ? (reportCard!['assessments'] as List)
        : <dynamic>[];
    final overall = reportCard?['overallStats'] is Map ? reportCard!['overallStats'] : null;

    if (!mounted) return;
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        titlePadding: const EdgeInsets.fromLTRB(20, 20, 20, 10),
        contentPadding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
        title: Row(
          children: [
            const Icon(Icons.school, color: Color(0xFF4F46E5)),
            const SizedBox(width: 8),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(studentName, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
                  Text('Official Report Card • $studentCode', style: const TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                ],
              ),
            ),
          ],
        ),
        content: SizedBox(
          width: 380,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (overall != null) ...[
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(0xFFEEF2FF),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFFC7D2FE)),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceAround,
                    children: [
                      Column(
                        children: [
                          const Text('Overall GPA', style: TextStyle(fontSize: 10, color: Color(0xFF4338CA))),
                          Text('${overall['grade'] ?? 'A'}', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF312E81))),
                        ],
                      ),
                      Column(
                        children: [
                          const Text('Cumulative %', style: TextStyle(fontSize: 10, color: Color(0xFF4338CA))),
                          Text('${overall['cumulativePercentage'] ?? 0}%', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF312E81))),
                        ],
                      ),
                      Column(
                        children: [
                          const Text('Tests Count', style: TextStyle(fontSize: 10, color: Color(0xFF4338CA))),
                          Text('${overall['totalAssessments'] ?? assessments.length}', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF312E81))),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
              ],
              const Text('Assessment Breakdown', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF1E293B))),
              const SizedBox(height: 8),
              if (assessments.isEmpty)
                Container(
                  padding: const EdgeInsets.all(16),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  child: const Text('No exam results recorded for this academic year yet.', style: TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                )
              else
                ConstrainedBox(
                  constraints: const BoxConstraints(maxHeight: 280),
                  child: ListView.separated(
                    shrinkWrap: true,
                    itemCount: assessments.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 8),
                    itemBuilder: (c, i) {
                      final asm = assessments[i];
                      final score = asm['score'] ?? 0;
                      final maxMarks = asm['maxMarks'] ?? 100;
                      final pct = asm['percentage'] ?? 0;
                      final grade = asm['grade'] ?? 'B';
                      final type = asm['assessmentType'] ?? 'EXAM';
                      final title = asm['title'] ?? 'Assessment';
                      final subject = asm['subject'] ?? 'General';
                      final rank = asm['rank'];

                      return Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF8FAFC),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: const Color(0xFFE2E8F0)),
                        ),
                        child: Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                              decoration: BoxDecoration(
                                color: const Color(0xFF4F46E5),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Text(
                                type,
                                style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
                              ),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(title, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF0F172A))),
                                  Text('$subject • ${asm['academicYear'] ?? '2026-2027'}', style: const TextStyle(fontSize: 10, color: Color(0xFF64748B))),
                                ],
                              ),
                            ),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                Text('$score / $maxMarks', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF047857))),
                                Text('Grade $grade • $pct%${rank != null ? ' (#$rank)' : ''}', style: const TextStyle(fontSize: 10, color: Color(0xFF475569))),
                              ],
                            ),
                          ],
                        ),
                      );
                    },
                  ),
                ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Close'),
          ),
        ],
      ),
    );
  }

  Widget _buildActionTile({
    required IconData icon,
    required String title,
    required String subtitle,
    required Color color,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFE2E8F0)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            CircleAvatar(
              radius: 18,
              backgroundColor: color.withOpacity(0.1),
              child: Icon(icon, color: color, size: 20),
            ),
            const SizedBox(height: 12),
            Text(title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
            const SizedBox(height: 2),
            Text(subtitle, style: const TextStyle(color: Color(0xFF64748B), fontSize: 11)),
          ],
        ),
      ),
    );
  }

  Widget _buildAssignmentsTab() {
    return _assignments.isEmpty
        ? const Center(child: Text('No active homework / assignments for this class.'))
        : ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: _assignments.length,
            separatorBuilder: (_, __) => const SizedBox(height: 12),
            itemBuilder: (ctx, idx) {
              final a = _assignments[idx];
              final isViewed = a['isViewed'] == true || a['viewedByParentAt'] != null;
              final attachments = (a['attachments'] is List) ? (a['attachments'] as List) : [];
              final format = a['format']?.toString() ?? 'TEXT';
              final isPdf = format == 'PDF' || attachments.any((att) => att['fileName']?.toString().endsWith('.pdf') == true);
              final isDoc = format == 'DOC' || attachments.any((att) => att['fileName']?.toString().endsWith('.docx') == true || att['fileName']?.toString().endsWith('.doc') == true);

              return Card(
                elevation: 0,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                  side: BorderSide(color: isViewed ? const Color(0xFFBBF7D0) : const Color(0xFFE2E8F0)),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                decoration: BoxDecoration(color: const Color(0xFFEFF6FF), borderRadius: BorderRadius.circular(6)),
                                child: Text(
                                  '${a['subject'] ?? 'Homework'} • By ${a['teacherName'] ?? a['teacherCode'] ?? 'Teacher'}',
                                  style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFF1D4ED8)),
                                ),
                              ),
                              const SizedBox(width: 6),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                decoration: BoxDecoration(
                                  color: isPdf ? const Color(0xFFFEE2E2) : isDoc ? const Color(0xFFDBEAFE) : const Color(0xFFF1F5F9),
                                  borderRadius: BorderRadius.circular(4),
                                ),
                                child: Text(
                                  isPdf ? '📄 PDF' : isDoc ? '📝 DOCX' : '✍️ TEXT',
                                  style: TextStyle(
                                    fontSize: 9,
                                    fontWeight: FontWeight.bold,
                                    color: isPdf ? const Color(0xFF991B1B) : isDoc ? const Color(0xFF1E40AF) : const Color(0xFF334155),
                                  ),
                                ),
                              ),
                            ],
                          ),
                          Text(
                            'Due: ${a['dueDate'] != null ? a['dueDate'].toString().substring(0, 10) : 'Soon'}',
                            style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF475569)),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Text(a['title'] ?? 'Assignment', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                      const SizedBox(height: 4),
                      Text(a['description'] ?? 'No instructions provided.', style: const TextStyle(fontSize: 12, color: Color(0xFF475569))),
                      if (attachments.isNotEmpty) ...[
                        const SizedBox(height: 8),
                        Wrap(
                          spacing: 6,
                          runSpacing: 4,
                          children: attachments.map<Widget>((att) {
                            final fn = att['fileName']?.toString() ?? 'File';
                            final attIsPdf = fn.endsWith('.pdf');
                            final attIsDoc = fn.endsWith('.docx') || fn.endsWith('.doc');
                            return ActionChip(
                              avatar: Icon(
                                attIsPdf ? Icons.picture_as_pdf : attIsDoc ? Icons.description : Icons.article,
                                size: 14,
                                color: attIsPdf ? Colors.red : attIsDoc ? Colors.blue : Colors.teal,
                              ),
                              label: Text(fn, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold)),
                              visualDensity: VisualDensity.compact,
                              onPressed: () => _openDocumentAttachment(Map<String, dynamic>.from(att)),
                            );
                          }).toList(),
                        ),
                      ],
                      const Divider(height: 16),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            'Expires: ${a['expiresAt'] != null ? a['expiresAt'].toString().substring(0, 10) : '7 days'}',
                            style: const TextStyle(fontSize: 10, color: Color(0xFF64748B)),
                          ),
                          if (isViewed)
                            const Row(
                              children: [
                                Icon(Icons.check_circle, size: 15, color: Color(0xFF059669)),
                                SizedBox(width: 4),
                                Text('Viewed ✓', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF059669))),
                              ],
                            )
                          else
                            ElevatedButton.icon(
                              onPressed: () => _markAssignmentViewed(a['assignmentCode']),
                              icon: const Icon(Icons.visibility, size: 14),
                              label: const Text('Mark as Viewed', style: TextStyle(fontSize: 11)),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: const Color(0xFF2563EB),
                                foregroundColor: Colors.white,
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                              ),
                            ),
                        ],
                      ),
                    ],
                  ),
                ),
              );
            },
          );
  }

  Widget _buildNoticesTab() {
    if (_notices.isEmpty) {
      return const Center(child: Text('No notices posted.'));
    }

    final examCount = _notices.where((n) => n['category'] == 'EXAM' || n['examDetails'] != null).length;
    final urgentCount = _notices.where((n) => n['priority'] == 'CRITICAL' || n['priority'] == 'IMPORTANT' || n['category'] == 'URGENT').length;

    final filteredNotices = _notices.where((n) {
      if (_noticeFilter == 'EXAM') {
        return n['category'] == 'EXAM' || n['examDetails'] != null;
      }
      if (_noticeFilter == 'URGENT') {
        return n['priority'] == 'CRITICAL' || n['priority'] == 'IMPORTANT' || n['category'] == 'URGENT';
      }
      if (_noticeFilter == 'ANNOUNCEMENT') {
        return n['category'] == 'ANNOUNCEMENT' || n['category'] == 'GENERAL' || n['category'] == 'HOLIDAY';
      }
      return true;
    }).toList();

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // Category Filter Chips
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: [
              ChoiceChip(
                label: Text('All (${_notices.length})', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                selected: _noticeFilter == 'ALL',
                onSelected: (_) => setState(() => _noticeFilter = 'ALL'),
              ),
              const SizedBox(width: 6),
              ChoiceChip(
                label: Text('📝 Exams ($examCount)', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                selected: _noticeFilter == 'EXAM',
                onSelected: (_) => setState(() => _noticeFilter = 'EXAM'),
              ),
              const SizedBox(width: 6),
              ChoiceChip(
                label: Text('🚨 Urgent Alerts ($urgentCount)', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                selected: _noticeFilter == 'URGENT',
                onSelected: (_) => setState(() => _noticeFilter = 'URGENT'),
              ),
              const SizedBox(width: 6),
              ChoiceChip(
                label: const Text('📢 Announcements', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                selected: _noticeFilter == 'ANNOUNCEMENT',
                onSelected: (_) => setState(() => _noticeFilter = 'ANNOUNCEMENT'),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),

        if (filteredNotices.isEmpty)
          Container(
            padding: const EdgeInsets.all(24),
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: const Text('No notices found in this category.', style: TextStyle(color: Color(0xFF64748B))),
          )
        else
          ...filteredNotices.map((n) {
            final cat = n['category']?.toString() ?? 'GENERAL';
            final priority = n['priority']?.toString() ?? 'NORMAL';
            final isExam = cat == 'EXAM' || n['examDetails'] != null;
            final isCritical = priority == 'CRITICAL';
            final isImportant = priority == 'IMPORTANT';
            final exam = n['examDetails'] is Map ? n['examDetails'] : null;
            final attachments = (n['attachments'] is List) ? (n['attachments'] as List) : [];

            Color catBg = const Color(0xFFF1F5F9);
            Color catFg = const Color(0xFF334155);
            String catLabel = 'ANNOUNCEMENT';
            if (isExam) {
              catBg = const Color(0xFFEFF6FF);
              catFg = const Color(0xFF1D4ED8);
              catLabel = '📝 EXAM NOTICE';
            } else if (cat == 'URGENT' || isCritical) {
              catBg = const Color(0xFFFEE2E2);
              catFg = const Color(0xFF991B1B);
              catLabel = '🚨 URGENT ALERT';
            } else if (cat == 'HOLIDAY') {
              catBg = const Color(0xFFFEF3C7);
              catFg = const Color(0xFF92400E);
              catLabel = '🏖️ HOLIDAY NOTICE';
            }

            return Card(
              elevation: 0,
              margin: const EdgeInsets.only(bottom: 12),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
                side: BorderSide(
                  color: isCritical
                      ? const Color(0xFFFCA5A5)
                      : isExam
                          ? const Color(0xFFBFDBFE)
                          : const Color(0xFFE2E8F0),
                  width: isCritical || isExam ? 1.5 : 1,
                ),
              ),
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(color: catBg, borderRadius: BorderRadius.circular(6)),
                          child: Text(catLabel, style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: catFg)),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: isCritical
                                ? const Color(0xFFDC2626)
                                : isImportant
                                    ? const Color(0xFFD97706)
                                    : const Color(0xFF64748B),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            priority,
                            style: const TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.bold),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text(n['title'] ?? 'Notice', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                    const SizedBox(height: 4),
                    Text(n['content'] ?? '', style: const TextStyle(fontSize: 12, color: Color(0xFF475569))),

                    // DEDICATED EXAM SCHEDULE BOX
                    if (isExam && exam != null) ...[
                      const SizedBox(height: 10),
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: const Color(0xFFEFF6FF),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: const Color(0xFFBFDBFE)),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                const Icon(Icons.school, size: 16, color: Color(0xFF1D4ED8)),
                                const SizedBox(width: 6),
                                Expanded(
                                  child: Text(
                                    '${exam['subject'] ?? 'Subject'} • Date: ${exam['examDate'] != null ? exam['examDate'].toString().split('T').first : 'Scheduled'} (${exam['startTime'] ?? ''})',
                                    style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF1E3A8A)),
                                  ),
                                ),
                                if (exam['maxMarks'] != null)
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                    decoration: BoxDecoration(color: const Color(0xFFDBEAFE), borderRadius: BorderRadius.circular(4)),
                                    child: Text('${exam['maxMarks']} Marks', style: const TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: Color(0xFF1D4ED8))),
                                  ),
                              ],
                            ),
                            if (exam['syllabus'] != null && exam['syllabus'].toString().isNotEmpty) ...[
                              const SizedBox(height: 6),
                              Text('📖 Syllabus: ${exam['syllabus']}', style: const TextStyle(fontSize: 11, color: Color(0xFF334155), fontWeight: FontWeight.w600)),
                            ],
                          ],
                        ),
                      ),
                    ],

                    // ATTACHMENTS (PDF, DOCX, TXT)
                    if (attachments.isNotEmpty) ...[
                      const SizedBox(height: 8),
                      Wrap(
                        spacing: 6,
                        runSpacing: 4,
                        children: attachments.map<Widget>((att) {
                          final fn = att['fileName']?.toString() ?? 'Attachment';
                          final attIsPdf = fn.endsWith('.pdf');
                          final attIsDoc = fn.endsWith('.docx') || fn.endsWith('.doc');
                          return ActionChip(
                            avatar: Icon(
                              attIsPdf ? Icons.picture_as_pdf : attIsDoc ? Icons.description : Icons.article,
                              size: 14,
                              color: attIsPdf ? Colors.red : attIsDoc ? Colors.blue : Colors.teal,
                            ),
                            label: Text(fn, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold)),
                            visualDensity: VisualDensity.compact,
                            onPressed: () => _openDocumentAttachment(Map<String, dynamic>.from(att)),
                          );
                        }).toList(),
                      ),
                    ],

                    const SizedBox(height: 8),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          '${n['publisherName'] != null ? 'By ${n['publisherName']}' : 'School'} • ${n['createdAt']?.toString().split('T').first ?? ''}',
                          style: const TextStyle(fontSize: 10, color: Color(0xFF94A3B8)),
                        ),
                        if (n['classCodes'] is List && (n['classCodes'] as List).isNotEmpty)
                          Text(
                            'Class: ${(n['classCodes'] as List).join(', ')}',
                            style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: Color(0xFF64748B)),
                          ),
                      ],
                    ),
                  ],
                ),
              ),
            );
          }),
      ],
    );
  }

  Widget _buildTransportTab() {
    if (_selectedStudent == null) {
      return const Center(child: Text('No student linked.'));
    }
    return ParentLiveTrackingScreen(
      studentCode: _selectedStudent['studentCode'],
      studentName: _selectedStudent['fullName'] ?? 'Student',
    );
  }
}

