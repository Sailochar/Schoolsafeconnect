'use client';

import React, { useEffect, useRef, useState } from 'react';

export interface RouteStopPoint {
  stopId?: string;
  stopCode?: string;
  stopName: string;
  sequenceOrder: number;
  scheduledPickupTime?: string;
  scheduledDropTime?: string;
  coordinates: [number, number]; // [lng, lat]
}

export interface RouteData {
  routeCode: string;
  routeName: string;
  startLocation?: { name: string; coordinates: [number, number] };
  endLocation?: { name: string; coordinates: [number, number] };
  stops?: RouteStopPoint[];
  busCode?: string;
  driverCode?: string;
  status?: string;
}

export interface FleetItem {
  bus: {
    busCode: string;
    registrationNumber: string;
    busNumber?: string;
    capacity?: number;
    driverCode?: string;
    routeCode?: string;
    status?: string;
  };
  driver?: { userCode: string; fullName: string; phone?: string } | null;
  route?: RouteData | null;
  trip?: { tripId: string; status: string; tripType?: string; startedAt?: string; delayedByMinutes?: number; delayReason?: string } | null;
  isLive: boolean;
  status: string;
  trail?: [number, number][];
  location?: {
    latitude: number;
    longitude: number;
    speedKmph?: number;
    accuracyMeters?: number;
    recordedAt?: string | null;
  };
}

interface LiveFleetMapProps {
  fleet?: FleetItem[];
  routes?: RouteData[];
  selectedBusCode?: string | null;
  selectedRouteCode?: string | null;
  height?: string;
  pickerMode?: boolean;
  pickerPin?: { lat: number; lng: number; label?: string } | null;
  onMapClick?: (lat: number, lng: number) => void;
}

declare global {
  interface Window {
    L: any;
  }
}

let leafletPromise: Promise<any> | null = null;

function loadLeaflet(): Promise<any> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (window.L) return Promise.resolve(window.L);
  if (leafletPromise) return leafletPromise;

  leafletPromise = new Promise((resolve, reject) => {
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    const script = document.createElement('script');
    script.id = 'leaflet-js';
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.async = true;
    script.onload = () => resolve(window.L);
    script.onerror = (err) => reject(err);
    document.head.appendChild(script);
  });

  return leafletPromise;
}

export default function LiveFleetMap({
  fleet = [],
  routes = [],
  selectedBusCode = null,
  selectedRouteCode = null,
  height = '420px',
  pickerMode = false,
  pickerPin = null,
  onMapClick,
}: LiveFleetMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const layerGroupRef = useRef<any>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  // Stop auto-shifting on zoom/pan! Only follow if user explicitly enables Fix/Lock.
  const [autoLockOnBus, setAutoLockOnBus] = useState(false);
  const [myLocation, setMyLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locatingMe, setLocatingMe] = useState(false);

  const hasInitialFittedRef = useRef(false);
  const lastSelectionRef = useRef<string>('');
  const latestBoundsRef = useRef<[number, number][]>([]);

  useEffect(() => {
    let mounted = true;
    loadLeaflet()
      .then((L) => {
        if (!mounted || !containerRef.current || !L) return;
        if (mapRef.current) return;

        const map = L.map(containerRef.current, {
          center: [17.385044, 78.486671],
          zoom: 12,
          zoomControl: true,
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors',
          maxZoom: 19,
        }).addTo(map);

        layerGroupRef.current = L.layerGroup().addTo(map);
        mapRef.current = map;

        map.on('click', (e: any) => {
          if (onMapClick) {
            onMapClick(Number(e.latlng.lat.toFixed(6)), Number(e.latlng.lng.toFixed(6)));
          }
        });

        // If user manually drags or zooms, release auto-lock so map never fights the user!
        map.on('dragstart', () => {
          setAutoLockOnBus(false);
        });

        setMapReady(true);
        setTimeout(() => map.invalidateSize(), 250);
      })
      .catch(() => {
        if (mounted) setMapError('Map tiles failed to load. Check internet connection.');
      });

    return () => {
      mounted = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        layerGroupRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.off('click');
    map.on('click', (e: any) => {
      if (onMapClick) {
        onMapClick(Number(e.latlng.lat.toFixed(6)), Number(e.latlng.lng.toFixed(6)));
      }
    });
  }, [onMapClick]);

  // Draw routes, stops, GPS trails, live bus markers, and current person marker
  useEffect(() => {
    const L = window.L;
    const map = mapRef.current;
    const group = layerGroupRef.current;
    if (!mapReady || !L || !map || !group) return;

    group.clearLayers();
    const boundsPoints: [number, number][] = [];
    let primaryBusPoint: [number, number] | null = null;

    // 1. Render Routes & Stops
    const routeList = routes.length > 0 ? routes : (fleet.map((f) => f.route).filter(Boolean) as RouteData[]);
    const seenRoutes = new Set<string>();
    const routeColors = ['#0284c7', '#059669', '#7c3aed', '#d97706', '#e11d48'];

    routeList.forEach((route, rIdx) => {
      if (!route || seenRoutes.has(route.routeCode)) return;
      seenRoutes.add(route.routeCode);
      if (selectedRouteCode && route.routeCode !== selectedRouteCode) return;

      const color = routeColors[rIdx % routeColors.length];
      const waypoints: [number, number][] = [];

      if (route.startLocation?.coordinates?.length === 2) {
        const pt: [number, number] = [route.startLocation.coordinates[1], route.startLocation.coordinates[0]];
        waypoints.push(pt);
        boundsPoints.push(pt);

        const startIcon = L.divIcon({
          className: 'ssc-start-pin',
          html: `<div style="background:#16a34a;color:#fff;font-size:10px;font-weight:700;padding:2px 6px;border-radius:12px;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);white-space:nowrap;">START</div>`,
          iconSize: [48, 22],
          iconAnchor: [24, 11],
        });
        L.marker(pt, { icon: startIcon })
          .bindPopup(`<b>Start Place:</b> ${route.startLocation.name}<br/><b>Route:</b> ${route.routeName} (${route.routeCode})`)
          .addTo(group);
      }

      const sortedStops = [...(route.stops || [])].sort((a, b) => (a.sequenceOrder || 0) - (b.sequenceOrder || 0));
      sortedStops.forEach((stop, sIdx) => {
        if (stop.coordinates?.length === 2) {
          const pt: [number, number] = [stop.coordinates[1], stop.coordinates[0]];
          waypoints.push(pt);
          boundsPoints.push(pt);

          const stopIcon = L.divIcon({
            className: 'ssc-stop-pin',
            html: `<div style="background:#ffffff;color:${color};font-size:10px;font-weight:800;width:22px;height:22px;border-radius:9999px;border:2.5px solid ${color};display:flex;align-items:center;justify-content:center;box-shadow:0 2px 5px rgba(0,0,0,0.25);">${stop.sequenceOrder || sIdx + 1}</div>`,
            iconSize: [22, 22],
            iconAnchor: [11, 11],
          });
          L.marker(pt, { icon: stopIcon })
            .bindPopup(
              `<b>Stop #${stop.sequenceOrder || sIdx + 1}: ${stop.stopName}</b><br/>` +
              `Pickup: ${stop.scheduledPickupTime || '-'} | Drop: ${stop.scheduledDropTime || '-'}<br/>` +
              `Route: ${route.routeName}`
            )
            .addTo(group);
        }
      });

      if (route.endLocation?.coordinates?.length === 2) {
        const pt: [number, number] = [route.endLocation.coordinates[1], route.endLocation.coordinates[0]];
        waypoints.push(pt);
        boundsPoints.push(pt);

        const endIcon = L.divIcon({
          className: 'ssc-end-pin',
          html: `<div style="background:#0f172a;color:#fff;font-size:10px;font-weight:700;padding:2px 6px;border-radius:12px;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);white-space:nowrap;">SCHOOL</div>`,
          iconSize: [54, 22],
          iconAnchor: [27, 11],
        });
        L.marker(pt, { icon: endIcon })
          .bindPopup(`<b>Destination:</b> ${route.endLocation.name}<br/><b>Route:</b> ${route.routeName}`)
          .addTo(group);
      }

      if (waypoints.length >= 2) {
        L.polyline(waypoints, { color, weight: 4, opacity: 0.85, dashArray: '8, 6' }).addTo(group);
      }
    });

    // 2. Render Live Buses & GPS Trails
    fleet.forEach((item) => {
      if (selectedBusCode && item.bus.busCode !== selectedBusCode) return;

      if (item.trail && item.trail.length >= 2) {
        L.polyline(item.trail, { color: '#2563eb', weight: 4, opacity: 0.9 }).addTo(group);
      }

      if (item.location?.latitude && item.location?.longitude) {
        const pt: [number, number] = [item.location.latitude, item.location.longitude];
        boundsPoints.push(pt);
        if (!primaryBusPoint || item.isLive) primaryBusPoint = pt;

        const bg = item.isLive ? (item.status === 'DELAYED' ? '#dc2626' : '#2563eb') : '#64748b';

        const busIcon = L.divIcon({
          className: 'ssc-bus-marker',
          html: `
            <div style="display:flex;flex-direction:column;align-items:center;">
              <div style="background:${bg};color:#fff;font-size:10px;font-weight:700;padding:3px 7px;border-radius:9999px;border:2px solid #fff;box-shadow:0 3px 10px rgba(0,0,0,0.35);white-space:nowrap;">
                🚌 ${item.bus.registrationNumber} ${item.isLive ? '● LIVE' : ''}
              </div>
              <div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:6px solid ${bg};margin-top:-1px;"></div>
            </div>`,
          iconSize: [120, 30],
          iconAnchor: [60, 28],
        });

        const popupHtml = `
          <div style="font-size:12px;line-height:1.5;">
            <div style="font-weight:700;color:#0f172a;">${item.bus.busCode} (${item.bus.registrationNumber})</div>
            <div>Status: <b style="color:${bg};">${item.status}</b></div>
            <div>Driver GPS: ${item.driver?.fullName || item.bus.driverCode || 'Unassigned'}</div>
            <div>Route: ${item.route?.routeName || item.bus.routeCode || 'Unassigned'}</div>
            <div>Speed: <b>${item.location.speedKmph ?? 0} km/h</b></div>
            <div style="font-family:monospace;font-size:11px;color:#475569;">
              GPS: ${item.location.latitude.toFixed(5)}, ${item.location.longitude.toFixed(5)}
            </div>
            ${item.location.recordedAt ? `<div style="font-size:10px;color:#64748b;">Updated: ${new Date(item.location.recordedAt).toLocaleTimeString()}</div>` : ''}
          </div>
        `;

        L.marker(pt, { icon: busIcon, zIndexOffset: 1000 }).bindPopup(popupHtml).addTo(group);
      }
    });

    // 3. Render Current Logged-in Person Location Pin
    if (myLocation) {
      const myPt: [number, number] = [myLocation.lat, myLocation.lng];
      const meIcon = L.divIcon({
        className: 'ssc-person-marker',
        html: `<div style="background:#7c3aed;color:#fff;font-size:10px;font-weight:700;padding:3px 8px;border-radius:9999px;border:2px solid #fff;box-shadow:0 3px 8px rgba(124,58,237,0.45);white-space:nowrap;">📍 My Location</div>`,
        iconSize: [96, 24],
        iconAnchor: [48, 12],
      });
      L.marker(myPt, { icon: meIcon, zIndexOffset: 1100 })
        .bindPopup(`<b>Current User Location</b><br/>${myLocation.lat.toFixed(5)}, ${myLocation.lng.toFixed(5)}`)
        .addTo(group);
    }

    // 4. Picker Pin
    if (pickerPin && !Number.isNaN(pickerPin.lat) && !Number.isNaN(pickerPin.lng)) {
      const pt: [number, number] = [pickerPin.lat, pickerPin.lng];
      boundsPoints.push(pt);
      const pinIcon = L.divIcon({
        className: 'ssc-picker-pin',
        html: `<div style="background:#ea580c;color:#fff;font-size:10px;font-weight:700;padding:3px 7px;border-radius:12px;border:2px solid #fff;box-shadow:0 3px 8px rgba(0,0,0,0.35);white-space:nowrap;">📍 ${pickerPin.label || 'Selected Place'}</div>`,
        iconSize: [110, 24],
        iconAnchor: [55, 12],
      });
      L.marker(pt, { icon: pinIcon, zIndexOffset: 1200 }).addTo(group);
    }

    latestBoundsRef.current = boundsPoints;

    // Fit map ONLY on very first data load OR when user explicitly changes selected bus/route filter OR enables Auto-Lock!
    const selectionKey = `${selectedBusCode || ''}|${selectedRouteCode || ''}`;
    const selectionChanged = selectionKey !== lastSelectionRef.current;
    lastSelectionRef.current = selectionKey;

    if (autoLockOnBus && primaryBusPoint) {
      map.panTo(primaryBusPoint, { animate: true });
    } else if (boundsPoints.length > 0 && (!hasInitialFittedRef.current || selectionChanged)) {
      if (boundsPoints.length === 1) {
        map.setView(boundsPoints[0], 14);
      } else {
        map.fitBounds(boundsPoints, { padding: [36, 36], maxZoom: 15 });
      }
      hasInitialFittedRef.current = true;
    }
  }, [mapReady, fleet, routes, selectedBusCode, selectedRouteCode, pickerPin, myLocation, autoLockOnBus]);

  const handleCenterOnBus = () => {
    const map = mapRef.current;
    if (!map) return;
    const target = fleet.find((f) => (selectedBusCode ? f.bus.busCode === selectedBusCode : f.isLive)) || fleet[0];
    if (target?.location?.latitude && target?.location?.longitude) {
      map.setView([target.location.latitude, target.location.longitude], 15, { animate: true });
    }
  };

  const handleFindMyLocation = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    setLocatingMe(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        setMyLocation({ lat, lng });
        setAutoLockOnBus(false);
        if (mapRef.current) {
          mapRef.current.setView([lat, lng], 15, { animate: true });
        }
        setLocatingMe(false);
      },
      () => {
        setLocatingMe(false);
        alert('Could not access browser location. Please allow Location permission.');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleFitAll = () => {
    const map = mapRef.current;
    const pts = latestBoundsRef.current;
    if (!map || pts.length === 0) return;
    setAutoLockOnBus(false);
    if (pts.length === 1) {
      map.setView(pts[0], 14, { animate: true });
    } else {
      map.fitBounds(pts, { padding: [36, 36], maxZoom: 15 });
    }
  };

  if (mapError) {
    return (
      <div className="w-full rounded-xl border border-slate-200 bg-slate-100 flex items-center justify-center text-xs text-slate-600 p-6" style={{ height }}>
        {mapError}
      </div>
    );
  }

  return (
    <div className="relative w-full rounded-xl overflow-hidden border border-slate-200 shadow-xs" style={{ height }}>
      <div ref={containerRef} className="w-full h-full z-0" />

      {/* Map Interactive Controls (Bus Location, Current Person Location, Fix/Unfix Auto-Follow, Fit Route) */}
      {!pickerMode && (
        <div className="absolute top-2.5 right-2.5 z-[400] flex flex-wrap gap-1.5 justify-end">
          <button
            type="button"
            onClick={handleCenterOnBus}
            className="bg-white/95 hover:bg-sky-50 text-sky-800 border border-sky-200 px-2.5 py-1.5 rounded-lg text-[11px] font-bold shadow-sm transition"
            title="Center map on bus current location"
          >
            🚌 Bus Location
          </button>
          <button
            type="button"
            onClick={handleFindMyLocation}
            disabled={locatingMe}
            className="bg-white/95 hover:bg-violet-50 text-violet-800 border border-violet-200 px-2.5 py-1.5 rounded-lg text-[11px] font-bold shadow-sm transition"
            title="Find currently logged-in user's location"
          >
            {locatingMe ? 'Locating...' : '📍 My Location'}
          </button>
          <button
            type="button"
            onClick={() => setAutoLockOnBus((prev) => !prev)}
            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold shadow-sm border transition ${
              autoLockOnBus
                ? 'bg-emerald-600 text-white border-emerald-700'
                : 'bg-white/95 text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
            title="Toggle automatic camera follow on bus"
          >
            {autoLockOnBus ? '🔒 Fixed on Bus' : '🔓 Free Zoom/Pan'}
          </button>
          <button
            type="button"
            onClick={handleFitAll}
            className="bg-white/95 hover:bg-slate-50 text-slate-700 border border-slate-300 px-2 py-1.5 rounded-lg text-[11px] font-semibold shadow-sm transition"
            title="Fit route & markers in view"
          >
            ⊞ Fit All
          </button>
        </div>
      )}

      {pickerMode && (
        <div className="absolute top-2 left-12 z-[400] bg-white/95 backdrop-blur-xs border border-amber-300 text-amber-900 px-3 py-1 rounded-full text-[11px] font-semibold shadow-sm pointer-events-none">
          Click anywhere on the map to pin GPS coordinates (Free zoom &amp; pan enabled)
        </div>
      )}
    </div>
  );
}
