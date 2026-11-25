'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient, clearStoredSession, getStoredUser } from '../../lib/api';
import LiveFleetMap, { FleetItem } from '../../components/LiveFleetMap';
import FreeLlmAssistant from '../../components/FreeLlmAssistant';
import SchoolWelcomeGreeting from '../../components/SchoolWelcomeGreeting';

export default function SchoolAdminDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'APPROVALS' | 'USERS' | 'CLASSES' | 'TIMETABLE' | 'STUDENTS' | 'EXAMS_OMR' | 'WHATSAPP' | 'TRANSPORT' | 'INCIDENTS' | 'FEES' | 'EVENTS'>('APPROVALS');

  const [pendingUsers, setPendingUsers] = useState<any[]>([]);
  const [tenantUsers, setTenantUsers] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [cameras, setCameras] = useState<any[]>([]);
  const [buses, setBuses] = useState<any[]>([]);
  const [routes, setRoutes] = useState<any[]>([]);
  const [incidents, setIncidents] = useState<any[]>([]);

  // Fees & WhatsApp Reminders State
  const [fees, setFees] = useState<any[]>([]);
  const [feeStats, setFeeStats] = useState<any | null>(null);
  const [feeFilterClass, setFeeFilterClass] = useState<string>('ALL');
  const [feeFilterStatus, setFeeFilterStatus] = useState<string>('ALL');
  const [feeSearch, setFeeSearch] = useState<string>('');
  const [isAssignFeeModal, setIsAssignFeeModal] = useState(false);
  const [assignFeeStudentCode, setAssignFeeStudentCode] = useState('');
  const [assignFeeClassCode, setAssignFeeClassCode] = useState('');
  const [assignFeeType, setAssignFeeType] = useState('TUITION');
  const [assignFeeAmount, setAssignFeeAmount] = useState('15000');
  const [assignFeeDueDate, setAssignFeeDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().split('T')[0];
  });
  const [assignFeeNotes, setAssignFeeNotes] = useState('Quarterly tuition fee');
  const [payFeeTarget, setPayFeeTarget] = useState<any | null>(null);
  const [payFeeAmount, setPayFeeAmount] = useState('');
  const [payFeeMethod, setPayFeeMethod] = useState('UPI');
  const [payFeeRef, setPayFeeRef] = useState('');
  const [payFeeNotes, setPayFeeNotes] = useState('');
  const [whatsAppConfig, setWhatsAppConfig] = useState<any | null>(null);
  const [isWhatsAppModal, setIsWhatsAppModal] = useState(false);
  const [waMode, setWaMode] = useState<'PERSONAL' | 'BUSINESS'>('PERSONAL');
  const [waPhoneInput, setWaPhoneInput] = useState('+91 86884 84559');
  const [waAccountInput, setWaAccountInput] = useState('PERSONAL-WA-8688484559');
  const [waApiKeyInput, setWaApiKeyInput] = useState('');

  // Events Gallery (7-Day Expiry) State
  const [events, setEvents] = useState<any[]>([]);
  const [isCreateEventModal, setIsCreateEventModal] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventCategory, setNewEventCategory] = useState('CAMPUS');
  const [newEventDate, setNewEventDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [newEventDescription, setNewEventDescription] = useState('');
  const [newEventImages, setNewEventImages] = useState<string[]>([
    'https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=800&q=80'
  ]);
  const [newImageUrlInput, setNewImageUrlInput] = useState('');

  // Student Edit, Class Transfer & Excel Import/Export State
  const [editStudentTarget, setEditStudentTarget] = useState<any | null>(null);
  const [editStudentName, setEditStudentName] = useState('');
  const [editStudentDob, setEditStudentDob] = useState('2014-06-01');
  const [editStudentGender, setEditStudentGender] = useState('MALE');
  const [editStudentPhone, setEditStudentPhone] = useState('');
  const [editStudentBus, setEditStudentBus] = useState('');

  const [transferStudentTarget, setTransferStudentTarget] = useState<any | null>(null);
  const [transferTargetClassCode, setTransferTargetClassCode] = useState('');
  const [transferTargetSection, setTransferTargetSection] = useState('A');
  const [transferReason, setTransferReason] = useState('Mid-term section rebalancing');

  const [isImportModal, setIsImportModal] = useState(false);
  const [importText, setImportText] = useState('');
  const [importResults, setImportResults] = useState<any | null>(null);

  // Daily Teacher Assignment State
  const [dailyAssignDate, setDailyAssignDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [dailyAssignClassCode, setDailyAssignClassCode] = useState('');
  const [dailyAssignmentsList, setDailyAssignmentsList] = useState<any[]>([]);
  const [dailyTeacherSelected, setDailyTeacherSelected] = useState('');
  const [dailySubjectSelected, setDailySubjectSelected] = useState('Mathematics');
  const [dailyPeriodSelected, setDailyPeriodSelected] = useState(1);

  // Assessments & AI OMR Correction State
  const [assessments, setAssessments] = useState<any[]>([]);
  const [selectedAssessment, setSelectedAssessment] = useState<any | null>(null);
  const [isCreateAssessmentModal, setIsCreateAssessmentModal] = useState(false);
  const [isEvaluateOmrModal, setIsEvaluateOmrModal] = useState(false);
  const [isReportCardModal, setIsReportCardModal] = useState(false);
  const [selectedStudentReport, setSelectedStudentReport] = useState<any | null>(null);
  const [evaluationLoading, setEvaluationLoading] = useState(false);
  const [omrUploadStudentName, setOmrUploadStudentName] = useState('');
  const [omrUploadFileName, setOmrUploadFileName] = useState('');
  const [omrEvaluationProgress, setOmrEvaluationProgress] = useState(0);

  // WhatsApp Broadcast & Management State
  const [isWhatsAppBroadcastModal, setIsWhatsAppBroadcastModal] = useState(false);
  const [broadcastTarget, setBroadcastTarget] = useState<'CLASS' | 'ALL_PARENTS' | 'TEACHERS'>('CLASS');
  const [broadcastClassCode, setBroadcastClassCode] = useState('');
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastLoading, setBroadcastLoading] = useState(false);

  // New Assessment Creation State
  const [newAssessment, setNewAssessment] = useState({
    classCode: '',
    title: 'Unit Test 1 - Core Mathematics',
    assessmentType: 'FA-1',
    subject: 'Mathematics',
    totalQuestions: 20,
    marksPerQuestion: 1,
    negativeMarking: 0,
    customType: '',
    answerKeyText: '1A, 2C, 3B, 4D, 5A, 6B, 7C, 8D, 9A, 10C, 11B, 12A, 13D, 14C, 15B, 16A, 17D, 18C, 19B, 20A'
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Auto-dismiss alert banner after 4.5 seconds
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 4500);
    return () => clearTimeout(t);
  }, [message]);

  // Parent Verification Modal State
  const [verifyParentTarget, setVerifyParentTarget] = useState<any | null>(null);
  const [studentAdmissionNo, setStudentAdmissionNo] = useState('');
  const [childFullName, setChildFullName] = useState('');
  const [childGrade, setChildGrade] = useState('6');
  const [childSection, setChildSection] = useState('A');
  const [parentRelationship, setParentRelationship] = useState('FATHER');
  const [consentAccepted, setConsentAccepted] = useState(true);
  const [verificationNotes, setVerificationNotes] = useState('');

  // Class Creation Modal
  const [isCreateClassModal, setIsCreateClassModal] = useState(false);
  const [newGrade, setNewGrade] = useState('6');
  const [newSection, setNewSection] = useState('A');
  const [newCapacity, setNewCapacity] = useState('40');
  const [newRoomNumber, setNewRoomNumber] = useState('101');

  // Student Enrollment Modal
  const [isEnrollStudentModal, setIsEnrollStudentModal] = useState(false);
  const [enrollAdmissionNo, setEnrollAdmissionNo] = useState('');
  const [enrollStudentName, setEnrollStudentName] = useState('');
  const [enrollDob, setEnrollDob] = useState('2014-05-10');
  const [enrollGender, setEnrollGender] = useState('MALE');
  const [enrollClassCode, setEnrollClassCode] = useState('');

  // Camera Creation Modal
  const [isCreateCameraModal, setIsCreateCameraModal] = useState(false);
  const [camName, setCamName] = useState('');
  const [camLocation, setCamLocation] = useState('');
  const [camClassCode, setCamClassCode] = useState('');
  const [camRtspUrl, setCamRtspUrl] = useState('');

  // Bus Creation & Edit Modal
  const [isCreateBusModal, setIsCreateBusModal] = useState(false);
  const [busRegistration, setBusRegistration] = useState('');
  const [busNumberLabel, setBusNumberLabel] = useState('');
  const [busCapacity, setBusCapacity] = useState('40');
  const [busDriverCode, setBusDriverCode] = useState('');
  const [busRouteCode, setBusRouteCode] = useState('');
  const [editBusTarget, setEditBusTarget] = useState<any | null>(null);
  const [editBusDriverCode, setEditBusDriverCode] = useState('');
  const [editBusRouteCode, setEditBusRouteCode] = useState('');
  const [editBusStatus, setEditBusStatus] = useState('ACTIVE');

  // Live Fleet GPS & Route/Places State
  const [fleetItems, setFleetItems] = useState<FleetItem[]>([]);
  const [selectedMapBusCode, setSelectedMapBusCode] = useState<string | null>(null);
  const [selectedMapRouteCode, setSelectedMapRouteCode] = useState<string | null>(null);
  const [autoRefreshMap, setAutoRefreshMap] = useState(true);

  // Create Route & Places Modal State
  const [isCreateRouteModal, setIsCreateRouteModal] = useState(false);
  const [routeName, setRouteName] = useState('');
  const [routeStartName, setRouteStartName] = useState('Kukatpally Housing Board');
  const [routeStartLat, setRouteStartLat] = useState('17.4948');
  const [routeStartLng, setRouteStartLng] = useState('78.3996');
  const [routeEndName, setRouteEndName] = useState('School Main Campus');
  const [routeEndLat, setRouteEndLat] = useState('17.4483');
  const [routeEndLng, setRouteEndLng] = useState('78.3915');
  const [routeBusCode, setRouteBusCode] = useState('');
  const [routeDriverCode, setRouteDriverCode] = useState('');
  const [routeStopsDraft, setRouteStopsDraft] = useState<Array<{
    stopName: string;
    scheduledPickupTime: string;
    scheduledDropTime: string;
    lat: string;
    lng: string;
  }>>([
    { stopName: 'JNTU Cross Roads', scheduledPickupTime: '07:35', scheduledDropTime: '15:35', lat: '17.4933', lng: '78.3914' },
    { stopName: 'Hitech City Junction', scheduledPickupTime: '07:50', scheduledDropTime: '15:20', lat: '17.4504', lng: '78.3808' }
  ]);
  const [activeMapPickerField, setActiveMapPickerField] = useState<string>('START');
  const [placeSearching, setPlaceSearching] = useState(false);
  const [placeSuggestionsField, setPlaceSuggestionsField] = useState<string | null>(null);
  const [placeSuggestions, setPlaceSuggestions] = useState<Array<{
    name: string;
    displayName: string;
    lat: number;
    lng: number;
    category?: string;
  }>>([]);
  const [modClassCodes, setModClassCodes] = useState<string[]>([]);

  // Add Stop Modal State
  const [addStopRouteTarget, setAddStopRouteTarget] = useState<any | null>(null);
  const [newStopName, setNewStopName] = useState('');
  const [newStopPickup, setNewStopPickup] = useState('07:40');
  const [newStopDrop, setNewStopDrop] = useState('15:40');
  const [newStopLat, setNewStopLat] = useState('17.4700');
  const [newStopLng, setNewStopLng] = useState('78.3900');

  // Timetable Generator & Editor State
  const [ttClassCode, setTtClassCode] = useState<string>('');
  const [ttDay, setTtDay] = useState<'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN'>('MON');
  const [ttData, setTtData] = useState<any | null>(null);
  const [ttSessionsDraft, setTtSessionsDraft] = useState<any[]>([]);
  const [ttGenStart, setTtGenStart] = useState('09:00');
  const [ttGenMinutes, setTtGenMinutes] = useState('45');
  const [ttGenPeriods, setTtGenPeriods] = useState('6');
  const [ttIncludeLiveNow, setTtIncludeLiveNow] = useState(true);

  // Sub-tabs in Staff & Parent Users Tab (Photo 3 requirement)
  const [userSubTab, setUserSubTab] = useState<'ALL' | 'PARENT' | 'TEACHER' | 'DRIVER'>('ALL');

  // Modify User Modal State
  const [modifyTargetUser, setModifyTargetUser] = useState<any | null>(null);
  const [modFullName, setModFullName] = useState('');
  const [modEmail, setModEmail] = useState('');
  const [modPhone, setModPhone] = useState('');
  const [modStatus, setModStatus] = useState<'ACTIVE' | 'SUSPENDED'>('ACTIVE');
  const [modTransportEnabled, setModTransportEnabled] = useState(true);
  const [modStudentCode, setModStudentCode] = useState('');
  const [modClassCode, setModClassCode] = useState('');
  const [modBusCode, setModBusCode] = useState('');
  const [modRouteCode, setModRouteCode] = useState('');
  const [modIsClassTeacher, setModIsClassTeacher] = useState(false);
  const [modSubject, setModSubject] = useState('');

  // Approve Teacher Modal State (Prompt for Class Access)
  const [approveTeacherTarget, setApproveTeacherTarget] = useState<any | null>(null);
  const [apprTeacherClassCode, setApprTeacherClassCode] = useState('');
  const [apprTeacherIsClassTeacher, setApprTeacherIsClassTeacher] = useState(false);
  const [apprTeacherSubject, setApprTeacherSubject] = useState('General');

  // User Profile Modal State (Showing School Code only in Profile Menu)
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  useEffect(() => {
    const profile = getStoredUser();
    if (!profile || profile.role !== 'SCHOOL_ADMIN') {
      router.push('/');
      return;
    }

    if (!profile.schoolName || profile.schoolName.startsWith('SSC-SCH-')) {
      apiClient('/auth/me')
        .then((res) => {
          if (res.data?.user) {
            const updated = {
              ...profile,
              ...res.data.user,
              schoolName: res.data.user.schoolName || 'Vijay High school'
            };
            setUser(updated);
            if (typeof window !== 'undefined') {
              localStorage.setItem('ssc_user_profile', JSON.stringify(updated));
            }
          } else {
            setUser({ ...profile, schoolName: 'Vijay High school' });
          }
        })
        .catch(() => {
          setUser({ ...profile, schoolName: profile.schoolName || 'Vijay High school' });
        });
    } else {
      setUser(profile);
    }
    loadTenantData();
  }, []);

  const loadFleetTelemetry = async () => {
    try {
      const fleetRes = await apiClient('/transport/fleet');
      setFleetItems(fleetRes.data?.fleet || []);
      if (fleetRes.data?.routes) {
        setRoutes(fleetRes.data.routes);
      }
    } catch {
      // silent poll failure
    }
  };

  useEffect(() => {
    if (activeTab !== 'TRANSPORT' || !autoRefreshMap) return;
    loadFleetTelemetry();
    const timer = setInterval(loadFleetTelemetry, 5000);
    return () => clearInterval(timer);
  }, [activeTab, autoRefreshMap]);

  const loadTenantData = async () => {
    setLoading(true);
    try {
      const [
        pendingRes,
        usersRes,
        classesRes,
        studentsRes,
        assessmentsRes,
        busesRes,
        routesRes,
        incidentsRes,
        fleetRes,
        feesRes,
        feeStatsRes,
        eventsRes,
        waRes
      ] = await Promise.all([
        apiClient('/school-admin/pending-approvals'),
        apiClient('/school-admin/users?limit=100'),
        apiClient('/classes'),
        apiClient('/students?limit=100'),
        apiClient('/assessments').catch(() => ({ data: [] })),
        apiClient('/transport/buses'),
        apiClient('/transport/routes'),
        apiClient('/incidents?limit=30'),
        apiClient('/transport/fleet').catch(() => ({ data: { fleet: [] } })),
        apiClient('/fees?limit=50').catch(() => ({ data: { fees: [] } })),
        apiClient('/fees/stats').catch(() => ({ data: null })),
        apiClient('/events').catch(() => ({ data: { events: [] } })),
        apiClient('/school-admin/whatsapp').catch(() => ({ data: { whatsapp: null } }))
      ]);

      setPendingUsers(pendingRes.data?.users || []);
      setTenantUsers(usersRes.data?.users || []);
      setClasses(classesRes.data?.classes || []);
      setStudents(studentsRes.data?.students || []);
      setAssessments(assessmentsRes.data || []);
      if (assessmentsRes.data?.length) setSelectedAssessment(assessmentsRes.data[0]);
      setBuses(busesRes.data?.buses || []);
      setRoutes(routesRes.data?.routes || []);
      setIncidents(incidentsRes.data?.incidents || []);
      setFleetItems(fleetRes.data?.fleet || []);
      setFees(feesRes.data?.fees || []);
      setFeeStats(feeStatsRes.data || null);
      setEvents(eventsRes.data?.events || []);
      setWhatsAppConfig(waRes.data?.whatsapp || null);

      if (classesRes.data?.classes?.length && !dailyAssignClassCode) {
        setDailyAssignClassCode(classesRes.data.classes[0].classCode);
      }
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const loadFees = async () => {
    try {
      const [res, stats] = await Promise.all([
        apiClient(
          `/fees?limit=100${feeFilterClass !== 'ALL' ? `&classCode=${feeFilterClass}` : ''}${
            feeFilterStatus !== 'ALL' ? `&status=${feeFilterStatus}` : ''
          }${feeSearch ? `&search=${encodeURIComponent(feeSearch)}` : ''}`
        ),
        apiClient('/fees/stats')
      ]);
      setFees(res.data?.fees || []);
      setFeeStats(stats.data || null);
    } catch (err: any) {
      console.warn('loadFees error:', err.message);
    }
  };

  const loadEvents = async () => {
    try {
      const res = await apiClient('/events');
      setEvents(res.data?.events || []);
    } catch (err: any) {
      console.warn('loadEvents error:', err.message);
    }
  };

  const loadWhatsAppConfig = async () => {
    try {
      const res = await apiClient('/school-admin/whatsapp');
      setWhatsAppConfig(res.data?.whatsapp || null);
      if (res.data?.whatsapp?.phoneNumber) {
        setWaPhoneInput(res.data.whatsapp.phoneNumber);
      }
      if (res.data?.whatsapp?.businessAccountId) {
        setWaAccountInput(res.data.whatsapp.businessAccountId);
      }
    } catch (err: any) {
      console.warn('loadWhatsAppConfig error:', err.message);
    }
  };

  const loadDailyAssignments = async (dateStr?: string, clsCode?: string) => {
    try {
      const d = dateStr || dailyAssignDate;
      const c = clsCode !== undefined ? clsCode : dailyAssignClassCode;
      const res = await apiClient(`/school-admin/daily-teacher-assignment?date=${d}${c ? `&classCode=${c}` : ''}`);
      setDailyAssignmentsList(res.data?.assignments || []);
    } catch (err: any) {
      console.warn('loadDailyAssignments error:', err.message);
    }
  };

  const handleCreateFee = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await apiClient('/fees', {
        method: 'POST',
        body: JSON.stringify({
          studentCode: assignFeeStudentCode || undefined,
          classCode: !assignFeeStudentCode ? assignFeeClassCode : undefined,
          feeType: assignFeeType,
          amount: parseFloat(assignFeeAmount),
          dueDate: assignFeeDueDate,
          notes: assignFeeNotes
        })
      });
      setMessage({ text: res.message || 'Fee record created successfully.', type: 'success' });
      setIsAssignFeeModal(false);
      await loadFees();
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payFeeTarget) return;
    setLoading(true);
    try {
      const res = await apiClient(`/fees/${payFeeTarget._id}/pay`, {
        method: 'POST',
        body: JSON.stringify({
          paidAmount: parseFloat(payFeeAmount),
          paymentMethod: payFeeMethod,
          transactionRef: payFeeRef,
          notes: payFeeNotes
        })
      });
      setMessage({
        text: `Payment of ₹${payFeeAmount} recorded. Official Receipt: ${res.data?.receiptNumber || 'Generated'}`,
        type: 'success'
      });
      setPayFeeTarget(null);
      await loadFees();
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleSendWhatsAppReminder = async (feeId: string) => {
    setLoading(true);
    try {
      const res = await apiClient(`/fees/${feeId}/remind-whatsapp`, { method: 'POST' });
      setMessage({
        text: `WhatsApp fee reminder dispatched to parent (${res.data?.targetPhone || 'mobile'}).`,
        type: 'success'
      });
      await loadFees();
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleSendAllWhatsAppReminders = async () => {
    if (!confirm('Send WhatsApp fee reminders to ALL parents with pending or partial fee balances?')) return;
    setLoading(true);
    try {
      const res = await apiClient('/fees/remind-all-whatsapp', {
        method: 'POST',
        body: JSON.stringify({ classCode: feeFilterClass !== 'ALL' ? feeFilterClass : undefined })
      });
      setMessage({
        text: `WhatsApp fee reminders dispatched to ${res.data?.sentCount || 0} parents.`,
        type: 'success'
      });
      await loadFees();
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateWhatsAppConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const cleanPhone = waPhoneInput.trim();
      const finalAccountId = waMode === 'PERSONAL'
        ? `PERSONAL-WA-${cleanPhone.replace(/\D/g, '') || 'ADMIN'}`
        : (waAccountInput.trim() || `WABA-${user?.schoolCode || 'SSC'}`);

      const res = await apiClient('/school-admin/whatsapp/connect', {
        method: 'POST',
        body: JSON.stringify({
          phoneNumber: cleanPhone,
          businessAccountId: finalAccountId,
          apiKey: waApiKeyInput.trim() || undefined,
          status: 'CONNECTED'
        })
      });
      setWhatsAppConfig(res.data);
      setMessage({
        text: `WhatsApp Gateway successfully connected to ${cleanPhone} (${waMode === 'PERSONAL' ? 'Personal WhatsApp Admin Channel' : 'WhatsApp Business API'}).`,
        type: 'success'
      });
      setIsWhatsAppModal(false);
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const loadAssessments = async () => {
    try {
      const res = await apiClient('/assessments');
      setAssessments(res.data || []);
      if (res.data?.length) {
        setSelectedAssessment((prev: any) => {
          if (!prev) return res.data[0];
          const found = res.data.find((a: any) => a._id === prev._id);
          return found || res.data[0];
        });
      }
    } catch (_) {}
  };

  const handleCreateAssessment = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const actualType = newAssessment.assessmentType === 'CUSTOM'
        ? (newAssessment.customType || 'Custom Assessment')
        : newAssessment.assessmentType;

      const pairs = newAssessment.answerKeyText.split(',').map((p: string) => p.trim());
      const answerKey: Array<{ questionNumber: number; correctAnswer: string }> = [];

      for (let i = 1; i <= Number(newAssessment.totalQuestions); i++) {
        const found = pairs.find((p: string) => p.startsWith(`${i}`) || p.startsWith(`Q${i}`));
        let ans = 'A';
        if (found) {
          const match = found.match(/[A-Da-d]$/);
          if (match) ans = match[0].toUpperCase();
        } else {
          ans = ['A', 'B', 'C', 'D'][(i - 1) % 4];
        }
        answerKey.push({ questionNumber: i, correctAnswer: ans });
      }

      const res = await apiClient('/assessments', {
        method: 'POST',
        body: JSON.stringify({
          classCode: newAssessment.classCode || (classes[0]?.classCode ?? ''),
          title: newAssessment.title,
          assessmentType: actualType,
          subject: newAssessment.subject,
          totalQuestions: Number(newAssessment.totalQuestions),
          marksPerQuestion: Number(newAssessment.marksPerQuestion),
          negativeMarking: Number(newAssessment.negativeMarking),
          answerKey
        })
      });

      setMessage({ text: `Assessment "${newAssessment.title}" created successfully!`, type: 'success' });
      setIsCreateAssessmentModal(false);
      await loadAssessments();
      if (res.data) setSelectedAssessment(res.data);
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleEvaluateOmrBatch = async (assessmentId: string) => {
    setEvaluationLoading(true);
    setOmrEvaluationProgress(15);
    try {
      const interval = setInterval(() => {
        setOmrEvaluationProgress((prev) => (prev < 90 ? prev + 25 : prev));
      }, 200);

      const res = await apiClient(`/assessments/${assessmentId}/evaluate-omr`, {
        method: 'POST',
        body: JSON.stringify({ autoMatchAllStudents: true })
      });

      clearInterval(interval);
      setOmrEvaluationProgress(100);
      setSelectedAssessment(res.data);
      setMessage({
        text: `AI OMR Evaluation Complete! Evaluated ${res.data?.results?.length || 0} students. Class Average: ${res.data?.summary?.classAverageScore} marks.`,
        type: 'success'
      });
      await loadAssessments();
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setTimeout(() => {
        setEvaluationLoading(false);
        setOmrEvaluationProgress(0);
      }, 500);
    }
  };

  const handlePublishReportCards = async (assessmentId: string) => {
    setLoading(true);
    try {
      const res = await apiClient(`/assessments/${assessmentId}/publish-report-cards`, {
        method: 'POST',
        body: JSON.stringify({ notifyWhatsApp: true })
      });
      setMessage({ text: res.message || 'Results published and WhatsApp alerts dispatched!', type: 'success' });
      await loadAssessments();
      if (selectedAssessment?._id === assessmentId) {
        setSelectedAssessment({ ...selectedAssessment, status: 'PUBLISHED' });
      }
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = async (assessmentId: string) => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('ssc_access_token') : '';
      const response = await fetch(`http://localhost:5000/api/v1/assessments/${assessmentId}/export-excel`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to export Excel.');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedAssessment?.classCode || 'Class'}_${selectedAssessment?.assessmentType || 'Exam'}_Results.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      setMessage({ text: 'Excel sheet downloaded successfully!', type: 'success' });
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    }
  };

  const handleViewReportCard = async (studentCode: string) => {
    setLoading(true);
    try {
      const res = await apiClient(`/assessments/student/${studentCode}/report-card`);
      setSelectedStudentReport(res.data);
      setIsReportCardModal(true);
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleTestWhatsAppConnection = async () => {
    setLoading(true);
    try {
      const res = await apiClient('/school-admin/whatsapp/test-connection', {
        method: 'POST',
        body: JSON.stringify({ testPhone: waPhoneInput })
      });
      setMessage({ text: res.message || 'WhatsApp channel verified successfully!', type: 'success' });
      await loadWhatsAppConfig();
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleSendWhatsAppBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    setBroadcastLoading(true);
    try {
      const res = await apiClient('/school-admin/whatsapp/broadcast', {
        method: 'POST',
        body: JSON.stringify({
          target: broadcastTarget,
          classCode: broadcastTarget === 'CLASS' ? broadcastClassCode : undefined,
          title: broadcastTitle,
          message: broadcastMessage
        })
      });
      setMessage({ text: res.message || 'Broadcast dispatched successfully!', type: 'success' });
      setIsWhatsAppBroadcastModal(false);
      setBroadcastTitle('');
      setBroadcastMessage('');
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setBroadcastLoading(false);
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventTitle.trim()) {
      alert('Event title is required.');
      return;
    }
    if (!newEventImages.length) {
      alert('At least one event image URL is required.');
      return;
    }
    setLoading(true);
    try {
      await apiClient('/events', {
        method: 'POST',
        body: JSON.stringify({
          title: newEventTitle,
          category: newEventCategory,
          eventDate: newEventDate,
          description: newEventDescription,
          images: newEventImages
        })
      });
      setMessage({ text: 'Event published to school gallery! Valid for 7 days (auto-expiry).', type: 'success' });
      setIsCreateEventModal(false);
      setNewEventTitle('');
      setNewEventDescription('');
      await loadEvents();
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!confirm('Are you sure you want to delete this event from the gallery?')) return;
    setLoading(true);
    try {
      await apiClient(`/events/${eventId}`, { method: 'DELETE' });
      setMessage({ text: 'Event removed from gallery.', type: 'success' });
      await loadEvents();
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleModifyStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editStudentTarget) return;
    setLoading(true);
    try {
      await apiClient(`/students/${editStudentTarget.studentCode}`, {
        method: 'PUT',
        body: JSON.stringify({
          fullName: editStudentName,
          dateOfBirth: editStudentDob,
          gender: editStudentGender,
          busCode: editStudentBus || undefined,
          emergencyContacts: editStudentPhone
            ? [{ name: 'Parent / Guardian', phone: editStudentPhone, relationship: 'PARENT' }]
            : undefined
        })
      });
      setMessage({ text: `Student [${editStudentTarget.studentCode}] updated successfully.`, type: 'success' });
      setEditStudentTarget(null);
      const res = await apiClient('/students?limit=100');
      setStudents(res.data?.students || []);
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleTransferStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferStudentTarget || !transferTargetClassCode) return;
    setLoading(true);
    try {
      const res = await apiClient(`/students/${transferStudentTarget.studentCode}/transfer`, {
        method: 'POST',
        body: JSON.stringify({
          targetClassCode: transferTargetClassCode,
          targetSection: transferTargetSection,
          reason: transferReason
        })
      });
      setMessage({
        text: `Transferred ${transferStudentTarget.fullName} from ${res.data?.previousClass} to ${res.data?.newClass} (Section ${res.data?.section}).`,
        type: 'success'
      });
      setTransferStudentTarget(null);
      const sRes = await apiClient('/students?limit=100');
      setStudents(sRes.data?.students || []);
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleBulkImportStudents = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importText.trim()) {
      alert('Please enter or paste CSV/spreadsheet lines.');
      return;
    }
    setLoading(true);
    try {
      // Parse CSV/TSV lines
      const lines = importText.trim().split('\n');
      const parsedRows: any[] = [];
      for (const line of lines) {
        if (!line.trim() || line.toLowerCase().startsWith('admission') || line.toLowerCase().startsWith('name')) {
          continue;
        }
        const cols = line.split(/[,\t]/).map((c) => c.trim().replace(/^["']|["']$/g, ''));
        if (cols.length >= 2) {
          parsedRows.push({
            admissionNo: cols[0],
            fullName: cols[1],
            grade: cols[2] || '6',
            section: cols[3] || 'A',
            gender: cols[4] || 'MALE',
            dob: cols[5] || '2014-06-01',
            parentName: cols[6] || 'Parent',
            parentPhone: cols[7] || ''
          });
        }
      }

      if (!parsedRows.length) {
        throw new Error('No valid student rows could be parsed. Check format: AdmissionNo, FullName, Grade, Section, Gender, DOB, ParentName, ParentPhone');
      }

      const res = await apiClient('/students/bulk-import', {
        method: 'POST',
        body: JSON.stringify({ students: parsedRows })
      });

      setImportResults(res.data);
      setMessage({
        text: `Bulk imported ${res.data?.importedCount || 0} students (${res.data?.skippedCount || 0} skipped).`,
        type: 'success'
      });
      const sRes = await apiClient('/students?limit=100');
      setStudents(sRes.data?.students || []);
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleExportStudents = async () => {
    setLoading(true);
    try {
      const res = await apiClient('/students/export');
      const list = res.data?.students || [];
      if (!list.length) {
        alert('No students available to export.');
        return;
      }
      // Generate CSV string
      const headers = ['Student Code', 'Admission Number', 'Full Name', 'Gender', 'DOB', 'Class Code', 'Section', 'Academic Year', 'Bus Code', 'Parent Name', 'Parent Phone', 'Status'];
      const rows = list.map((s: any) => [
        `"${s.studentCode || ''}"`,
        `"${s.admissionNumber || ''}"`,
        `"${s.fullName || ''}"`,
        `"${s.gender || ''}"`,
        `"${s.dateOfBirth || ''}"`,
        `"${s.classCode || ''}"`,
        `"${s.section || ''}"`,
        `"${s.academicYear || ''}"`,
        `"${s.busCode || ''}"`,
        `"${s.parentName || ''}"`,
        `"${s.parentPhone || ''}"`,
        `"${s.status || ''}"`
      ]);
      const csvContent = [headers.join(','), ...rows.map((r: string[]) => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `students_export_${user?.schoolCode || 'SSC'}_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setMessage({ text: `Exported ${list.length} student records to CSV!`, type: 'success' });
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDailyAssignments = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dailyAssignClassCode || !dailyTeacherSelected || !dailySubjectSelected) {
      alert('Please select class, teacher, and subject.');
      return;
    }
    const tUser = tenantUsers.find((u) => u.userCode === dailyTeacherSelected);
    setLoading(true);
    try {
      await apiClient('/school-admin/daily-teacher-assignment', {
        method: 'POST',
        body: JSON.stringify({
          date: dailyAssignDate,
          assignments: [
            {
              classCode: dailyAssignClassCode,
              periodNumber: dailyPeriodSelected,
              startTime: `0${8 + dailyPeriodSelected}:00`.slice(-5),
              endTime: `0${8 + dailyPeriodSelected}:45`.slice(-5),
              subject: dailySubjectSelected,
              teacherCode: dailyTeacherSelected,
              teacherName: tUser?.fullName || 'Teacher',
              isClassTeacher: false
            }
          ]
        })
      });
      setMessage({
        text: `Assigned ${tUser?.fullName || 'teacher'} to ${dailyAssignClassCode} for Period ${dailyPeriodSelected} (${dailySubjectSelected}).`,
        type: 'success'
      });
      await loadDailyAssignments(dailyAssignDate, dailyAssignClassCode);
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Open Parent Verification Modal prefilled with submitted data
  const openParentVerificationModal = (pUser: any) => {
    setVerifyParentTarget(pUser);
    const details = pUser.verificationDetails || {};
    setStudentAdmissionNo(details.submittedAdmissionNumber || '');
    setChildFullName(details.submittedChildName || '');
    setChildGrade(details.submittedGrade || '6');
    setChildSection(details.submittedSection || 'A');
    setParentRelationship(details.submittedRelationship || 'FATHER');
    setConsentAccepted(true);
    setVerificationNotes('Parent-child identity verified against official school register');
  };

  // Multi-step Parent Verification & Approval
  const handleVerifyParent = async () => {
    if (!verifyParentTarget || !studentAdmissionNo.trim() || !childFullName.trim()) {
      alert('Student admission number and child full name are required.');
      return;
    }

    setLoading(true);
    try {
      const res = await apiClient('/school-admin/users/parents/verify-and-approve', {
        method: 'POST',
        body: JSON.stringify({
          userId: verifyParentTarget._id,
          parentFullName: verifyParentTarget.fullName,
          parentMobile: verifyParentTarget.phone,
          parentEmail: verifyParentTarget.email,
          studentAdmissionNumber: studentAdmissionNo.trim(),
          childFullName: childFullName.trim(),
          childGrade: childGrade.trim(),
          childSection: childSection.trim(),
          relationship: parentRelationship,
          consentAccepted: true,
          verificationNotes
        })
      });

      setMessage({
        text: `Parent [${verifyParentTarget.fullName}] verified & assigned code [${res.data?.parentCode}]. Status: VERIFIED.`,
        type: 'success'
      });
      setVerifyParentTarget(null);
      await loadTenantData();
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Quick Select Enrolled Student in Parent Verification
  const handleSelectStudentForParent = (selectedStudentCode: string) => {
    const found = students.find((s) => s.studentCode === selectedStudentCode);
    if (found) {
      setStudentAdmissionNo(found.admissionNumber);
      setChildFullName(found.fullName);
      const matchedClass = classes.find((c) => c.classCode === found.classCode);
      if (matchedClass) {
        setChildGrade(matchedClass.grade);
        setChildSection(matchedClass.section);
      } else {
        setChildGrade(found.grade || '6');
        setChildSection(found.section || 'A');
      }
    }
  };

  // Open Teacher Approval Modal (Prompt for Class Access)
  const openApproveTeacherModal = (pUser: any) => {
    setApproveTeacherTarget(pUser);
    setApprTeacherClassCode(classes.length > 0 ? classes[0].classCode : '');
    setApprTeacherIsClassTeacher(true);
    setApprTeacherSubject('General');
  };

  // Submit Teacher Approval with Class Access
  const handleApproveTeacherSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!approveTeacherTarget) return;
    setLoading(true);
    try {
      const res = await apiClient('/school-admin/users/teachers/approve', {
        method: 'POST',
        body: JSON.stringify({
          userId: approveTeacherTarget._id,
          classCode: apprTeacherClassCode || undefined,
          isClassTeacher: apprTeacherIsClassTeacher,
          subject: apprTeacherSubject || 'General'
        })
      });
      setMessage({
        text: `Teacher [${res.data?.fullName}] approved with serial code [${res.data?.userCode}]. Assigned to class: ${apprTeacherClassCode || 'None'}.`,
        type: 'success'
      });
      setApproveTeacherTarget(null);
      await loadTenantData();
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Open User Modification Modal
  const openModifyModal = (u: any) => {
    setModifyTargetUser(u);
    setModFullName(u.fullName || '');
    setModEmail(u.email || '');
    setModPhone(u.phone || '');
    setModStatus(u.status === 'SUSPENDED' ? 'SUSPENDED' : 'ACTIVE');
    setModTransportEnabled(u.accessControls?.transportEnabled !== false);

    const matchedStudent = students.find((s) => s.admissionNumber === u.verificationDetails?.submittedAdmissionNumber) || (students.length > 0 ? students[0] : null);
    setModStudentCode(matchedStudent ? matchedStudent.studentCode : (students[0]?.studentCode || ''));
    setModClassCode(matchedStudent?.classCode || (classes.length > 0 ? classes[0].classCode : ''));
    const existingTeacherClasses = Array.isArray(u.assignedClasses)
      ? u.assignedClasses.map((ac: any) => ac.classCode).filter(Boolean)
      : [];
    setModClassCodes(existingTeacherClasses.length > 0 ? existingTeacherClasses : (classes.length > 0 ? [classes[0].classCode] : []));
    setModBusCode(u.accessControls?.transportBusCode || matchedStudent?.transport?.busCode || matchedStudent?.busCode || (buses.length > 0 ? buses[0].busCode : ''));
    setModRouteCode(routes.length > 0 ? routes[0].routeCode : '');
    setModIsClassTeacher(u.role === 'CLASS_TEACHER');
    setModSubject(u.assignedClasses?.[0]?.subject || 'General');
  };

  // Submit User Modification
  const handleSaveModifyUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modifyTargetUser) return;
    setLoading(true);
    try {
      const payload: any = {
        fullName: modFullName.trim(),
        email: modEmail.trim(),
        phone: modPhone.trim(),
        status: modStatus,
        transportEnabled: modTransportEnabled,
      };
      if (modifyTargetUser.role === 'PARENT') {
        if (modStudentCode) payload.studentCode = modStudentCode;
        if (modClassCode) payload.classCode = modClassCode;
        if (modBusCode) payload.busCode = modBusCode;
        if (modRouteCode) payload.routeCode = modRouteCode;
      } else if (modifyTargetUser.role.includes('TEACHER')) {
        payload.classCodes = modClassCodes;
        if (modClassCodes.length > 0) payload.classCode = modClassCodes[0];
        payload.isClassTeacher = modIsClassTeacher;
        payload.subject = modSubject;
      } else if (modifyTargetUser.role === 'DRIVER') {
        if (modBusCode) payload.busCode = modBusCode;
        if (modRouteCode) payload.routeCode = modRouteCode;
      }

      await apiClient(`/school-admin/users/${modifyTargetUser.userCode}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });

      setMessage({
        text: `User [${modifyTargetUser.userCode}] (${modifyTargetUser.fullName}) modified successfully. Status: ${modStatus}. Bus Location: ${modTransportEnabled ? 'Active' : 'Deactivated'}.`,
        type: 'success'
      });
      setModifyTargetUser(null);
      await loadTenantData();
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Approve Driver
  const handleApproveDriver = async (userId: string) => {
    setLoading(true);
    try {
      const res = await apiClient('/school-admin/users/drivers/approve', {
        method: 'POST',
        body: JSON.stringify({ userId })
      });
      setMessage({
        text: `Driver [${res.data?.fullName}] approved with serial code [${res.data?.userCode}].`,
        type: 'success'
      });
      await loadTenantData();
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Suspend User
  const handleSuspendUser = async (userCode: string) => {
    const reason = prompt(`Enter reason for suspending user ${userCode}:`);
    if (!reason || reason.trim().length < 5) {
      alert('A valid reason of at least 5 characters is required.');
      return;
    }

    setLoading(true);
    try {
      await apiClient(`/school-admin/users/${userCode}/suspend`, {
        method: 'PUT',
        body: JSON.stringify({ reason: reason.trim() })
      });
      setMessage({ text: `User ${userCode} has been suspended.`, type: 'success' });
      await loadTenantData();
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Activate User
  const handleActivateUser = async (userCode: string) => {
    setLoading(true);
    try {
      await apiClient(`/school-admin/users/${userCode}/activate`, {
        method: 'PUT',
        body: JSON.stringify({ reason: 'Re-activated by School Administrator' })
      });
      setMessage({ text: `User ${userCode} re-activated.`, type: 'success' });
      await loadTenantData();
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Create Class (Photo 1 Fix: sends both capacity and maxCapacity)
  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const cap = parseInt(newCapacity, 10) || 40;
      await apiClient('/classes', {
        method: 'POST',
        body: JSON.stringify({
          grade: newGrade,
          section: newSection.toUpperCase(),
          academicYear: '2026-2027',
          capacity: cap,
          maxCapacity: cap,
          roomNumber: newRoomNumber
        })
      });
      setMessage({ text: `Class Grade ${newGrade}-${newSection} created.`, type: 'success' });
      setIsCreateClassModal(false);
      await loadTenantData();
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Enroll Student
  const handleEnrollStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await apiClient('/students', {
        method: 'POST',
        body: JSON.stringify({
          admissionNumber: enrollAdmissionNo.trim(),
          fullName: enrollStudentName.trim(),
          dateOfBirth: enrollDob,
          gender: enrollGender,
          classCode: enrollClassCode,
          academicYear: '2026-2027',
          emergencyContacts: [
            { name: 'Primary Guardian', phone: '+919876543210', relationship: 'PARENT' }
          ]
        })
      });
      setMessage({ text: `Student ${enrollStudentName} enrolled.`, type: 'success' });
      setIsEnrollStudentModal(false);
      setEnrollAdmissionNo('');
      setEnrollStudentName('');
      await loadTenantData();
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Search matching places & nearby landmarks via OpenStreetMap Nominatim (returns selectable dropdown list)
  const searchPlacesForField = async (fieldId: string, query: string) => {
    if (!query.trim()) return;
    setPlaceSearching(true);
    setPlaceSuggestionsField(fieldId);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=6&addressdetails=1&q=${encodeURIComponent(query.trim())}`,
        { headers: { Accept: 'application/json' } }
      );
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        setPlaceSuggestions(
          data.map((item: any) => ({
            name: item.name || item.display_name?.split(',')[0] || query.trim(),
            displayName: item.display_name,
            lat: Number(parseFloat(item.lat).toFixed(6)),
            lng: Number(parseFloat(item.lon).toFixed(6)),
            category: item.type || item.class || 'place'
          }))
        );
      } else {
        setPlaceSuggestions([]);
        setMessage({ text: `No places found for "${query}". Try a nearby town/landmark or click directly on the map.`, type: 'error' });
      }
    } catch {
      setPlaceSuggestions([]);
      setMessage({ text: 'Place search unavailable offline. Click directly on the map to pin GPS coordinates.', type: 'error' });
    } finally {
      setPlaceSearching(false);
    }
  };

  // Find nearby landmarks around a GPS coordinate (bus stops, schools, junctions, villages, temples)
  const searchNearbyLandmarksForField = async (fieldId: string, latStr: string, lngStr: string) => {
    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return;
    setPlaceSearching(true);
    setPlaceSuggestionsField(fieldId);
    try {
      const delta = 0.04;
      const viewbox = `${lng - delta},${lat + delta},${lng + delta},${lat - delta}`;
      const [revRes, poiRes] = await Promise.all([
        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16&addressdetails=1`).then((r) => r.json()).catch(() => null),
        fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=6&bounded=1&viewbox=${viewbox}&q=bus+stop+OR+school+OR+junction+OR+temple+OR+hospital+OR+village`).then((r) => r.json()).catch(() => [])
      ]);
      const items: Array<{ name: string; displayName: string; lat: number; lng: number; category?: string }> = [];
      if (revRes?.display_name) {
        items.push({
          name: revRes.name || revRes.address?.village || revRes.address?.suburb || revRes.address?.road || revRes.display_name.split(',')[0],
          displayName: revRes.display_name,
          lat: Number(parseFloat(revRes.lat || String(lat)).toFixed(6)),
          lng: Number(parseFloat(revRes.lon || String(lng)).toFixed(6)),
          category: 'Pinned Area'
        });
      }
      if (Array.isArray(poiRes)) {
        for (const p of poiRes) {
          items.push({
            name: p.name || p.display_name?.split(',')[0] || 'Landmark',
            displayName: p.display_name,
            lat: Number(parseFloat(p.lat).toFixed(6)),
            lng: Number(parseFloat(p.lon).toFixed(6)),
            category: p.type || 'Landmark'
          });
        }
      }
      setPlaceSuggestions(items);
    } catch {
      setPlaceSuggestions([]);
    } finally {
      setPlaceSearching(false);
    }
  };

  const applySelectedPlace = (fieldId: string, item: { name: string; displayName: string; lat: number; lng: number }) => {
    if (fieldId === 'START') {
      setRouteStartName(item.name);
      setRouteStartLat(String(item.lat));
      setRouteStartLng(String(item.lng));
    } else if (fieldId === 'END') {
      setRouteEndName(item.name);
      setRouteEndLat(String(item.lat));
      setRouteEndLng(String(item.lng));
    } else if (fieldId === 'NEW_STOP') {
      setNewStopName(item.name);
      setNewStopLat(String(item.lat));
      setNewStopLng(String(item.lng));
    } else if (fieldId.startsWith('STOP_')) {
      const idx = parseInt(fieldId.replace('STOP_', ''), 10);
      setRouteStopsDraft((prev) => {
        const next = [...prev];
        if (next[idx]) next[idx] = { ...next[idx], stopName: item.name, lat: String(item.lat), lng: String(item.lng) };
        return next;
      });
    }
    setPlaceSuggestions([]);
    setPlaceSuggestionsField(null);
  };

  // Register Bus (with Driver & Route assignment)
  const handleCreateBus = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const reg = busRegistration.trim().toUpperCase();
      await apiClient('/transport/buses', {
        method: 'POST',
        body: JSON.stringify({
          busNumber: busNumberLabel.trim() || reg,
          registrationNumber: reg,
          capacity: parseInt(busCapacity, 10),
          driverCode: busDriverCode || undefined,
          routeCode: busRouteCode || undefined,
          gpsDeviceId: `GPS-${Date.now().toString().slice(-6)}`
        })
      });
      setMessage({ text: `Bus [${reg}] registered with GPS tracker.`, type: 'success' });
      setIsCreateBusModal(false);
      setBusRegistration('');
      setBusNumberLabel('');
      setBusDriverCode('');
      setBusRouteCode('');
      await loadTenantData();
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Update Bus Driver / Route / Status
  const handleSaveEditBus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editBusTarget) return;
    setLoading(true);
    try {
      await apiClient(`/transport/buses/${editBusTarget.busCode}`, {
        method: 'PUT',
        body: JSON.stringify({
          driverCode: editBusDriverCode || null,
          routeCode: editBusRouteCode || null,
          status: editBusStatus
        })
      });
      setMessage({ text: `Bus [${editBusTarget.busCode}] updated.`, type: 'success' });
      setEditBusTarget(null);
      await loadTenantData();
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Create Route with Places & Stops
  const handleCreateRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        routeName: routeName.trim(),
        startLocation: {
          name: routeStartName.trim(),
          coordinates: [parseFloat(routeStartLng) || 78.3996, parseFloat(routeStartLat) || 17.4948]
        },
        endLocation: {
          name: routeEndName.trim(),
          coordinates: [parseFloat(routeEndLng) || 78.3915, parseFloat(routeEndLat) || 17.4483]
        },
        busCode: routeBusCode || undefined,
        driverCode: routeDriverCode || undefined,
        stops: routeStopsDraft
          .filter((s) => s.stopName.trim().length > 0)
          .map((s, idx) => ({
            stopName: s.stopName.trim(),
            sequenceOrder: idx + 1,
            scheduledPickupTime: s.scheduledPickupTime || '07:30',
            scheduledDropTime: s.scheduledDropTime || '15:30',
            coordinates: [parseFloat(s.lng) || 78.3914, parseFloat(s.lat) || 17.4700]
          }))
      };

      await apiClient('/transport/routes', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      setMessage({ text: `Route [${routeName}] created with ${payload.stops.length} stops and GPS waypoints.`, type: 'success' });
      setIsCreateRouteModal(false);
      setRouteName('');
      await loadTenantData();
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Delete Route
  const handleDeleteRoute = async (rCode: string) => {
    if (!confirm(`Delete route ${rCode} and all its stops?`)) return;
    setLoading(true);
    try {
      await apiClient(`/transport/routes/${rCode}`, { method: 'DELETE' });
      setMessage({ text: `Route [${rCode}] deleted.`, type: 'success' });
      await loadTenantData();
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Add Stop to Existing Route
  const handleAddStopToRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addStopRouteTarget) return;
    setLoading(true);
    try {
      const nextSeq = (addStopRouteTarget.stops?.length || 0) + 1;
      await apiClient('/transport/stops', {
        method: 'POST',
        body: JSON.stringify({
          routeCode: addStopRouteTarget.routeCode,
          stopName: newStopName.trim(),
          sequenceOrder: nextSeq,
          scheduledPickupTime: newStopPickup,
          scheduledDropTime: newStopDrop,
          coordinates: [parseFloat(newStopLng) || 78.3900, parseFloat(newStopLat) || 17.4700]
        })
      });
      setMessage({ text: `Stop [${newStopName}] added to ${addStopRouteTarget.routeName}.`, type: 'success' });
      setAddStopRouteTarget(null);
      setNewStopName('');
      await loadTenantData();
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const loadClassTimetable = async (classCodeToLoad: string, preferredDay?: 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN') => {
    if (!classCodeToLoad) return;
    setLoading(true);
    try {
      const res = await apiClient(`/timetable/class/${classCodeToLoad}`);
      const data = res.data;
      setTtData(data);
      const dayKey = preferredDay || data?.today || ttDay;
      setTtDay(dayKey);
      setTtSessionsDraft(data?.days?.[dayKey]?.sessions || []);
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateTimetable = async () => {
    const targetClass = ttClassCode || classes[0]?.classCode;
    if (!targetClass) {
      setMessage({ text: 'Please create a class first.', type: 'error' });
      return;
    }
    setLoading(true);
    try {
      await apiClient(`/timetable/class/${targetClass}/generate`, {
        method: 'POST',
        body: JSON.stringify({
          startTime: ttGenStart,
          periodMinutes: parseInt(ttGenMinutes, 10) || 45,
          periodsPerDay: parseInt(ttGenPeriods, 10) || 6,
          includeCurrentTimeSession: ttIncludeLiveNow
        })
      });
      setMessage({
        text: `Weekly timetable generated for ${targetClass}! Master schedule synchronized across teachers, students, and parents.`,
        type: 'success'
      });
      await loadClassTimetable(targetClass);
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDayTimetable = async () => {
    if (!ttClassCode) return;
    setLoading(true);
    try {
      await apiClient(`/timetable/class/${ttClassCode}`, {
        method: 'POST',
        body: JSON.stringify({
          dayOfWeek: ttDay,
          sessions: ttSessionsDraft
        })
      });
      setMessage({ text: `Saved ${ttDay} timetable for ${ttClassCode} and synced teacher assignments.`, type: 'success' });
      await loadClassTimetable(ttClassCode, ttDay);
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    clearStoredSession();
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* 3.5s Centered School Welcome Greeting */}
      {user && (
        <SchoolWelcomeGreeting
          schoolName={user?.schoolName || 'Vijay High school'}
          userName={user?.fullName}
          role={user?.role}
          durationMs={3500}
        />
      )}

      {/* Top Navbar */}
      <header className="bg-sky-900 text-white px-6 py-3.5 flex items-center justify-between shadow-md">
        <div className="flex items-center space-x-3">
          <img src="/logo.png?v=3" alt="SAFE SCL CONNECT" className="h-10 w-auto object-contain rounded" />
          <div>
            <h1 className="font-semibold text-base leading-tight">School Safe Connect</h1>
            <p className="text-xs text-sky-200">
              School Admin Portal • <span className="font-bold text-white tracking-wide">{user?.schoolName || 'Vijay High school'}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {/* Profile Menu Trigger - School code is kept securely in profile menu only */}
          <button
            onClick={() => setIsProfileModalOpen(true)}
            className="flex items-center gap-2.5 bg-sky-800/80 hover:bg-sky-700/80 border border-sky-600/40 px-3.5 py-1.5 rounded-xl transition text-left cursor-pointer shadow-sm"
            title="Open Profile & School Identification"
          >
            <div className="w-7 h-7 rounded-full bg-sky-500 flex items-center justify-center font-bold text-xs text-white shadow-sm ring-1 ring-white/30">
              {user?.fullName ? user.fullName[0].toUpperCase() : 'A'}
            </div>
            <div>
              <p className="text-xs font-semibold text-white leading-tight">{user?.fullName || 'Administrator'}</p>
              <p className="text-[10px] text-sky-200 leading-tight">Profile Menu ▾</p>
            </div>
          </button>
          <button
            onClick={handleLogout}
            className="text-xs bg-red-600/90 hover:bg-red-700 text-white font-medium px-3.5 py-1.5 rounded-xl transition border border-red-500/50 shadow-sm"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* User Profile Modal Dialog */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-200 relative animate-in fade-in zoom-in-95">
            <button
              onClick={() => setIsProfileModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 p-1 rounded-full text-base"
              title="Close Profile"
            >
              ✕
            </button>
            <div className="flex items-center gap-3.5 border-b border-slate-100 pb-4 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-600 to-indigo-600 text-white flex items-center justify-center font-bold text-lg shadow-md">
                {user?.fullName ? user.fullName[0].toUpperCase() : 'A'}
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">{user?.fullName || 'Administrator'}</h3>
                <p className="text-xs text-sky-600 font-semibold">{user?.role?.replace(/_/g, ' ') || 'SCHOOL ADMIN'}</p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                <span className="text-slate-500 font-medium">Institution / School:</span>
                <p className="text-slate-900 font-bold text-sm mt-0.5">{user?.schoolName || 'Vijay High school'}</p>
              </div>

              <div className="bg-sky-50/70 p-3.5 rounded-2xl border border-sky-100">
                <span className="text-sky-700 font-semibold">School Code (Tenant ID):</span>
                <p className="font-mono text-sky-900 font-bold text-sm mt-0.5">{user?.schoolCode || 'SSC-SCH-1001'}</p>
                <p className="text-[10px] text-sky-600 mt-1">Tenant isolation identifier for system administration.</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <span className="text-slate-500">User Code:</span>
                  <p className="font-mono text-slate-900 font-bold mt-0.5">{user?.userCode || 'SSC-SCH-1001'}</p>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <span className="text-slate-500">Status:</span>
                  <p className="text-emerald-700 font-bold mt-0.5">● {user?.status || 'ACTIVE'}</p>
                </div>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                <span className="text-slate-500 font-medium">Contact:</span>
                <p className="text-slate-800 mt-0.5">{user?.email || 'principal@gmail.com'}</p>
                {user?.phone && <p className="text-slate-800">{user.phone}</p>}
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2.5">
              <button
                onClick={() => setIsProfileModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
              >
                Close
              </button>
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl transition shadow-sm"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="bg-white border-b border-slate-200 px-6 flex space-x-6 text-xs font-semibold overflow-x-auto">
        <button
          onClick={() => setActiveTab('APPROVALS')}
          className={`py-3.5 border-b-2 transition whitespace-nowrap ${
            activeTab === 'APPROVALS' ? 'border-sky-600 text-sky-700 font-bold' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Pending Approvals ({pendingUsers.length})
        </button>
        <button
          onClick={() => setActiveTab('USERS')}
          className={`py-3.5 border-b-2 transition whitespace-nowrap ${
            activeTab === 'USERS' ? 'border-sky-600 text-sky-700 font-bold' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Staff & Parent Users ({tenantUsers.length})
        </button>
        <button
          onClick={() => setActiveTab('CLASSES')}
          className={`py-3.5 border-b-2 transition whitespace-nowrap ${
            activeTab === 'CLASSES' ? 'border-sky-600 text-sky-700 font-bold' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Classes & Periods ({classes.length})
        </button>
        <button
          onClick={() => {
            setActiveTab('TIMETABLE');
            const target = ttClassCode || classes[0]?.classCode || '';
            if (target) {
              setTtClassCode(target);
              loadClassTimetable(target);
            }
          }}
          className={`py-3.5 border-b-2 transition whitespace-nowrap ${
            activeTab === 'TIMETABLE' ? 'border-emerald-600 text-emerald-700 font-bold' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          📅 Master Timetable
        </button>
        <button
          onClick={() => setActiveTab('STUDENTS')}
          className={`py-3.5 border-b-2 transition whitespace-nowrap ${
            activeTab === 'STUDENTS' ? 'border-sky-600 text-sky-700 font-bold' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Students ({students.length})
        </button>
        <button
          onClick={() => {
            setActiveTab('EXAMS_OMR');
            loadAssessments();
          }}
          className={`py-3.5 border-b-2 transition whitespace-nowrap flex items-center space-x-1.5 ${
            activeTab === 'EXAMS_OMR' ? 'border-indigo-600 text-indigo-700 font-bold' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>📝 AI OMR & Exams</span>
          <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-800 text-[10px] rounded-full">
            {assessments.length}
          </span>
        </button>
        <button
          onClick={() => {
            setActiveTab('WHATSAPP');
            loadWhatsAppConfig();
          }}
          className={`py-3.5 border-b-2 transition whitespace-nowrap flex items-center space-x-1.5 ${
            activeTab === 'WHATSAPP' ? 'border-emerald-600 text-emerald-700 font-bold' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>💬 WhatsApp Hub</span>
          <span className={`px-1.5 py-0.5 text-[10px] rounded-full font-semibold ${whatsAppConfig?.connected ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>
            {whatsAppConfig?.connected ? 'Verified' : 'Connect'}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('TRANSPORT')}
          className={`py-3.5 border-b-2 transition whitespace-nowrap ${
            activeTab === 'TRANSPORT' ? 'border-sky-600 text-sky-700 font-bold' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Fleet & Buses ({buses.length})
        </button>
        <button
          onClick={() => setActiveTab('INCIDENTS')}
          className={`py-3.5 border-b-2 transition whitespace-nowrap ${
            activeTab === 'INCIDENTS' ? 'border-sky-600 text-sky-700 font-bold' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Incidents & SOS ({incidents.length})
        </button>
        <button
          onClick={() => {
            setActiveTab('FEES');
            loadFees();
          }}
          className={`py-3.5 border-b-2 transition whitespace-nowrap ${
            activeTab === 'FEES' ? 'border-amber-600 text-amber-700 font-bold' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          💳 Fees & WhatsApp Reminders ({fees.length})
        </button>
        <button
          onClick={() => {
            setActiveTab('EVENTS');
            loadEvents();
          }}
          className={`py-3.5 border-b-2 transition whitespace-nowrap ${
            activeTab === 'EVENTS' ? 'border-purple-600 text-purple-700 font-bold' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          📸 Events Gallery ({events.length})
        </button>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
        {message && (
          <div
            className={`p-4 rounded-lg text-xs font-medium flex justify-between items-center ${
              message.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
          >
            <span>{message.text}</span>
            <button onClick={() => setMessage(null)} className="font-bold ml-4">✕</button>
          </div>
        )}

        {/* TAB 1: PENDING APPROVALS */}
        {activeTab === 'APPROVALS' && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h2 className="font-bold text-slate-800 text-sm">User Registration Verification & Approval Queue</h2>
                <p className="text-xs text-slate-500">
                  Approve teachers, drivers, and conduct parent-child custody verification.
                </p>
              </div>
              <button onClick={loadTenantData} className="text-xs text-sky-600 hover:underline font-semibold">
                Refresh
              </button>
            </div>

            {pendingUsers.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs">
                No user registrations currently pending verification in this school tenant.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Role</th>
                      <th className="py-3 px-4">Applicant Full Name</th>
                      <th className="py-3 px-4">Email</th>
                      <th className="py-3 px-4">Phone</th>
                      <th className="py-3 px-4">Submitted Child Mapping</th>
                      <th className="py-3 px-4 text-right">Verification Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pendingUsers.map((pUser) => (
                      <tr key={pUser._id} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-4">
                          <span className={`font-semibold px-2 py-0.5 rounded text-[10px] ${
                            pUser.role === 'PARENT' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' :
                            pUser.role === 'DRIVER' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                            'bg-emerald-50 text-emerald-700 border border-emerald-100'
                          }`}>
                            {pUser.role}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-900">{pUser.fullName}</td>
                        <td className="py-3 px-4 text-slate-600">{pUser.email}</td>
                        <td className="py-3 px-4 font-mono text-slate-600">{pUser.phone}</td>
                        <td className="py-3 px-4 text-slate-600">
                          {pUser.role === 'PARENT' && pUser.verificationDetails?.submittedChildName ? (
                            <div>
                              <span className="font-medium text-slate-900">{pUser.verificationDetails.submittedChildName}</span>
                              <span className="text-[10px] text-slate-400 block">
                                Adm: {pUser.verificationDetails.submittedAdmissionNumber || 'N/A'} • Grade {pUser.verificationDetails.submittedGrade}-{pUser.verificationDetails.submittedSection}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">N/A</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                          {pUser.role === 'PARENT' ? (
                            <button
                              onClick={() => openParentVerificationModal(pUser)}
                              className="bg-sky-600 hover:bg-sky-700 text-white px-3 py-1.5 rounded font-semibold text-xs shadow-sm transition"
                            >
                              Verify & Approve Parent
                            </button>
                          ) : pUser.role === 'DRIVER' ? (
                            <button
                              onClick={() => handleApproveDriver(pUser._id)}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded font-semibold text-xs shadow-sm transition"
                            >
                              Approve Driver
                            </button>
                          ) : (
                            <button
                              onClick={() => openApproveTeacherModal(pUser)}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded font-semibold text-xs shadow-sm transition"
                            >
                              Approve Teacher
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: ACTIVE TENANT USERS (With Photo 3 Sub-tabs: All, Parent, Teacher, Driver & Modify) */}
        {activeTab === 'USERS' && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50">
              <div>
                <h2 className="font-bold text-slate-800 text-sm">Tenant User Directory & Access Control</h2>
                <p className="text-xs text-slate-500">Manage hierarchical identity codes, permissions, class/bus assignments, and suspension.</p>
              </div>
              <button onClick={loadTenantData} className="text-xs text-sky-600 hover:underline font-semibold self-start md:self-auto">
                Refresh
              </button>
            </div>

            {/* 3 Separate Sub-Tabs (Photo 3 requirement: parent, teacher, driver) */}
            <div className="px-4 border-b border-slate-200 bg-white flex space-x-2 text-xs font-semibold overflow-x-auto">
              <button
                onClick={() => setUserSubTab('ALL')}
                className={`py-3 px-3 border-b-2 transition whitespace-nowrap flex items-center space-x-1.5 ${
                  userSubTab === 'ALL'
                    ? 'border-sky-600 text-sky-700 font-bold'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <span>All Users</span>
                <span className="bg-slate-100 text-slate-700 rounded-full px-2 py-0.5 text-[10px]">
                  {tenantUsers.length}
                </span>
              </button>
              <button
                onClick={() => setUserSubTab('PARENT')}
                className={`py-3 px-3 border-b-2 transition whitespace-nowrap flex items-center space-x-1.5 ${
                  userSubTab === 'PARENT'
                    ? 'border-sky-600 text-sky-700 font-bold'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <span>Parents</span>
                <span className="bg-indigo-100 text-indigo-700 rounded-full px-2 py-0.5 text-[10px]">
                  {tenantUsers.filter((u) => u.role === 'PARENT').length}
                </span>
              </button>
              <button
                onClick={() => setUserSubTab('TEACHER')}
                className={`py-3 px-3 border-b-2 transition whitespace-nowrap flex items-center space-x-1.5 ${
                  userSubTab === 'TEACHER'
                    ? 'border-sky-600 text-sky-700 font-bold'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <span>Teachers</span>
                <span className="bg-emerald-100 text-emerald-700 rounded-full px-2 py-0.5 text-[10px]">
                  {tenantUsers.filter((u) => u.role.includes('TEACHER')).length}
                </span>
              </button>
              <button
                onClick={() => setUserSubTab('DRIVER')}
                className={`py-3 px-3 border-b-2 transition whitespace-nowrap flex items-center space-x-1.5 ${
                  userSubTab === 'DRIVER'
                    ? 'border-sky-600 text-sky-700 font-bold'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <span>Bus Drivers</span>
                <span className="bg-amber-100 text-amber-700 rounded-full px-2 py-0.5 text-[10px]">
                  {tenantUsers.filter((u) => u.role === 'DRIVER').length}
                </span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">User Code</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Full Name</th>
                    <th className="py-3 px-4">Contact</th>
                    <th className="py-3 px-4">Verification</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tenantUsers
                    .filter((u) => {
                      if (userSubTab === 'PARENT') return u.role === 'PARENT';
                      if (userSubTab === 'TEACHER') return u.role.includes('TEACHER');
                      if (userSubTab === 'DRIVER') return u.role === 'DRIVER';
                      return true;
                    })
                    .map((u) => (
                      <tr key={u._id} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-4 font-mono font-bold text-sky-700">{u.userCode}</td>
                        <td className="py-3 px-4">
                          <span className={`font-semibold px-2 py-0.5 rounded text-[10px] ${
                            u.role === 'PARENT' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' :
                            u.role === 'DRIVER' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                            u.role.includes('TEACHER') ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                            'bg-slate-100 text-slate-700'
                          }`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-900">{u.fullName}</td>
                        <td className="py-3 px-4 text-slate-600">
                          <div>{u.email}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{u.phone}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            u.verificationDetails?.status === 'VERIFIED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {u.verificationDetails?.status || 'PENDING'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            u.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}>
                            {u.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                          {u.role !== 'SCHOOL_ADMIN' && (
                            <>
                              {/* Photo 3 requirement: Modify button */}
                              <button
                                onClick={() => openModifyModal(u)}
                                className="bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200 px-2.5 py-1 rounded text-xs font-semibold shadow-xs transition mr-2"
                              >
                                Modify
                              </button>
                              {u.status === 'ACTIVE' ? (
                                <button
                                  onClick={() => handleSuspendUser(u.userCode)}
                                  className="text-rose-600 hover:text-rose-800 font-semibold text-xs"
                                >
                                  Suspend
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleActivateUser(u.userCode)}
                                  className="text-emerald-600 hover:text-emerald-800 font-semibold text-xs"
                                >
                                  Activate
                                </button>
                              )}
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: CLASSES & ACADEMIC SECTIONS */}
        {activeTab === 'CLASSES' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-sm font-bold text-slate-800">Classroom Management & Academic Sections</h2>
                <p className="text-xs text-slate-500">Configure academic grades, sections, room numbers, and student enrollment capacities.</p>
              </div>
              <button
                onClick={() => setIsCreateClassModal(true)}
                className="bg-sky-600 hover:bg-sky-700 text-white px-3 py-1.5 rounded text-xs font-semibold shadow-sm transition"
              >
                + Create New Class
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {classes.map((cls) => (
                <div key={cls.classCode} className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">Grade {cls.grade} - Section {cls.section}</h3>
                      <p className="font-mono text-xs text-sky-700 font-semibold">{cls.classCode}</p>
                    </div>
                    <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium">
                      Room {cls.roomNumber || 'N/A'}
                    </span>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Student Capacity:</span>
                      <span className="font-semibold text-slate-800">{cls.capacity || 40} Seats</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Academic Status:</span>
                      <span className="font-semibold text-emerald-700">Active Section</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Enrolled Count:</span>
                      <span className="font-semibold text-sky-700">
                        {students.filter(s => s.classCode === cls.classCode).length} Students
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Daily Teacher-to-Class Assignment Section */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="font-bold text-slate-800 text-sm flex items-center space-x-2">
                    <span>👨‍🏫 Daily Teacher-to-Class Assignment Console</span>
                    <span className="text-[10px] bg-sky-100 text-sky-800 font-semibold px-2 py-0.5 rounded-full">Multi-Class Capable</span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Assign teachers to specific classes per day/period. One teacher can teach multiple classes and parents will receive multiple homework tasks from their respective subject teachers.
                  </p>
                </div>
                <div className="flex items-center space-x-3 text-xs">
                  <div>
                    <label className="text-slate-500 font-semibold block text-[10px]">Date</label>
                    <input
                      type="date"
                      value={dailyAssignDate}
                      onChange={(e) => {
                        setDailyAssignDate(e.target.value);
                        loadDailyAssignments(e.target.value, dailyAssignClassCode);
                      }}
                      className="border border-slate-300 rounded p-1.5 text-xs bg-white font-medium"
                    />
                  </div>
                  <div>
                    <label className="text-slate-500 font-semibold block text-[10px]">Filter Class</label>
                    <select
                      value={dailyAssignClassCode}
                      onChange={(e) => {
                        setDailyAssignClassCode(e.target.value);
                        loadDailyAssignments(dailyAssignDate, e.target.value);
                      }}
                      className="border border-slate-300 rounded p-1.5 text-xs bg-white font-medium"
                    >
                      <option value="">All Classes</option>
                      {classes.map((c) => (
                        <option key={c.classCode} value={c.classCode}>
                          Grade {c.grade}-{c.section} ({c.classCode})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Assignment Form */}
              <form onSubmit={handleSaveDailyAssignments} className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs space-y-3">
                <h4 className="font-bold text-slate-800 text-xs">Assign Teacher to Period & Class</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Target Class</label>
                    <select
                      required
                      value={dailyAssignClassCode || (classes[0]?.classCode || '')}
                      onChange={(e) => setDailyAssignClassCode(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg p-2 bg-white"
                    >
                      {classes.map((c) => (
                        <option key={c.classCode} value={c.classCode}>
                          Grade {c.grade}-{c.section} ({c.classCode})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Period Number</label>
                    <select
                      value={dailyPeriodSelected}
                      onChange={(e) => setDailyPeriodSelected(parseInt(e.target.value, 10))}
                      className="w-full border border-slate-300 rounded-lg p-2 bg-white"
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((p) => (
                        <option key={p} value={p}>Period {p} (0{8 + p}:00 - 0{8 + p}:45)</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Subject</label>
                    <input
                      type="text"
                      required
                      value={dailySubjectSelected}
                      onChange={(e) => setDailySubjectSelected(e.target.value)}
                      placeholder="e.g. Mathematics, Science"
                      className="w-full border border-slate-300 rounded-lg p-2 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Assign Teacher</label>
                    <select
                      required
                      value={dailyTeacherSelected}
                      onChange={(e) => setDailyTeacherSelected(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg p-2 bg-white font-medium"
                    >
                      <option value="">-- Choose Teacher --</option>
                      {tenantUsers
                        .filter((u) => u.role === 'TEACHER' || u.role === 'CLASS_TEACHER')
                        .map((t) => (
                          <option key={t.userCode} value={t.userCode}>
                            {t.fullName} ({t.userCode})
                          </option>
                        ))}
                    </select>
                  </div>
                  <div className="flex items-end">
                    <button
                      type="submit"
                      disabled={loading || !dailyTeacherSelected}
                      className="w-full py-2 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-semibold rounded-lg shadow-sm transition"
                    >
                      Assign Period
                    </button>
                  </div>
                </div>
              </form>

              {/* Active Daily Assignments Table */}
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-600 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Class</th>
                      <th className="py-2.5 px-3">Period</th>
                      <th className="py-2.5 px-3">Timing</th>
                      <th className="py-2.5 px-3">Subject</th>
                      <th className="py-2.5 px-3">Assigned Teacher</th>
                      <th className="py-2.5 px-3">Teacher Code</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {dailyAssignmentsList.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-4 text-center text-slate-400 italic">
                          No daily assignments found for {dailyAssignDate}. Use the form above to assign teachers to classes.
                        </td>
                      </tr>
                    ) : (
                      dailyAssignmentsList.map((a, i) => (
                        <tr key={a._id || i} className="hover:bg-slate-50 transition">
                          <td className="py-2 px-3 font-medium text-slate-800">{a.date}</td>
                          <td className="py-2 px-3 font-mono font-bold text-sky-700">{a.classCode}</td>
                          <td className="py-2 px-3">Period {a.periodNumber}</td>
                          <td className="py-2 px-3 text-slate-500 font-mono">{a.startTime} – {a.endTime}</td>
                          <td className="py-2 px-3 font-medium text-slate-900">{a.subject}</td>
                          <td className="py-2 px-3 font-semibold text-emerald-700">{a.teacherName}</td>
                          <td className="py-2 px-3 font-mono text-[11px] text-slate-500">{a.teacherCode}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB: TIMETABLE & CLASS SCHEDULE */}
        {activeTab === 'TIMETABLE' && (
          <div className="space-y-5">
            {/* Header & Auto-Generator */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Master School Timetable &amp; Schedule Manager</h2>
                  <p className="text-xs text-slate-500">
                    Comprehensive period schedule governing teacher classroom allocations, subject periods, and parent notification sync.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <select
                    value={ttClassCode}
                    onChange={(e) => {
                      setTtClassCode(e.target.value);
                      loadClassTimetable(e.target.value);
                    }}
                    className="px-3 py-2 border border-slate-300 rounded-lg bg-white font-semibold"
                  >
                    <option value="" disabled>-- Select Class --</option>
                    {classes.map((cls) => (
                      <option key={cls.classCode} value={cls.classCode}>
                        Grade {cls.grade}-{cls.section} ({cls.classCode})
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => ttClassCode && loadClassTimetable(ttClassCode, ttDay)}
                    className="px-3 py-2 border border-slate-300 rounded-lg bg-white hover:bg-slate-50 font-semibold"
                  >
                    ↻ Refresh
                  </button>
                </div>
              </div>

              {/* One-Click Weekly Timetable Auto-Generator */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-wrap items-end gap-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">School Start Time</label>
                  <input type="time" value={ttGenStart} onChange={(e) => setTtGenStart(e.target.value)} className="p-2 border rounded-lg bg-white" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Period Duration (min)</label>
                  <input type="number" min={25} max={90} value={ttGenMinutes} onChange={(e) => setTtGenMinutes(e.target.value)} className="w-24 p-2 border rounded-lg bg-white" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Periods / Day</label>
                  <input type="number" min={2} max={10} value={ttGenPeriods} onChange={(e) => setTtGenPeriods(e.target.value)} className="w-20 p-2 border rounded-lg bg-white" />
                </div>
                <label className="flex items-center space-x-2 py-2 cursor-pointer">
                  <input type="checkbox" checked={ttIncludeLiveNow} onChange={(e) => setTtIncludeLiveNow(e.target.checked)} className="rounded text-emerald-600" />
                  <span className="font-medium text-slate-700">Include Active Session Now (for live testing)</span>
                </label>
                <button
                  onClick={handleGenerateTimetable}
                  disabled={loading || !ttClassCode}
                  className="ml-auto bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-bold shadow-sm transition"
                >
                  ⚡ Auto-Generate Weekly Timetable
                </button>
              </div>
            </div>

            {/* Day-Wise Timetable Editor */}
            {ttClassCode && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between flex-wrap gap-2">
                  <div className="flex space-x-1 overflow-x-auto text-xs font-bold">
                    {(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const).map((d) => (
                      <button
                        key={d}
                        onClick={() => {
                          setTtDay(d);
                          setTtSessionsDraft(ttData?.days?.[d]?.sessions || []);
                        }}
                        className={`py-3 px-3 border-b-2 transition ${
                          ttDay === d ? 'border-sky-600 text-sky-700' : 'border-transparent text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        {d} {ttData?.today === d ? '(Today)' : ''}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center space-x-2 py-2">
                    <button
                      onClick={() =>
                        setTtSessionsDraft((prev) => [
                          ...prev,
                          {
                            periodNumber: prev.length + 1,
                            subject: 'Mathematics',
                            title: `Period ${prev.length + 1} - Mathematics`,
                            teacherCode: tenantUsers.find((u) => u.role?.includes('TEACHER') && u.userCode)?.userCode || '',
                            startTime: '09:00',
                            endTime: '09:45',
                            isBreak: false
                          }
                        ])
                      }
                      className="px-3 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-lg text-xs font-semibold"
                    >
                      + Add Period
                    </button>
                    <button
                      onClick={handleSaveDayTimetable}
                      disabled={loading}
                      className="px-4 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-bold shadow-xs"
                    >
                      Save {ttDay} Schedule
                    </button>
                  </div>
                </div>

                <div className="p-4 space-y-2.5 text-xs">
                  {ttSessionsDraft.length === 0 ? (
                    <div className="text-center py-8 text-slate-400">
                      No sessions configured for {ttDay}. Click &quot;⚡ Auto-Generate Weekly Timetable&quot; or &quot;+ Add Period&quot;.
                    </div>
                  ) : (
                    ttSessionsDraft.map((s, idx) => (
                      <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center p-2.5 rounded-lg border border-slate-200 bg-slate-50">
                        <div className="md:col-span-1 font-bold text-sky-700 text-center">P{idx + 1}</div>
                        <div className="md:col-span-3">
                          <input
                            type="text"
                            value={s.subject || ''}
                            onChange={(e) => {
                              const next = [...ttSessionsDraft];
                              next[idx] = { ...next[idx], subject: e.target.value, title: `Period ${idx + 1} - ${e.target.value}` };
                              setTtSessionsDraft(next);
                            }}
                            placeholder="Subject / Break"
                            className="w-full p-1.5 border rounded bg-white text-xs"
                          />
                        </div>
                        <div className="md:col-span-3">
                          <select
                            value={s.teacherCode || ''}
                            disabled={Boolean(s.isBreak)}
                            onChange={(e) => {
                              const next = [...ttSessionsDraft];
                              next[idx] = { ...next[idx], teacherCode: e.target.value };
                              setTtSessionsDraft(next);
                            }}
                            className="w-full p-1.5 border rounded bg-white text-xs disabled:bg-slate-100"
                          >
                            <option value="">-- Select Teacher --</option>
                            {tenantUsers
                              .filter((u) => u.role?.includes('TEACHER') && u.userCode)
                              .map((t) => (
                                <option key={t.userCode} value={t.userCode}>
                                  {t.fullName} ({t.userCode})
                                </option>
                              ))}
                          </select>
                        </div>
                        <div className="md:col-span-2">
                          <input
                            type="time"
                            value={s.startTime || '09:00'}
                            onChange={(e) => {
                              const next = [...ttSessionsDraft];
                              next[idx] = { ...next[idx], startTime: e.target.value };
                              setTtSessionsDraft(next);
                            }}
                            className="w-full p-1.5 border rounded bg-white text-xs"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <input
                            type="time"
                            value={s.endTime || '09:45'}
                            onChange={(e) => {
                              const next = [...ttSessionsDraft];
                              next[idx] = { ...next[idx], endTime: e.target.value };
                              setTtSessionsDraft(next);
                            }}
                            className="w-full p-1.5 border rounded bg-white text-xs"
                          />
                        </div>
                        <div className="md:col-span-1 flex items-center justify-end space-x-2">
                          <label className="text-[10px] flex items-center space-x-1" title="Break period">
                            <input
                              type="checkbox"
                              checked={Boolean(s.isBreak)}
                              onChange={(e) => {
                                const next = [...ttSessionsDraft];
                                next[idx] = { ...next[idx], isBreak: e.target.checked, subject: e.target.checked ? 'BREAK' : next[idx].subject };
                                setTtSessionsDraft(next);
                              }}
                            />
                            <span>Brk</span>
                          </label>
                          <button
                            type="button"
                            onClick={() => setTtSessionsDraft((prev) => prev.filter((_, i) => i !== idx))}
                            className="text-rose-600 hover:text-rose-800 font-bold"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: STUDENTS */}
        {activeTab === 'STUDENTS' && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50">
              <div>
                <h2 className="font-bold text-slate-800 text-sm">Enrolled Student Registry ({students.length})</h2>
                <p className="text-xs text-slate-500">Official student admission mapping, modification, class transfer, and Excel import/export.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleExportStudents}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded text-xs font-semibold shadow-sm transition flex items-center space-x-1"
                >
                  <span>📤</span>
                  <span>Export CSV</span>
                </button>
                <button
                  onClick={() => {
                    setImportText('');
                    setImportResults(null);
                    setIsImportModal(true);
                  }}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded text-xs font-semibold shadow-sm transition flex items-center space-x-1"
                >
                  <span>📥</span>
                  <span>Import Excel / CSV</span>
                </button>
                <button
                  onClick={() => {
                    if (classes.length > 0) setEnrollClassCode(classes[0].classCode);
                    setIsEnrollStudentModal(true);
                  }}
                  className="bg-sky-600 hover:bg-sky-700 text-white px-3 py-1.5 rounded text-xs font-semibold shadow-sm transition flex items-center space-x-1"
                >
                  <span>+ Enroll Student</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Student Code</th>
                    <th className="py-3 px-4">Admission No</th>
                    <th className="py-3 px-4">Full Name</th>
                    <th className="py-3 px-4">Class</th>
                    <th className="py-3 px-4">Bus Route</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {students.map((s) => (
                    <tr key={s.studentCode} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-4 font-mono font-bold text-sky-700">{s.studentCode}</td>
                      <td className="py-3 px-4 font-mono font-semibold text-slate-800">{s.admissionNumber}</td>
                      <td className="py-3 px-4 font-medium text-slate-900">{s.fullName}</td>
                      <td className="py-3 px-4 font-medium">{s.classCode}</td>
                      <td className="py-3 px-4 text-slate-500">{s.busCode || 'Self Transit'}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                          {s.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                        <button
                          onClick={() => {
                            setEditStudentTarget(s);
                            setEditStudentName(s.fullName || '');
                            setEditStudentDob(s.dateOfBirth ? s.dateOfBirth.split('T')[0] : '2014-06-01');
                            setEditStudentGender(s.gender || 'MALE');
                            setEditStudentPhone(s.emergencyContacts?.[0]?.phone || '');
                            setEditStudentBus(s.busCode || '');
                          }}
                          className="px-2 py-1 bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200 rounded font-semibold text-[11px] transition"
                        >
                          ✏️ Edit
                        </button>
                        <button
                          onClick={() => {
                            setTransferStudentTarget(s);
                            setTransferTargetClassCode(classes.find((c) => c.classCode !== s.classCode)?.classCode || '');
                            setTransferTargetSection('A');
                            setTransferReason('Academic section transfer');
                          }}
                          className="px-2 py-1 bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200 rounded font-semibold text-[11px] transition"
                        >
                          🔄 Transfer Class
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 5: AI OMR CORRECTION & EXAM EVALUATIONS */}
        {activeTab === 'EXAMS_OMR' && (
          <div className="space-y-6">
            {/* Header & Primary Actions */}
            <div className="bg-gradient-to-r from-indigo-900 via-slate-900 to-sky-950 text-white p-6 rounded-2xl shadow-md border border-indigo-800/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 uppercase tracking-wider">
                    AI Assessment OS
                  </span>
                  <span className="text-xs text-slate-400">FA-1 • FA-2 • SA-1 • Custom Exams</span>
                </div>
                <h2 className="text-xl font-bold mt-1 text-white">AI OMR Sheet Correction & Digital Report Cards</h2>
                <p className="text-xs text-slate-300 mt-1 max-w-2xl">
                  Automated optical bubble recognition, student-to-file matching, instant score generation, class performance ranking, Excel sheet exports, and automated WhatsApp result notifications to parents.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => {
                    if (classes.length > 0 && !newAssessment.classCode) {
                      setNewAssessment((prev) => ({ ...prev, classCode: classes[0].classCode }));
                    }
                    setIsCreateAssessmentModal(true);
                  }}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-4 py-2.5 rounded-xl text-xs flex items-center space-x-2 shadow-lg shadow-indigo-600/30 transition active:scale-95"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                  </svg>
                  <span>+ Create New Assessment</span>
                </button>
              </div>
            </div>

            {/* KPI Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                <p className="text-xs text-slate-500 font-medium">Total Assessments</p>
                <p className="text-2xl font-bold text-slate-800 mt-1">{assessments.length}</p>
                <p className="text-[11px] text-indigo-600 font-semibold mt-1">FA-1, FA-2 & SA-1 Tracked</p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                <p className="text-xs text-slate-500 font-medium">Students Evaluated</p>
                <p className="text-2xl font-bold text-slate-800 mt-1">
                  {selectedAssessment?.results?.length || 0}
                </p>
                <p className="text-[11px] text-emerald-600 font-semibold mt-1">Active Class Batch</p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                <p className="text-xs text-slate-500 font-medium">Class Average Score</p>
                <p className="text-2xl font-bold text-slate-800 mt-1">
                  {selectedAssessment?.summary?.classAverageScore || 0} <span className="text-xs text-slate-400 font-normal">/ {selectedAssessment?.maxMarks || 20}</span>
                </p>
                <p className="text-[11px] text-sky-600 font-semibold mt-1">
                  High: {selectedAssessment?.summary?.highestScore || 0} • Low: {selectedAssessment?.summary?.lowestScore || 0}
                </p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                <p className="text-xs text-slate-500 font-medium">Class Pass Rate</p>
                <p className="text-2xl font-bold text-emerald-600 mt-1">
                  {selectedAssessment?.summary?.passRate || 0}%
                </p>
                <p className="text-[11px] text-slate-500 font-semibold mt-1">Standard Cutoff (40%)</p>
              </div>
            </div>

            {/* Assessment Cards Selector */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Select Assessment to Inspect</h3>
                <span className="text-xs text-slate-400">Click any card to load student OMR records</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {assessments.map((a) => {
                  const isSelected = selectedAssessment?._id === a._id;
                  const typeColor = a.assessmentType.startsWith('FA')
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    : a.assessmentType.startsWith('SA')
                    ? 'bg-purple-100 text-purple-800 border-purple-300'
                    : 'bg-amber-100 text-amber-800 border-amber-300';

                  return (
                    <div
                      key={a._id}
                      onClick={() => setSelectedAssessment(a)}
                      className={`p-4 rounded-2xl cursor-pointer transition-all border ${
                        isSelected
                          ? 'bg-indigo-50/50 border-indigo-500 shadow-md ring-2 ring-indigo-500/20'
                          : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-xs'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${typeColor}`}>
                          {a.assessmentType}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            a.status === 'PUBLISHED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : a.status === 'EVALUATED'
                              ? 'bg-sky-100 text-sky-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {a.status}
                        </span>
                      </div>

                      <h4 className="font-bold text-slate-900 text-sm mt-2">{a.title}</h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Subject: <span className="font-semibold text-slate-700">{a.subject}</span> • Class: <span className="font-mono text-slate-700">{a.classCode}</span>
                      </p>

                      <div className="mt-3 pt-3 border-t border-slate-100 flex justify-between text-[11px] text-slate-500">
                        <span>{a.totalQuestions} Questions ({a.maxMarks} Marks)</span>
                        <span className="font-semibold text-indigo-700">
                          {a.results?.length || 0} Students Graded
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Selected Assessment Detailed Console */}
            {selectedAssessment && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-5 border-b border-slate-100 bg-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider">Active Evaluation Console</span>
                      <span className="text-xs text-slate-400">•</span>
                      <span className="font-mono text-xs text-slate-600 font-semibold">{selectedAssessment.classCode}</span>
                    </div>
                    <h3 className="text-base font-bold text-slate-900 mt-0.5">{selectedAssessment.title}</h3>
                    <p className="text-xs text-slate-500">
                      Subject: {selectedAssessment.subject} • Type: {selectedAssessment.assessmentType} • Max Marks: {selectedAssessment.maxMarks}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => handleEvaluateOmrBatch(selectedAssessment._id)}
                      disabled={evaluationLoading}
                      className="bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold px-3.5 py-2 rounded-xl flex items-center space-x-1.5 shadow-sm transition disabled:opacity-50"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      <span>{evaluationLoading ? 'Evaluating OMRs...' : '⚡ Run AI OMR Evaluation'}</span>
                    </button>

                    <button
                      onClick={() => handleExportExcel(selectedAssessment._id)}
                      className="bg-emerald-800 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold px-3.5 py-2 rounded-xl flex items-center space-x-1.5 shadow-sm transition"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span>📊 Export Excel (.xlsx)</span>
                    </button>

                    <button
                      onClick={() => handlePublishReportCards(selectedAssessment._id)}
                      disabled={loading || selectedAssessment.status === 'PUBLISHED'}
                      className="bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs font-bold px-3.5 py-2 rounded-xl flex items-center space-x-1.5 shadow-sm transition disabled:opacity-60"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      <span>
                        {selectedAssessment.status === 'PUBLISHED'
                          ? '✓ Published & Notified'
                          : '📤 Publish & Send WhatsApp'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Progress bar during evaluation */}
                {evaluationLoading && (
                  <div className="p-4 bg-indigo-50 border-b border-indigo-100 flex items-center space-x-4">
                    <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                    <div className="flex-1">
                      <div className="flex justify-between text-xs font-bold text-indigo-900 mb-1">
                        <span>AI OMR Optical Recognition & Bubble Analysis in Progress...</span>
                        <span>{omrEvaluationProgress}%</span>
                      </div>
                      <div className="w-full bg-indigo-200 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-indigo-600 h-2 transition-all duration-300"
                          style={{ width: `${omrEvaluationProgress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Answer Key Strip */}
                <div className="p-4 bg-slate-50 border-b border-slate-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Master Answer Key ({selectedAssessment.totalQuestions} Questions)
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Marks: +{selectedAssessment.marksPerQuestion} • Negative: -{selectedAssessment.negativeMarking}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                    {selectedAssessment.answerKey?.map((k: any) => (
                      <span
                        key={k.questionNumber}
                        className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-lg text-xs font-bold bg-white border border-slate-300 shadow-2xs"
                      >
                        <span className="text-slate-400 font-mono text-[10px]">Q{k.questionNumber}</span>
                        <span className="text-indigo-700 font-mono font-bold">{k.correctAnswer}</span>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Student Results Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100 text-slate-600 uppercase font-semibold border-b border-slate-200">
                        <th className="p-3">Rank</th>
                        <th className="p-3">Student Name & Adm No</th>
                        <th className="p-3">OMR File Name</th>
                        <th className="p-3 text-center">Attempted</th>
                        <th className="p-3 text-center">Correct / Wrong</th>
                        <th className="p-3 text-center">Score / Max</th>
                        <th className="p-3 text-center">Percentage</th>
                        <th className="p-3 text-center">Grade</th>
                        <th className="p-3 text-center">Status</th>
                        <th className="p-3 text-center">WhatsApp Alert</th>
                        <th className="p-3 text-right">Report Card</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedAssessment.results?.map((r: any) => {
                        const rankBadge =
                          r.rank === 1
                            ? 'bg-amber-100 text-amber-900 border-amber-300 font-bold'
                            : r.rank === 2
                            ? 'bg-slate-200 text-slate-800 font-bold'
                            : r.rank === 3
                            ? 'bg-amber-50 text-amber-800 font-bold'
                            : 'bg-slate-50 text-slate-600';

                        return (
                          <tr key={r.studentCode} className="hover:bg-slate-50/70 transition">
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded-md text-[11px] border ${rankBadge}`}>
                                #{r.rank}
                              </span>
                            </td>
                            <td className="p-3">
                              <div className="font-semibold text-slate-900">{r.studentName}</div>
                              <div className="font-mono text-[10px] text-slate-400">{r.admissionNumber}</div>
                            </td>
                            <td className="p-3 font-mono text-[11px] text-slate-600">
                              <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                📄 {r.omrFileName || `${r.studentName}_OMR.pdf`}
                              </span>
                            </td>
                            <td className="p-3 text-center font-mono">
                              {r.totalAttempted} / {selectedAssessment.totalQuestions}
                            </td>
                            <td className="p-3 text-center">
                              <span className="text-emerald-700 font-semibold">{r.correctCount} ✓</span>{' '}
                              <span className="text-rose-600 font-semibold">({r.wrongCount} ✗)</span>
                            </td>
                            <td className="p-3 text-center font-bold text-slate-800">
                              {r.score} <span className="text-slate-400 font-normal">/ {selectedAssessment.maxMarks}</span>
                            </td>
                            <td className="p-3 text-center font-bold">
                              <span className={r.percentage >= 80 ? 'text-emerald-600' : r.percentage >= 50 ? 'text-sky-700' : 'text-rose-600'}>
                                {r.percentage}%
                              </span>
                            </td>
                            <td className="p-3 text-center">
                              <span className="px-2 py-0.5 rounded-md font-bold text-xs bg-indigo-100 text-indigo-800">
                                {r.grade}
                              </span>
                            </td>
                            <td className="p-3 text-center">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  r.percentage >= 40
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-rose-100 text-rose-800'
                                }`}
                              >
                                {r.percentage >= 40 ? 'PASS' : 'FAIL'}
                              </span>
                            </td>
                            <td className="p-3 text-center">
                              {r.whatsappNotified || selectedAssessment.status === 'PUBLISHED' ? (
                                <span className="inline-flex items-center space-x-1 text-emerald-700 font-semibold text-[11px]">
                                  <span>💬 Sent</span>
                                </span>
                              ) : (
                                <span className="text-slate-400 text-[11px]">Pending</span>
                              )}
                            </td>
                            <td className="p-3 text-right">
                              <button
                                onClick={() => handleViewReportCard(r.studentCode)}
                                className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs transition"
                              >
                                View Card →
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB: WHATSAPP HUB & NOTIFICATION GATEWAY */}
        {activeTab === 'WHATSAPP' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 text-white p-6 rounded-2xl shadow-md border border-emerald-800/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 uppercase tracking-wider">
                    Official WhatsApp Gateway
                  </span>
                  <span className="text-xs text-emerald-200">2-Way Verified Notifications</span>
                </div>
                <h2 className="text-xl font-bold mt-1 text-white">School WhatsApp Communication Engine</h2>
                <p className="text-xs text-slate-300 mt-1 max-w-2xl">
                  Automated parent communication channel: Fee due reminders, AI-evaluated exam report cards, daily attendance notices, and instant school-wide urgent announcements.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleTestWhatsAppConnection}
                  disabled={loading}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2.5 rounded-xl text-xs flex items-center space-x-2 shadow-lg shadow-emerald-600/30 transition active:scale-95 disabled:opacity-50"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Test Live Connection</span>
                </button>

                <button
                  onClick={() => {
                    if (classes.length > 0 && !broadcastClassCode) {
                      setBroadcastClassCode(classes[0].classCode);
                    }
                    setIsWhatsAppBroadcastModal(true);
                  }}
                  className="bg-white text-emerald-900 hover:bg-emerald-50 font-bold px-4 py-2.5 rounded-xl text-xs flex items-center space-x-2 shadow-sm transition active:scale-95"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                  </svg>
                  <span>📢 Send Instant Broadcast</span>
                </button>
              </div>
            </div>

            {/* Connection Status Card */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Gateway Status</span>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                    🟢 LIVE CONNECTED
                  </span>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-400">School Admin WhatsApp Number</p>
                  <p className="text-base font-bold font-mono text-slate-900">
                    {whatsAppConfig?.phoneNumber || '+91 98765 43210'}
                  </p>
                </div>
                <div className="space-y-1 pt-2 border-t border-slate-100">
                  <p className="text-xs text-slate-400">Business Account ID (WABA)</p>
                  <p className="font-mono text-xs text-slate-700">
                    {whatsAppConfig?.businessAccountId || 'WABA-SSC-2026-LIVE'}
                  </p>
                </div>
                <button
                  onClick={() => setIsWhatsAppModal(true)}
                  className="w-full mt-2 py-2 px-3 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition"
                >
                  Configure Credentials / Change Number
                </button>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3 md:col-span-2">
                <h3 className="font-bold text-slate-900 text-sm">Active Automated Communication Triggers</h3>
                <p className="text-xs text-slate-500">
                  The following events trigger automated WhatsApp notification delivery to parents and staff:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-start space-x-3">
                    <span className="text-lg">💳</span>
                    <div>
                      <p className="font-bold text-slate-800 text-xs">Automated Fee Reminders</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Dispatches single and bulk reminders with pending balance and payment receipts.
                      </p>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-start space-x-3">
                    <span className="text-lg">📝</span>
                    <div>
                      <p className="font-bold text-slate-800 text-xs">AI OMR Exam Results</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Dispatches FA-1, FA-2, SA-1 scores, class rank, and digital report card links to parents.
                      </p>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-start space-x-3">
                    <span className="text-lg">🚌</span>
                    <div>
                      <p className="font-bold text-slate-800 text-xs">Fleet & Bus ETA Alerts</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Dispatches bus departure and stop arrival alerts to parents on the designated route.
                      </p>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-start space-x-3">
                    <span className="text-lg">🚨</span>
                    <div>
                      <p className="font-bold text-slate-800 text-xs">Urgent Campus Notices</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Instant broadcast to all parents for weather delays, school holidays, or emergencies.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: TRANSPORT — FLEET, ROUTES, PLACES & LIVE GPS MAP */}
        {activeTab === 'TRANSPORT' && (
          <div className="space-y-6">
            {/* Header & Primary Actions */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-800">Fleet, Bus Routes & Live GPS Tracking</h2>
                <p className="text-xs text-slate-500">
                  Manage school buses, route places & pickup stops, driver assignments, and real-time GPS tracking map.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setAutoRefreshMap((prev) => !prev)}
                  className={`px-3 py-1.5 rounded text-xs font-semibold border transition ${
                    autoRefreshMap
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-white text-slate-600 border-slate-300'
                  }`}
                >
                  {autoRefreshMap ? '● Live GPS Auto-Sync (5s)' : '○ Auto-Sync Paused'}
                </button>
                <button
                  onClick={loadFleetTelemetry}
                  className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 px-3 py-1.5 rounded text-xs font-semibold transition"
                >
                  ↻ Refresh GPS
                </button>
                <button
                  onClick={() => setIsCreateRouteModal(true)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded text-xs font-semibold shadow-sm transition"
                >
                  + Create Route & Places
                </button>
                <button
                  onClick={() => setIsCreateBusModal(true)}
                  className="bg-sky-600 hover:bg-sky-700 text-white px-3 py-1.5 rounded text-xs font-semibold shadow-sm transition"
                >
                  + Register Bus
                </button>
              </div>
            </div>

            {/* LIVE INTERACTIVE GPS MAP PANEL */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wide">
                    Live School Bus GPS Map & Route Waypoints
                  </h3>
                  <span className="text-[11px] bg-sky-100 text-sky-800 px-2 py-0.5 rounded-full font-semibold">
                    {fleetItems.filter((f) => f.isLive).length} Active Trips • {buses.length} Buses • {routes.length} Routes
                  </span>
                </div>
                <div className="flex items-center space-x-2 text-xs">
                  {(selectedMapBusCode || selectedMapRouteCode) && (
                    <button
                      onClick={() => {
                        setSelectedMapBusCode(null);
                        setSelectedMapRouteCode(null);
                      }}
                      className="text-sky-700 hover:underline font-semibold"
                    >
                      Show All Buses & Routes
                    </button>
                  )}
                </div>
              </div>
              <div className="p-3">
                <LiveFleetMap
                  fleet={fleetItems}
                  routes={routes}
                  selectedBusCode={selectedMapBusCode}
                  selectedRouteCode={selectedMapRouteCode}
                  height="400px"
                />
              </div>
            </div>

            {/* SCHOOL BUSES GRID */}
            <div className="space-y-2.5">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Registered School Buses ({buses.length})
              </h3>
              {buses.length === 0 ? (
                <div className="bg-white rounded-xl border border-dashed border-slate-300 p-6 text-center text-xs text-slate-500">
                  No buses registered yet. Click &quot;+ Register Bus&quot; to add a vehicle with GPS tracking.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {buses.map((b) => {
                    const liveEntry = fleetItems.find((f) => f.bus.busCode === b.busCode);
                    const assignedRoute = routes.find((r) => r.routeCode === b.routeCode);
                    const assignedDriver = tenantUsers.find((u) => u.userCode === b.driverCode);
                    return (
                      <div key={b.busCode} className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-2.5">
                        <div className="flex justify-between items-center">
                          <span className="font-mono text-xs font-bold text-sky-700">{b.busCode}</span>
                          <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                            liveEntry?.isLive
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-sky-100 text-sky-800'
                          }`}>
                            {liveEntry?.isLive ? `● ${liveEntry.status}` : b.status || 'STANDBY'}
                          </span>
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900 text-sm">
                            {b.busNumber && b.busNumber !== b.registrationNumber ? `${b.busNumber} • ` : ''}
                            Reg: {b.registrationNumber}
                          </h4>
                          <p className="text-xs text-slate-500">Capacity: {b.capacity} Seats</p>
                        </div>
                        <div className="bg-slate-50 rounded-lg p-2.5 space-y-1 text-[11px] border border-slate-100">
                          <div className="flex justify-between">
                            <span className="text-slate-500">Driver:</span>
                            <span className="font-semibold text-slate-800">
                              {assignedDriver ? `${assignedDriver.fullName} (${assignedDriver.userCode})` : b.driverCode || 'Unassigned'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Route:</span>
                            <span className="font-semibold text-sky-700">
                              {assignedRoute ? assignedRoute.routeName : b.routeCode || 'Unassigned'}
                            </span>
                          </div>
                          {liveEntry?.location?.latitude && (
                            <div className="flex justify-between pt-1 border-t border-slate-200">
                              <span className="text-slate-500">GPS:</span>
                              <span className="font-mono text-slate-700">
                                {liveEntry.location.latitude.toFixed(4)}, {liveEntry.location.longitude.toFixed(4)} ({liveEntry.location.speedKmph ?? 0} km/h)
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center justify-between pt-1 gap-2">
                          <button
                            onClick={() => {
                              setSelectedMapRouteCode(null);
                              setSelectedMapBusCode(b.busCode);
                            }}
                            className="flex-1 py-1.5 px-2.5 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-lg text-[11px] font-semibold transition"
                          >
                            Track on Map
                          </button>
                          <button
                            onClick={() => {
                              setEditBusTarget(b);
                              setEditBusDriverCode(b.driverCode || '');
                              setEditBusRouteCode(b.routeCode || '');
                              setEditBusStatus(b.status || 'ACTIVE');
                            }}
                            className="flex-1 py-1.5 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold transition"
                          >
                            Assign Driver/Route
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ROUTES & PLACES REGISTRY */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Transit Routes, Places & Stops ({routes.length})
                </h3>
                <button
                  onClick={() => setIsCreateRouteModal(true)}
                  className="text-xs text-emerald-700 hover:underline font-semibold"
                >
                  + Add New Route
                </button>
              </div>
              {routes.length === 0 ? (
                <div className="bg-white rounded-xl border border-dashed border-slate-300 p-6 text-center text-xs text-slate-500">
                  No bus routes configured yet. Click &quot;+ Create Route &amp; Places&quot; to set start place, pickup stops, and school campus destination with GPS coordinates.
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {routes.map((rt) => (
                    <div key={rt.routeCode} className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-mono text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                              {rt.routeCode}
                            </span>
                            <h4 className="font-bold text-slate-900 text-sm">{rt.routeName}</h4>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-1">
                            Bus: <span className="font-mono font-semibold text-slate-700">{rt.busCode || 'Unassigned'}</span> • Driver:{' '}
                            <span className="font-mono font-semibold text-slate-700">{rt.driverCode || 'Unassigned'}</span>
                          </p>
                        </div>
                        <div className="flex items-center space-x-1.5">
                          <button
                            onClick={() => {
                              setSelectedMapBusCode(null);
                              setSelectedMapRouteCode(rt.routeCode);
                            }}
                            className="px-2.5 py-1 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded text-[11px] font-semibold"
                          >
                            View Map
                          </button>
                          <button
                            onClick={() => {
                              setAddStopRouteTarget(rt);
                              setNewStopLat(String(rt.startLocation?.coordinates?.[1] ?? 17.4700));
                              setNewStopLng(String(rt.startLocation?.coordinates?.[0] ?? 78.3900));
                            }}
                            className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded text-[11px] font-semibold"
                          >
                            + Stop
                          </button>
                          <button
                            onClick={() => handleDeleteRoute(rt.routeCode)}
                            className="px-2 py-1 text-rose-600 hover:bg-rose-50 rounded text-[11px] font-semibold"
                          >
                            Delete
                          </button>
                        </div>
                      </div>

                      {/* Ordered Places Timeline */}
                      <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                            <span className="font-semibold text-slate-800">Start: {rt.startLocation?.name || 'Origin'}</span>
                          </div>
                          <span className="font-mono text-[10px] text-slate-400">
                            {rt.startLocation?.coordinates?.[1]?.toFixed(4)}, {rt.startLocation?.coordinates?.[0]?.toFixed(4)}
                          </span>
                        </div>

                        {(rt.stops || []).map((st: any, idx: number) => (
                          <div key={st.stopId || idx} className="flex items-center justify-between pl-2 border-l-2 border-sky-300 ml-1">
                            <div>
                              <span className="font-semibold text-sky-800">#{st.sequenceOrder || idx + 1} {st.stopName}</span>
                              <span className="ml-2 text-[10px] text-slate-500">
                                Pickup {st.scheduledPickupTime} • Drop {st.scheduledDropTime}
                              </span>
                            </div>
                            <span className="font-mono text-[10px] text-slate-400">
                              {st.coordinates?.[1]?.toFixed(4)}, {st.coordinates?.[0]?.toFixed(4)}
                            </span>
                          </div>
                        ))}

                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-slate-900" />
                            <span className="font-semibold text-slate-800">End: {rt.endLocation?.name || 'School Campus'}</span>
                          </div>
                          <span className="font-mono text-[10px] text-slate-400">
                            {rt.endLocation?.coordinates?.[1]?.toFixed(4)}, {rt.endLocation?.coordinates?.[0]?.toFixed(4)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 7: INCIDENTS & SOS */}
        {activeTab === 'INCIDENTS' && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50">
              <h2 className="font-bold text-slate-800 text-sm">School Incident & Panic SOS Alert Ledger</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-4">Incident Code</th>
                    <th className="py-2.5 px-4">Type</th>
                    <th className="py-2.5 px-4">Severity</th>
                    <th className="py-2.5 px-4">Reported By</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4">Reported At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {incidents.map((inc) => (
                    <tr key={inc.incidentCode} className="hover:bg-slate-50 transition">
                      <td className="py-2.5 px-4 font-mono font-semibold text-slate-900">{inc.incidentCode}</td>
                      <td className="py-2.5 px-4 font-medium text-slate-800">{inc.type}</td>
                      <td className="py-2.5 px-4">
                        <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                          inc.severity === 'CRITICAL' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {inc.severity}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 font-mono text-slate-600">{inc.reportedBy}</td>
                      <td className="py-2.5 px-4">{inc.status}</td>
                      <td className="py-2.5 px-4 text-slate-400">{new Date(inc.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 8: FEES & WHATSAPP REMINDERS */}
        {activeTab === 'FEES' && (
          <div className="space-y-6">
            {/* KPI Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-400">Total Billed</span>
                <p className="text-xl font-bold text-slate-900 mt-1">₹{(feeStats?.totalBilled || 0).toLocaleString('en-IN')}</p>
                <span className="text-[11px] text-slate-500">{feeStats?.totalRecords || fees.length} fee assessments</span>
              </div>
              <div className="bg-white p-4 rounded-xl shadow-sm border border-emerald-200 bg-emerald-50/20">
                <span className="text-[10px] uppercase font-bold text-emerald-600">Total Collected</span>
                <p className="text-xl font-bold text-emerald-700 mt-1">₹{(feeStats?.totalCollected || 0).toLocaleString('en-IN')}</p>
                <span className="text-[11px] text-emerald-600 font-semibold">{feeStats?.countPaid || 0} Fully Paid</span>
              </div>
              <div className="bg-white p-4 rounded-xl shadow-sm border border-rose-200 bg-rose-50/20">
                <span className="text-[10px] uppercase font-bold text-rose-600">Total Pending / Dues</span>
                <p className="text-xl font-bold text-rose-700 mt-1">₹{(feeStats?.totalPending || 0).toLocaleString('en-IN')}</p>
                <span className="text-[11px] text-rose-600 font-semibold">{(feeStats?.countPending || 0) + (feeStats?.countPartial || 0)} Students with Dues</span>
              </div>
              <div className="bg-white p-4 rounded-xl shadow-sm border border-amber-200 bg-amber-50/20 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-amber-700">WhatsApp Gateway</span>
                  <div className="flex items-center space-x-2 mt-1">
                    <span className={`w-2.5 h-2.5 rounded-full ${whatsAppConfig?.connected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                    <span className="text-xs font-bold text-slate-800">
                      {whatsAppConfig?.connected ? 'Connected (Verified)' : 'Disconnected'}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-0.5 truncate">{whatsAppConfig?.phoneNumber || 'No phone set'}</p>
                </div>
                <button
                  onClick={() => setIsWhatsAppModal(true)}
                  className="mt-2 text-[11px] font-semibold text-amber-800 hover:text-amber-900 underline text-left"
                >
                  ⚙️ Configure WhatsApp
                </button>
              </div>
            </div>

            {/* Actions Bar & WhatsApp Remind All */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center space-x-2 text-xs">
                  <span className="text-slate-500 font-semibold">Class:</span>
                  <select
                    value={feeFilterClass}
                    onChange={(e) => {
                      setFeeFilterClass(e.target.value);
                      setTimeout(loadFees, 50);
                    }}
                    className="border border-slate-300 rounded-lg p-1.5 text-xs bg-white font-medium"
                  >
                    <option value="ALL">All Classes</option>
                    {classes.map((c) => (
                      <option key={c.classCode} value={c.classCode}>
                        Grade {c.grade}-{c.section}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center space-x-2 text-xs">
                  <span className="text-slate-500 font-semibold">Status:</span>
                  <select
                    value={feeFilterStatus}
                    onChange={(e) => {
                      setFeeFilterStatus(e.target.value);
                      setTimeout(loadFees, 50);
                    }}
                    className="border border-slate-300 rounded-lg p-1.5 text-xs bg-white font-medium"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="PENDING">Pending Dues Only</option>
                    <option value="PARTIAL">Partial Payments</option>
                    <option value="PAID">Fully Paid</option>
                  </select>
                </div>

                <input
                  type="text"
                  value={feeSearch}
                  onChange={(e) => setFeeSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && loadFees()}
                  placeholder="Search student, adm no..."
                  className="text-xs p-1.5 border border-slate-300 rounded-lg outline-none w-44"
                />
                <button
                  onClick={loadFees}
                  className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1.5 rounded font-semibold transition"
                >
                  Search
                </button>
              </div>

              <div className="flex items-center space-x-2 self-start md:self-auto">
                <button
                  onClick={handleSendAllWhatsAppReminders}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded text-xs font-semibold shadow-sm transition flex items-center space-x-1.5"
                >
                  <span>📲</span>
                  <span>Remind All Pending (WhatsApp)</span>
                </button>
                <button
                  onClick={() => {
                    if (classes.length > 0) setAssignFeeClassCode(classes[0].classCode);
                    setIsAssignFeeModal(true);
                  }}
                  className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded text-xs font-semibold shadow-sm transition"
                >
                  + Assign Fee
                </button>
              </div>
            </div>

            {/* Fee Records Table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Student & Adm</th>
                      <th className="py-3 px-4">Class</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Total Amount</th>
                      <th className="py-3 px-4">Paid Amount</th>
                      <th className="py-3 px-4">Due Balance</th>
                      <th className="py-3 px-4">Due Date</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Parent WhatsApp</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {fees.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-8 text-center text-slate-400 italic">
                          No fee records found for the selected filters. Use "+ Assign Fee" to create fees for a student or class.
                        </td>
                      </tr>
                    ) : (
                      fees.map((f) => {
                        const due = (f.amount || 0) - (f.paidAmount || 0);
                        return (
                          <tr key={f._id} className="hover:bg-slate-50 transition">
                            <td className="py-3 px-4">
                              <span className="font-bold text-slate-900 block">{f.studentName}</span>
                              <span className="text-[10px] font-mono text-slate-400">
                                {f.admissionNumber} • {f.studentCode}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-mono font-medium text-sky-800">{f.classCode}</td>
                            <td className="py-3 px-4">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                                {f.feeType}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-semibold text-slate-900">₹{(f.amount || 0).toLocaleString('en-IN')}</td>
                            <td className="py-3 px-4 font-semibold text-emerald-700">₹{(f.paidAmount || 0).toLocaleString('en-IN')}</td>
                            <td className="py-3 px-4 font-bold text-rose-700">₹{due > 0 ? due.toLocaleString('en-IN') : 0}</td>
                            <td className="py-3 px-4 text-slate-600">
                              {new Date(f.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  f.status === 'PAID'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : f.status === 'PARTIAL'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-rose-100 text-rose-800'
                                }`}
                              >
                                {f.status}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                              <div>{f.parentPhone || 'No Phone'}</div>
                              {f.whatsappRemindersSent > 0 && (
                                <span className="text-[10px] text-emerald-600 font-semibold block">
                                  ✓ {f.whatsappRemindersSent} reminder(s) sent
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                              {f.status !== 'PAID' && (
                                <>
                                  <button
                                    onClick={() => {
                                      setPayFeeTarget(f);
                                      setPayFeeAmount(String(due));
                                      setPayFeeMethod('UPI');
                                      setPayFeeRef(`TXN-${Date.now().toString().slice(-6)}`);
                                      setPayFeeNotes('');
                                    }}
                                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-semibold text-[11px] shadow-sm transition"
                                  >
                                    💳 Pay
                                  </button>
                                  <button
                                    onClick={() => handleSendWhatsAppReminder(f._id)}
                                    className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded font-semibold text-[11px] shadow-sm transition"
                                    title="Send WhatsApp Fee Reminder"
                                  >
                                    📲 Remind
                                  </button>
                                </>
                              )}
                              {f.receiptNumber && (
                                <span className="text-[10px] font-mono text-slate-500 font-semibold">
                                  Rcpt: {f.receiptNumber}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 9: EVENTS GALLERY (7-DAY EXPIRY) */}
        {activeTab === 'EVENTS' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-purple-900 to-indigo-900 text-white p-5 rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-400 animate-pulse" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-purple-200">School Media &amp; Activities</span>
                </div>
                <h2 className="text-lg font-bold mt-1">Events Gallery (7-Day Automatic Expiry)</h2>
                <p className="text-xs text-purple-200 mt-1 max-w-xl">
                  Photos, sports meets, cultural celebrations, and campus notices. All published events are preserved for exactly 1 week (7 days) and automatically expire to maintain tenant privacy and clean media storage.
                </p>
              </div>
              <button
                onClick={() => {
                  setNewEventTitle('');
                  setNewEventCategory('CAMPUS');
                  setNewEventDate(new Date().toISOString().split('T')[0]);
                  setNewEventDescription('');
                  setIsCreateEventModal(true);
                }}
                className="bg-white hover:bg-purple-50 text-purple-900 px-4 py-2 rounded-xl text-xs font-bold shadow-md transition self-start md:self-auto"
              >
                + Publish New Event
              </button>
            </div>

            {/* Events Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {events.length === 0 ? (
                <div className="col-span-full bg-white p-12 text-center rounded-xl border border-slate-200 text-slate-400">
                  <p className="text-sm font-semibold">No active events in the gallery.</p>
                  <p className="text-xs mt-1">Publish an event with photos above. Events automatically expire in 7 days.</p>
                </div>
              ) : (
                events.map((ev) => (
                  <div key={ev._id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col hover:shadow-md transition">
                    {/* Primary Image / Hero */}
                    <div className="relative h-48 bg-slate-100 overflow-hidden">
                      <img
                        src={ev.images?.[0] || 'https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=800&q=80'}
                        alt={ev.title}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-3 left-3 flex items-center space-x-1.5">
                        <span className="bg-slate-900/80 backdrop-blur-sm text-white px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">
                          {ev.category}
                        </span>
                      </div>
                      <div className="absolute top-3 right-3">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold backdrop-blur-sm ${
                            ev.isExpiringSoon
                              ? 'bg-rose-600/90 text-white animate-pulse'
                              : 'bg-emerald-600/90 text-white'
                          }`}
                        >
                          ⏳ Expires in {ev.daysLeft}d ({ev.hoursLeft}h)
                        </span>
                      </div>
                    </div>

                    {/* Secondary Image Thumbnails if multiple */}
                    {ev.images?.length > 1 && (
                      <div className="flex space-x-1.5 p-2 bg-slate-50 border-b border-slate-100 overflow-x-auto">
                        {ev.images.slice(0, 4).map((imgUrl: string, idx: number) => (
                          <img
                            key={idx}
                            src={imgUrl}
                            alt=""
                            className="h-10 w-14 object-cover rounded border border-slate-200 flex-shrink-0"
                          />
                        ))}
                      </div>
                    )}

                    <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                      <div>
                        <div className="text-[10px] font-semibold text-slate-400">
                          {new Date(ev.eventDate).toLocaleDateString('en-IN', {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </div>
                        <h3 className="font-bold text-slate-900 text-sm mt-0.5 leading-snug">{ev.title}</h3>
                        <p className="text-xs text-slate-600 mt-1 line-clamp-3 leading-relaxed">{ev.description}</p>
                      </div>

                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                        <span>By {ev.uploader?.fullName || 'School Admin'}</span>
                        <button
                          onClick={() => handleDeleteEvent(ev._id)}
                          className="text-rose-600 hover:text-rose-800 font-semibold"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </main>

      {/* MODAL: VERIFY PARENT-CHILD CUSTODY */}
      {verifyParentTarget && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 bg-sky-800 text-white">
              <h3 className="text-base font-bold">Parent Verification & Custody Audit</h3>
              <p className="text-xs text-sky-200 mt-0.5">
                {verifyParentTarget.fullName} ({verifyParentTarget.phone} • {verifyParentTarget.email})
              </p>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-amber-900 space-y-1">
                <p className="font-bold text-[11px]">Strict Verification Policy:</p>
                <p>Parent status will only become <span className="font-bold">VERIFIED</span> after cross-checking admission number, student mapping, duplicate contact checks, and explicit consent.</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Photo 3 requirement: Select enrolled student for parent approval */}
                <div className="col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">
                    Quick Select Enrolled Student (Auto-fills Registry Details)
                  </label>
                  <select
                    onChange={(e) => handleSelectStudentForParent(e.target.value)}
                    defaultValue=""
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-300 bg-white font-medium outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    <option value="" disabled>-- Select Student from School Admission Registry --</option>
                    {students.map((st) => (
                      <option key={st.studentCode} value={st.studentCode}>
                        {st.fullName} ({st.admissionNumber}) • Class {st.classCode}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Note: A student already linked to another verified parent cannot be reassigned (strict single-parent guard).
                  </p>
                </div>

                <div className="col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">
                    Student Admission Number (Must Match School Registry)
                  </label>
                  <input
                    type="text"
                    required
                    value={studentAdmissionNo}
                    onChange={(e) => setStudentAdmissionNo(e.target.value)}
                    placeholder="e.g. ADM-1001"
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-300 font-mono uppercase focus:ring-2 focus:ring-sky-500 outline-none"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">
                    Child Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={childFullName}
                    onChange={(e) => setChildFullName(e.target.value)}
                    placeholder="e.g. Aarav Sharma"
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-sky-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Class / Grade</label>
                  <input
                    type="text"
                    required
                    value={childGrade}
                    onChange={(e) => setChildGrade(e.target.value)}
                    placeholder="6"
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-sky-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Section</label>
                  <input
                    type="text"
                    required
                    value={childSection}
                    onChange={(e) => setChildSection(e.target.value)}
                    placeholder="A"
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-300 uppercase focus:ring-2 focus:ring-sky-500 outline-none"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Relationship to Child</label>
                  <select
                    value={parentRelationship}
                    onChange={(e) => setParentRelationship(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-300 bg-white outline-none"
                  >
                    <option value="FATHER">Father</option>
                    <option value="MOTHER">Mother</option>
                    <option value="LEGAL_GUARDIAN">Legal Guardian</option>
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Admin Verification Audit Note</label>
                  <textarea
                    rows={2}
                    value={verificationNotes}
                    onChange={(e) => setVerificationNotes(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-300 outline-none"
                  />
                </div>

                <div className="col-span-2 flex items-center space-x-2 pt-1">
                  <input
                    type="checkbox"
                    id="consent"
                    checked={consentAccepted}
                    onChange={(e) => setConsentAccepted(e.target.checked)}
                    className="rounded text-sky-600 focus:ring-sky-500"
                  />
                  <label htmlFor="consent" className="text-slate-700 font-medium">
                    Mandatory Parental Consent Accepted & Verified
                  </label>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setVerifyParentTarget(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleVerifyParent}
                  disabled={loading || !studentAdmissionNo.trim() || !consentAccepted}
                  className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition disabled:opacity-50"
                >
                  {loading ? 'Verifying...' : 'Approve & Issue Parent Code'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: APPROVE TEACHER (Photo 3 Prompt for Class Access) */}
      {approveTeacherTarget && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 bg-sky-800 text-white">
              <h3 className="text-base font-bold">Approve Teacher & Configure Class Access</h3>
              <p className="text-xs text-sky-200 mt-0.5">
                {approveTeacherTarget.fullName} ({approveTeacherTarget.email} • {approveTeacherTarget.phone})
              </p>
            </div>
            <form onSubmit={handleApproveTeacherSubmit} className="p-6 space-y-4 text-xs">
              <div className="bg-sky-50 border border-sky-200 p-3 rounded-lg text-sky-900 text-xs">
                <p className="font-semibold">Class Permission Access:</p>
                <p className="text-[11px] text-sky-800 mt-0.5">Assign the classroom and teaching responsibilities for this educator.</p>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Select Assigned Classroom</label>
                <select
                  value={apprTeacherClassCode}
                  onChange={(e) => setApprTeacherClassCode(e.target.value)}
                  className="w-full p-2.5 border rounded-lg bg-white text-xs font-medium"
                >
                  <option value="">-- No Class Access Assigned --</option>
                  {classes.map((cls) => (
                    <option key={cls.classCode} value={cls.classCode}>
                      Grade {cls.grade}-{cls.section} ({cls.classCode}) - Room {cls.roomNumber || 'N/A'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Teaching Subject / Specialization</label>
                <input
                  type="text"
                  value={apprTeacherSubject}
                  onChange={(e) => setApprTeacherSubject(e.target.value)}
                  placeholder="e.g. Mathematics, Science, General"
                  className="w-full p-2.5 border rounded-lg text-xs"
                />
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="apprIsClassTeacher"
                  checked={apprTeacherIsClassTeacher}
                  onChange={(e) => setApprTeacherIsClassTeacher(e.target.checked)}
                  className="rounded text-sky-600 focus:ring-sky-500"
                />
                <label htmlFor="apprIsClassTeacher" className="text-slate-800 font-medium">
                  Designate as Primary Class Teacher (Assigned Class Leader for notices, assignments & assessments)
                </label>
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setApproveTeacherTarget(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition"
                >
                  {loading ? 'Approving...' : 'Approve Teacher & Issue Code'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: MODIFY USER (Photo 3 requirement: Modify button & assign class/bus/student) */}
      {modifyTargetUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 bg-sky-900 text-white flex justify-between items-center">
              <div>
                <h3 className="text-base font-bold">Modify User Details & Access Controls</h3>
                <p className="text-xs text-sky-200 font-mono mt-0.5">
                  Code: {modifyTargetUser.userCode} • Role: {modifyTargetUser.role}
                </p>
              </div>
              <span className="px-2.5 py-1 rounded text-[11px] font-bold bg-white/10 uppercase">
                {modifyTargetUser.status}
              </span>
            </div>

            <form onSubmit={handleSaveModifyUser} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={modFullName}
                    onChange={(e) => setModFullName(e.target.value)}
                    className="w-full p-2.5 border rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    value={modEmail}
                    onChange={(e) => setModEmail(e.target.value)}
                    className="w-full p-2.5 border rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Phone Number</label>
                  <input
                    type="text"
                    required
                    value={modPhone}
                    onChange={(e) => setModPhone(e.target.value)}
                    className="w-full p-2.5 border rounded-lg text-xs font-mono"
                  />
                </div>

                {/* Photo 1 requirement: Activate or Deactivate Option */}
                <div className="col-span-2 bg-slate-50 border border-slate-200 p-3 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-800 text-xs block">Account Authorization Status</span>
                    <span className="text-[11px] text-slate-500">Activate or deactivate this account's system access</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => setModStatus('ACTIVE')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                        modStatus === 'ACTIVE'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      ✓ Active
                    </button>
                    <button
                      type="button"
                      onClick={() => setModStatus('SUSPENDED')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                        modStatus === 'SUSPENDED'
                          ? 'bg-rose-600 text-white shadow-xs'
                          : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      ✕ Deactivated
                    </button>
                  </div>
                </div>

                {/* ROLE SPECIFIC: PARENT (Access control to Bus Location, Student Class mapping, Bus No for Location) */}
                {modifyTargetUser.role === 'PARENT' && (
                  <div className="col-span-2 space-y-3 pt-2 border-t border-slate-100">
                    <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-lg text-amber-900 text-[11px]">
                      <span className="font-bold">Parent Access Control:</span> Manage permissions for Bus Location tracking, student academic class section, and transit route mapping.
                    </div>

                    {/* Academic Section Mapping */}
                    <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl space-y-2">
                      <label className="block font-semibold text-slate-700 text-[11px]">
                        Enrolled Student Class &amp; Section
                      </label>
                      <select
                        value={modClassCode}
                        onChange={(e) => setModClassCode(e.target.value)}
                        className="w-full p-2 border rounded-lg bg-white text-xs"
                      >
                        <option value="">-- Select Student Class --</option>
                        {classes.map((cls) => (
                          <option key={cls.classCode} value={cls.classCode}>
                            Grade {cls.grade}-{cls.section} ({cls.classCode})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Photo 1 requirement: Access Control to Bus Location & Bus No for Location */}
                    <div className="bg-sky-50/70 border border-sky-200 p-3 rounded-xl space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className={`w-2.5 h-2.5 rounded-full ${modTransportEnabled ? 'bg-sky-500 animate-pulse' : 'bg-slate-400'}`}></span>
                          <span className="font-bold text-slate-800 text-xs">Access Control to Bus Location</span>
                        </div>
                        <div className="flex items-center space-x-1.5">
                          <button
                            type="button"
                            onClick={() => setModTransportEnabled(true)}
                            className={`px-2.5 py-1 rounded text-[11px] font-semibold transition ${
                              modTransportEnabled
                                ? 'bg-sky-600 text-white shadow-xs'
                                : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-50'
                            }`}
                          >
                            Activate
                          </button>
                          <button
                            type="button"
                            onClick={() => setModTransportEnabled(false)}
                            className={`px-2.5 py-1 rounded text-[11px] font-semibold transition ${
                              !modTransportEnabled
                                ? 'bg-rose-600 text-white shadow-xs'
                                : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-50'
                            }`}
                          >
                            Deactivate
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1 text-[11px]">
                          Bus No for Location (Live Delayed GPS)
                        </label>
                        <select
                          value={modBusCode}
                          onChange={(e) => setModBusCode(e.target.value)}
                          disabled={!modTransportEnabled}
                          className="w-full p-2 border rounded-lg bg-white text-xs disabled:bg-slate-100 disabled:text-slate-400"
                        >
                          <option value="">-- Select Bus No for Location --</option>
                          {buses.map((b) => (
                            <option key={b.busCode} value={b.busCode}>
                              {b.registrationNumber} ({b.busCode})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Map Enrolled Student (Single-Parent Exclusive)
                      </label>
                      <select
                        value={modStudentCode}
                        onChange={(e) => setModStudentCode(e.target.value)}
                        className="w-full p-2.5 border rounded-lg bg-white text-xs font-medium"
                      >
                        <option value="">-- No Student Linked --</option>
                        {students.map((st) => (
                          <option key={st.studentCode} value={st.studentCode}>
                            {st.fullName} ({st.admissionNumber}) • {st.studentCode}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {/* ROLE SPECIFIC: TEACHER (Multi-Class Assignment Managed Anytime by School Admin) */}
                {modifyTargetUser.role.includes('TEACHER') && (
                  <div className="col-span-2 space-y-3 pt-2 border-t border-slate-100">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Assign / Change Teaching Classes (Multi-Class Supported)
                      </label>
                      <p className="text-[10px] text-slate-500 mb-1.5">
                        Select one or multiple classes this teacher teaches. You can add or remove classes at any time.
                      </p>
                      <div className="grid grid-cols-2 gap-1.5 max-h-32 overflow-y-auto p-2 border rounded-lg bg-slate-50">
                        {classes.map((cls) => {
                          const checked = modClassCodes.includes(cls.classCode);
                          return (
                            <label
                              key={cls.classCode}
                              className={`flex items-center space-x-2 p-1.5 rounded border cursor-pointer text-[11px] ${
                                checked ? 'bg-sky-50 border-sky-300 text-sky-900 font-semibold' : 'bg-white border-slate-200 text-slate-700'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setModClassCodes((prev) => Array.from(new Set([...prev, cls.classCode])));
                                  } else {
                                    setModClassCodes((prev) => prev.filter((c) => c !== cls.classCode));
                                  }
                                }}
                                className="rounded text-sky-600"
                              />
                              <span>Grade {cls.grade}-{cls.section}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Teaching Subject</label>
                      <input
                        type="text"
                        value={modSubject}
                        onChange={(e) => setModSubject(e.target.value)}
                        placeholder="Mathematics, Science, English..."
                        className="w-full p-2.5 border rounded-lg text-xs"
                      />
                    </div>

                    <div className="flex items-center space-x-2 pt-1">
                      <input
                        type="checkbox"
                        id="modIsClassTeacher"
                        checked={modIsClassTeacher}
                        onChange={(e) => setModIsClassTeacher(e.target.checked)}
                        className="rounded text-sky-600 focus:ring-sky-500"
                      />
                      <label htmlFor="modIsClassTeacher" className="text-slate-700 font-medium">
                        Designate as Primary Class Teacher
                      </label>
                    </div>
                  </div>
                )}

                {/* ROLE SPECIFIC: DRIVER */}
                {modifyTargetUser.role === 'DRIVER' && (
                  <div className="col-span-2 space-y-3 pt-2 border-t border-slate-100">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Assign / Change Bus</label>
                      <select
                        value={modBusCode}
                        onChange={(e) => setModBusCode(e.target.value)}
                        className="w-full p-2.5 border rounded-lg bg-white text-xs font-medium"
                      >
                        <option value="">-- No Bus Assigned --</option>
                        {buses.map((b) => (
                          <option key={b.busCode} value={b.busCode}>
                            {b.registrationNumber} ({b.busCode}) - {b.capacity} Seats
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Assign / Change Route</label>
                      <select
                        value={modRouteCode}
                        onChange={(e) => setModRouteCode(e.target.value)}
                        className="w-full p-2.5 border rounded-lg bg-white text-xs font-medium"
                      >
                        <option value="">-- Default School Route --</option>
                        {routes.map((r) => (
                          <option key={r.routeCode} value={r.routeCode}>
                            {r.name || r.routeCode} ({r.routeCode})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setModifyTargetUser(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 text-xs font-semibold bg-sky-600 hover:bg-sky-700 text-white rounded-lg transition"
                >
                  {loading ? 'Saving...' : 'Save Modifications'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE CLASS */}
      {isCreateClassModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 bg-sky-800 text-white">
              <h3 className="text-base font-bold">Create New Classroom</h3>
            </div>
            <form onSubmit={handleCreateClass} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Grade</label>
                  <input
                    type="text"
                    required
                    value={newGrade}
                    onChange={(e) => setNewGrade(e.target.value)}
                    className="w-full p-2.5 border rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Section</label>
                  <input
                    type="text"
                    required
                    value={newSection}
                    onChange={(e) => setNewSection(e.target.value)}
                    className="w-full p-2.5 border rounded-lg text-xs uppercase"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Max Capacity</label>
                  <input
                    type="number"
                    required
                    value={newCapacity}
                    onChange={(e) => setNewCapacity(e.target.value)}
                    className="w-full p-2.5 border rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Room Number</label>
                  <input
                    type="text"
                    required
                    value={newRoomNumber}
                    onChange={(e) => setNewRoomNumber(e.target.value)}
                    className="w-full p-2.5 border rounded-lg text-xs"
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsCreateClassModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 text-xs font-semibold bg-sky-600 hover:bg-sky-700 text-white rounded-lg"
                >
                  Create Class
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* MODAL: ENROLL STUDENT */}
      {isEnrollStudentModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 bg-sky-800 text-white">
              <h3 className="text-base font-bold">Enroll New Student</h3>
            </div>
            <form onSubmit={handleEnrollStudent} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Admission Number</label>
                <input
                  type="text"
                  required
                  value={enrollAdmissionNo}
                  onChange={(e) => setEnrollAdmissionNo(e.target.value)}
                  placeholder="ADM-1002"
                  className="w-full p-2.5 border rounded-lg font-mono uppercase text-xs"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Student Full Name</label>
                <input
                  type="text"
                  required
                  value={enrollStudentName}
                  onChange={(e) => setEnrollStudentName(e.target.value)}
                  placeholder="Aarav Kumar"
                  className="w-full p-2.5 border rounded-lg text-xs"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Date of Birth</label>
                  <input
                    type="date"
                    required
                    value={enrollDob}
                    onChange={(e) => setEnrollDob(e.target.value)}
                    className="w-full p-2.5 border rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Gender</label>
                  <select
                    value={enrollGender}
                    onChange={(e) => setEnrollGender(e.target.value)}
                    className="w-full p-2.5 border rounded-lg bg-white text-xs"
                  >
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Class Assigned</label>
                <select
                  value={enrollClassCode}
                  onChange={(e) => setEnrollClassCode(e.target.value)}
                  className="w-full p-2.5 border rounded-lg bg-white text-xs"
                >
                  {classes.map((cls) => (
                    <option key={cls.classCode} value={cls.classCode}>
                      Grade {cls.grade}-{cls.section} ({cls.classCode})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end space-x-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsEnrollStudentModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 text-xs font-semibold bg-sky-600 hover:bg-sky-700 text-white rounded-lg"
                >
                  Enroll Student
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: REGISTER BUS (Enhanced with Bus Label, Driver & Route) */}
      {isCreateBusModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 bg-sky-800 text-white">
              <h3 className="text-base font-bold">Register School Bus & GPS Tracker</h3>
            </div>
            <form onSubmit={handleCreateBus} className="p-6 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Registration Plate Number *</label>
                <input
                  type="text"
                  required
                  value={busRegistration}
                  onChange={(e) => setBusRegistration(e.target.value)}
                  placeholder="AP09BW4704 or TS 09 AB 1234"
                  className="w-full p-2.5 border rounded-lg uppercase text-xs font-mono"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Bus Label / Number</label>
                  <input
                    type="text"
                    value={busNumberLabel}
                    onChange={(e) => setBusNumberLabel(e.target.value)}
                    placeholder="Bus 01"
                    className="w-full p-2.5 border rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Seating Capacity *</label>
                  <input
                    type="number"
                    required
                    value={busCapacity}
                    onChange={(e) => setBusCapacity(e.target.value)}
                    className="w-full p-2.5 border rounded-lg text-xs"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Assign Driver (Optional)</label>
                <select
                  value={busDriverCode}
                  onChange={(e) => setBusDriverCode(e.target.value)}
                  className="w-full p-2.5 border rounded-lg bg-white text-xs"
                >
                  <option value="">-- Assign Driver Later --</option>
                  {tenantUsers
                    .filter((u) => u.role === 'DRIVER' && u.userCode)
                    .map((d) => (
                      <option key={d.userCode} value={d.userCode}>
                        {d.fullName} ({d.userCode})
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Assign Bus Route (Optional)</label>
                <select
                  value={busRouteCode}
                  onChange={(e) => setBusRouteCode(e.target.value)}
                  className="w-full p-2.5 border rounded-lg bg-white text-xs"
                >
                  <option value="">-- Assign Route Later --</option>
                  {routes.map((rt) => (
                    <option key={rt.routeCode} value={rt.routeCode}>
                      {rt.routeName} ({rt.routeCode})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end space-x-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsCreateBusModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 text-xs font-semibold bg-sky-600 hover:bg-sky-700 text-white rounded-lg"
                >
                  Register Bus
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT BUS DRIVER & ROUTE */}
      {editBusTarget && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 bg-sky-800 text-white">
              <h3 className="text-base font-bold">Assign Driver & Route to Bus</h3>
              <p className="text-xs text-sky-200 font-mono mt-0.5">
                {editBusTarget.busCode} • Reg: {editBusTarget.registrationNumber}
              </p>
            </div>
            <form onSubmit={handleSaveEditBus} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Assigned Driver</label>
                <select
                  value={editBusDriverCode}
                  onChange={(e) => setEditBusDriverCode(e.target.value)}
                  className="w-full p-2.5 border rounded-lg bg-white text-xs"
                >
                  <option value="">-- Unassigned --</option>
                  {tenantUsers
                    .filter((u) => u.role === 'DRIVER' && u.userCode)
                    .map((d) => (
                      <option key={d.userCode} value={d.userCode}>
                        {d.fullName} ({d.userCode})
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Assigned Route</label>
                <select
                  value={editBusRouteCode}
                  onChange={(e) => setEditBusRouteCode(e.target.value)}
                  className="w-full p-2.5 border rounded-lg bg-white text-xs"
                >
                  <option value="">-- Unassigned --</option>
                  {routes.map((rt) => (
                    <option key={rt.routeCode} value={rt.routeCode}>
                      {rt.routeName} ({rt.routeCode})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Operational Status</label>
                <select
                  value={editBusStatus}
                  onChange={(e) => setEditBusStatus(e.target.value)}
                  className="w-full p-2.5 border rounded-lg bg-white text-xs"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="MAINTENANCE">MAINTENANCE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </div>
              <div className="flex justify-end space-x-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setEditBusTarget(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 text-xs font-semibold bg-sky-600 hover:bg-sky-700 text-white rounded-lg"
                >
                  Save Assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE ROUTE WITH PLACES, STOPS & INTERACTIVE MAP PICKER */}
      {isCreateRouteModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden my-6">
            <div className="p-5 bg-emerald-800 text-white flex justify-between items-center">
              <div>
                <h3 className="text-base font-bold">Create Bus Route, Places & GPS Waypoints</h3>
                <p className="text-xs text-emerald-100 mt-0.5">
                  Search any place name or click directly on the map to pin Start Place, Pickup Stops, and School Destination.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateRouteModal(false)}
                className="text-emerald-100 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateRoute} className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-5 text-xs max-h-[80vh] overflow-y-auto">
              {/* Left Column: Route Details & Places */}
              <div className="space-y-3.5">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Route Name *</label>
                  <input
                    type="text"
                    required
                    value={routeName}
                    onChange={(e) => setRouteName(e.target.value)}
                    placeholder="e.g., Route 1 - Kukatpally to School Campus"
                    className="w-full p-2 border rounded-lg text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Assign Bus</label>
                    <select
                      value={routeBusCode}
                      onChange={(e) => setRouteBusCode(e.target.value)}
                      className="w-full p-2 border rounded-lg bg-white text-xs"
                    >
                      <option value="">-- Optional Bus --</option>
                      {buses.map((b) => (
                        <option key={b.busCode} value={b.busCode}>
                          {b.registrationNumber} ({b.busCode})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Assign Driver</label>
                    <select
                      value={routeDriverCode}
                      onChange={(e) => setRouteDriverCode(e.target.value)}
                      className="w-full p-2 border rounded-lg bg-white text-xs"
                    >
                      <option value="">-- Optional Driver --</option>
                      {tenantUsers
                        .filter((u) => u.role === 'DRIVER' && u.userCode)
                        .map((d) => (
                          <option key={d.userCode} value={d.userCode}>
                            {d.fullName} ({d.userCode})
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                {/* START PLACE */}
                <div
                  onClick={() => setActiveMapPickerField('START')}
                  className={`p-3 rounded-xl border space-y-2 cursor-pointer transition ${
                    activeMapPickerField === 'START' ? 'border-emerald-500 bg-emerald-50/50' : 'border-slate-200 bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-emerald-800">1. Start Place (Origin)</span>
                    <span className="text-[10px] text-emerald-700 font-semibold">
                      {activeMapPickerField === 'START' ? '📍 Click map to pin' : 'Click to pick on map'}
                    </span>
                  </div>
                  <div className="flex space-x-1.5">
                    <input
                      type="text"
                      required
                      value={routeStartName}
                      onChange={(e) => setRouteStartName(e.target.value)}
                      placeholder="Start place name (e.g. Kukatpally)"
                      className="flex-1 p-2 border rounded-lg bg-white text-xs"
                    />
                    <button
                      type="button"
                      disabled={placeSearching}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        searchPlacesForField('START', routeStartName);
                      }}
                      className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold text-[11px]"
                    >
                      Search Places
                    </button>
                    <button
                      type="button"
                      disabled={placeSearching}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        searchNearbyLandmarksForField('START', routeStartLat, routeStartLng);
                      }}
                      className="px-2 py-1.5 bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-300 rounded-lg font-semibold text-[11px]"
                      title="Show nearby landmarks around current GPS"
                    >
                      Nearby
                    </button>
                  </div>
                  {placeSuggestionsField === 'START' && placeSuggestions.length > 0 && (
                    <div className="bg-white border border-emerald-300 rounded-lg shadow-md max-h-36 overflow-y-auto divide-y divide-slate-100">
                      {placeSuggestions.map((item, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            applySelectedPlace('START', item);
                          }}
                          className="w-full text-left px-2.5 py-1.5 hover:bg-emerald-50 transition"
                        >
                          <div className="font-bold text-slate-900 text-[11px]">📍 {item.name} <span className="text-[10px] font-normal text-emerald-700">({item.category})</span></div>
                          <div className="text-[10px] text-slate-500 truncate">{item.displayName}</div>
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      step="any"
                      value={routeStartLat}
                      onChange={(e) => setRouteStartLat(e.target.value)}
                      placeholder="Latitude"
                      className="p-1.5 border rounded bg-white font-mono text-[11px]"
                    />
                    <input
                      type="number"
                      step="any"
                      value={routeStartLng}
                      onChange={(e) => setRouteStartLng(e.target.value)}
                      placeholder="Longitude"
                      className="p-1.5 border rounded bg-white font-mono text-[11px]"
                    />
                  </div>
                </div>

                {/* INTERMEDIATE STOPS */}
                <div className="p-3 rounded-xl border border-slate-200 bg-white space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800">2. Intermediate Pickup / Drop Stops</span>
                    <button
                      type="button"
                      onClick={() => {
                        setRouteStopsDraft((prev) => [
                          ...prev,
                          {
                            stopName: '',
                            scheduledPickupTime: '07:45',
                            scheduledDropTime: '15:45',
                            lat: routeStartLat,
                            lng: routeStartLng
                          }
                        ]);
                        setActiveMapPickerField(`STOP_${routeStopsDraft.length}`);
                      }}
                      className="text-sky-700 hover:underline font-semibold text-[11px]"
                    >
                      + Add Stop Place
                    </button>
                  </div>
                  <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                    {routeStopsDraft.map((st, idx) => (
                      <div
                        key={idx}
                        onClick={() => setActiveMapPickerField(`STOP_${idx}`)}
                        className={`p-2 rounded-lg border space-y-1.5 cursor-pointer ${
                          activeMapPickerField === `STOP_${idx}` ? 'border-sky-500 bg-sky-50/50' : 'border-slate-200 bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center space-x-1.5">
                          <span className="font-bold text-sky-700 text-[11px]">#{idx + 1}</span>
                          <input
                            type="text"
                            value={st.stopName}
                            onChange={(e) => {
                              const next = [...routeStopsDraft];
                              next[idx] = { ...next[idx], stopName: e.target.value };
                              setRouteStopsDraft(next);
                            }}
                            placeholder="Stop place name"
                            className="flex-1 p-1.5 border rounded bg-white text-[11px]"
                          />
                          <button
                            type="button"
                            disabled={placeSearching}
                            onClick={(ev) => {
                              ev.stopPropagation();
                              searchPlacesForField(`STOP_${idx}`, st.stopName);
                            }}
                            className="px-2 py-1 bg-sky-600 hover:bg-sky-700 text-white rounded text-[10px] font-semibold"
                          >
                            Places
                          </button>
                          <button
                            type="button"
                            disabled={placeSearching}
                            onClick={(ev) => {
                              ev.stopPropagation();
                              searchNearbyLandmarksForField(`STOP_${idx}`, st.lat, st.lng);
                            }}
                            className="px-1.5 py-1 bg-white hover:bg-sky-50 text-sky-700 border border-sky-300 rounded text-[10px] font-semibold"
                            title="Nearby Landmarks"
                          >
                            Nearby
                          </button>
                          <button
                            type="button"
                            onClick={(ev) => {
                              ev.stopPropagation();
                              setRouteStopsDraft((prev) => prev.filter((_, i) => i !== idx));
                            }}
                            className="text-rose-600 font-bold px-1"
                          >
                            ✕
                          </button>
                        </div>
                        {placeSuggestionsField === `STOP_${idx}` && placeSuggestions.length > 0 && (
                          <div className="bg-white border border-sky-300 rounded-lg shadow-md max-h-32 overflow-y-auto divide-y divide-slate-100">
                            {placeSuggestions.map((item, sI) => (
                              <button
                                key={sI}
                                type="button"
                                onClick={(ev) => {
                                  ev.stopPropagation();
                                  applySelectedPlace(`STOP_${idx}`, item);
                                }}
                                className="w-full text-left px-2 py-1.5 hover:bg-sky-50 transition"
                              >
                                <div className="font-bold text-slate-900 text-[10px]">📍 {item.name} <span className="font-normal text-sky-700">({item.category})</span></div>
                                <div className="text-[9px] text-slate-500 truncate">{item.displayName}</div>
                              </button>
                            ))}
                          </div>
                        )}
                        <div className="grid grid-cols-4 gap-1.5">
                          <input
                            type="time"
                            value={st.scheduledPickupTime}
                            onChange={(e) => {
                              const next = [...routeStopsDraft];
                              next[idx] = { ...next[idx], scheduledPickupTime: e.target.value };
                              setRouteStopsDraft(next);
                            }}
                            className="p-1 border rounded bg-white text-[10px]"
                            title="Pickup Time"
                          />
                          <input
                            type="time"
                            value={st.scheduledDropTime}
                            onChange={(e) => {
                              const next = [...routeStopsDraft];
                              next[idx] = { ...next[idx], scheduledDropTime: e.target.value };
                              setRouteStopsDraft(next);
                            }}
                            className="p-1 border rounded bg-white text-[10px]"
                            title="Drop Time"
                          />
                          <input
                            type="number"
                            step="any"
                            value={st.lat}
                            onChange={(e) => {
                              const next = [...routeStopsDraft];
                              next[idx] = { ...next[idx], lat: e.target.value };
                              setRouteStopsDraft(next);
                            }}
                            placeholder="Lat"
                            className="p-1 border rounded bg-white font-mono text-[10px]"
                          />
                          <input
                            type="number"
                            step="any"
                            value={st.lng}
                            onChange={(e) => {
                              const next = [...routeStopsDraft];
                              next[idx] = { ...next[idx], lng: e.target.value };
                              setRouteStopsDraft(next);
                            }}
                            placeholder="Lng"
                            className="p-1 border rounded bg-white font-mono text-[10px]"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* END PLACE */}
                <div
                  onClick={() => setActiveMapPickerField('END')}
                  className={`p-3 rounded-xl border space-y-2 cursor-pointer transition ${
                    activeMapPickerField === 'END' ? 'border-slate-800 bg-slate-100' : 'border-slate-200 bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">3. Destination Place (School Campus)</span>
                    <span className="text-[10px] text-slate-700 font-semibold">
                      {activeMapPickerField === 'END' ? '📍 Click map to pin' : 'Click to pick on map'}
                    </span>
                  </div>
                  <div className="flex space-x-1.5">
                    <input
                      type="text"
                      required
                      value={routeEndName}
                      onChange={(e) => setRouteEndName(e.target.value)}
                      placeholder="School campus location"
                      className="flex-1 p-2 border rounded-lg bg-white text-xs"
                    />
                    <button
                      type="button"
                      disabled={placeSearching}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        searchPlacesForField('END', routeEndName);
                      }}
                      className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-semibold text-[11px]"
                    >
                      Search Places
                    </button>
                    <button
                      type="button"
                      disabled={placeSearching}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        searchNearbyLandmarksForField('END', routeEndLat, routeEndLng);
                      }}
                      className="px-2 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg font-semibold text-[11px]"
                    >
                      Nearby
                    </button>
                  </div>
                  {placeSuggestionsField === 'END' && placeSuggestions.length > 0 && (
                    <div className="bg-white border border-slate-300 rounded-lg shadow-md max-h-36 overflow-y-auto divide-y divide-slate-100">
                      {placeSuggestions.map((item, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            applySelectedPlace('END', item);
                          }}
                          className="w-full text-left px-2.5 py-1.5 hover:bg-slate-100 transition"
                        >
                          <div className="font-bold text-slate-900 text-[11px]">📍 {item.name} <span className="text-[10px] font-normal text-slate-600">({item.category})</span></div>
                          <div className="text-[10px] text-slate-500 truncate">{item.displayName}</div>
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      step="any"
                      value={routeEndLat}
                      onChange={(e) => setRouteEndLat(e.target.value)}
                      placeholder="Latitude"
                      className="p-1.5 border rounded bg-white font-mono text-[11px]"
                    />
                    <input
                      type="number"
                      step="any"
                      value={routeEndLng}
                      onChange={(e) => setRouteEndLng(e.target.value)}
                      placeholder="Longitude"
                      className="p-1.5 border rounded bg-white font-mono text-[11px]"
                    />
                  </div>
                </div>
              </div>

              {/* Right Column: Live Interactive Map Preview & Click Picker */}
              <div className="flex flex-col space-y-3">
                <div className="bg-sky-50 border border-sky-200 rounded-lg p-2.5 text-[11px] text-sky-900">
                  <b>Interactive Map Picker:</b> Currently placing{' '}
                  <span className="font-bold underline">
                    {activeMapPickerField === 'START'
                      ? 'Start Place'
                      : activeMapPickerField === 'END'
                      ? 'Destination (School)'
                      : `Stop #${parseInt(activeMapPickerField.replace('STOP_', ''), 10) + 1}`}
                  </span>
                  . Click anywhere on the map below to update its GPS coordinates!
                </div>
                <LiveFleetMap
                  pickerMode
                  height="380px"
                  routes={[
                    {
                      routeCode: 'PREVIEW',
                      routeName: routeName || 'Route Preview',
                      startLocation: {
                        name: routeStartName || 'Start',
                        coordinates: [parseFloat(routeStartLng) || 78.3996, parseFloat(routeStartLat) || 17.4948]
                      },
                      endLocation: {
                        name: routeEndName || 'School',
                        coordinates: [parseFloat(routeEndLng) || 78.3915, parseFloat(routeEndLat) || 17.4483]
                      },
                      stops: routeStopsDraft.map((s, idx) => ({
                        stopName: s.stopName || `Stop ${idx + 1}`,
                        sequenceOrder: idx + 1,
                        scheduledPickupTime: s.scheduledPickupTime,
                        scheduledDropTime: s.scheduledDropTime,
                        coordinates: [parseFloat(s.lng) || 78.3914, parseFloat(s.lat) || 17.4700]
                      }))
                    }
                  ]}
                  onMapClick={(lat, lng) => {
                    if (activeMapPickerField === 'START') {
                      setRouteStartLat(String(lat));
                      setRouteStartLng(String(lng));
                    } else if (activeMapPickerField === 'END') {
                      setRouteEndLat(String(lat));
                      setRouteEndLng(String(lng));
                    } else if (activeMapPickerField.startsWith('STOP_')) {
                      const idx = parseInt(activeMapPickerField.replace('STOP_', ''), 10);
                      setRouteStopsDraft((prev) => {
                        const next = [...prev];
                        if (next[idx]) next[idx] = { ...next[idx], lat: String(lat), lng: String(lng) };
                        return next;
                      });
                    }
                  }}
                />
                <div className="flex justify-end space-x-3 pt-2 border-t mt-auto">
                  <button
                    type="button"
                    onClick={() => setIsCreateRouteModal(false)}
                    className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm"
                  >
                    Save Route & GPS Waypoints
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD STOP TO ROUTE */}
      {addStopRouteTarget && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 bg-emerald-800 text-white">
              <h3 className="text-base font-bold">Add Bus Stop Place</h3>
              <p className="text-xs text-emerald-100 mt-0.5">
                Route: {addStopRouteTarget.routeName} ({addStopRouteTarget.routeCode})
              </p>
            </div>
            <form onSubmit={handleAddStopToRoute} className="p-5 space-y-3 text-xs">
              <div className="flex space-x-2">
                <input
                  type="text"
                  required
                  value={newStopName}
                  onChange={(e) => setNewStopName(e.target.value)}
                  placeholder="Place / Landmark Name (e.g. Madhapur Metro)"
                  className="flex-1 p-2.5 border rounded-lg text-xs"
                />
                <button
                  type="button"
                  disabled={placeSearching}
                  onClick={() => searchPlacesForField('NEW_STOP', newStopName)}
                  className="px-3 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-semibold"
                >
                  Places
                </button>
                <button
                  type="button"
                  disabled={placeSearching}
                  onClick={() => searchNearbyLandmarksForField('NEW_STOP', newStopLat, newStopLng)}
                  className="px-2.5 py-2 bg-white hover:bg-sky-50 text-sky-700 border border-sky-300 rounded-lg font-semibold"
                >
                  Nearby
                </button>
              </div>
              {placeSuggestionsField === 'NEW_STOP' && placeSuggestions.length > 0 && (
                <div className="bg-white border border-sky-300 rounded-lg shadow-md max-h-36 overflow-y-auto divide-y divide-slate-100">
                  {placeSuggestions.map((item, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => applySelectedPlace('NEW_STOP', item)}
                      className="w-full text-left px-2.5 py-1.5 hover:bg-sky-50 transition"
                    >
                      <div className="font-bold text-slate-900 text-[11px]">📍 {item.name} <span className="text-[10px] font-normal text-sky-700">({item.category})</span></div>
                      <div className="text-[10px] text-slate-500 truncate">{item.displayName}</div>
                    </button>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Morning Pickup</label>
                  <input type="time" value={newStopPickup} onChange={(e) => setNewStopPickup(e.target.value)} className="w-full p-2 border rounded-lg" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Afternoon Drop</label>
                  <input type="time" value={newStopDrop} onChange={(e) => setNewStopDrop(e.target.value)} className="w-full p-2 border rounded-lg" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">GPS Latitude</label>
                  <input type="number" step="any" required value={newStopLat} onChange={(e) => setNewStopLat(e.target.value)} className="w-full p-2 border rounded-lg font-mono" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">GPS Longitude</label>
                  <input type="number" step="any" required value={newStopLng} onChange={(e) => setNewStopLng(e.target.value)} className="w-full p-2 border rounded-lg font-mono" />
                </div>
              </div>
              <LiveFleetMap
                pickerMode
                height="220px"
                pickerPin={{ lat: parseFloat(newStopLat) || 17.47, lng: parseFloat(newStopLng) || 78.39, label: newStopName || 'New Stop' }}
                onMapClick={(lat, lng) => {
                  setNewStopLat(String(lat));
                  setNewStopLng(String(lng));
                }}
              />
              <div className="flex justify-end space-x-3 pt-2 border-t">
                <button type="button" onClick={() => setAddStopRouteTarget(null)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">
                  Cancel
                </button>
                <button type="submit" disabled={loading} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold">
                  Save Bus Stop
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ASSIGN FEE */}
      {isAssignFeeModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 bg-amber-800 text-white">
              <h3 className="text-base font-bold">Assign Fee Assessment</h3>
              <p className="text-xs text-amber-200 mt-0.5">Bill a single student or assign fees class-wide.</p>
            </div>
            <form onSubmit={handleCreateFee} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Fee Assignment Target</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAssignFeeStudentCode('')}
                    className={`py-2 px-3 rounded-lg border font-semibold text-xs transition ${
                      !assignFeeStudentCode ? 'bg-amber-50 border-amber-500 text-amber-900' : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    Entire Class
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (students.length > 0 && !assignFeeStudentCode) {
                        setAssignFeeStudentCode(students[0].studentCode);
                      }
                    }}
                    className={`py-2 px-3 rounded-lg border font-semibold text-xs transition ${
                      assignFeeStudentCode ? 'bg-amber-50 border-amber-500 text-amber-900' : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    Single Student
                  </button>
                </div>
              </div>

              {!assignFeeStudentCode ? (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Target Class</label>
                  <select
                    value={assignFeeClassCode || (classes[0]?.classCode || '')}
                    onChange={(e) => setAssignFeeClassCode(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                  >
                    {classes.map((c) => (
                      <option key={c.classCode} value={c.classCode}>
                        Grade {c.grade}-{c.section} ({c.classCode})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Target Student</label>
                  <select
                    value={assignFeeStudentCode}
                    onChange={(e) => setAssignFeeStudentCode(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg bg-white font-medium"
                  >
                    {students.map((s) => (
                      <option key={s.studentCode} value={s.studentCode}>
                        {s.fullName} ({s.admissionNumber}) • {s.classCode}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Fee Category</label>
                  <select
                    value={assignFeeType}
                    onChange={(e) => setAssignFeeType(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="TUITION">Tuition Fee</option>
                    <option value="TRANSPORT">Transport Fee</option>
                    <option value="TERM_1">Term 1 Fee</option>
                    <option value="TERM_2">Term 2 Fee</option>
                    <option value="ANNUAL">Annual Fee</option>
                    <option value="EXAM">Examination Fee</option>
                    <option value="LIBRARY">Library Fee</option>
                    <option value="OTHER">Other Fees</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Amount (₹)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={assignFeeAmount}
                    onChange={(e) => setAssignFeeAmount(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg font-bold text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Payment Due Date</label>
                <input
                  type="date"
                  required
                  value={assignFeeDueDate}
                  onChange={(e) => setAssignFeeDueDate(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white font-medium"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Notes / Description</label>
                <input
                  type="text"
                  value={assignFeeNotes}
                  onChange={(e) => setAssignFeeNotes(e.target.value)}
                  placeholder="e.g. Q2 standard tuition fees"
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsAssignFeeModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold shadow-sm"
                >
                  {loading ? 'Creating...' : 'Assign Fee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RECORD FEE PAYMENT */}
      {payFeeTarget && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 bg-emerald-800 text-white">
              <h3 className="text-base font-bold">Record Fee Payment</h3>
              <p className="text-xs text-emerald-200 mt-0.5">
                {payFeeTarget.studentName} ({payFeeTarget.admissionNumber} • {payFeeTarget.classCode})
              </p>
            </div>
            <form onSubmit={handleRecordPayment} className="p-5 space-y-3.5 text-xs">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Fee Category:</span>
                  <span className="font-bold text-slate-800">{payFeeTarget.feeType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Billed:</span>
                  <span className="font-semibold text-slate-900">₹{(payFeeTarget.amount || 0).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Already Paid:</span>
                  <span className="font-semibold text-emerald-700">₹{(payFeeTarget.paidAmount || 0).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-1">
                  <span className="font-bold text-slate-700">Remaining Balance:</span>
                  <span className="font-bold text-rose-700">
                    ₹{((payFeeTarget.amount || 0) - (payFeeTarget.paidAmount || 0)).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Payment Amount (₹)</label>
                <input
                  type="number"
                  required
                  min="1"
                  max={(payFeeTarget.amount || 0) - (payFeeTarget.paidAmount || 0)}
                  value={payFeeAmount}
                  onChange={(e) => setPayFeeAmount(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg font-bold text-slate-900 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Payment Method</label>
                  <select
                    value={payFeeMethod}
                    onChange={(e) => setPayFeeMethod(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="UPI">UPI / QR Code</option>
                    <option value="CASH">Cash at Counter</option>
                    <option value="NET_BANKING">Net Banking</option>
                    <option value="CARD">Credit / Debit Card</option>
                    <option value="CHEQUE">Cheque / DD</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Transaction Ref / Cheque No</label>
                  <input
                    type="text"
                    value={payFeeRef}
                    onChange={(e) => setPayFeeRef(e.target.value)}
                    placeholder="e.g. UPI-984218"
                    className="w-full p-2 border border-slate-300 rounded-lg font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Remarks</label>
                <input
                  type="text"
                  value={payFeeNotes}
                  onChange={(e) => setPayFeeNotes(e.target.value)}
                  placeholder="Optional cashier remarks..."
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setPayFeeTarget(null)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold shadow-sm"
                >
                  {loading ? 'Recording...' : 'Record Payment & Issue Receipt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CONFIGURE WHATSAPP */}
      {isWhatsAppModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden text-slate-800">
            {/* Modal Header */}
            <div className="p-5 bg-gradient-to-r from-emerald-700 via-teal-700 to-emerald-800 text-white relative">
              <button
                type="button"
                onClick={() => setIsWhatsAppModal(false)}
                className="absolute top-4 right-4 text-white/80 hover:text-white p-1.5 rounded-full hover:bg-white/10 transition text-sm leading-none"
                title="Close"
              >
                ✕
              </button>
              <div className="flex items-center space-x-2">
                <span className="text-2xl">📲</span>
                <div>
                  <h3 className="text-base font-bold leading-tight">School WhatsApp Notification Gateway</h3>
                  <p className="text-xs text-emerald-200 mt-0.5">Configure your Personal WhatsApp or Business Gateway for instant parent alerts.</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleUpdateWhatsAppConfig} className="p-6 space-y-4 text-xs">
              {/* Channel Type Selector */}
              <div>
                <label className="block font-bold text-slate-800 mb-2 text-xs">Choose Connection Mode:</label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setWaMode('PERSONAL');
                      setWaAccountInput(`PERSONAL-WA-${waPhoneInput.replace(/\D/g, '') || 'ADMIN'}`);
                    }}
                    className={`py-3 px-3 rounded-2xl border-2 text-left transition flex flex-col justify-between ${
                      waMode === 'PERSONAL'
                        ? 'border-emerald-600 bg-emerald-50/80 text-emerald-950 shadow-sm ring-1 ring-emerald-500'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <span>👤</span>
                      <span>Personal WhatsApp</span>
                    </div>
                    <span className="text-[10px] text-slate-500 mt-1">Recommended • Uses your mobile number directly</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setWaMode('BUSINESS');
                      setWaAccountInput(waAccountInput.startsWith('PERSONAL-') ? `WABA-${user?.schoolCode || 'SSC'}` : waAccountInput);
                    }}
                    className={`py-3 px-3 rounded-2xl border-2 text-left transition flex flex-col justify-between ${
                      waMode === 'BUSINESS'
                        ? 'border-emerald-600 bg-emerald-50/80 text-emerald-950 shadow-sm ring-1 ring-emerald-500'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <span>🏢</span>
                      <span>WhatsApp Business API</span>
                    </div>
                    <span className="text-[10px] text-slate-500 mt-1">Meta Cloud API / WABA / Twilio</span>
                  </button>
                </div>
              </div>

              {/* Mode Description Box */}
              {waMode === 'PERSONAL' ? (
                <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-2xl text-emerald-900 space-y-1">
                  <p className="font-bold flex items-center gap-1.5 text-xs text-emerald-950">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Personal WhatsApp Active Mode
                  </p>
                  <p className="text-[11px] text-emerald-800 leading-relaxed">
                    Fee reminders, exam report cards, and urgent notices will be dispatched under your WhatsApp number. Parents can view your contact and reply directly to your chat.
                  </p>
                </div>
              ) : (
                <div className="bg-blue-50 border border-blue-200 p-3.5 rounded-2xl text-blue-900 space-y-1">
                  <p className="font-bold text-xs text-blue-950">Enterprise Meta WhatsApp Cloud API</p>
                  <p className="text-[11px] text-blue-800 leading-relaxed">
                    Messages are routed through Meta's official WhatsApp Business API Webhooks with verified business templates.
                  </p>
                </div>
              )}

              {/* Mobile Number Input with High-Contrast Dark Text */}
              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  {waMode === 'PERSONAL' ? 'Your Personal WhatsApp Number' : 'Business WhatsApp Phone Number'}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={waPhoneInput}
                    onChange={(e) => setWaPhoneInput(e.target.value)}
                    placeholder="+91 86884 84559"
                    className="w-full p-3 border-2 border-slate-300 rounded-xl font-mono text-slate-900 bg-white placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-200 text-sm font-bold shadow-xs"
                    style={{ color: '#0f172a', backgroundColor: '#ffffff' }}
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Include country code (e.g. +91 for India followed by your 10-digit number).</p>
              </div>

              {/* Business Account Details (Only shown if Business mode is chosen) */}
              {waMode === 'BUSINESS' && (
                <div className="space-y-3 pt-1">
                  <div>
                    <label className="block font-bold text-slate-800 mb-1">WhatsApp Business Account ID (WABA)</label>
                    <input
                      type="text"
                      required
                      value={waAccountInput}
                      onChange={(e) => setWaAccountInput(e.target.value)}
                      placeholder="e.g. WABA-SSC-SCH-1001"
                      className="w-full p-3 border-2 border-slate-300 rounded-xl font-mono text-slate-900 bg-white placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none text-sm font-bold shadow-xs"
                      style={{ color: '#0f172a', backgroundColor: '#ffffff' }}
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-800 mb-1">Permanent Access Token / API Key (Optional)</label>
                    <input
                      type="password"
                      value={waApiKeyInput}
                      onChange={(e) => setWaApiKeyInput(e.target.value)}
                      placeholder="Meta Cloud API System User Token (Optional)"
                      className="w-full p-3 border-2 border-slate-300 rounded-xl font-mono text-slate-900 bg-white placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none text-sm shadow-xs"
                      style={{ color: '#0f172a', backgroundColor: '#ffffff' }}
                    />
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={handleTestWhatsAppConnection}
                  disabled={loading || !waPhoneInput}
                  className="w-full sm:w-auto px-3.5 py-2.5 rounded-xl border-2 border-emerald-600 text-emerald-800 hover:bg-emerald-50 font-bold text-xs transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                  title="Sends an instant verification message to your WhatsApp number"
                >
                  <span>⚡</span>
                  <span>Test Connection Now</span>
                </button>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={() => setIsWhatsAppModal(false)}
                    className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold text-xs transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white rounded-xl font-bold text-xs shadow-md shadow-emerald-600/25 transition disabled:opacity-50"
                  >
                    {loading ? 'Saving...' : 'Save & Connect WhatsApp'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: PUBLISH EVENT TO GALLERY */}
      {isCreateEventModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 bg-purple-900 text-white">
              <h3 className="text-base font-bold">Publish Event to School Gallery</h3>
              <p className="text-xs text-purple-200 mt-0.5">7-Day Automatic Expiry • Auto-deletes after 1 week</p>
            </div>
            <form onSubmit={handleCreateEvent} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Event Title</label>
                <input
                  type="text"
                  required
                  value={newEventTitle}
                  onChange={(e) => setNewEventTitle(e.target.value)}
                  placeholder="e.g. Annual Sports Championship 2026"
                  className="w-full p-2 border border-slate-300 rounded-lg font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Category</label>
                  <select
                    value={newEventCategory}
                    onChange={(e) => setNewEventCategory(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="SPORTS">Sports & Athletics</option>
                    <option value="CULTURAL">Cultural & Arts</option>
                    <option value="ACADEMIC">Academic Science Fair</option>
                    <option value="ANNUAL_DAY">Annual Day</option>
                    <option value="EXCURSION">Excursion & Field Trip</option>
                    <option value="CAMPUS">Campus Life & Notices</option>
                    <option value="CELEBRATION">Festival & Celebration</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Event Date</label>
                  <input
                    type="date"
                    required
                    value={newEventDate}
                    onChange={(e) => setNewEventDate(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Description / Highlights</label>
                <textarea
                  rows={3}
                  value={newEventDescription}
                  onChange={(e) => setNewEventDescription(e.target.value)}
                  placeholder="Highlight key moments, winners, and student achievements..."
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Event Images (URLs or Presets)</label>
                <div className="flex space-x-2 mb-2">
                  <input
                    type="url"
                    value={newImageUrlInput}
                    onChange={(e) => setNewImageUrlInput(e.target.value)}
                    placeholder="Paste image URL (https://...)"
                    className="flex-1 p-2 border border-slate-300 rounded-lg text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newImageUrlInput.trim()) {
                        setNewEventImages([...newEventImages, newImageUrlInput.trim()]);
                        setNewImageUrlInput('');
                      }
                    }}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold"
                  >
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {newEventImages.map((img, idx) => (
                    <div key={idx} className="relative group">
                      <img src={img} alt="" className="h-14 w-20 object-cover rounded-lg border border-slate-200" />
                      <button
                        type="button"
                        onClick={() => setNewEventImages(newEventImages.filter((_, i) => i !== idx))}
                        className="absolute -top-1 -right-1 bg-rose-600 text-white rounded-full w-4 h-4 text-[10px] flex items-center justify-center"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-amber-50 p-2.5 rounded-lg border border-amber-200 text-amber-900 text-[11px]">
                ℹ️ <b>1-Week Expiry Rule:</b> This album will be active for 7 days until{' '}
                <b>{new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString()}</b> and then safely purged.
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsCreateEventModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-lg font-semibold shadow-sm"
                >
                  {loading ? 'Publishing...' : 'Publish to Gallery (7 Days)'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: MODIFY STUDENT */}
      {editStudentTarget && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 bg-sky-800 text-white">
              <h3 className="text-base font-bold">Modify Student Details</h3>
              <p className="text-xs text-sky-200 mt-0.5">
                {editStudentTarget.studentCode} • Adm: {editStudentTarget.admissionNumber}
              </p>
            </div>
            <form onSubmit={handleModifyStudent} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={editStudentName}
                  onChange={(e) => setEditStudentName(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg font-medium text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Date of Birth</label>
                  <input
                    type="date"
                    required
                    value={editStudentDob}
                    onChange={(e) => setEditStudentDob(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Gender</label>
                  <select
                    value={editStudentGender}
                    onChange={(e) => setEditStudentGender(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Parent Emergency Mobile</label>
                <input
                  type="text"
                  value={editStudentPhone}
                  onChange={(e) => setEditStudentPhone(e.target.value)}
                  placeholder="+91 98000 00000"
                  className="w-full p-2 border border-slate-300 rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Assigned Bus Route</label>
                <select
                  value={editStudentBus}
                  onChange={(e) => setEditStudentBus(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="">Self Transit (No Bus)</option>
                  {buses.map((b) => (
                    <option key={b.busCode} value={b.busCode}>
                      {b.busNumber} ({b.registrationNumber}) • {b.busCode}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setEditStudentTarget(null)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-semibold shadow-sm"
                >
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CLASS TRANSFER */}
      {transferStudentTarget && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 bg-amber-800 text-white">
              <h3 className="text-base font-bold">Transfer Student Class</h3>
              <p className="text-xs text-amber-200 mt-0.5">
                {transferStudentTarget.fullName} (Currently in {transferStudentTarget.classCode})
              </p>
            </div>
            <form onSubmit={handleTransferStudent} className="p-5 space-y-3.5 text-xs">
              <div className="bg-amber-50 p-3 rounded-lg border border-amber-200 text-amber-900 text-[11px] space-y-1">
                <p className="font-bold">Transfer Audit Trail:</p>
                <p>
                  Class transfer will update the student's academic section mapping, homework feed, and academic report cards.
                </p>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Target Class</label>
                <select
                  required
                  value={transferTargetClassCode}
                  onChange={(e) => {
                    setTransferTargetClassCode(e.target.value);
                    const cls = classes.find((c) => c.classCode === e.target.value);
                    if (cls) setTransferTargetSection(cls.section);
                  }}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white font-medium"
                >
                  <option value="" disabled>-- Select New Class --</option>
                  {classes.map((c) => (
                    <option key={c.classCode} value={c.classCode}>
                      Grade {c.grade}-{c.section} ({c.classCode})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Target Section</label>
                <input
                  type="text"
                  required
                  value={transferTargetSection}
                  onChange={(e) => setTransferTargetSection(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg uppercase font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Transfer Justification / Reason</label>
                <input
                  type="text"
                  required
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                  placeholder="e.g. Academic rebalancing or parent request"
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setTransferStudentTarget(null)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-lg font-semibold shadow-sm"
                >
                  {loading ? 'Transferring...' : 'Execute Class Transfer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: IMPORT STUDENTS FROM EXCEL / CSV */}
      {isImportModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 bg-indigo-900 text-white">
              <h3 className="text-base font-bold flex items-center space-x-2">
                <span>📥 Import Students from Excel / CSV</span>
              </h3>
              <p className="text-xs text-indigo-200 mt-0.5">Bulk batch enrollment into school database.</p>
            </div>
            <form onSubmit={handleBulkImportStudents} className="p-5 space-y-3.5 text-xs">
              <div className="bg-indigo-50 border border-indigo-200 p-3 rounded-lg text-indigo-900 space-y-1">
                <p className="font-bold">Supported CSV / Spreadsheet Columns:</p>
                <p className="font-mono text-[11px] bg-white p-1.5 rounded border border-indigo-200 text-indigo-800">
                  AdmissionNo, FullName, Grade, Section, Gender, DOB, ParentName, ParentPhone
                </p>
                <p className="text-[10px] text-indigo-700">You can paste tabular data directly from Microsoft Excel or Google Sheets.</p>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="font-semibold text-slate-700">Paste Spreadsheet Rows</label>
                  <button
                    type="button"
                    onClick={() => {
                      const sample =
                        `ADM-1031, Aryan Sharma, 6, A, MALE, 2014-04-12, Rajesh Sharma, +919811001122\n` +
                        `ADM-1032, Sneha Reddy, 6, A, FEMALE, 2014-08-25, Kavita Reddy, +919811001133\n` +
                        `ADM-1033, Vikram Patel, 7, B, MALE, 2013-11-05, Suresh Patel, +919811001144`;
                      setImportText(sample);
                    }}
                    className="text-[11px] text-indigo-600 hover:underline font-semibold"
                  >
                    + Load Sample Rows
                  </button>
                </div>
                <textarea
                  rows={6}
                  required
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder="Paste comma or tab-delimited rows from Excel..."
                  className="w-full p-2.5 border border-slate-300 rounded-lg font-mono text-[11px]"
                />
              </div>

              {importResults && (
                <div className="p-3 bg-slate-50 border rounded-lg text-xs space-y-1">
                  <p className="font-bold text-emerald-700">✓ Successfully Imported: {importResults.importedCount}</p>
                  <p className="text-slate-500">Skipped (duplicates/invalid): {importResults.skippedCount}</p>
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsImportModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !importText.trim()}
                  className="px-4 py-2 bg-indigo-700 hover:bg-indigo-800 disabled:opacity-50 text-white rounded-lg font-semibold shadow-sm"
                >
                  {loading ? 'Importing...' : 'Start Bulk Import'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE ASSESSMENT & ANSWER KEY */}
      {isCreateAssessmentModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 bg-indigo-900 text-white">
              <h3 className="text-base font-bold flex items-center space-x-2">
                <span>📝 Create Assessment & OMR Answer Key</span>
              </h3>
              <p className="text-xs text-indigo-200 mt-0.5">
                Define exam parameters, question count, scoring formula, and correct answers for automated AI grading.
              </p>
            </div>

            <form onSubmit={handleCreateAssessment} className="p-5 space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Target Class</label>
                  <select
                    value={newAssessment.classCode || (classes[0]?.classCode ?? '')}
                    onChange={(e) => setNewAssessment({ ...newAssessment, classCode: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                  >
                    {classes.map((c) => (
                      <option key={c.classCode} value={c.classCode}>
                        Grade {c.grade}-{c.section} ({c.classCode})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Assessment Type</label>
                  <select
                    value={newAssessment.assessmentType}
                    onChange={(e) => setNewAssessment({ ...newAssessment, assessmentType: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-lg bg-white font-semibold"
                  >
                    <option value="FA-1">FA-1 (Formative Assessment 1)</option>
                    <option value="FA-2">FA-2 (Formative Assessment 2)</option>
                    <option value="FA-3">FA-3 (Formative Assessment 3)</option>
                    <option value="FA-4">FA-4 (Formative Assessment 4)</option>
                    <option value="SA-1">SA-1 (Summative Assessment 1)</option>
                    <option value="SA-2">SA-2 (Summative Assessment 2)</option>
                    <option value="CUSTOM">Custom Assessment Name...</option>
                  </select>
                </div>
              </div>

              {newAssessment.assessmentType === 'CUSTOM' && (
                <div>
                  <label className="block font-semibold text-indigo-700 mb-1">Custom Assessment Name</label>
                  <input
                    type="text"
                    required
                    value={newAssessment.customType}
                    onChange={(e) => setNewAssessment({ ...newAssessment, customType: e.target.value })}
                    placeholder="e.g. Unit Test 1, Mid-Term Exam, Quarterly Assessment"
                    className="w-full p-2 border border-indigo-300 rounded-lg bg-indigo-50/50"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Subject</label>
                  <input
                    type="text"
                    required
                    value={newAssessment.subject}
                    onChange={(e) => setNewAssessment({ ...newAssessment, subject: e.target.value })}
                    placeholder="e.g. Mathematics, Science, English"
                    className="w-full p-2 border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Assessment Title</label>
                  <input
                    type="text"
                    required
                    value={newAssessment.title}
                    onChange={(e) => setNewAssessment({ ...newAssessment, title: e.target.value })}
                    placeholder="e.g. Term 1 Core Evaluation"
                    className="w-full p-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Total Questions</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    required
                    value={newAssessment.totalQuestions}
                    onChange={(e) => setNewAssessment({ ...newAssessment, totalQuestions: Number(e.target.value) })}
                    className="w-full p-2 border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Marks / Question</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    required
                    value={newAssessment.marksPerQuestion}
                    onChange={(e) => setNewAssessment({ ...newAssessment, marksPerQuestion: Number(e.target.value) })}
                    className="w-full p-2 border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Negative Marks</label>
                  <input
                    type="number"
                    step="0.25"
                    min="0"
                    required
                    value={newAssessment.negativeMarking}
                    onChange={(e) => setNewAssessment({ ...newAssessment, negativeMarking: Number(e.target.value) })}
                    className="w-full p-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Master Answer Key (Question Numbers with Options A, B, C, D)
                </label>
                <textarea
                  rows={3}
                  required
                  value={newAssessment.answerKeyText}
                  onChange={(e) => setNewAssessment({ ...newAssessment, answerKeyText: e.target.value })}
                  placeholder="e.g. 1A, 2C, 3B, 4D, 5A, 6B, 7C, 8D..."
                  className="w-full p-2 border border-slate-300 rounded-lg font-mono text-[11px]"
                />
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Format: comma-separated list like 1A, 2C, 3B. Missing questions will be defaulted sequentially.
                </p>
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsCreateAssessmentModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold shadow-sm"
                >
                  {loading ? 'Creating...' : 'Create Assessment & Initialize Key'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: STUDENT REPORT CARD */}
      {isReportCardModal && selectedStudentReport && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-5 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex justify-between items-start">
              <div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/30 text-indigo-200 uppercase">
                  Official Academic Transcript
                </span>
                <h3 className="text-lg font-bold mt-1 text-white">{selectedStudentReport.studentName}</h3>
                <p className="text-xs text-slate-300">
                  Admission No: <span className="font-mono text-white font-bold">{selectedStudentReport.admissionNumber}</span> • Class: {selectedStudentReport.classCode} • Year: {selectedStudentReport.academicYear}
                </p>
              </div>

              <button
                onClick={() => setIsReportCardModal(false)}
                className="text-slate-400 hover:text-white text-lg font-bold p-1"
              >
                ✕
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-5 text-xs flex-1">
              {/* Overall GPA & Stats Summary */}
              <div className="grid grid-cols-3 gap-3 bg-indigo-50/60 border border-indigo-100 p-4 rounded-xl">
                <div>
                  <p className="text-slate-500 font-medium text-[11px]">Cumulative Percentage</p>
                  <p className="text-xl font-bold text-indigo-900 mt-0.5">
                    {selectedStudentReport.overallStats?.overallPercentage || 0}%
                  </p>
                </div>
                <div>
                  <p className="text-slate-500 font-medium text-[11px]">Cumulative Grade</p>
                  <p className="text-xl font-bold text-emerald-600 mt-0.5">
                    {selectedStudentReport.overallStats?.overallGrade || 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500 font-medium text-[11px]">Total Assessments</p>
                  <p className="text-xl font-bold text-slate-800 mt-0.5">
                    {selectedStudentReport.assessments?.length || 0}
                  </p>
                </div>
              </div>

              {/* Assessment Records Table */}
              <div>
                <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-2">
                  Completed Evaluations (FA-1, FA-2, SA-1, Custom)
                </h4>
                {selectedStudentReport.assessments?.length === 0 ? (
                  <p className="text-slate-400 italic py-4 text-center">No evaluated assessments on record yet.</p>
                ) : (
                  <table className="w-full text-left border-collapse border border-slate-200 rounded-xl overflow-hidden">
                    <thead>
                      <tr className="bg-slate-100 text-slate-600 font-semibold uppercase text-[10px]">
                        <th className="p-2.5">Type</th>
                        <th className="p-2.5">Subject</th>
                        <th className="p-2.5">Assessment Title</th>
                        <th className="p-2.5 text-center">Attempted</th>
                        <th className="p-2.5 text-center">Score / Max</th>
                        <th className="p-2.5 text-center">Percentage</th>
                        <th className="p-2.5 text-center">Grade</th>
                        <th className="p-2.5 text-center">Class Rank</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {selectedStudentReport.assessments?.map((a: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-2.5 font-bold text-indigo-700">{a.assessmentType}</td>
                          <td className="p-2.5 font-semibold text-slate-800">{a.subject}</td>
                          <td className="p-2.5 text-slate-600">{a.title}</td>
                          <td className="p-2.5 text-center font-mono">{a.attempted || '-'}</td>
                          <td className="p-2.5 text-center font-bold text-slate-900">
                            {a.marksObtained} / {a.maxMarks}
                          </td>
                          <td className="p-2.5 text-center font-bold text-emerald-600">{a.percentage}%</td>
                          <td className="p-2.5 text-center">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800">
                              {a.grade}
                            </span>
                          </td>
                          <td className="p-2.5 text-center font-bold text-slate-700">#{a.rank || 1}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Remarks */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-600">
                <p className="font-bold text-slate-800 text-xs">Teacher Remarks & Evaluation Feedback:</p>
                <p className="mt-1 text-[11px] leading-relaxed">
                  {selectedStudentReport.teacherRemarks || 'Student has shown consistent analytical ability and prompt answer submission across all formal assessments.'}
                </p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setIsReportCardModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-lg text-xs"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SEND WHATSAPP BROADCAST */}
      {isWhatsAppBroadcastModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 bg-emerald-800 text-white">
              <h3 className="text-base font-bold flex items-center space-x-2">
                <span>📢 Broadcast Official WhatsApp Message</span>
              </h3>
              <p className="text-xs text-emerald-200 mt-0.5">
                Send instantaneous announcements directly to parent and teacher WhatsApp phones.
              </p>
            </div>

            <form onSubmit={handleSendWhatsAppBroadcast} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Broadcast Target Audience</label>
                <select
                  value={broadcastTarget}
                  onChange={(e: any) => setBroadcastTarget(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="CLASS">Parents of a Specific Class</option>
                  <option value="ALL_PARENTS">All Registered School Parents</option>
                  <option value="TEACHERS">All Teaching Staff</option>
                </select>
              </div>

              {broadcastTarget === 'CLASS' && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Target Class</label>
                  <select
                    value={broadcastClassCode}
                    onChange={(e) => setBroadcastClassCode(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                  >
                    {classes.map((c) => (
                      <option key={c.classCode} value={c.classCode}>
                        Grade {c.grade}-{c.section} ({c.classCode})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Announcement Subject / Title</label>
                <input
                  type="text"
                  required
                  value={broadcastTitle}
                  onChange={(e) => setBroadcastTitle(e.target.value)}
                  placeholder="e.g. FA-1 Assessment Report Cards Published"
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Message Body</label>
                <textarea
                  rows={4}
                  required
                  value={broadcastMessage}
                  onChange={(e) => setBroadcastMessage(e.target.value)}
                  placeholder="Type your official announcement here..."
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsWhatsAppBroadcastModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={broadcastLoading}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold shadow-sm flex items-center space-x-1.5"
                >
                  <span>{broadcastLoading ? 'Dispatching...' : 'Dispatch WhatsApp Broadcast'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating Free LLM Assistant Widget */}
      <FreeLlmAssistant />

    </div>
  );
}
