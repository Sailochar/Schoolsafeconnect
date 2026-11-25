'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient, clearStoredSession, getStoredUser } from '../../lib/api';
import LiveFleetMap from '../../components/LiveFleetMap';
import FreeLlmAssistant from '../../components/FreeLlmAssistant';
import SchoolWelcomeGreeting from '../../components/SchoolWelcomeGreeting';

export default function TransportCoordinatorDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [buses, setBuses] = useState<any[]>([]);
  const [routes, setRoutes] = useState<any[]>([]);
  const [fleet, setFleet] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const profile = getStoredUser();
    if (!profile || (profile.role !== 'TRANSPORT_COORDINATOR' && profile.role !== 'SCHOOL_ADMIN')) {
      router.push('/');
      return;
    }
    setUser(profile);
    loadTransportData();
    const timer = setInterval(loadTransportData, 5000);
    return () => clearInterval(timer);
  }, []);

  const loadTransportData = async () => {
    setLoading(true);
    try {
      const [busesRes, routesRes, fleetRes] = await Promise.all([
        apiClient('/transport/buses'),
        apiClient('/transport/routes'),
        apiClient('/transport/fleet')
      ]);

      setBuses(busesRes.data?.buses || []);
      setRoutes(routesRes.data?.routes || []);
      setFleet(fleetRes.data?.fleet || []);
    } catch (err: any) {
      setMessage(err.message);
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
      {/* 2.5-3s School Welcome Greeting */}
      {user && (
        <SchoolWelcomeGreeting
          schoolName={user?.schoolName || user?.schoolCode || 'School Transport Operations'}
          userName={user?.fullName}
          role="Transport Coordinator"
          durationMs={2800}
        />
      )}

      {/* Top Navbar */}
      <header className="bg-amber-900 text-white px-6 py-4 flex items-center justify-between shadow-md">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center font-bold text-white text-sm">
            TRC
          </div>
          <div>
            <h1 className="font-semibold text-base leading-tight">School Safe Connect</h1>
            <p className="text-xs text-amber-200">Transport Coordinator Portal • Tenant: <span className="font-mono text-white">{user?.schoolCode}</span></p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <span className="text-xs text-amber-100">{user?.fullName}</span>
          <button
            onClick={handleLogout}
            className="text-xs bg-amber-800 hover:bg-amber-700 text-white px-3 py-1.5 rounded transition border border-amber-700"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
        {message && (
          <div className="p-4 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg text-xs">
            {message}
          </div>
        )}

        {/* Live Fleet Overview */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="font-bold text-slate-900 text-base">Live Fleet Tracking & Delayed Visibility</h2>
              <p className="text-xs text-slate-500">Active trip monitoring with driver GPS ingestion and parental delay protections.</p>
            </div>
            <button
              onClick={loadTransportData}
              className="text-xs bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded shadow-sm font-medium"
            >
              Refresh Fleet Status
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
              <span className="text-xs text-slate-500 font-medium">Total Registered Buses</span>
              <p className="text-2xl font-bold text-slate-900 mt-1">{buses.length}</p>
            </div>
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
              <span className="text-xs text-slate-500 font-medium">Configured Routes</span>
              <p className="text-2xl font-bold text-slate-900 mt-1">{routes.length}</p>
            </div>
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
              <span className="text-xs text-slate-500 font-medium">Active Trips on Transit</span>
              <p className="text-2xl font-bold text-amber-600 mt-1">{fleet.filter((f) => f.isLive).length}</p>
            </div>
          </div>

          <div className="mt-4">
            <LiveFleetMap fleet={fleet} routes={routes} height="380px" />
          </div>
        </div>

        {/* Fleet Table */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100 font-semibold text-sm text-slate-800">
            Registered Transport Buses ({buses.length})
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider border-b border-slate-200 font-mono">
                <tr>
                  <th className="py-2.5 px-4">Bus Code</th>
                  <th className="py-2.5 px-4">Registration</th>
                  <th className="py-2.5 px-4">Capacity</th>
                  <th className="py-2.5 px-4">Assigned Driver</th>
                  <th className="py-2.5 px-4">Route</th>
                  <th className="py-2.5 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {buses.map((b) => (
                  <tr key={b.busCode} className="hover:bg-slate-50 transition">
                    <td className="py-2.5 px-4 font-mono font-semibold text-amber-700">{b.busCode}</td>
                    <td className="py-2.5 px-4 font-mono font-medium text-slate-900">{b.registrationNumber}</td>
                    <td className="py-2.5 px-4">{b.capacity} Students</td>
                    <td className="py-2.5 px-4 font-mono text-slate-600">{b.driverCode || 'Unassigned'}</td>
                    <td className="py-2.5 px-4 font-mono text-slate-600">{b.routeCode || 'Unassigned'}</td>
                    <td className="py-2.5 px-4">
                      <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-medium text-[11px]">
                        {b.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
      <FreeLlmAssistant />
    </div>
  );
}
