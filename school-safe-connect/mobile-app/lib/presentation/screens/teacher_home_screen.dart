import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:file_picker/file_picker.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/api_service.dart';
import 'sos_panic_screen.dart';
import 'login_screen.dart';
import '../widgets/school_welcome_greeting.dart';

class TeacherHomeScreen extends StatefulWidget {
  const TeacherHomeScreen({super.key});

  @override
  State<TeacherHomeScreen> createState() => _TeacherHomeScreenState();
}

class _TeacherHomeScreenState extends State<TeacherHomeScreen> {
  int _currentIndex = 0;
  bool _isLoading = true;
  bool _hasShownGreeting = false;
  String? _errorMessage;
  String? _teacherUserCode;
  String? _teacherFullName;
  String? _teacherSchoolCode;
  String? _teacherSchoolName;

  List<dynamic> _assignedClasses = [];
  List<dynamic> _assignments = [];
  List<dynamic> _notices = [];
  List<dynamic> _parentQueries = [];
  List<dynamic> _classAssessments = [];
  List<dynamic> _incidents = [];
  Map<String, dynamic>? _timetableData;
  String _selectedTimetableDay = 'MON';

  @override
  void initState() {
    super.initState();
    _loadTeacherData();
  }

  Future<void> _loadTeacherData() async {
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
          userName: name ?? 'Teacher',
          role: 'Teacher',
        );
      }

      final results = await Future.wait([
        ApiService.instance.get('/assignments/my-classes').catchError((_) => {'data': {'classes': []}}),
        ApiService.instance.get('/assignments').catchError((_) => {'data': {'assignments': []}}),
        ApiService.instance.get('/notices').catchError((_) => {'data': {'notices': []}}),
        ApiService.instance.get('/assignments/queries/teacher').catchError((_) => {'data': {'queries': []}}),
        ApiService.instance.get('/assessments').catchError((_) => {'data': []}),
        ApiService.instance.get('/incidents').catchError((_) => {'data': {'incidents': []}}),
        ApiService.instance.get('/timetable/my-schedule').catchError((_) => {'data': {}}),
      ]);

      if (mounted) {
        final ttData = results[6]['data'] is Map ? Map<String, dynamic>.from(results[6]['data']) : null;
        setState(() {
          _teacherUserCode = code;
          _teacherFullName = name;
          _teacherSchoolCode = schoolCode;
          _teacherSchoolName = schoolName;
          _assignedClasses = results[0]['data']?['classes'] ?? [];
          _assignments = results[1]['data']?['assignments'] ?? [];
          _notices = results[2]['data']?['notices'] ?? [];
          _parentQueries = results[3]['data']?['queries'] ?? [];
          _classAssessments = results[4]['data'] is List ? (results[4]['data'] as List) : [];
          _incidents = results[5]['data']?['incidents'] ?? [];
          _timetableData = ttData;
          if (ttData?['today'] != null) {
            _selectedTimetableDay = ttData!['today'].toString();
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

  void _showCreateAssignmentDialog() {
    if (_assignedClasses.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          backgroundColor: Color(0xFFB45309),
          content: Text('No classes assigned yet. Ask School Admin to assign classes to your account.'),
        ),
      );
      return;
    }

    final titleCtrl = TextEditingController();
    final descCtrl = TextEditingController();
    final subjectCtrl = TextEditingController(
      text: _assignedClasses.first['subject']?.toString() ?? 'General',
    );
    final textDocNameCtrl = TextEditingController(text: 'Worksheet_Questions');
    final textDocContentCtrl = TextEditingController();
    final selectedClassCodes = <String>{_assignedClasses.first['classCode'].toString()};
    DateTime dueDate = DateTime.now().add(const Duration(days: 3));
    String assignmentFormat = 'PDF'; // PDF | DOC | TEXT
    String assignmentType = 'HOMEWORK'; // HOMEWORK | PROJECT | EXAM_PREP | WORKSHEET
    final attachments = <Map<String, dynamic>>[];
    bool isPickingFile = false;
    bool showTextEditor = false;
    bool submitting = false;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setModalState) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: Row(
            children: [
              const Icon(Icons.assignment_add, color: Color(0xFF2563EB), size: 22),
              const SizedBox(width: 8),
              const Expanded(
                child: Text('Create Class Assignment / Homework', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
              ),
            ],
          ),
          content: SizedBox(
            width: 480,
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('1. Target Class(es):', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF475569))),
                  const SizedBox(height: 6),
                  Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    children: _assignedClasses.map<Widget>((cls) {
                      final code = cls['classCode'].toString();
                      final label = 'Grade ${cls['grade']}-${cls['section']}';
                      final isSelected = selectedClassCodes.contains(code);
                      return FilterChip(
                        label: Text(label, style: const TextStyle(fontSize: 11)),
                        selected: isSelected,
                        onSelected: (val) {
                          setModalState(() {
                            if (val) {
                              selectedClassCodes.add(code);
                            } else if (selectedClassCodes.length > 1) {
                              selectedClassCodes.remove(code);
                            }
                          });
                        },
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 12),

                  const Text('2. Assignment Format & Document Type:', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF475569))),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      ChoiceChip(
                        label: const Text('📄 PDF (.pdf)', style: TextStyle(fontSize: 11)),
                        selected: assignmentFormat == 'PDF',
                        onSelected: (_) => setModalState(() => assignmentFormat = 'PDF'),
                      ),
                      const SizedBox(width: 6),
                      ChoiceChip(
                        label: const Text('📝 Word (.docx)', style: TextStyle(fontSize: 11)),
                        selected: assignmentFormat == 'DOC',
                        onSelected: (_) => setModalState(() => assignmentFormat = 'DOC'),
                      ),
                      const SizedBox(width: 6),
                      ChoiceChip(
                        label: const Text('✍️ Text (.txt)', style: TextStyle(fontSize: 11)),
                        selected: assignmentFormat == 'TEXT',
                        onSelected: (_) => setModalState(() => assignmentFormat = 'TEXT'),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),

                  Row(
                    children: [
                      Expanded(
                        child: DropdownButtonFormField<String>(
                          value: assignmentType,
                          decoration: const InputDecoration(labelText: 'Task Type', isDense: true, border: OutlineInputBorder()),
                          items: const [
                            DropdownMenuItem(value: 'HOMEWORK', child: Text('Daily Homework')),
                            DropdownMenuItem(value: 'EXAM_PREP', child: Text('Exam Prep / Test Sheet')),
                            DropdownMenuItem(value: 'WORKSHEET', child: Text('Class Worksheet')),
                            DropdownMenuItem(value: 'PROJECT', child: Text('Project Task')),
                          ],
                          onChanged: (v) => setModalState(() => assignmentType = v ?? 'HOMEWORK'),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: TextField(
                          controller: subjectCtrl,
                          decoration: const InputDecoration(labelText: 'Subject *', isDense: true, border: OutlineInputBorder()),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),

                  TextField(
                    controller: titleCtrl,
                    decoration: const InputDecoration(labelText: 'Assignment Title *', hintText: 'e.g. Chapter 4 Practice Exercises', isDense: true, border: OutlineInputBorder()),
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: descCtrl,
                    maxLines: 2,
                    decoration: const InputDecoration(labelText: 'Instructions for Students & Parents *', isDense: true, border: OutlineInputBorder()),
                  ),
                  const SizedBox(height: 10),

                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('Due: ${dueDate.toLocal().toString().split(' ')[0]}', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                      TextButton.icon(
                        onPressed: () async {
                          final picked = await showDatePicker(
                            context: ctx,
                            initialDate: dueDate,
                            firstDate: DateTime.now(),
                            lastDate: DateTime.now().add(const Duration(days: 7)),
                          );
                          if (picked != null) {
                            setModalState(() => dueDate = picked);
                          }
                        },
                        icon: const Icon(Icons.calendar_today, size: 14),
                        label: const Text('Change Date'),
                      ),
                    ],
                  ),

                  const Divider(height: 20),
                  const Text('3. Attachments (PDF / Word DOC / Text):', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF475569))),
                  const SizedBox(height: 6),

                  if (attachments.isNotEmpty) ...[
                    Wrap(
                      spacing: 6,
                      runSpacing: 4,
                      children: attachments.map<Widget>((att) {
                        final isPdf = att['fileName']?.toString().endsWith('.pdf') == true;
                        final isDoc = att['fileName']?.toString().endsWith('.docx') == true || att['fileName']?.toString().endsWith('.doc') == true;
                        return Chip(
                          avatar: Icon(
                            isPdf ? Icons.picture_as_pdf : isDoc ? Icons.description : Icons.article,
                            size: 14,
                            color: isPdf ? Colors.red : isDoc ? Colors.blue : Colors.teal,
                          ),
                          label: Text('${att['fileName']}', style: const TextStyle(fontSize: 10)),
                          deleteIcon: const Icon(Icons.close, size: 14),
                          onDeleted: () {
                            setModalState(() => attachments.remove(att));
                          },
                        );
                      }).toList(),
                    ),
                    const SizedBox(height: 8),
                  ],

                  Row(
                    children: [
                      ElevatedButton.icon(
                        onPressed: isPickingFile
                            ? null
                            : () async {
                                setModalState(() => isPickingFile = true);
                                try {
                                  final res = await FilePicker.pickFiles(
                                    type: FileType.custom,
                                    allowedExtensions: ['pdf', 'doc', 'docx', 'txt'],
                                    withData: true,
                                  );
                                  if (res != null && res.files.isNotEmpty) {
                                    final f = res.files.first;
                                    if (f.bytes != null) {
                                      final b64 = base64Encode(f.bytes!);
                                      final ext = f.name.split('.').last.toLowerCase();
                                      String mime = 'text/plain';
                                      if (ext == 'pdf') mime = 'application/pdf';
                                      else if (ext == 'docx') mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
                                      else if (ext == 'doc') mime = 'application/msword';

                                      final upRes = await ApiService.instance.post('/assignments/upload', {
                                        'fileName': f.name,
                                        'fileBase64': b64,
                                        'fileType': mime,
                                        'docFormat': assignmentFormat,
                                      });
                                      if (upRes['data'] != null) {
                                        setModalState(() {
                                          attachments.add(Map<String, dynamic>.from(upRes['data']));
                                        });
                                      }
                                    }
                                  }
                                } catch (e) {
                                  if (mounted) {
                                    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('File upload error: $e')));
                                  }
                                } finally {
                                  setModalState(() => isPickingFile = false);
                                }
                              },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF0F172A),
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                        ),
                        icon: const Icon(Icons.upload_file, size: 14),
                        label: Text(isPickingFile ? 'Uploading...' : '📁 Browse File ($assignmentFormat)'),
                      ),
                      const SizedBox(width: 8),
                      OutlinedButton.icon(
                        onPressed: () => setModalState(() => showTextEditor = !showTextEditor),
                        icon: Icon(showTextEditor ? Icons.expand_less : Icons.edit_note, size: 14),
                        label: Text(showTextEditor ? 'Hide Text' : '✍️ Write Document'),
                        style: OutlinedButton.styleFrom(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8)),
                      ),
                    ],
                  ),

                  if (showTextEditor) ...[
                    const SizedBox(height: 10),
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF8FAFC),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: const Color(0xFFCBD5E1)),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Create New $assignmentFormat Document from Text:', style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFF334155))),
                          const SizedBox(height: 6),
                          TextField(
                            controller: textDocNameCtrl,
                            decoration: InputDecoration(
                              labelText: 'File Name',
                              suffixText: assignmentFormat == 'PDF' ? '.pdf' : assignmentFormat == 'DOC' ? '.docx' : '.txt',
                              isDense: true,
                              border: const OutlineInputBorder(),
                            ),
                          ),
                          const SizedBox(height: 8),
                          TextField(
                            controller: textDocContentCtrl,
                            maxLines: 3,
                            decoration: const InputDecoration(labelText: 'Worksheet / Questions Content *', isDense: true, border: OutlineInputBorder()),
                          ),
                          const SizedBox(height: 8),
                          Align(
                            alignment: Alignment.centerRight,
                            child: ElevatedButton.icon(
                              onPressed: () async {
                                if (textDocContentCtrl.text.trim().isEmpty) return;
                                try {
                                  final name = textDocNameCtrl.text.trim().isEmpty ? 'Worksheet' : textDocNameCtrl.text.trim();
                                  final fullFileName = '$name.${assignmentFormat == 'PDF' ? 'pdf' : assignmentFormat == 'DOC' ? 'docx' : 'txt'}';
                                  final b64 = base64Encode(utf8.encode(textDocContentCtrl.text.trim()));
                                  final upRes = await ApiService.instance.post('/assignments/upload', {
                                    'fileName': fullFileName,
                                    'fileBase64': b64,
                                    'fileType': assignmentFormat == 'PDF' ? 'application/pdf' : assignmentFormat == 'DOC' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'text/plain',
                                    'docFormat': assignmentFormat,
                                  });
                                  if (upRes['data'] != null) {
                                    setModalState(() {
                                      attachments.add(Map<String, dynamic>.from(upRes['data']));
                                      textDocContentCtrl.clear();
                                      showTextEditor = false;
                                    });
                                  }
                                } catch (_) {}
                              },
                              icon: const Icon(Icons.add, size: 14),
                              label: Text('Save as $assignmentFormat Attachment', style: const TextStyle(fontSize: 11)),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],

                  const SizedBox(height: 8),
                  const Text('Note: Homework automatically expires & deletes after 7 days.', style: TextStyle(fontSize: 10, color: Color(0xFF64748B))),
                ],
              ),
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.of(ctx).pop(), child: const Text('Cancel')),
            ElevatedButton(
              onPressed: submitting
                  ? null
                  : () async {
                      if (titleCtrl.text.trim().isEmpty || descCtrl.text.trim().isEmpty) {
                        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please enter Title and Instructions.')));
                        return;
                      }
                      setModalState(() => submitting = true);
                      try {
                        // If teacher wrote text in editor but didn't click save attachment, save it automatically
                        if (textDocContentCtrl.text.trim().isNotEmpty) {
                          final name = textDocNameCtrl.text.trim().isEmpty ? 'Worksheet' : textDocNameCtrl.text.trim();
                          final fullFileName = '$name.${assignmentFormat == 'PDF' ? 'pdf' : assignmentFormat == 'DOC' ? 'docx' : 'txt'}';
                          final b64 = base64Encode(utf8.encode(textDocContentCtrl.text.trim()));
                          final upRes = await ApiService.instance.post('/assignments/upload', {
                            'fileName': fullFileName,
                            'fileBase64': b64,
                            'fileType': assignmentFormat == 'PDF' ? 'application/pdf' : assignmentFormat == 'DOC' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'text/plain',
                            'docFormat': assignmentFormat,
                          });
                          if (upRes['data'] != null) {
                            attachments.add(Map<String, dynamic>.from(upRes['data']));
                          }
                        }

                        await ApiService.instance.post('/assignments', {
                          'classCodes': selectedClassCodes.toList(),
                          'subject': subjectCtrl.text.trim().isEmpty ? 'General' : subjectCtrl.text.trim(),
                          'title': titleCtrl.text.trim(),
                          'description': descCtrl.text.trim(),
                          'format': assignmentFormat,
                          'assignmentType': assignmentType,
                          'dueDate': dueDate.toIso8601String(),
                          'attachments': attachments,
                        });

                        if (mounted) {
                          Navigator.of(ctx).pop();
                          await _loadTeacherData();
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              backgroundColor: const Color(0xFF059669),
                              content: Text('Assignment ($assignmentFormat) published to ${selectedClassCodes.length} class(es). Parents notified!'),
                            ),
                          );
                        }
                      } catch (e) {
                        setModalState(() => submitting = false);
                        if (mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(content: Text('Error: ${e.toString().replaceAll('Exception: ', '')}')),
                          );
                        }
                      }
                    },
              child: Text(submitting ? 'Publishing...' : 'Publish $assignmentFormat Homework'),
            ),
          ],
        ),
      ),
    );
  }

  void _showCreateNoticeDialog() {
    if (_assignedClasses.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No classes assigned to post class notices.')),
      );
      return;
    }

    final titleCtrl = TextEditingController();
    final contentCtrl = TextEditingController();
    final examSubjectCtrl = TextEditingController(text: _assignedClasses.first['subject']?.toString() ?? 'Mathematics');
    final examTimingCtrl = TextEditingController(text: '09:30 AM - 12:30 PM');
    final examSyllabusCtrl = TextEditingController(text: 'Chapters 1 to 4: Complete syllabus');
    final examMarksCtrl = TextEditingController(text: '100');
    DateTime examDate = DateTime.now().add(const Duration(days: 5));

    final selectedClassCodes = <String>{_assignedClasses.first['classCode'].toString()};
    String category = 'EXAM'; // EXAM | URGENT | ANNOUNCEMENT | HOLIDAY
    String priority = 'IMPORTANT'; // NORMAL | IMPORTANT | CRITICAL
    final attachments = <Map<String, dynamic>>[];
    bool isPickingFile = false;
    bool submitting = false;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setModalState) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: Row(
            children: [
              Icon(
                category == 'EXAM' ? Icons.school : category == 'URGENT' ? Icons.warning_amber_rounded : Icons.campaign,
                color: category == 'URGENT' ? const Color(0xFFDC2626) : const Color(0xFF0D9488),
                size: 22,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  category == 'EXAM' ? 'Create Exam Notice & Schedule' : 'Send Class Notice to Parents',
                  style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                ),
              ),
            ],
          ),
          content: SizedBox(
            width: 480,
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('1. Notice Category & Priority:', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF475569))),
                  const SizedBox(height: 6),
                  Wrap(
                    spacing: 6,
                    children: [
                      ChoiceChip(
                        label: const Text('📝 Exam Notice / Schedule', style: TextStyle(fontSize: 11)),
                        selected: category == 'EXAM',
                        onSelected: (_) => setModalState(() {
                          category = 'EXAM';
                          priority = 'IMPORTANT';
                        }),
                      ),
                      ChoiceChip(
                        label: const Text('🚨 Urgent / Important Alert', style: TextStyle(fontSize: 11)),
                        selected: category == 'URGENT',
                        onSelected: (_) => setModalState(() {
                          category = 'URGENT';
                          priority = 'CRITICAL';
                        }),
                      ),
                      ChoiceChip(
                        label: const Text('📢 General Announcement', style: TextStyle(fontSize: 11)),
                        selected: category == 'ANNOUNCEMENT',
                        onSelected: (_) => setModalState(() {
                          category = 'ANNOUNCEMENT';
                          priority = 'NORMAL';
                        }),
                      ),
                      ChoiceChip(
                        label: const Text('🏖️ Holiday Notice', style: TextStyle(fontSize: 11)),
                        selected: category == 'HOLIDAY',
                        onSelected: (_) => setModalState(() {
                          category = 'HOLIDAY';
                          priority = 'NORMAL';
                        }),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),

                  Row(
                    children: [
                      Expanded(
                        child: DropdownButtonFormField<String>(
                          value: priority,
                          decoration: const InputDecoration(labelText: 'Priority Level', isDense: true, border: OutlineInputBorder()),
                          items: const [
                            DropdownMenuItem(value: 'CRITICAL', child: Text('🔴 Critical (Instant Red Alert)')),
                            DropdownMenuItem(value: 'IMPORTANT', child: Text('🟠 Important (Priority Notice)')),
                            DropdownMenuItem(value: 'NORMAL', child: Text('🔵 Normal Announcement')),
                          ],
                          onChanged: (v) => setModalState(() => priority = v ?? 'NORMAL'),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),

                  const Text('2. Target Classes for Notice:', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF475569))),
                  const SizedBox(height: 6),
                  Wrap(
                    spacing: 6,
                    runSpacing: 4,
                    children: _assignedClasses.map<Widget>((cls) {
                      final code = cls['classCode'].toString();
                      return FilterChip(
                        label: Text('Grade ${cls['grade']}-${cls['section']}', style: const TextStyle(fontSize: 11)),
                        selected: selectedClassCodes.contains(code),
                        onSelected: (v) {
                          setModalState(() {
                            if (v) {
                              selectedClassCodes.add(code);
                            } else if (selectedClassCodes.length > 1) {
                              selectedClassCodes.remove(code);
                            }
                          });
                        },
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 10),

                  // EXAM DETAILS SECTION
                  if (category == 'EXAM') ...[
                    Container(
                      padding: const EdgeInsets.all(12),
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
                              Icon(Icons.edit_calendar, color: Color(0xFF1D4ED8), size: 16),
                              SizedBox(width: 6),
                              Text('Exam & Assessment Schedule Details:', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF1E3A8A))),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Row(
                            children: [
                              Expanded(
                                child: TextField(
                                  controller: examSubjectCtrl,
                                  decoration: const InputDecoration(labelText: 'Exam Subject *', isDense: true, border: OutlineInputBorder(), fillColor: Colors.white, filled: true),
                                ),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: TextField(
                                  controller: examMarksCtrl,
                                  keyboardType: TextInputType.number,
                                  decoration: const InputDecoration(labelText: 'Max Marks', isDense: true, border: OutlineInputBorder(), fillColor: Colors.white, filled: true),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Row(
                            children: [
                              Expanded(
                                child: Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                                  decoration: BoxDecoration(
                                    color: Colors.white,
                                    borderRadius: BorderRadius.circular(6),
                                    border: Border.all(color: const Color(0xFFCBD5E1)),
                                  ),
                                  child: Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      Text('Date: ${examDate.toLocal().toString().split(' ')[0]}', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                                      InkWell(
                                        onTap: () async {
                                          final picked = await showDatePicker(
                                            context: ctx,
                                            initialDate: examDate,
                                            firstDate: DateTime.now(),
                                            lastDate: DateTime.now().add(const Duration(days: 90)),
                                          );
                                          if (picked != null) setModalState(() => examDate = picked);
                                        },
                                        child: const Icon(Icons.calendar_today, size: 14, color: Color(0xFF2563EB)),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: TextField(
                                  controller: examTimingCtrl,
                                  decoration: const InputDecoration(labelText: 'Exam Timings', hintText: '09:30 AM - 12:30 PM', isDense: true, border: OutlineInputBorder(), fillColor: Colors.white, filled: true),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          TextField(
                            controller: examSyllabusCtrl,
                            maxLines: 2,
                            decoration: const InputDecoration(labelText: 'Syllabus & Chapters Included *', isDense: true, border: OutlineInputBorder(), fillColor: Colors.white, filled: true),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 10),
                  ],

                  TextField(
                    controller: titleCtrl,
                    decoration: InputDecoration(
                      labelText: category == 'EXAM' ? 'Exam Notice Title *' : 'Notice Headline *',
                      hintText: category == 'EXAM' ? 'e.g. Mid-Term Assessment Schedule & Guidelines' : 'Notice Title',
                      isDense: true,
                      border: const OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: contentCtrl,
                    maxLines: 3,
                    decoration: const InputDecoration(labelText: 'Notice Instructions & Message for Parents *', isDense: true, border: OutlineInputBorder()),
                  ),
                  const SizedBox(height: 10),

                  // ATTACHMENT SECTION
                  const Text('3. Optional Notice Document (Exam Routine / Syllabus):', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF475569))),
                  const SizedBox(height: 6),
                  if (attachments.isNotEmpty) ...[
                    Wrap(
                      spacing: 6,
                      runSpacing: 4,
                      children: attachments.map<Widget>((att) {
                        return Chip(
                          avatar: const Icon(Icons.attach_file, size: 14),
                          label: Text('${att['fileName']}', style: const TextStyle(fontSize: 10)),
                          deleteIcon: const Icon(Icons.close, size: 14),
                          onDeleted: () => setModalState(() => attachments.remove(att)),
                        );
                      }).toList(),
                    ),
                    const SizedBox(height: 6),
                  ],
                  ElevatedButton.icon(
                    onPressed: isPickingFile
                        ? null
                        : () async {
                            setModalState(() => isPickingFile = true);
                            try {
                              final res = await FilePicker.pickFiles(
                                type: FileType.custom,
                                allowedExtensions: ['pdf', 'doc', 'docx', 'txt'],
                                withData: true,
                              );
                              if (res != null && res.files.isNotEmpty) {
                                final f = res.files.first;
                                if (f.bytes != null) {
                                  final b64 = base64Encode(f.bytes!);
                                  final ext = f.name.split('.').last.toLowerCase();
                                  String mime = 'text/plain';
                                  if (ext == 'pdf') mime = 'application/pdf';
                                  else if (ext == 'docx') mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
                                  else if (ext == 'doc') mime = 'application/msword';

                                  final upRes = await ApiService.instance.post('/assignments/upload', {
                                    'fileName': f.name,
                                    'fileBase64': b64,
                                    'fileType': mime,
                                  });
                                  if (upRes['data'] != null) {
                                    setModalState(() {
                                      attachments.add(Map<String, dynamic>.from(upRes['data']));
                                    });
                                  }
                                }
                              }
                            } catch (_) {}
                            setModalState(() => isPickingFile = false);
                          },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF0F172A),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                    ),
                    icon: const Icon(Icons.upload_file, size: 14),
                    label: Text(isPickingFile ? 'Uploading...' : '📁 Attach Routine / Syllabus (PDF / DOC / TXT)'),
                  ),
                ],
              ),
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.of(ctx).pop(), child: const Text('Cancel')),
            ElevatedButton(
              onPressed: submitting
                  ? null
                  : () async {
                      if (titleCtrl.text.trim().isEmpty || contentCtrl.text.trim().isEmpty) {
                        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please enter Notice Title and Message.')));
                        return;
                      }
                      setModalState(() => submitting = true);
                      try {
                        await ApiService.instance.post('/notices', {
                          'title': titleCtrl.text.trim(),
                          'content': contentCtrl.text.trim(),
                          'category': category,
                          'priority': priority,
                          'classCodes': selectedClassCodes.toList(),
                          'targetRoles': ['PARENT', 'CLASS_TEACHER'],
                          if (category == 'EXAM')
                            'examDetails': {
                              'examName': titleCtrl.text.trim(),
                              'subject': examSubjectCtrl.text.trim(),
                              'examDate': examDate.toIso8601String(),
                              'startTime': examTimingCtrl.text.trim(),
                              'endTime': '',
                              'syllabus': examSyllabusCtrl.text.trim(),
                              'maxMarks': int.tryParse(examMarksCtrl.text.trim()) ?? 100,
                            },
                          'attachments': attachments,
                        });
                        if (mounted) {
                          Navigator.of(ctx).pop();
                          await _loadTeacherData();
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              backgroundColor: const Color(0xFF059669),
                              content: Text(
                                category == 'EXAM'
                                    ? 'Exam schedule published! Parents notified via instant alert.'
                                    : 'Notice sent to parents successfully!',
                              ),
                            ),
                          );
                        }
                      } catch (e) {
                        setModalState(() => submitting = false);
                        if (mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(content: Text('Failed: ${e.toString().replaceAll('Exception: ', '')}')),
                          );
                        }
                      }
                    },
              child: Text(submitting ? 'Publishing...' : category == 'EXAM' ? 'Publish Exam Notice' : 'Send Notice'),
            ),
          ],
        ),
      ),
    );
  }

  void _showReplyQueryDialog(Map<String, dynamic> query) {
    final replyCtrl = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Reply to ${query['subject'] ?? 'Parent Query'}', style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Parent (${query['parentCode']}): ${query['message']}', style: const TextStyle(fontSize: 12, color: Color(0xFF334155))),
            const SizedBox(height: 12),
            TextField(
              controller: replyCtrl,
              maxLines: 3,
              decoration: const InputDecoration(labelText: 'Clarification Reply *', border: OutlineInputBorder()),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.of(ctx).pop(), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () async {
              if (replyCtrl.text.trim().isEmpty) return;
              try {
                await ApiService.instance.post('/assignments/queries/${query['queryCode']}/reply', {
                  'reply': replyCtrl.text.trim(),
                  'status': 'ANSWERED',
                });
                if (mounted) {
                  Navigator.of(ctx).pop();
                  await _loadTeacherData();
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(backgroundColor: Color(0xFF059669), content: Text('Clarification reply sent to parent.')),
                  );
                }
              } catch (e) {
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Reply failed: ${e.toString().replaceAll('Exception: ', '')}')),
                  );
                }
              }
            },
            child: const Text('Send Reply'),
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
            errorBuilder: (_, __, ___) => const Icon(Icons.school, color: Color(0xFF0284C7)),
          ),
        ),
        title: const Text('Teacher Portal', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 17)),
        backgroundColor: Colors.white,
        foregroundColor: const Color(0xFF1E293B),
        elevation: 0,
        actions: [
          IconButton(icon: const Icon(Icons.refresh, color: Color(0xFF0284C7)), onPressed: _loadTeacherData),
          IconButton(
            icon: const Icon(Icons.emergency_outlined, color: Colors.red),
            tooltip: 'Trigger Classroom SOS',
            onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const SosPanicScreen())),
          ),
          IconButton(
            icon: const Icon(Icons.logout),
            tooltip: 'Sign Out',
            onPressed: () async {
              await ApiService.instance.clearSession();
              if (context.mounted) {
                Navigator.of(context).pushReplacement(MaterialPageRoute(builder: (_) => const LoginScreen()));
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
                      Text(_errorMessage!, style: const TextStyle(color: Colors.red)),
                      const SizedBox(height: 12),
                      ElevatedButton(onPressed: _loadTeacherData, child: const Text('Retry')),
                    ],
                  ),
                )
              : Column(
                  children: [
                    _buildTeacherIdentityHeader(),
                    Expanded(child: _buildBody()),
                  ],
                ),
      floatingActionButton: _currentIndex == 0
          ? FloatingActionButton.extended(
              onPressed: _showCreateAssignmentDialog,
              backgroundColor: const Color(0xFF2563EB),
              icon: const Icon(Icons.add_task, color: Colors.white),
              label: const Text('New Homework', style: TextStyle(color: Colors.white)),
            )
          : _currentIndex == 1
              ? FloatingActionButton.extended(
                  onPressed: _showCreateNoticeDialog,
                  backgroundColor: const Color(0xFF0D9488),
                  icon: const Icon(Icons.campaign, color: Colors.white),
                  label: const Text('Send Notice', style: TextStyle(color: Colors.white)),
                )
              : null,
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        onTap: (idx) => setState(() => _currentIndex = idx),
        type: BottomNavigationBarType.fixed,
        selectedItemColor: const Color(0xFF2563EB),
        items: [
          BottomNavigationBarItem(icon: const Icon(Icons.assignment_outlined), label: 'Homework (${_assignments.length})'),
          BottomNavigationBarItem(icon: const Icon(Icons.campaign_outlined), label: 'Notices (${_notices.length})'),
          BottomNavigationBarItem(icon: const Icon(Icons.forum_outlined), label: 'Queries (${_parentQueries.length})'),
          BottomNavigationBarItem(icon: const Icon(Icons.assessment_outlined), label: 'Exams & OMR (${_classAssessments.length})'),
          const BottomNavigationBarItem(icon: Icon(Icons.calendar_month_outlined), label: 'Timetable'),
        ],
      ),
    );
  }

  Widget _buildTeacherIdentityHeader() {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 10, 16, 6),
      padding: const EdgeInsets.all(12),
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
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(_teacherFullName ?? 'Faculty Member', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                  Text('${_teacherSchoolName ?? 'Vijay High school'} • ${_teacherUserCode ?? ''}', style: const TextStyle(fontSize: 11, color: Color(0xFF059669), fontWeight: FontWeight.w600)),
                ],
              ),
              IconButton(
                icon: const Icon(Icons.copy, size: 16, color: Color(0xFF059669)),
                onPressed: () {
                  if (_teacherUserCode != null) {
                    Clipboard.setData(ClipboardData(text: _teacherUserCode!));
                    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Teacher code copied!')));
                  }
                },
              ),
            ],
          ),
          const SizedBox(height: 6),
          if (_assignedClasses.isEmpty)
            const Text('No classes assigned yet (Ask School Admin to assign classes).', style: TextStyle(fontSize: 11, color: Color(0xFFB45309)))
          else
            Wrap(
              spacing: 6,
              runSpacing: 4,
              children: _assignedClasses.map<Widget>((cls) {
                return Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: const Color(0xFFEFF6FF),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFFBFDBFE)),
                  ),
                  child: Text(
                    'Grade ${cls['grade']}-${cls['section']} (${cls['subject'] ?? 'General'}) • ${cls['studentCount'] ?? 0} students',
                    style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFF1D4ED8)),
                  ),
                );
              }).toList(),
            ),
          if (_timetableData != null) ...[
            const SizedBox(height: 8),
            InkWell(
              onTap: () => setState(() => _currentIndex = 4),
              borderRadius: BorderRadius.circular(8),
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: _timetableData!['currentSession'] != null
                      ? const Color(0xFFECFDF5)
                      : const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(
                    color: _timetableData!['currentSession'] != null
                        ? const Color(0xFF6EE7B7)
                        : const Color(0xFFE2E8F0),
                  ),
                ),
                child: Row(
                  children: [
                    Icon(
                      Icons.schedule,
                      size: 15,
                      color: _timetableData!['currentSession'] != null
                          ? const Color(0xFF047857)
                          : const Color(0xFF0284C7),
                    ),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        () {
                          final cur = _timetableData!['currentSession'];
                          final nxt = _timetableData!['nextSession'];
                          if (cur is Map) {
                            return 'LIVE PERIOD: ${cur['subject']} • ${cur['classCode']} (${cur['startTime']} - ${cur['endTime']})';
                          }
                          if (nxt is Map) {
                            return 'NEXT PERIOD: ${nxt['subject']} • ${nxt['classCode']} (${nxt['startTime']} - ${nxt['endTime']})';
                          }
                          final cnt = (_timetableData!['todaySessions'] is List) ? (_timetableData!['todaySessions'] as List).length : 0;
                          return 'Today (${_timetableData!['today']}): $cnt scheduled period(s) • Tap to view Timetable';
                        }(),
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: _timetableData!['currentSession'] != null
                              ? const Color(0xFF065F46)
                              : const Color(0xFF334155),
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildBody() {
    switch (_currentIndex) {
      case 0:
        return _buildAssignmentsTab();
      case 1:
        return _buildNoticesTab();
      case 2:
        return _buildQueriesTab();
      case 3:
        return _buildExamsAndIncidentsTab();
      case 4:
      default:
        return _buildTimetableTab();
    }
  }

  Widget _buildTimetableTab() {
    const days = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
    final week = _timetableData?['week'] is Map ? Map<String, dynamic>.from(_timetableData!['week']) : <String, dynamic>{};
    final dayList = week[_selectedTimetableDay] is List ? (week[_selectedTimetableDay] as List) : <dynamic>[];
    final currentSession = _timetableData?['currentSession'] is Map
        ? Map<String, dynamic>.from(_timetableData!['currentSession'])
        : null;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: const Color(0xFFEFF6FF),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFFBFDBFE)),
          ),
          child: const Row(
            children: [
              Icon(Icons.calendar_month, color: Color(0xFF1D4ED8), size: 20),
              SizedBox(width: 8),
              Expanded(
                child: Text(
                  'School Admin Master Timetable: All classes, period timings, and homework follow this official schedule.',
                  style: TextStyle(fontSize: 11, color: Color(0xFF1E3A8A), fontWeight: FontWeight.w600),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: days.map((d) {
              final active = d == _selectedTimetableDay;
              final isToday = d == _timetableData?['today']?.toString();
              return Padding(
                padding: const EdgeInsets.only(right: 6),
                child: ChoiceChip(
                  label: Text(isToday ? '$d (Today)' : d, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                  selected: active,
                  onSelected: (_) => setState(() => _selectedTimetableDay = d),
                ),
              );
            }).toList(),
          ),
        ),
        const SizedBox(height: 12),
        if (dayList.isEmpty)
          Container(
            padding: const EdgeInsets.all(24),
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: Text(
              'No periods scheduled for $_selectedTimetableDay yet. Ask School Admin to generate or assign your class timetable.',
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
            ),
          )
        else
          ...dayList.map((s) {
            final isNow = currentSession != null &&
                _selectedTimetableDay == _timetableData?['today']?.toString() &&
                currentSession['sessionId'] == s['sessionId'];
            return Card(
              elevation: 0,
              margin: const EdgeInsets.only(bottom: 10),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
                side: BorderSide(color: isNow ? const Color(0xFF059669) : const Color(0xFFE2E8F0), width: isNow ? 1.5 : 1),
              ),
              color: isNow ? const Color(0xFFECFDF5) : Colors.white,
              child: ListTile(
                leading: CircleAvatar(
                  backgroundColor: isNow ? const Color(0xFF059669) : const Color(0xFF0284C7),
                  foregroundColor: Colors.white,
                  child: Text('P${s['periodNumber'] ?? ''}', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                ),
                title: Text(
                  '${s['subject'] ?? s['title'] ?? 'Class'} • ${s['classCode'] ?? ''}',
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                ),
                subtitle: Text(
                  '${s['startTime']} - ${s['endTime']}${isNow ? ' • LIVE NOW' : ''}',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: isNow ? FontWeight.bold : FontWeight.normal,
                    color: isNow ? const Color(0xFF047857) : const Color(0xFF64748B),
                  ),
                ),
                trailing: OutlinedButton(
                  onPressed: _showCreateAssignmentDialog,
                  style: OutlinedButton.styleFrom(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4)),
                  child: const Text('+ Task', style: TextStyle(fontSize: 11)),
                ),
              ),
            );
          }),
      ],
    );
  }

  Widget _buildAssignmentsTab() {
    if (_assignments.isEmpty) {
      return const Center(
        child: Text('No active assignments. Tap "+ New Homework" to post to your assigned classes.', textAlign: TextAlign.center),
      );
    }
    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 80),
      itemCount: _assignments.length,
      separatorBuilder: (_, __) => const SizedBox(height: 10),
      itemBuilder: (ctx, idx) {
        final a = _assignments[idx];
        final delivery = a['deliverySummary'] ?? {};
        final attachments = (a['attachments'] is List) ? (a['attachments'] as List) : [];
        final expiresAtStr = a['expiresAt'] != null ? a['expiresAt'].toString().split('T').first : '7 days';
        final format = a['format']?.toString() ?? 'TEXT';
        final isPdf = format == 'PDF' || attachments.any((att) => att['fileName']?.toString().endsWith('.pdf') == true);
        final isDoc = format == 'DOC' || attachments.any((att) => att['fileName']?.toString().endsWith('.docx') == true || att['fileName']?.toString().endsWith('.doc') == true);

        return Card(
          elevation: 0,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: const BorderSide(color: Color(0xFFE2E8F0))),
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
                          child: Text('${a['classCode']} • ${a['subject'] ?? 'General'}', style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFF1D4ED8))),
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
                    Text('Auto-deletes: $expiresAtStr', style: const TextStyle(fontSize: 10, color: Color(0xFF64748B))),
                  ],
                ),
                const SizedBox(height: 6),
                Text(a['title'] ?? 'Homework', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                const SizedBox(height: 4),
                Text(a['description'] ?? '', style: const TextStyle(fontSize: 12, color: Color(0xFF475569))),
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
                      'Due: ${a['dueDate']?.toString().split('T').first ?? 'N/A'}',
                      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF334155)),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(color: const Color(0xFFECFDF5), borderRadius: BorderRadius.circular(6)),
                      child: Text(
                        'Delivery: Viewed by ${delivery['viewedCount'] ?? 0} / ${delivery['totalStudents'] ?? 0} parents',
                        style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFF047857)),
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
      return const Center(child: Text('No class notices posted yet. Tap "+ Send Notice".'));
    }
    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 80),
      itemCount: _notices.length,
      separatorBuilder: (_, __) => const SizedBox(height: 10),
      itemBuilder: (ctx, idx) {
        final n = _notices[idx];
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

                // EXAM DETAILS CONTAINER
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
                            const Icon(Icons.school, size: 15, color: Color(0xFF1D4ED8)),
                            const SizedBox(width: 6),
                            Text(
                              '${exam['subject'] ?? 'Subject'} • ${exam['examDate'] != null ? exam['examDate'].toString().split('T').first : ''} (${exam['startTime'] ?? 'TBD'})',
                              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF1E3A8A)),
                            ),
                          ],
                        ),
                        if (exam['syllabus'] != null && exam['syllabus'].toString().isNotEmpty) ...[
                          const SizedBox(height: 4),
                          Text('Syllabus: ${exam['syllabus']}', style: const TextStyle(fontSize: 11, color: Color(0xFF334155))),
                        ],
                      ],
                    ),
                  ),
                ],

                // ATTACHMENTS
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
                      'Published: ${n['createdAt']?.toString().split('T').first ?? ''}',
                      style: const TextStyle(fontSize: 10, color: Color(0xFF94A3B8)),
                    ),
                    if (n['classCodes'] is List && (n['classCodes'] as List).isNotEmpty)
                      Text(
                        'Classes: ${(n['classCodes'] as List).join(', ')}',
                        style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: Color(0xFF64748B)),
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

  Widget _buildQueriesTab() {
    if (_parentQueries.isEmpty) {
      return const Center(child: Text('No parent queries for your assigned classes.'));
    }
    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: _parentQueries.length,
      separatorBuilder: (_, __) => const SizedBox(height: 10),
      itemBuilder: (ctx, idx) {
        final q = _parentQueries[idx];
        final isPriority = q['queryType'] != 'NORMAL';
        return Card(
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
            side: BorderSide(color: isPriority ? const Color(0xFFFCA5A5) : const Color(0xFFE2E8F0)),
          ),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('${q['queryType'] ?? 'NORMAL'} • ${q['classCode']}', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: isPriority ? Colors.red : const Color(0xFF2563EB))),
                    Text(q['status'] ?? 'OPEN', style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold)),
                  ],
                ),
                const SizedBox(height: 4),
                Text(q['subject'] ?? 'Parent Query', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                Text(q['message'] ?? '', style: const TextStyle(fontSize: 12, color: Color(0xFF475569))),
                if (q['reply']?['message'] != null) ...[
                  const SizedBox(height: 8),
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(color: const Color(0xFFECFDF5), borderRadius: BorderRadius.circular(8)),
                    child: Text('Your Reply: ${q['reply']['message']}', style: const TextStyle(fontSize: 11, color: Color(0xFF065F46))),
                  ),
                ] else ...[
                  const SizedBox(height: 8),
                  Align(
                    alignment: Alignment.centerRight,
                    child: ElevatedButton.icon(
                      onPressed: () => _showReplyQueryDialog(Map<String, dynamic>.from(q)),
                      icon: const Icon(Icons.reply, size: 15),
                      label: const Text('Send Clarification Reply', style: TextStyle(fontSize: 11)),
                    ),
                  ),
                ],
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildExamsAndIncidentsTab() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text(
              'Class Assessments & AI OMR Exams',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: Color(0xFF1E293B)),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: const Color(0xFF2563EB).withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                '${_classAssessments.length} Exams',
                style: const TextStyle(color: Color(0xFF2563EB), fontWeight: FontWeight.bold, fontSize: 11),
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        if (_classAssessments.isEmpty)
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: const Row(
              children: [
                Icon(Icons.quiz_outlined, color: Color(0xFF94A3B8), size: 28),
                SizedBox(width: 12),
                Expanded(
                  child: Text(
                    'No exams published for your assigned classes yet. AI OMR evaluations and report cards will appear here.',
                    style: TextStyle(color: Color(0xFF64748B), fontSize: 12),
                  ),
                ),
              ],
            ),
          )
        else
          ..._classAssessments.map<Widget>((asm) {
            final title = asm['title']?.toString() ?? 'Assessment';
            final subject = asm['subject']?.toString() ?? 'General';
            final type = asm['assessmentType']?.toString() ?? 'FA-1';
            final classCode = asm['classCode']?.toString() ?? '';
            final totalMarks = asm['totalMarks']?.toString() ?? '50';
            final studentsList = asm['students'] is List ? (asm['students'] as List) : [];
            final studentCount = asm['totalStudentsEvaluated'] ?? studentsList.length;
            final avgScore = asm['averageScore'] != null ? '${asm['averageScore']}%' : 'Evaluated';

            return Card(
              margin: const EdgeInsets.only(bottom: 10),
              elevation: 0,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
                side: const BorderSide(color: Color(0xFFE2E8F0)),
              ),
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: const Color(0xFF2563EB),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            type,
                            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 11),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                title,
                                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF0F172A)),
                              ),
                              Text(
                                'Subject: $subject • Class: $classCode',
                                style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                              ),
                            ],
                          ),
                        ),
                        Text(
                          'Max: $totalMarks',
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 11, color: Color(0xFF334155)),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF8FAFC),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Row(
                            children: [
                              const Icon(Icons.people_outline, size: 14, color: Color(0xFF64748B)),
                              const SizedBox(width: 4),
                              Text(
                                'Evaluated: $studentCount students',
                                style: const TextStyle(fontSize: 11, color: Color(0xFF475569), fontWeight: FontWeight.w500),
                              ),
                            ],
                          ),
                          Text(
                            'Status: $avgScore',
                            style: const TextStyle(fontSize: 11, color: Color(0xFF16A34A), fontWeight: FontWeight.bold),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            );
          }),
        const Divider(height: 28),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              'Class Incidents (${_incidents.length})',
              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF1E293B)),
            ),
          ],
        ),
        const SizedBox(height: 8),
        if (_incidents.isEmpty)
          const Text('No class incidents recorded.', style: TextStyle(color: Color(0xFF64748B), fontSize: 12))
        else
          ..._incidents.map((inc) => Card(
                elevation: 0,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: const BorderSide(color: Color(0xFFE2E8F0))),
                child: ListTile(
                  leading: const Icon(Icons.warning_amber_rounded, color: Colors.orange),
                  title: Text(inc['type'] ?? 'Incident', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                  subtitle: Text(inc['description'] ?? '', style: const TextStyle(fontSize: 12)),
                  trailing: Text(inc['severity'] ?? 'LOW', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 11)),
                ),
              )),
      ],
    );
  }
}
