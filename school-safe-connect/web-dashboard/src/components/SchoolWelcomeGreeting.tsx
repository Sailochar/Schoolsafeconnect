'use client';

import React, { useEffect, useState } from 'react';

interface SchoolWelcomeGreetingProps {
  schoolName: string;
  userName?: string;
  role?: string;
  durationMs?: number;
  onDismiss?: () => void;
}

export default function SchoolWelcomeGreeting({
  schoolName,
  userName,
  role = 'Administrator',
  durationMs = 3500,
  onDismiss
}: SchoolWelcomeGreetingProps) {
  const [visible, setVisible] = useState(true);
  const [animatingOut, setAnimatingOut] = useState(false);

  useEffect(() => {
    // Start fade-out slightly before durationMs
    const fadeTimer = setTimeout(() => {
      setAnimatingOut(true);
    }, Math.max(1200, durationMs - 400));

    const removeTimer = setTimeout(() => {
      setVisible(false);
      onDismiss?.();
    }, durationMs);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, [durationMs, onDismiss]);

  const handleDismiss = () => {
    setAnimatingOut(true);
    setTimeout(() => {
      setVisible(false);
      onDismiss?.();
    }, 200);
  };

  if (!visible) return null;

  const roleLabel = role.replace(/_/g, ' ');
  const displaySchoolName = schoolName && schoolName.trim() && !schoolName.startsWith('SSC-SCH-')
    ? schoolName
    : 'Vijay High school';

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-md transition-opacity duration-300 ${
        animatingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      onClick={handleDismiss}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`relative w-full max-w-lg bg-gradient-to-b from-slate-900 via-slate-900 to-[#0A0F1D] border-2 border-sky-500/40 rounded-3xl p-8 sm:p-10 shadow-2xl text-center text-white transform transition-all duration-300 ${
          animatingOut ? 'scale-95 translate-y-4' : 'scale-100 translate-y-0'
        }`}
      >
        {/* Close Button */}
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-2 rounded-full hover:bg-white/10 transition text-sm leading-none"
          title="Close dialog"
        >
          ✕
        </button>

        {/* School Logo Emblem */}
        <div className="flex justify-center mb-5">
          <div className="relative">
            <div className="h-24 w-24 rounded-2xl bg-white/10 p-2.5 flex items-center justify-center ring-2 ring-sky-400/50 shadow-2xl shadow-sky-500/30 backdrop-blur-sm">
              <img
                src="/logo.png?v=3"
                alt="School Safe Connect"
                className="h-full w-full object-contain rounded-xl"
              />
            </div>
            <span className="absolute -top-1 -right-1 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 ring-2 ring-slate-900" />
            </span>
          </div>
        </div>

        {/* Portal Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-sky-500/15 border border-sky-400/30 text-sky-300 text-xs font-bold uppercase tracking-wider mb-3">
          <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
          Verified School Portal • 2026 Academic Session
        </div>

        {/* Welcome Heading with School Name */}
        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
          Welcome to{' '}
          <span className="bg-gradient-to-r from-sky-400 via-teal-300 to-indigo-300 bg-clip-text text-transparent">
            {displaySchoolName}
          </span>
        </h2>

        {/* Greetings to user with user name */}
        <div className="mt-3 text-slate-300">
          <p className="text-base sm:text-lg font-medium">
            Hello, <span className="font-bold text-white">{userName || 'Administrator'}</span>!
          </p>
          <p className="text-xs text-sky-300/90 mt-1 uppercase tracking-wide font-semibold">
            {roleLabel}
          </p>
        </div>

        {/* Quick action button */}
        <div className="mt-8">
          <button
            onClick={handleDismiss}
            className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 text-white font-bold text-sm shadow-xl shadow-sky-600/30 hover:shadow-sky-600/40 transition-all active:scale-[0.98]"
          >
            Enter School Console →
          </button>
        </div>

        {/* 3.5s Countdown progress bar */}
        <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-slate-800/80 rounded-b-3xl overflow-hidden">
          <div
            className="bg-gradient-to-r from-sky-400 via-emerald-400 to-indigo-400 h-full transition-all linear"
            style={{
              animation: `shrinkWidth ${durationMs}ms linear forwards`
            }}
          />
        </div>
      </div>

      <style jsx>{`
        @keyframes shrinkWidth {
          from {
            width: 100%;
          }
          to {
            width: 0%;
          }
        }
      `}</style>
    </div>
  );
}
