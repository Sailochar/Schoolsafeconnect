'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient, clearStoredSession, getStoredUser } from '../../lib/api';
import FreeLlmAssistant from '../../components/FreeLlmAssistant';
import LiveFleetMap from '../../components/LiveFleetMap';

export default function SuperAdminDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'REQUESTS' | 'TENANTS' | 'AUDIT' | 'SCHOOL_VIEW'>('REQUESTS');

  const [onboardingRequests, setOnboardingRequests] = useState<any[]>([]);
  const [schools, setSchools] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Auto-dismiss alerts after 4.5 seconds
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 4500);
    return () => clearTimeout(t);
  }, [message]);

  // Approval / Rejection Modal State
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [isRejectModal, setIsRejectModal] = useState(false);

  // Full Details View Modal
  const [viewDetailsRequest, setViewDetailsRequest] = useState<any | null>(null);

  // Edit / Modify Modal State
  const [editRequest, setEditRequest] = useState<any | null>(null);
  const [editSchoolName, setEditSchoolName] = useState('');
  const [editBoard, setEditBoard] = useState('CBSE');
  const [editCapacity, setEditCapacity] = useState('500');
  const [editStreet, setEditStreet] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editState, setEditState] = useState('');
  const [editPostalCode, setEditPostalCode] = useState('');
  const [editAdminName, setEditAdminName] = useState('');
  const [editAdminEmail, setEditAdminEmail] = useState('');
  const [editAdminPhone, setEditAdminPhone] = useState('');
  const [editAdminPassword, setEditAdminPassword] = useState('');

  // Tenant Deletion State (Section 20 Destructive action)
  const [deleteTargetSchool, setDeleteTargetSchool] = useState<any | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteReason, setDeleteReason] = useState('');

  // Super Admin Eye Tab: Full School Admin View, Usage, Details & End-to-End Users
  const [inspectSchoolCode, setInspectSchoolCode] = useState<string>('');
  const [schoolOverview, setSchoolOverview] = useState<any | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [inspectSubTab, setInspectSubTab] = useState<'USERS' | 'FLEET_MAP' | 'ACADEMICS' | 'ASSESSMENTS' | 'ACTIVITY'>('USERS');
  const [inspectRoleFilter, setInspectRoleFilter] = useState<'ALL' | 'SCHOOL_ADMIN' | 'TEACHER' | 'PARENT' | 'DRIVER'>('ALL');
  const [inspectUserSearch, setInspectUserSearch] = useState('');

  const loadSchoolOverview = async (schoolCodeToLoad: string) => {
    if (!schoolCodeToLoad) return;
    setOverviewLoading(true);
    try {
      const res = await apiClient(`/super-admin/schools/${schoolCodeToLoad}/overview`);
      setSchoolOverview(res.data);
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setOverviewLoading(false);
    }
  };

  const openSchoolFullView = (schoolCodeToLoad: string) => {
    setInspectSchoolCode(schoolCodeToLoad);
    setActiveTab('SCHOOL_VIEW');
    loadSchoolOverview(schoolCodeToLoad);
  };

  useEffect(() => {
    if (activeTab !== 'SCHOOL_VIEW' || !inspectSchoolCode) return;
    if (inspectSubTab !== 'FLEET_MAP') return;
    const timer = setInterval(() => loadSchoolOverview(inspectSchoolCode), 8000);
    return () => clearInterval(timer);
  }, [activeTab, inspectSchoolCode, inspectSubTab]);

  useEffect(() => {
    const profile = getStoredUser();
    if (!profile || profile.role !== 'GLOBAL_SUPER_ADMIN') {
      router.push('/');
      return;
    }
    setUser(profile);
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [reqs, schs, logs] = await Promise.all([
        apiClient('/super-admin/onboarding-requests'),
        apiClient('/super-admin/schools'),
        apiClient('/super-admin/audit-logs?limit=50')
      ]);

      setOnboardingRequests(reqs.data?.requests || []);
      setSchools(schs.data?.schools || []);
      setAuditLogs(logs.data?.logs || []);
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (req: any) => {
    setEditRequest(req);
    setEditSchoolName(req.schoolName || '');
    setEditBoard(req.board || 'CBSE');
    setEditCapacity(String(req.expectedStudents || '500'));
    setEditStreet(req.address?.street || '');
    setEditCity(req.address?.city || '');
    setEditState(req.address?.state || '');
    setEditPostalCode(req.address?.postalCode || '');
    setEditAdminName(req.proposedAdminDetails?.fullName || '');
    setEditAdminEmail(req.proposedAdminDetails?.email || '');
    setEditAdminPhone(req.proposedAdminDetails?.phone || '');
    setEditAdminPassword('');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editRequest) return;
    setLoading(true);
    try {
      const payload: any = {
        schoolName: editSchoolName,
        board: editBoard,
        expectedStudents: parseInt(editCapacity, 10),
        address: {
          street: editStreet,
          city: editCity,
          state: editState,
          postalCode: editPostalCode,
          country: 'India'
        },
        proposedAdminDetails: {
          fullName: editAdminName,
          email: editAdminEmail,
          phone: editAdminPhone
        }
      };

      if (editAdminPassword && editAdminPassword.trim().length >= 8) {
        payload.proposedAdminDetails.password = editAdminPassword.trim();
      }

      await apiClient(`/super-admin/onboarding-requests/${editRequest.requestId}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });

      setMessage({ text: `Details for ${editSchoolName} updated successfully.`, type: 'success' });
      setEditRequest(null);
      await loadData();
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedRequest || actionReason.trim().length < 10) {
      alert('Mandatory approval reason must be at least 10 characters.');
      return;
    }

    setLoading(true);
    try {
      await apiClient('/super-admin/schools/approve', {
        method: 'POST',
        body: JSON.stringify({
          requestId: selectedRequest.requestId,
          reason: actionReason
        })
      });

      setMessage({ text: `School [${selectedRequest.schoolName}] successfully approved and tenant provisioned!`, type: 'success' });
      setSelectedRequest(null);
      setActionReason('');
      await loadData();
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedRequest || actionReason.trim().length < 10) {
      alert('Mandatory rejection reason must be at least 10 characters.');
      return;
    }

    setLoading(true);
    try {
      await apiClient('/super-admin/schools/reject', {
        method: 'POST',
        body: JSON.stringify({
          requestId: selectedRequest.requestId,
          reason: actionReason
        })
      });

      setMessage({ text: `School [${selectedRequest.schoolName}] application rejected.`, type: 'success' });
      setSelectedRequest(null);
      setActionReason('');
      setIsRejectModal(false);
      await loadData();
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRequest = async (requestId: string) => {
    if (!confirm('Are you sure you want to delete this school application record?')) return;
    setLoading(true);
    try {
      await apiClient(`/super-admin/onboarding-requests/${requestId}`, {
        method: 'DELETE'
      });
      setMessage({ text: 'Onboarding request record deleted.', type: 'success' });
      await loadData();
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSchoolTenant = async () => {
    if (!deleteTargetSchool) return;
    setLoading(true);
    try {
      await apiClient(`/super-admin/schools/${deleteTargetSchool.schoolCode}`, {
        method: 'DELETE',
        body: JSON.stringify({
          confirmationText: deleteConfirmText,
          reason: deleteReason
        })
      });
      setMessage({ text: `Tenant ${deleteTargetSchool.schoolCode} deleted permanently.`, type: 'success' });
      setDeleteTargetSchool(null);
      setDeleteConfirmText('');
      setDeleteReason('');
      await loadData();
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
      {/* Top Navbar */}
      <header className="bg-slate-900 text-white px-6 py-3.5 flex items-center justify-between shadow-md">
        <div className="flex items-center space-x-3">
          <img src="/logo.png?v=2" alt="SAFE SCL CONNECT" className="h-9 w-auto object-contain rounded" />
          <div>
            <h1 className="font-semibold text-base leading-tight">School Safe Connect</h1>
            <p className="text-xs text-sky-400">Global Super Admin Console ({user?.userCode})</p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <span className="text-xs text-slate-300">Signed in: {user?.fullName}</span>
          <button
            onClick={handleLogout}
            className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded transition border border-slate-700"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="bg-white border-b border-slate-200 px-6 flex space-x-6">
        <button
          onClick={() => setActiveTab('REQUESTS')}
          className={`py-3 text-xs font-semibold border-b-2 transition ${activeTab === 'REQUESTS'
            ? 'border-sky-600 text-sky-700'
            : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
        >
          School Applications ({onboardingRequests.length})
        </button>
        <button
          onClick={() => setActiveTab('TENANTS')}
          className={`py-3 text-xs font-semibold border-b-2 transition ${activeTab === 'TENANTS'
            ? 'border-sky-600 text-sky-700'
            : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
        >
          Active Tenants ({schools.length})
        </button>
        <button
          onClick={() => setActiveTab('AUDIT')}
          className={`py-3 text-xs font-semibold border-b-2 transition ${activeTab === 'AUDIT'
            ? 'border-sky-600 text-sky-700'
            : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
        >
          Immutable Audit Ledger
        </button>
        {/* Eye Symbol Compact Tab: Full School Admin View, Usage & End-to-End Users */}
        <button
          onClick={() => {
            setActiveTab('SCHOOL_VIEW');
            const target = inspectSchoolCode || schools[0]?.schoolCode || '';
            if (target) {
              setInspectSchoolCode(target);
              loadSchoolOverview(target);
            }
          }}
          title="Inspect Full School Admin View, Usage, Details & End-to-End Users"
          className={`py-3 px-2 text-xs font-semibold border-b-2 transition flex items-center space-x-1.5 ${activeTab === 'SCHOOL_VIEW'
            ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50'
            : 'border-transparent text-slate-500 hover:text-indigo-700'
            }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          <span>School View</span>
        </button>
      </div>

      {/* Main Body */}
      <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
        {message && (
          <div
            className={`p-4 rounded-lg text-xs font-medium border flex items-center justify-between gap-2 ${message.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
              }`}
          >
            <span>{message.text}</span>
            <button
              type="button"
              onClick={() => setMessage(null)}
              className="font-bold text-sm leading-none px-1 opacity-70 hover:opacity-100"
              title="Dismiss"
            >
              ✕
            </button>
          </div>
        )}

        {/* TAB 1: SCHOOL ONBOARDING REQUESTS */}
        {activeTab === 'REQUESTS' && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <div>
                <h2 className="text-sm font-bold text-slate-800">Prospective School Onboarding Submissions</h2>
                <p className="text-xs text-slate-500">Inspect full applicant details, modify information, or manage approval</p>
              </div>
              <button
                onClick={loadData}
                disabled={loading}
                className="text-xs text-sky-600 hover:text-sky-800 font-medium"
              >
                Refresh
              </button>
            </div>

            {onboardingRequests.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs">
                No school applications currently pending review.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Request ID</th>
                      <th className="py-3 px-4">School Details</th>
                      <th className="py-3 px-4">Proposed Administrator</th>
                      <th className="py-3 px-4">Capacity</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Super Admin Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {onboardingRequests.map((req) => (
                      <tr key={req.requestId} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-4 font-mono font-medium text-slate-700">
                          <div>{req.requestId}</div>
                          {req.allocatedSchoolCode && (
                            <span className="text-[10px] text-emerald-700 font-bold block mt-0.5">
                              Assigned: {req.allocatedSchoolCode}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900">{req.schoolName}</div>
                          <div className="text-[11px] text-slate-500">Board: {req.board} • {req.address?.city}, {req.address?.state}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-800">{req.proposedAdminDetails?.fullName}</div>
                          <div className="text-[11px] text-slate-500">{req.proposedAdminDetails?.email} • {req.proposedAdminDetails?.phone}</div>
                        </td>
                        <td className="py-3 px-4 text-slate-600">{req.expectedStudents} Students</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${req.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' :
                            req.status === 'REJECTED' ? 'bg-rose-100 text-rose-800' :
                              'bg-amber-100 text-amber-800'
                            }`}>
                            {req.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                          {/* VIEW ALL DETAILS BUTTON */}
                          <button
                            onClick={() => setViewDetailsRequest(req)}
                            className="bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 px-2.5 py-1.5 rounded text-xs font-medium transition"
                            title="Inspect all registered information"
                          >
                            View Details
                          </button>

                          {/* MODIFY BUTTON */}
                          <button
                            onClick={() => openEditModal(req)}
                            className="bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 px-2.5 py-1.5 rounded text-xs font-medium transition"
                            title="Modify School or Administrator details"
                          >
                            Modify
                          </button>

                          {req.status === 'PENDING' && (
                            <>
                              <button
                                onClick={() => {
                                  setSelectedRequest(req);
                                  setIsRejectModal(false);
                                  setActionReason('');
                                }}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1.5 rounded text-xs font-medium transition"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedRequest(req);
                                  setIsRejectModal(true);
                                  setActionReason('');
                                }}
                                className="bg-rose-600 hover:bg-rose-700 text-white px-2.5 py-1.5 rounded text-xs font-medium transition"
                              >
                                Deny
                              </button>
                            </>
                          )}

                          <button
                            onClick={() => handleDeleteRequest(req.requestId)}
                            className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-2 py-1.5 rounded text-xs font-medium transition"
                            title="Delete Application Record"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: ACTIVE TENANTS */}
        {activeTab === 'TENANTS' && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
              <h2 className="text-sm font-bold text-slate-800">Multi-Tenant Isolated School Infrastructure</h2>
              <span className="text-xs text-slate-500">Live Enterprise Deployment</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Tenant Code</th>
                    <th className="py-3 px-4">School Name</th>
                    <th className="py-3 px-4">Board & Location</th>
                    <th className="py-3 px-4">Tenant Status</th>
                    <th className="py-3 px-4">Configured Capacity</th>
                    <th className="py-3 px-4 text-right">Administrative Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {schools.map((school) => (
                    <tr key={school.schoolCode} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-4 font-mono font-bold text-sky-700">{school.schoolCode}</td>
                      <td className="py-3 px-4 font-medium text-slate-900">{school.name}</td>
                      <td className="py-3 px-4 text-slate-600">{school.board} • {school.address?.city || 'Pilot'}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${school.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}>
                          {school.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-500">Enrolled Multi-Tenant</td>
                      <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                        <button
                          onClick={() => openSchoolFullView(school.schoolCode)}
                          title="Inspect full School Admin view, usage, GPS map, and end-to-end users"
                          className="inline-flex items-center space-x-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-3 py-1.5 rounded text-xs font-semibold transition"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          <span>Inspect</span>
                        </button>
                        <button
                          onClick={() => {
                            setDeleteTargetSchool(school);
                            setDeleteConfirmText('');
                            setDeleteReason('');
                          }}
                          className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-3 py-1.5 rounded text-xs font-semibold transition"
                        >
                          Delete Tenant
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: AUDIT LOGS */}
        {activeTab === 'AUDIT' && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50">
              <h2 className="text-sm font-bold text-slate-800">Immutable Cryptographic Audit Trail</h2>
              <p className="text-xs text-slate-500 mt-0.5">Mongoose pre-hook protected against deletion or modification</p>
            </div>
            <div className="overflow-x-auto max-h-[500px]">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider border-b border-slate-200 font-mono">
                  <tr>
                    <th className="py-2.5 px-4">Timestamp</th>
                    <th className="py-2.5 px-4">Action</th>
                    <th className="py-2.5 px-4">Tenant</th>
                    <th className="py-2.5 px-4">Actor</th>
                    <th className="py-2.5 px-4">Reason / Notes</th>
                    <th className="py-2.5 px-4">IP Address</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {auditLogs.map((log) => (
                    <tr key={log.logId || log._id} className="hover:bg-slate-50 transition">
                      <td className="py-2.5 px-4 text-slate-500 whitespace-nowrap font-mono">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-4 font-mono font-semibold text-sky-700">{log.action}</td>
                      <td className="py-2.5 px-4 font-mono text-slate-600">{log.schoolCode}</td>
                      <td className="py-2.5 px-4">
                        <span className="font-medium text-slate-800">{log.actor?.userCode}</span>
                        <span className="text-[10px] text-slate-400 block">({log.actor?.role})</span>
                      </td>
                      <td className="py-2.5 px-4 text-slate-700 max-w-xs truncate">{log.reason || 'Automated record'}</td>
                      <td className="py-2.5 px-4 text-slate-400 font-mono">{log.ipAddress}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4 (EYE SYMBOL): FULL SCHOOL ADMIN VIEW, USAGE, DETAILS & END-TO-END USERS */}
        {activeTab === 'SCHOOL_VIEW' && (
          <div className="space-y-5">
            {/* School Selector Bar */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Super Admin Eye — Full School Inspector</h2>
                  <p className="text-xs text-slate-500">
                    End-to-end School Admin view, usage telemetry, live driver GPS map, academic assessments, and all users.
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <select
                  value={inspectSchoolCode}
                  onChange={(e) => {
                    setInspectSchoolCode(e.target.value);
                    loadSchoolOverview(e.target.value);
                  }}
                  className="text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="" disabled>-- Select School Tenant --</option>
                  {schools.map((s) => (
                    <option key={s.schoolCode} value={s.schoolCode}>
                      {s.schoolCode} — {s.name} ({s.status})
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => inspectSchoolCode && loadSchoolOverview(inspectSchoolCode)}
                  disabled={overviewLoading || !inspectSchoolCode}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-3 py-2 rounded-lg text-xs font-semibold transition"
                >
                  {overviewLoading ? 'Loading...' : '↻ Refresh View'}
                </button>
              </div>
            </div>

            {!schoolOverview ? (
              <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-xs text-slate-500">
                {overviewLoading
                  ? 'Loading complete school tenant telemetry...'
                  : 'Select a school tenant above to inspect its full School Admin view, usage analytics, and end-to-end users.'}
              </div>
            ) : (
              <>
                {/* School Profile & Admin Banner */}
                <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-xl p-5 shadow-sm grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-xs bg-white/15 px-2.5 py-0.5 rounded font-bold">
                        {schoolOverview.school?.schoolCode}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${schoolOverview.school?.status === 'ACTIVE' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
                        }`}>
                        {schoolOverview.school?.status}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold">{schoolOverview.school?.name}</h3>
                    <p className="text-xs text-slate-300">
                      Board: {schoolOverview.school?.board || 'CBSE'} • {schoolOverview.school?.address?.city || 'Campus'},{' '}
                      {schoolOverview.school?.address?.state || ''} • Created:{' '}
                      {schoolOverview.school?.createdAt ? new Date(schoolOverview.school.createdAt).toLocaleDateString() : '-'}
                    </p>
                  </div>

                  <div className="bg-white/10 rounded-lg p-3.5 text-xs space-y-1">
                    <div className="text-[10px] uppercase tracking-wider text-indigo-200 font-bold">
                      School Administrator Account(s)
                    </div>
                    {(schoolOverview.schoolAdmins || []).length === 0 ? (
                      <div className="text-slate-300">No School Admin assigned</div>
                    ) : (
                      schoolOverview.schoolAdmins.map((adm: any) => (
                        <div key={adm.userCode} className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-1 last:border-0 last:pb-0">
                          <div>
                            <span className="font-bold text-white">{adm.fullName}</span>{' '}
                            <span className="font-mono text-sky-300">({adm.userCode})</span>
                            <div className="text-[11px] text-slate-300">{adm.email} • {adm.phone}</div>
                          </div>
                          <div className="text-right text-[10px] text-slate-300">
                            <div>Status: <b className="text-emerald-300">{adm.status}</b></div>
                            <div>Last Login: {adm.lastLoginAt ? new Date(adm.lastLoginAt).toLocaleString() : 'Never'}</div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Usage KPI Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  <div className="bg-white rounded-xl border border-slate-200 p-3.5">
                    <span className="text-[11px] text-slate-500 font-semibold">Total End Users</span>
                    <div className="text-xl font-bold text-slate-900 mt-0.5">{schoolOverview.usage?.totalUsers ?? 0}</div>
                    <div className="text-[10px] text-emerald-600 font-semibold">
                      {schoolOverview.usage?.activeUsers ?? 0} Active • {schoolOverview.usage?.pendingUsers ?? 0} Pending
                    </div>
                  </div>
                  <div className="bg-white rounded-xl border border-slate-200 p-3.5">
                    <span className="text-[11px] text-slate-500 font-semibold">Teachers / Parents</span>
                    <div className="text-xl font-bold text-indigo-700 mt-0.5">
                      {schoolOverview.usage?.teachersCount ?? 0} / {schoolOverview.usage?.parentsCount ?? 0}
                    </div>
                    <div className="text-[10px] text-slate-500">Drivers: {schoolOverview.usage?.driversCount ?? 0}</div>
                  </div>
                  <div className="bg-white rounded-xl border border-slate-200 p-3.5">
                    <span className="text-[11px] text-slate-500 font-semibold">Classes & Students</span>
                    <div className="text-xl font-bold text-sky-700 mt-0.5">
                      {schoolOverview.usage?.classesCount ?? 0} / {schoolOverview.usage?.studentsCount ?? 0}
                    </div>
                    <div className="text-[10px] text-slate-500">Enrolled Registry</div>
                  </div>
                  <div className="bg-white rounded-xl border border-slate-200 p-3.5">
                    <span className="text-[11px] text-slate-500 font-semibold">AI Assessments</span>
                    <div className="text-xl font-bold text-emerald-700 mt-0.5">
                      {schoolOverview.assessments?.length ?? 0} Exams
                    </div>
                    <div className="text-[10px] text-slate-500">
                      FA-1, FA-2, SA-1 OMR Sheets
                    </div>
                  </div>
                  <div className="bg-white rounded-xl border border-slate-200 p-3.5">
                    <span className="text-[11px] text-slate-500 font-semibold">GPS Bus Fleet</span>
                    <div className="text-xl font-bold text-amber-600 mt-0.5">
                      {schoolOverview.usage?.busesCount ?? 0} Buses • {schoolOverview.usage?.routesCount ?? 0} Routes
                    </div>
                    <div className="text-[10px] text-emerald-700 font-semibold">
                      {schoolOverview.usage?.activeTripsCount ?? 0} Live Trips • {schoolOverview.usage?.totalGpsPings ?? 0} GPS pings
                    </div>
                  </div>
                  <div className="bg-white rounded-xl border border-slate-200 p-3.5">
                    <span className="text-[11px] text-slate-500 font-semibold">Safety & Audit</span>
                    <div className="text-xl font-bold text-rose-600 mt-0.5">
                      {schoolOverview.usage?.incidentsCount ?? 0} Inc • {schoolOverview.usage?.panicAlertsCount ?? 0} SOS
                    </div>
                    <div className="text-[10px] text-slate-500">{schoolOverview.usage?.auditEventsCount ?? 0} Audit Events</div>
                  </div>
                </div>

                {/* Inner Drill-Down Tabs */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="px-4 border-b border-slate-200 bg-slate-50 flex flex-wrap gap-2 text-xs font-semibold">
                    {[
                      { id: 'USERS', label: `End-to-End Users (${schoolOverview.users?.length || 0})` },
                      { id: 'FLEET_MAP', label: `Live Bus GPS Map & Routes (${schoolOverview.fleet?.length || 0})` },
                      { id: 'ACADEMICS', label: `Classes (${schoolOverview.classes?.length || 0}) & Students (${schoolOverview.students?.length || 0})` },
                      { id: 'ASSESSMENTS', label: `AI OMR & Assessments (${schoolOverview.assessments?.length || 0})` },
                      { id: 'ACTIVITY', label: `Incidents & Usage Log (${schoolOverview.recentActivity?.length || 0})` }
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setInspectSubTab(tab.id as any)}
                        className={`py-3 px-3 border-b-2 transition ${inspectSubTab === tab.id
                          ? 'border-indigo-600 text-indigo-700 font-bold'
                          : 'border-transparent text-slate-500 hover:text-slate-800'
                          }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* SUB-TAB 1: END-TO-END USERS */}
                  {inspectSubTab === 'USERS' && (
                    <div className="p-4 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap gap-1.5 text-xs">
                          {(['ALL', 'SCHOOL_ADMIN', 'TEACHER', 'PARENT', 'DRIVER'] as const).map((r) => (
                            <button
                              key={r}
                              onClick={() => setInspectRoleFilter(r)}
                              className={`px-2.5 py-1 rounded-lg font-semibold border text-[11px] transition ${inspectRoleFilter === r
                                ? 'bg-indigo-600 text-white border-indigo-600'
                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                }`}
                            >
                              {r === 'ALL' ? 'All Roles' : r.replace('_', ' ')}
                            </button>
                          ))}
                        </div>
                        <input
                          type="text"
                          value={inspectUserSearch}
                          onChange={(e) => setInspectUserSearch(e.target.value)}
                          placeholder="Search name, code, email, phone..."
                          className="text-xs px-3 py-1.5 border border-slate-300 rounded-lg w-64 outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>

                      <div className="overflow-x-auto max-h-[440px]">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider border-b border-slate-200 sticky top-0">
                            <tr>
                              <th className="py-2.5 px-3">Serial Code</th>
                              <th className="py-2.5 px-3">Role</th>
                              <th className="py-2.5 px-3">Full Name & Contact</th>
                              <th className="py-2.5 px-3">Status / Verification</th>
                              <th className="py-2.5 px-3">Transit &amp; Bus Access</th>
                              <th className="py-2.5 px-3">Last Login</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {(schoolOverview.users || [])
                              .filter((u: any) => {
                                if (inspectRoleFilter === 'TEACHER') return u.role?.includes('TEACHER');
                                if (inspectRoleFilter !== 'ALL') return u.role === inspectRoleFilter;
                                return true;
                              })
                              .filter((u: any) => {
                                if (!inspectUserSearch.trim()) return true;
                                const q = inspectUserSearch.toLowerCase();
                                return (
                                  (u.fullName || '').toLowerCase().includes(q) ||
                                  (u.userCode || '').toLowerCase().includes(q) ||
                                  (u.email || '').toLowerCase().includes(q) ||
                                  (u.phone || '').toLowerCase().includes(q)
                                );
                              })
                              .map((u: any) => (
                                <tr key={u._id} className="hover:bg-slate-50">
                                  <td className="py-2.5 px-3 font-mono font-bold text-sky-700">{u.userCode || 'PENDING'}</td>
                                  <td className="py-2.5 px-3">
                                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-bold">
                                      {u.role}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-3">
                                    <div className="font-semibold text-slate-900">{u.fullName}</div>
                                    <div className="text-[11px] text-slate-500">{u.email} • {u.phone}</div>
                                  </td>
                                  <td className="py-2.5 px-3 space-x-1">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${u.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                                      }`}>
                                      {u.status}
                                    </span>
                                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-sky-50 text-sky-700">
                                      {u.verificationDetails?.status || 'PENDING'}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-3 text-[11px]">
                                    <div>
                                      Bus GPS:{' '}
                                      <b className={u.accessControls?.transportEnabled === false ? 'text-rose-600' : 'text-sky-700'}>
                                        {u.accessControls?.transportEnabled === false ? 'OFF' : 'ON'}
                                      </b>
                                      {u.accessControls?.transportBusCode ? ` (${u.accessControls.transportBusCode})` : ''}
                                    </div>
                                  </td>
                                  <td className="py-2.5 px-3 text-[11px] text-slate-500">
                                    {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'Never'}
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* SUB-TAB 2: LIVE BUS GPS MAP & ROUTES */}
                  {inspectSubTab === 'FLEET_MAP' && (
                    <div className="p-4 space-y-4">
                      <LiveFleetMap
                        fleet={schoolOverview.fleet || []}
                        routes={schoolOverview.routes || []}
                        height="390px"
                      />
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                        {(schoolOverview.fleet || []).map((f: any) => (
                          <div key={f.bus?.busCode} className="p-3 rounded-lg border border-slate-200 bg-slate-50 space-y-1">
                            <div className="flex justify-between">
                              <span className="font-mono font-bold text-sky-700">{f.bus?.busCode} ({f.bus?.registrationNumber})</span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${f.isLive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                                }`}>
                                {f.isLive ? `● ${f.status}` : 'STANDBY'}
                              </span>
                            </div>
                            <div className="text-slate-600">
                              Driver GPS Portal: <b>{f.driver?.fullName || f.bus?.driverCode || 'Unassigned'}</b>
                            </div>
                            <div className="text-slate-600">
                              Route: <b>{f.route?.routeName || f.bus?.routeCode || 'Unassigned'}</b>
                            </div>
                            <div className="font-mono text-[11px] text-slate-500">
                              GPS: {f.location?.latitude?.toFixed(5)}, {f.location?.longitude?.toFixed(5)} • Speed: {f.location?.speedKmph ?? 0} km/h
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* SUB-TAB 3: CLASSES & STUDENTS */}
                  {inspectSubTab === 'ACADEMICS' && (
                    <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
                      <div className="space-y-2">
                        <h4 className="font-bold text-slate-800">Classes &amp; Sections ({schoolOverview.classes?.length || 0})</h4>
                        {(schoolOverview.classes || []).map((c: any) => (
                          <div key={c.classCode} className="p-3 rounded-lg border border-slate-200 bg-slate-50 flex justify-between items-center">
                            <div>
                              <div className="font-mono font-bold text-sky-700">{c.classCode}</div>
                              <div className="text-slate-600">Grade {c.grade}-{c.section} • Room {c.roomNumber || '-'} • Cap {c.capacity}</div>
                            </div>
                            <div className="text-right text-[11px]">
                              <span className="px-2 py-0.5 rounded font-bold bg-emerald-100 text-emerald-800">
                                ACTIVE
                              </span>
                              <div className="text-slate-500 mt-0.5">{c.academicYear || '2026-2027'}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="space-y-2">
                        <h4 className="font-bold text-slate-800">Enrolled Students & Mapped Parents ({schoolOverview.students?.length || 0})</h4>
                        {(schoolOverview.students || []).map((st: any) => (
                          <div key={st.studentCode} className="p-3 rounded-lg border border-slate-200 bg-slate-50 space-y-0.5">
                            <div className="flex justify-between">
                              <span className="font-bold text-slate-900">{st.fullName}</span>
                              <span className="font-mono text-sky-700 font-semibold">{st.studentCode}</span>
                            </div>
                            <div className="text-slate-600">
                              Adm: {st.admissionNumber} • Class: {st.classCode} • Bus: {st.transport?.busCode || st.busCode || 'Self'}
                            </div>
                            <div className="text-[11px] text-indigo-700 font-mono">
                              Linked Parents: {(st.linkedParents || []).length > 0 ? st.linkedParents.join(', ') : 'None'}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* SUB-TAB 4: AI ASSESSMENTS & REPORT CARDS */}
                  {inspectSubTab === 'ASSESSMENTS' && (
                    <div className="p-4 space-y-4 text-xs">
                      <div className="flex justify-between items-center">
                        <div>
                          <h4 className="font-bold text-slate-800">Evaluated Assessments &amp; OMR Correction Results</h4>
                          <p className="text-slate-500 text-[11px]">Overview of FA/SA examinations, answer key scoring, and report cards.</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {(schoolOverview.assessments || []).map((asm: any) => (
                          <div key={asm._id || asm.title} className="p-3 rounded-lg border border-slate-200 bg-slate-50 space-y-1.5">
                            <div className="flex justify-between items-center">
                              <span className="font-bold text-sky-800">{asm.title}</span>
                              <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 text-[10px] font-bold">{asm.assessmentType}</span>
                            </div>
                            <div className="text-slate-600 font-semibold">{asm.subject} • Class: {asm.classCode}</div>
                            <div className="text-slate-500 flex justify-between text-[11px]">
                              <span>Questions: {asm.totalQuestions}</span>
                              <span>Evaluated: {asm.results?.length || 0} students</span>
                            </div>
                            <div className="text-slate-500 flex justify-between text-[11px]">
                              <span>Pass Rate: {asm.summary?.passPercentage || 0}%</span>
                              <span className="text-emerald-700 font-bold">Top: {asm.summary?.highestScore || 0}/{asm.maxMarks}</span>
                            </div>
                          </div>
                        ))}
                        {(!schoolOverview.assessments || schoolOverview.assessments.length === 0) && (
                          <div className="col-span-3 text-center py-6 text-slate-400">
                            No assessments logged yet for this school.
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* SUB-TAB 5: INCIDENTS & SCHOOL ADMIN USAGE AUDIT */}
                  {inspectSubTab === 'ACTIVITY' && (
                    <div className="p-4 space-y-4 text-xs">
                      <h4 className="font-bold text-slate-800">School Admin & End-to-End Tenant Activity Log</h4>
                      <div className="overflow-x-auto max-h-[380px]">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 text-slate-500 uppercase border-b sticky top-0">
                            <tr>
                              <th className="py-2 px-3">Time</th>
                              <th className="py-2 px-3">Action</th>
                              <th className="py-2 px-3">Actor</th>
                              <th className="py-2 px-3">Resource</th>
                              <th className="py-2 px-3">Details</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {(schoolOverview.recentActivity || []).map((a: any) => (
                              <tr key={a._id || a.logId} className="hover:bg-slate-50">
                                <td className="py-2 px-3 font-mono text-slate-500 whitespace-nowrap">{new Date(a.createdAt).toLocaleString()}</td>
                                <td className="py-2 px-3 font-mono font-semibold text-indigo-700">{a.action}</td>
                                <td className="py-2 px-3">{a.actor?.userCode} <span className="text-slate-400">({a.actor?.role})</span></td>
                                <td className="py-2 px-3 font-mono text-slate-600">{a.resourceType}: {a.resourceId}</td>
                                <td className="py-2 px-3 text-slate-600">{a.reason}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </main>

      {/* MODAL 1: VIEW ALL DETAILS MODAL */}
      {viewDetailsRequest && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 bg-sky-800 text-white flex justify-between items-center">
              <div>
                <h3 className="text-base font-bold">{viewDetailsRequest.schoolName}</h3>
                <p className="text-xs text-sky-200 mt-0.5">Tracking ID: {viewDetailsRequest.requestId}</p>
              </div>
              <span className={`px-2.5 py-1 rounded text-xs font-semibold ${viewDetailsRequest.status === 'APPROVED' ? 'bg-emerald-500 text-white' :
                viewDetailsRequest.status === 'REJECTED' ? 'bg-rose-500 text-white' :
                  'bg-amber-500 text-white'
                }`}>
                {viewDetailsRequest.status}
              </span>
            </div>

            <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto text-xs text-slate-700">

              {/* Institution Info */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">1. School Profile</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div><strong>School Name:</strong> {viewDetailsRequest.schoolName}</div>
                  <div><strong>Affiliation Board:</strong> {viewDetailsRequest.board}</div>
                  <div><strong>Expected Students:</strong> {viewDetailsRequest.expectedStudents}</div>
                  <div><strong>Allocated Tenant:</strong> {viewDetailsRequest.allocatedSchoolCode || 'Not provisioned yet'}</div>
                </div>
                <div>
                  <strong>Address:</strong> {viewDetailsRequest.address?.street}, {viewDetailsRequest.address?.city}, {viewDetailsRequest.address?.state} - {viewDetailsRequest.address?.postalCode}, {viewDetailsRequest.address?.country}
                </div>
              </div>

              {/* Proposed Admin Info */}
              <div className="bg-sky-50/60 p-4 rounded-xl border border-sky-100 space-y-2">
                <h4 className="font-bold text-sky-900 uppercase tracking-wider text-[11px]">2. Proposed Administrator Details</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div><strong>Full Name:</strong> {viewDetailsRequest.proposedAdminDetails?.fullName}</div>
                  <div><strong>Official Email:</strong> {viewDetailsRequest.proposedAdminDetails?.email}</div>
                  <div><strong>Contact Phone:</strong> {viewDetailsRequest.proposedAdminDetails?.phone}</div>
                  <div><strong>Allocated User Code:</strong> {viewDetailsRequest.allocatedAdminCode || 'Pending approval'}</div>
                </div>
              </div>

              {/* School Office Desk Contact */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">3. Contact Person & Desk</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div><strong>Name:</strong> {viewDetailsRequest.contactPerson?.name || 'N/A'}</div>
                  <div><strong>Phone:</strong> {viewDetailsRequest.contactPerson?.phone || 'N/A'}</div>
                  <div><strong>Email:</strong> {viewDetailsRequest.contactPerson?.email || 'N/A'}</div>
                </div>
              </div>

              {/* Audit / Review Status */}
              <div className="text-[11px] text-slate-500 border-t border-slate-200 pt-3">
                <p><strong>Submission Date:</strong> {new Date(viewDetailsRequest.createdAt).toLocaleString()}</p>
                {viewDetailsRequest.reviewDetails?.reviewedAt && (
                  <p><strong>Reviewed By:</strong> {viewDetailsRequest.reviewDetails.reviewedBy} at {new Date(viewDetailsRequest.reviewDetails.reviewedAt).toLocaleString()}</p>
                )}
                {viewDetailsRequest.approvalReason && (
                  <p className="text-emerald-700"><strong>Approval Reason:</strong> {viewDetailsRequest.approvalReason}</p>
                )}
                {viewDetailsRequest.rejectionReason && (
                  <p className="text-rose-700"><strong>Rejection Reason:</strong> {viewDetailsRequest.rejectionReason}</p>
                )}
              </div>
            </div>

            <div className="p-4 bg-slate-100 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setViewDetailsRequest(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: MODIFY / EDIT REGISTRATION DETAILS MODAL */}
      {editRequest && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 bg-amber-600 text-white flex justify-between items-center">
              <div>
                <h3 className="text-base font-bold">Modify Registration Details</h3>
                <p className="text-xs text-amber-100 mt-0.5">Editing: {editRequest.schoolName} ({editRequest.requestId})</p>
              </div>
              <button
                onClick={() => setEditRequest(null)}
                className="text-white hover:text-amber-200 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">

              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b pb-1">
                School Information
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">School Name</label>
                  <input
                    type="text"
                    required
                    value={editSchoolName}
                    onChange={(e) => setEditSchoolName(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-xs outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Affiliation Board</label>
                  <select
                    value={editBoard}
                    onChange={(e) => setEditBoard(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-xs outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                  >
                    <option value="CBSE">CBSE</option>
                    <option value="ICSE">ICSE</option>
                    <option value="State Board">State Board</option>
                    <option value="IB">IB</option>
                    <option value="Cambridge">Cambridge</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Expected Capacity</label>
                  <input
                    type="number"
                    required
                    value={editCapacity}
                    onChange={(e) => setEditCapacity(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-xs outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Street Address</label>
                  <input
                    type="text"
                    required
                    value={editStreet}
                    onChange={(e) => setEditStreet(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-xs outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">City</label>
                  <input
                    type="text"
                    required
                    value={editCity}
                    onChange={(e) => setEditCity(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-xs outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">State</label>
                  <input
                    type="text"
                    required
                    value={editState}
                    onChange={(e) => setEditState(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-xs outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Postal Code</label>
                  <input
                    type="text"
                    required
                    value={editPostalCode}
                    onChange={(e) => setEditPostalCode(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-xs outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b pb-1 pt-2">
                Administrator Identity & Password
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Administrator Full Name</label>
                  <input
                    type="text"
                    required
                    value={editAdminName}
                    onChange={(e) => setEditAdminName(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-xs outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Official Email</label>
                  <input
                    type="email"
                    required
                    value={editAdminEmail}
                    onChange={(e) => setEditAdminEmail(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-xs outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Phone</label>
                  <input
                    type="text"
                    required
                    value={editAdminPhone}
                    onChange={(e) => setEditAdminPhone(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-xs outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Override / Update Admin Password (optional, leave blank to keep existing)
                  </label>
                  <input
                    type="password"
                    minLength={8}
                    value={editAdminPassword}
                    onChange={(e) => setEditAdminPassword(e.target.value)}
                    placeholder="Enter new password if updating..."
                    className="w-full px-3 py-2 border rounded-lg text-xs outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setEditRequest(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition disabled:opacity-50"
                >
                  {loading ? 'Saving Changes...' : 'Save & Update Details'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: MANDATORY REASON CAPTURE FOR APPROVE / REJECT */}
      {selectedRequest && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className={`p-5 text-white ${isRejectModal ? 'bg-rose-700' : 'bg-emerald-700'}`}>
              <h3 className="text-base font-bold">
                {isRejectModal ? 'Deny / Reject School Onboarding' : 'Approve School Tenant'}
              </h3>
              <p className="text-xs text-white/80 mt-1">{selectedRequest.schoolName}</p>
            </div>

            <div className="p-6 space-y-4">
              <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100">
                <p><strong>Proposed Admin:</strong> {selectedRequest.proposedAdminDetails?.fullName}</p>
                <p><strong>Admin Email:</strong> {selectedRequest.proposedAdminDetails?.email}</p>
                <p><strong>Board Affiliation:</strong> {selectedRequest.board}</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mandatory Justification Reason (Required for Audit Trail)
                </label>
                <textarea
                  rows={3}
                  required
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  placeholder="Detail official accreditation, board verification, or reason for rejection..."
                  className="w-full text-xs p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-sky-500 outline-none"
                />
                <p className="text-[11px] text-slate-400 mt-1">Minimum 10 characters required.</p>
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedRequest(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={isRejectModal ? handleReject : handleApprove}
                  disabled={loading || actionReason.trim().length < 10}
                  className={`px-4 py-2 text-xs font-semibold text-white rounded-lg transition disabled:opacity-50 ${isRejectModal ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'
                    }`}
                >
                  {loading ? 'Processing...' : isRejectModal ? 'Confirm Rejection' : 'Confirm Approval & Provision'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: SECTION 20 DESTRUCTIVE TENANT DELETION */}
      {deleteTargetSchool && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-red-200 overflow-hidden">
            <div className="p-5 bg-rose-700 text-white">
              <h3 className="text-base font-bold">Destructive Tenant Deletion</h3>
              <p className="text-xs text-white/80 mt-1">
                {deleteTargetSchool.name} ({deleteTargetSchool.schoolCode})
              </p>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800">
                Warning: This will permanently delete the school tenant, all registered admin/teacher/parent accounts, students, classes, and transport configurations.
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Type Confirmation: <span className="font-mono text-rose-600">CONFIRM-DELETE-TENANT-{deleteTargetSchool.schoolCode}</span>
                </label>
                <input
                  type="text"
                  required
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 font-mono focus:ring-2 focus:ring-rose-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mandatory Audit Reason (min 10 chars)
                </label>
                <textarea
                  rows={2}
                  required
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  placeholder="Official justification for tenant decommissioning..."
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-rose-500 outline-none"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteTargetSchool(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteSchoolTenant}
                  disabled={
                    loading ||
                    deleteConfirmText !== `CONFIRM-DELETE-TENANT-${deleteTargetSchool.schoolCode}` ||
                    deleteReason.trim().length < 10
                  }
                  className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition disabled:opacity-50"
                >
                  {loading ? 'Deleting...' : 'Permanently Delete Tenant'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <FreeLlmAssistant />
    </div>
  );
}
