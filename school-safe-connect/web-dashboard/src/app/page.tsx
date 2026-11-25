'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck,
  Video,
  Bus,
  BookOpen,
  Users,
  Bell,
  Lock,
  CheckCircle2,
  ArrowRight,
  MapPin,
  Clock,
  Sparkles,
  Smartphone,
  FileText,
  AlertTriangle,
  ChevronRight,
  X,
  Key,
  School,
  Sun,
  Moon,
  Eye,
  Sliders,
  Check,
  Award,
  Zap,
  HelpCircle
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { apiClient, setStoredToken } from '../lib/api';
import { GlowButton } from '@/components/unlumen-ui/components/buttons/glow';
import {
  MotionNavigationMenu,
  MotionNavigationMenuList,
  MotionNavigationMenuItem,
  MotionNavigationMenuTrigger,
  MotionNavigationMenuContent,
  MotionNavigationMenuLink,
} from '@/components/unlumen-ui/components/navigation/motion-navigation-menu';

type AuthView = 'LOGIN' | '2FA' | 'FORGOT_PASSWORD' | 'RESET_PASSWORD' | 'SIGNUP_SCHOOL';

export default function MarketingLandingPage() {
  const router = useRouter();

  // Dark / Light Mode State
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Initialize theme from localStorage or system preference
  useEffect(() => {
    const savedTheme = localStorage.getItem('ssc_theme') as 'dark' | 'light' | null;
    const initialTheme = savedTheme || 'dark';
    setTheme(initialTheme);
    if (initialTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('ssc_theme', nextTheme);
    if (nextTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  // Authentication Modal State
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [view, setView] = useState<AuthView>('LOGIN');

  // Login Credentials
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  // 2FA State
  const [tempToken, setTempToken] = useState('');
  const [otp, setOtp] = useState('');
  const [maskedPhone, setMaskedPhone] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');

  // Forgot Password State
  const [resetIdentifier, setResetIdentifier] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [resetOtp, setResetOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // School Signup State
  const [schoolName, setSchoolName] = useState('');
  const [board, setBoard] = useState('CBSE');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [expectedStudents, setExpectedStudents] = useState('500');

  // Administrator Account Credentials for the new school
  const [adminFullName, setAdminFullName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPhone, setAdminPhone] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // School Contact
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Auto-dismiss error & success banners after 4.5 seconds
  useEffect(() => {
    if (!error && !successMsg) return;
    const t = setTimeout(() => {
      setError(null);
      setSuccessMsg(null);
    }, 4500);
    return () => clearTimeout(t);
  }, [error, successMsg]);

  // Prefetch console destinations to eliminate signin redirection delay
  useEffect(() => {
    router.prefetch('/school-admin');
    router.prefetch('/super-admin');
    router.prefetch('/transport');
  }, [router]);

  const openAuthModal = (targetView: AuthView = 'LOGIN') => {
    setView(targetView);
    setError(null);
    setSuccessMsg(null);
    setAuthModalOpen(true);
  };

  // Submit Step 1: Login
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      const res = await apiClient('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          identifier: identifier.trim(),
          password,
          clientType: 'WEB'
        })
      });

      if (res.data?.requires2FA) {
        setTempToken(res.data.tempToken);
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('ssc_temp_token', res.data.tempToken);
        }
        setMaskedPhone(res.data.maskedPhone || '');
        setMaskedEmail(res.data.maskedEmail || '');
        setOtp('');
        setView('2FA');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed. Invalid credentials.');
    } finally {
      setLoading(false);
    }
  };

  // Submit Step 2: 2FA OTP
  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const activeTempToken = tempToken || (typeof window !== 'undefined' ? sessionStorage.getItem('ssc_temp_token') : null) || '';
    const cleanOtp = String(otp || '').trim().replace(/\D/g, '');

    if (!activeTempToken) {
      setError('2FA verification session expired. Please enter your credentials again.');
      setView('LOGIN');
      setLoading(false);
      return;
    }

    if (cleanOtp.length !== 6) {
      setError('Please enter a valid 6-digit verification code.');
      setLoading(false);
      return;
    }

    try {
      const res = await apiClient('/auth/verify-2fa', {
        method: 'POST',
        body: JSON.stringify({
          tempToken: activeTempToken,
          otp: cleanOtp,
          clientType: 'WEB'
        })
      });

      const { accessToken, refreshToken, user } = res.data;
      setStoredToken(accessToken, refreshToken, user);
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('ssc_temp_token');
      }
      setAuthModalOpen(false); // Close auth modal immediately

      // Route according to user role
      if (user.role === 'GLOBAL_SUPER_ADMIN' || user.role === 'SUPER_ADMIN') {
        router.push('/super-admin');
      } else if (user.role === 'SCHOOL_ADMIN') {
        router.push('/school-admin');
      } else if (user.role === 'TRANSPORT_COORDINATOR' || user.role === 'TRANSPORT_MANAGER') {
        router.push('/transport');
      } else {
        setError('Notice: Mobile app users (Teachers, Parents, Drivers) should access the mobile application at http://localhost:8080.');
      }
    } catch (err: any) {
      setError(err.message || '2FA verification failed.');
    } finally {
      setLoading(false);
    }
  };

  // Submit Forgot Password: Request OTP
  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await apiClient('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ identifier: resetIdentifier })
      });

      setResetToken(res.data?.resetToken || '');
      setMaskedPhone(res.data?.maskedPhone || '');
      setMaskedEmail(res.data?.maskedEmail || '');
      setSuccessMsg(res.message || 'Password reset OTP dispatched.');
      setView('RESET_PASSWORD');
    } catch (err: any) {
      setError(err.message || 'Failed to dispatch reset instructions.');
    } finally {
      setLoading(false);
    }
  };

  // Submit Reset Password with OTP & New Password
  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters long.');
      return;
    }

    setLoading(true);

    try {
      const res = await apiClient('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({
          resetToken,
          otp: resetOtp,
          newPassword
        })
      });

      setSuccessMsg(res.message || 'Password reset successful. Please sign in with your new password.');
      setView('LOGIN');
      setPassword('');
      setResetOtp('');
    } catch (err: any) {
      setError(err.message || 'Password reset failed.');
    } finally {
      setLoading(false);
    }
  };

  // Submit Onboarding Registration Application
  const handleSchoolSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (adminPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (adminPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setLoading(true);

    try {
      const payload = {
        schoolName,
        board,
        address: { street, city, state, postalCode, country: 'India' },
        contactPerson: { name: contactName || adminFullName, phone: contactPhone || adminPhone, email: contactEmail || adminEmail },
        expectedStudents: parseInt(expectedStudents, 10) || 500,
        proposedAdminDetails: {
          fullName: adminFullName,
          email: adminEmail,
          phone: adminPhone,
          password: adminPassword
        },
        documents: [
          {
            title: 'School Affiliation Documentation',
            fileUrl: 'https://schoolsafeconnect.internal/docs/affiliation-verification.pdf'
          }
        ]
      };

      const res = await apiClient('/onboarding/apply', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      setSuccessMsg(
        `Application submitted successfully! Tracking Request ID: ${res.data?.requestId}. Once approved by the Global Super Admin, your school tenant will be active.`
      );
      setView('LOGIN');
      setIdentifier(adminEmail);
      setPassword(adminPassword);
    } catch (err: any) {
      setError(err.message || 'School registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B0F19] text-slate-800 dark:text-slate-100 transition-colors duration-300 flex flex-col selection:bg-sky-500 selection:text-white">
      
      {/* ===================== TOP NAVIGATION BAR ===================== */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-[#0B0F19]/80 backdrop-blur-xl transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
          
          {/* Logo & Brand Identity */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="h-10 w-10 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-1 flex items-center justify-center shadow-sm">
              <img src="/logo.png?v=2" alt="School Safe Connect" className="h-full w-full object-contain rounded-lg" />
            </div>
            <div>
              <span className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                School Safe Connect
              </span>
              <span className="hidden sm:block text-[10px] uppercase font-bold tracking-widest text-sky-600 dark:text-sky-400">
                School Safety & Telematics OS
              </span>
            </div>
          </div>

          {/* Motion Navigation Menu (Explaining Key Feature Categories) */}
          <div className="hidden lg:flex items-center justify-center">
            <MotionNavigationMenu className="text-slate-700 dark:text-slate-200">
              <MotionNavigationMenuList>
                
                {/* 1. AI OMR & Assessments */}
                <MotionNavigationMenuItem value="assessments">
                  <MotionNavigationMenuTrigger className="text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white data-[state=open]:text-indigo-600 dark:data-[state=open]:text-indigo-400 font-medium text-sm">
                    AI OMR & Assessments
                  </MotionNavigationMenuTrigger>
                  <MotionNavigationMenuContent className="w-[420px] bg-white/95 dark:bg-slate-900/95 border-slate-200 dark:border-slate-800 shadow-2xl p-4 rounded-2xl backdrop-blur-2xl">
                    <div className="grid gap-2">
                      <MotionNavigationMenuLink href="#omr-features" className="hover:bg-slate-100 dark:hover:bg-slate-800/70 rounded-xl p-3 transition-all">
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                            <Sparkles className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="font-semibold text-sm text-slate-900 dark:text-slate-100">AI OMR Sheet Correction</div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                              Optical recognition corrects student OMR PDFs and grades them against master answer keys.
                            </p>
                          </div>
                        </div>
                      </MotionNavigationMenuLink>

                      <MotionNavigationMenuLink href="#omr-features" className="hover:bg-slate-100 dark:hover:bg-slate-800/70 rounded-xl p-3 transition-all">
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                            <FileText className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="font-semibold text-sm text-slate-900 dark:text-slate-100">Digital Report Cards & WhatsApp</div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                              Auto-generates FA-1, FA-2, SA-1 report cards, class Excel exports, and WhatsApp results.
                            </p>
                          </div>
                        </div>
                      </MotionNavigationMenuLink>
                    </div>
                  </MotionNavigationMenuContent>
                </MotionNavigationMenuItem>

                {/* 2. Fleet & GPS */}
                <MotionNavigationMenuItem value="fleet">
                  <MotionNavigationMenuTrigger className="text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white data-[state=open]:text-emerald-600 dark:data-[state=open]:text-emerald-400 font-medium text-sm">
                    Fleet Telematics
                  </MotionNavigationMenuTrigger>
                  <MotionNavigationMenuContent className="w-[420px] bg-white/95 dark:bg-slate-900/95 border-slate-200 dark:border-slate-800 shadow-2xl p-4 rounded-2xl backdrop-blur-2xl">
                    <div className="grid gap-2">
                      <MotionNavigationMenuLink href="#fleet-features" className="hover:bg-slate-100 dark:hover:bg-slate-800/70 rounded-xl p-3 transition-all">
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                            <Bus className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="font-semibold text-sm text-slate-900 dark:text-slate-100">Driver Phone as GPS Beacon</div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                              No expensive vehicle hardware or extra SIMs. Driver’s mobile portal streams high-precision telemetry.
                            </p>
                          </div>
                        </div>
                      </MotionNavigationMenuLink>

                      <MotionNavigationMenuLink href="#fleet-features" className="hover:bg-slate-100 dark:hover:bg-slate-800/70 rounded-xl p-3 transition-all">
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                            <MapPin className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="font-semibold text-sm text-slate-900 dark:text-slate-100">Live Routes & Anti-Drift Maps</div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                              Maintains map orientation on zoom with landmark stop geocoding and automated ETA notifications.
                            </p>
                          </div>
                        </div>
                      </MotionNavigationMenuLink>
                    </div>
                  </MotionNavigationMenuContent>
                </MotionNavigationMenuItem>

                {/* 3. Academics & Notices */}
                <MotionNavigationMenuItem value="academics">
                  <MotionNavigationMenuTrigger className="text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white data-[state=open]:text-indigo-600 dark:data-[state=open]:text-indigo-400 font-medium text-sm">
                    Academic Notices
                  </MotionNavigationMenuTrigger>
                  <MotionNavigationMenuContent className="w-[420px] bg-white/95 dark:bg-slate-900/95 border-slate-200 dark:border-slate-800 shadow-2xl p-4 rounded-2xl backdrop-blur-2xl">
                    <div className="grid gap-2">
                      <MotionNavigationMenuLink href="#academic-features" className="hover:bg-slate-100 dark:hover:bg-slate-800/70 rounded-xl p-3 transition-all">
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                            <Bell className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="font-semibold text-sm text-slate-900 dark:text-slate-100">Exam Schedules & Syllabus Portions</div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                              Direct notifications to parents with exam dates, timings, portion outlines, and max marks.
                            </p>
                          </div>
                        </div>
                      </MotionNavigationMenuLink>

                      <MotionNavigationMenuLink href="#academic-features" className="hover:bg-slate-100 dark:hover:bg-slate-800/70 rounded-xl p-3 transition-all">
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                            <FileText className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="font-semibold text-sm text-slate-900 dark:text-slate-100">Multi-Format Assignments</div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                              Supports PDF documents, Word .docx files, and text worksheets with 1-query/day parent questions.
                            </p>
                          </div>
                        </div>
                      </MotionNavigationMenuLink>
                    </div>
                  </MotionNavigationMenuContent>
                </MotionNavigationMenuItem>

              </MotionNavigationMenuList>
            </MotionNavigationMenu>
          </div>

          {/* Action Buttons: Theme Switch, Sign In & Required GlowButton */}
          <div className="flex items-center gap-3">
            
            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="p-2.5 rounded-xl border border-slate-300 dark:border-slate-700/80 bg-white dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
              aria-label="Toggle Theme"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-slate-700" />
              )}
            </button>

            <button
              onClick={() => openAuthModal('LOGIN')}
              className="hidden sm:inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/80 rounded-xl transition border border-slate-300 dark:border-slate-700/60"
            >
              Sign In
            </button>

            {/* Glowing Get Started Button */}
            <GlowButton
              colors={["#FF5733", "#33FF57", "#3357FF", "#F1C40F"]}
              onClick={() => openAuthModal('SIGNUP_SCHOOL')}
            >
              Get Started
            </GlowButton>
          </div>
        </div>
      </header>

      {/* ===================== HERO SECTION ===================== */}
      <section className="relative overflow-hidden pt-16 pb-20 lg:pt-24 lg:pb-28">
        
        {/* Subtle Ambient Radial Glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[320px] bg-sky-500/10 dark:bg-sky-500/10 blur-[130px] pointer-events-none rounded-full" />
        <div className="absolute top-1/3 left-1/4 w-[400px] h-[300px] bg-indigo-500/10 dark:bg-indigo-500/10 blur-[120px] pointer-events-none rounded-full" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-3xl mx-auto">
            
            {/* Elegant Sub-Tag */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-sky-100 dark:bg-sky-500/10 border border-sky-300 dark:border-sky-500/20 text-sky-700 dark:text-sky-300 text-xs font-semibold mb-6 shadow-sm"
            >
              <Sparkles className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
              <span>Zero-Trust Architecture for Modern Schools</span>
            </motion.div>

            {/* Hero Main Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-[1.18]"
            >
              Campus Safety, Live Telematics & Academic Clarity
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="mt-6 text-lg sm:text-xl text-slate-600 dark:text-slate-300 leading-relaxed font-normal"
            >
              School Safe Connect combines AI-powered OMR sheet optical correction, continuous exam evaluations (FA & SA), official WhatsApp parent notifications, and driver smartphone GPS tracking into one unified platform.
            </motion.p>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="mt-10 flex flex-wrap items-center justify-center gap-4"
            >
              <GlowButton
                colors={["#FF5733", "#33FF57", "#3357FF", "#F1C40F"]}
                onClick={() => openAuthModal('SIGNUP_SCHOOL')}
                className="px-8 py-3.5 text-base sm:text-lg font-bold"
              >
                Register Your School <ArrowRight className="w-5 h-5 ml-1 inline" />
              </GlowButton>

              <button
                onClick={() => openAuthModal('LOGIN')}
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-white dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700/80 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-white font-semibold text-base transition duration-200 shadow-sm"
              >
                <Lock className="w-4 h-4 text-sky-600 dark:text-sky-400" /> Administrative Sign In
              </button>
            </motion.div>

          </div>

          {/* Core Pillars Feature Overview Strip */}
          <div className="mt-16 grid grid-cols-1 md:grid-cols-4 gap-4">
            
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-3">
                <Sparkles className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">AI OMR Sheet Correction</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                Automated bubble detection, student matching, instant grading, class ranking, and downloadable Excel sheets.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3">
                <Bus className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">Driver GPS Telematics</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                Driver smartphone acts as the live GPS beacon. Real-time stop sequences and anti-drift map focus.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-3">
                <Bell className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">Exam & Academic Notices</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                Instant exam dates, timings, portion syllabi, max marks, and multi-format assignments (PDF, DOCX, TXT).
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-3">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">Verified Child Custody</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                Enforces strict 1-to-1 verified child-parent linking with mandatory 2-Factor Authentication on every login.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* ===================== FEATURE 1: AI OMR EVALUATION & DIGITAL REPORT CARDS ===================== */}
      <section id="omr-features" className="py-20 border-t border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-950 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="max-w-3xl mb-12">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5 mb-2">
              <Sparkles className="w-4 h-4" /> AI OMR Correction & Academic Hub
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Instant AI OMR Grading & Automated WhatsApp Cards
            </h2>
            <p className="mt-3 text-slate-600 dark:text-slate-300 text-base leading-relaxed">
              Empower school leadership to grade hundreds of student OMR sheets in seconds, export class performance matrices to Excel, update cumulative transcripts, and notify parents on WhatsApp automatically.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <Sparkles className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 dark:text-white text-lg">Optical Bubble Evaluation</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Scan or batch upload student OMR PDF files named directly as <code>&lt;StudentName&gt;.pdf</code>. The optical engine cleans filenames, maps students to class rosters, evaluates marked bubbles against the master answer key, and computes scores with optional negative marking.
              </p>
              <div className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 pt-2 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> High-Accuracy Bubble Scoring
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <FileText className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 dark:text-white text-lg">Excel (.xlsx) Export & Transcripts</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Generate 1-click administrative Excel workbooks containing individual student itemized breakdowns, scores, percentages, and class summary stats (mean score, highest score, pass percentage). Commit grades directly into cumulative Report Cards under FA-1, FA-2, SA-1, or custom exam titles.
              </p>
              <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 pt-2 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> Official Assessment Transcripts
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                <Bell className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 dark:text-white text-lg">Automated WhatsApp Parent Alerts</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Connect your school's WhatsApp Business Gateway to dispatch real-time scorecards directly to parents. Broadcast formatted test results, class ranks, and teacher feedback with zero manual messaging effort.
              </p>
              <div className="text-xs font-semibold text-sky-600 dark:text-sky-400 pt-2 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> Real-Time Parent Engagement
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ===================== FEATURE 2: FLEET TELEMATICS & GPS HUB ===================== */}
      <section id="fleet-features" className="py-20 border-t border-slate-200/80 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-900/40 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="max-w-3xl mb-12">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 mb-2">
              <Bus className="w-4 h-4" /> Fleet & GPS Telematics
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Real-Time Transit Tracking with Zero Extra Hardware
            </h2>
            <p className="mt-3 text-slate-600 dark:text-slate-300 text-base leading-relaxed">
              Transform any bus driver’s smartphone into an enterprise-grade GPS transmitter without paying for expensive vehicle hardware, wiring harnesses, or monthly telematics contracts.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <Smartphone className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 dark:text-white text-lg">Driver Smartphone Console</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Drivers log into their dedicated transit console on their phone to start trips. High-frequency coordinates, speed, and heading are automatically broadcast directly to the school map and enrolled parents.
              </p>
              <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 pt-2 flex items-center gap-1">
                <Check className="w-4 h-4" /> $0 Hardware Installation Cost
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                <Sliders className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 dark:text-white text-lg">Anti-Drift Map Focus</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Prevents map recentering disorientation while zooming or inspecting route paths. Includes an instant "Locate Bus" and "My Current Location" focus button to center the map whenever desired.
              </p>
              <div className="text-xs font-semibold text-sky-600 dark:text-sky-400 pt-2 flex items-center gap-1">
                <Check className="w-4 h-4" /> Smooth OpenStreetMap Experience
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 dark:text-white text-lg">Stops & Emergency SOS</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Sequential pickup and drop stops with automated morning and evening timings. If traffic delays or emergencies occur, drivers broadcast 1-tap alerts instantly to School Admins and parents.
              </p>
              <div className="text-xs font-semibold text-red-600 dark:text-red-400 pt-2 flex items-center gap-1">
                <Check className="w-4 h-4" /> Automated Proximity ETA Alerts
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ===================== FEATURE 3: ACADEMIC NOTICES & MULTI-FORMAT ASSIGNMENTS ===================== */}
      <section id="academic-features" className="py-20 border-t border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-950 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="max-w-3xl mb-12">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5 mb-2">
              <BookOpen className="w-4 h-4" /> Academic Communications
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Structured Exam Notices & Multi-Format Assignments
            </h2>
            <p className="mt-3 text-slate-600 dark:text-slate-300 text-base leading-relaxed">
              Keep parents informed without noisy messaging groups. Direct exam timetables, syllabus portions, and homework in PDF, Word DOC, or text format.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <Bell className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 dark:text-white text-lg">Exam Timetables & Portions</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Teachers publish complete exam notices detailing exam names, dates, subject timing, syllabus portions, and max marks. Active exam notices pin to the top of the parent’s home dashboard.
              </p>
              <div className="text-xs font-semibold text-amber-600 dark:text-amber-400 pt-2 flex items-center gap-1">
                <Check className="w-4 h-4" /> Pinned Home Screen Alerts
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <FileText className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 dark:text-white text-lg">Multi-Format Assignments</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Whether distributing question banks in PDF format, practice sheets in Word (.docx/.doc), or quick text worksheets, parents and students view files directly via the built-in document viewer.
              </p>
              <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 pt-2 flex items-center gap-1">
                <Check className="w-4 h-4" /> PDF, DOCX, DOC & Text Worksheets
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 dark:text-white text-lg">1-Query/Day Communication</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Parents are permitted one focused clarification per day per subject teacher. Teachers provide a single official response, with direct 1-tap escalation to School Admin if a concern remains unresolved.
              </p>
              <div className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 pt-2 flex items-center gap-1">
                <Check className="w-4 h-4" /> Direct Escalation to School Admin
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ===================== FEATURE 4: ROLES & TENANT GOVERNANCE ===================== */}
      <section className="py-20 border-t border-slate-200/80 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-900/40 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="max-w-3xl mb-12">
            <span className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 flex items-center gap-1.5 mb-2">
              <ShieldCheck className="w-4 h-4" /> Multi-Tenant Role Isolation
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Enterprise Role Segregation & Access Controls
            </h2>
            <p className="mt-3 text-slate-600 dark:text-slate-300 text-base leading-relaxed">
              Every request is strictly bounded to the school’s unique tenant identifier with cryptographic role separation and immutable audit logging.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
              <div className="text-xs font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400 mb-1">Role 01</div>
              <h4 className="font-bold text-slate-900 dark:text-white text-base">Super Admin</h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">
                Approves school onboardings, monitors tenant metrics, and oversees global safety compliance.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
              <div className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-1">Role 02</div>
              <h4 className="font-bold text-slate-900 dark:text-white text-base">School Admin</h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">
                Manages classes, user approvals, student-parent custody, AI OMR evaluation, Excel exports, WhatsApp hub, and fleet routing.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
              <div className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mb-1">Role 03</div>
              <h4 className="font-bold text-slate-900 dark:text-white text-base">Teachers</h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">
                Publishes assignments in multiple formats (PDF, DOCX, text), schedules exams, evaluates student performance, and tracks submissions.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
              <div className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-1">Role 04</div>
              <h4 className="font-bold text-slate-900 dark:text-white text-base">Parents</h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">
                Tracks live bus GPS telemetry, views term report cards, receives WhatsApp scorecards, and reviews exam schedules.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
              <div className="text-xs font-bold uppercase tracking-wider text-red-600 dark:text-red-400 mb-1">Role 05</div>
              <h4 className="font-bold text-slate-900 dark:text-white text-base">Drivers</h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">
                Runs the mobile transit console, broadcasts real-time GPS telemetry, and logs route stop completions.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* ===================== CALL TO ACTION ===================== */}
      <section className="py-20 border-t border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-950 transition-colors duration-300">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Ready to Protect Your Campus with School Safe Connect?
          </h2>
          <p className="text-slate-600 dark:text-slate-300 text-base max-w-2xl mx-auto">
            Experience zero-compromise child safety, real-time driver GPS tracking, and transparent parent communications.
          </p>

          <div className="pt-4 flex flex-wrap items-center justify-center gap-4">
            <GlowButton
              colors={["#FF5733", "#33FF57", "#3357FF", "#F1C40F"]}
              onClick={() => openAuthModal('SIGNUP_SCHOOL')}
              className="px-8 py-3.5 text-base sm:text-lg font-bold"
            >
              Get Started
            </GlowButton>

            <button
              onClick={() => openAuthModal('LOGIN')}
              className="px-6 py-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-white font-semibold text-base transition border border-slate-300 dark:border-slate-700"
            >
              Sign In to Admin Portal
            </button>
          </div>
        </div>
      </section>

      {/* ===================== FOOTER ===================== */}
      <footer className="border-t border-slate-200/80 dark:border-slate-800/80 bg-slate-50 dark:bg-[#0B0F19] py-10 text-slate-500 dark:text-slate-400 text-xs transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <img src="/logo.png?v=2" alt="School Safe Connect" className="w-7 h-7 object-contain rounded-lg shadow-sm" />
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              © 2026 School Safe Connect. Zero-Trust Architecture.
            </span>
          </div>

          <div className="flex items-center gap-6">
            <button onClick={() => openAuthModal('LOGIN')} className="hover:text-slate-900 dark:hover:text-white transition">Admin Sign In</button>
            <button onClick={() => openAuthModal('SIGNUP_SCHOOL')} className="hover:text-slate-900 dark:hover:text-white transition">Register School</button>
            <button onClick={() => openAuthModal('FORGOT_PASSWORD')} className="hover:text-slate-900 dark:hover:text-white transition">Forgot Password</button>
          </div>
        </div>
      </footer>

      {/* ===================== AUTHENTICATION & ONBOARDING MODAL ===================== */}
      <AnimatePresence>
        {authModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            {/* Modal Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setAuthModalOpen(false)}
              className="fixed inset-0 bg-slate-950/70 backdrop-blur-md"
            />

            {/* Modal Dialog Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: 'spring', stiffness: 350, damping: 30 }}
              className={cn(
                "relative z-10 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-8 transition-colors duration-300",
                view === 'SIGNUP_SCHOOL' ? 'max-w-2xl' : 'max-w-md'
              )}
            >
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-700 p-6 text-white text-center relative">
                <button
                  type="button"
                  onClick={() => setAuthModalOpen(false)}
                  className="absolute top-4 right-4 text-white/80 hover:text-white p-1.5 rounded-full hover:bg-white/10 transition"
                  title="Close Dialog"
                >
                  <X className="w-5 h-5" />
                </button>

                <div className="flex justify-center mb-2">
                  <div className="h-14 w-14 rounded-2xl bg-white/20 backdrop-blur-md p-1.5 flex items-center justify-center ring-1 ring-white/30 shadow-lg">
                    <img src="/logo.png?v=2" alt="School Safe Connect" className="h-full w-full object-contain rounded-xl" />
                  </div>
                </div>
                <h3 className="text-xl font-bold tracking-tight">School Safe Connect</h3>
                <p className="text-sky-100 text-xs mt-1">
                  {view === 'SIGNUP_SCHOOL'
                    ? 'New School Registration & Admin Setup'
                    : view === 'FORGOT_PASSWORD' || view === 'RESET_PASSWORD'
                    ? 'Account Recovery & Password Reset'
                    : 'Administrative Web Portal'}
                </p>
              </div>

              {/* Modal Content Body */}
              <div className="p-6 sm:p-8 text-slate-800 dark:text-slate-100 max-h-[80vh] overflow-y-auto">
                {error && (
                  <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/80 border-l-4 border-red-500 text-red-700 dark:text-red-200 text-xs rounded-xl flex items-start justify-between gap-2 shadow-sm">
                    <div>
                      <p className="font-bold text-red-600 dark:text-red-400">Error</p>
                      <p className="mt-0.5">{error}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setError(null)}
                      className="text-red-500 dark:text-red-400 hover:text-red-800 dark:hover:text-white font-bold text-base leading-none px-1"
                    >
                      ✕
                    </button>
                  </div>
                )}

                {successMsg && (
                  <div className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-950/80 border-l-4 border-emerald-500 text-emerald-700 dark:text-emerald-200 text-xs rounded-xl flex items-start justify-between gap-2 shadow-sm">
                    <div>
                      <p className="font-bold text-emerald-600 dark:text-emerald-400">Notice</p>
                      <p className="mt-0.5">{successMsg}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSuccessMsg(null)}
                      className="text-emerald-500 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-white font-bold text-base leading-none px-1"
                    >
                      ✕
                    </button>
                  </div>
                )}

                {/* VIEW: LOGIN */}
                {view === 'LOGIN' && (
                  <form onSubmit={handleLoginSubmit} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                        School Admin User ID / Email / Phone
                      </label>
                      <input
                        type="text"
                        required
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        placeholder="e.g. principal@greenwood.edu or SSC-SCH-0001-ADM-001"
                        className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none transition text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                          Password
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setError(null);
                            setView('FORGOT_PASSWORD');
                          }}
                          className="text-xs text-sky-600 dark:text-sky-400 hover:underline"
                        >
                          Forgot Password?
                        </button>
                      </div>
                      <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none transition text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-3.5 px-4 bg-sky-600 hover:bg-sky-500 active:scale-[0.99] text-white font-bold rounded-xl text-sm transition shadow-lg shadow-sky-600/30 disabled:opacity-50 mt-2"
                    >
                      {loading ? 'Authenticating...' : 'Proceed to 2FA Authentication'}
                    </button>

                    <div className="pt-4 border-t border-slate-200 dark:border-slate-800 text-center">
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Are you a school looking to join our safety platform?{' '}
                        <button
                          type="button"
                          onClick={() => {
                            setError(null);
                            setView('SIGNUP_SCHOOL');
                          }}
                          className="text-sky-600 dark:text-sky-400 font-bold hover:underline"
                        >
                          Register New School
                        </button>
                      </p>
                    </div>
                  </form>
                )}

                {/* VIEW: 2FA CHALLENGE */}
                {view === '2FA' && (
                  <form onSubmit={handleOtpSubmit} className="space-y-4">
                    <div className="p-3.5 bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/60 rounded-xl text-xs text-sky-800 dark:text-sky-200">
                      <p className="font-semibold">Two-Factor Authentication Required</p>
                      <p className="mt-1 text-slate-600 dark:text-slate-300">
                        A 6-digit verification code was dispatched to your phone/email:
                      </p>
                      <p className="font-mono text-slate-900 dark:text-white font-bold mt-1">
                        {maskedPhone || maskedEmail || 'Your Registered Device'}
                      </p>
                      <p className="text-[10px] text-sky-600 dark:text-sky-400 mt-1 italic">
                        (Development test OTP: 123456)
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                        Enter 6-Digit OTP
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={6}
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                        placeholder="123456"
                        className="w-full px-4 py-3 text-center tracking-[0.5em] text-xl font-bold rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-sky-500 text-slate-900 dark:text-white outline-none"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loading || otp.length < 6}
                      className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] text-white font-bold rounded-xl text-sm transition shadow-lg shadow-emerald-600/30 disabled:opacity-50"
                    >
                      {loading ? 'Verifying...' : 'Verify OTP & Enter Console'}
                    </button>

                    <button
                      type="button"
                      onClick={() => setView('LOGIN')}
                      className="w-full py-2.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    >
                      ← Back to Login
                    </button>
                  </form>
                )}

                {/* VIEW: FORGOT PASSWORD */}
                {view === 'FORGOT_PASSWORD' && (
                  <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                        Registered User Code / Email / Phone
                      </label>
                      <input
                        type="text"
                        required
                        value={resetIdentifier}
                        onChange={(e) => setResetIdentifier(e.target.value)}
                        placeholder="e.g. principal@greenwood.edu"
                        className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-sky-500 text-sm text-slate-900 dark:text-white outline-none"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-3.5 px-4 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl text-sm transition disabled:opacity-50"
                    >
                      {loading ? 'Sending OTP...' : 'Send Password Reset OTP'}
                    </button>

                    <button
                      type="button"
                      onClick={() => setView('LOGIN')}
                      className="w-full py-2.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    >
                      ← Back to Login
                    </button>
                  </form>
                )}

                {/* VIEW: RESET PASSWORD */}
                {view === 'RESET_PASSWORD' && (
                  <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
                    <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-600 dark:text-slate-300">
                      Enter the OTP sent to <span className="font-mono text-slate-900 dark:text-white font-bold">{maskedPhone || maskedEmail}</span> and set your new password.
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                        6-Digit OTP
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={6}
                        value={resetOtp}
                        onChange={(e) => setResetOtp(e.target.value.replace(/\D/g, ''))}
                        placeholder="123456"
                        className="w-full px-4 py-3 text-center tracking-[0.4em] font-bold text-lg rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                        New Password (Min. 8 characters)
                      </label>
                      <input
                        type="password"
                        required
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white outline-none text-sm"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loading || resetOtp.length < 6}
                      className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-sm transition disabled:opacity-50"
                    >
                      {loading ? 'Updating Password...' : 'Save New Password & Sign In'}
                    </button>
                  </form>
                )}

                {/* VIEW: SIGNUP NEW SCHOOL */}
                {view === 'SIGNUP_SCHOOL' && (
                  <form onSubmit={handleSchoolSignupSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                          School Full Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={schoolName}
                          onChange={(e) => setSchoolName(e.target.value)}
                          placeholder="e.g. Greenwood International High"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                          Education Board *
                        </label>
                        <select
                          value={board}
                          onChange={(e) => setBoard(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white outline-none"
                        >
                          <option value="CBSE">CBSE</option>
                          <option value="ICSE">ICSE</option>
                          <option value="STATE_BOARD">State Board</option>
                          <option value="IB">International Baccalaureate (IB)</option>
                          <option value="CAMBRIDGE">Cambridge IGCSE</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">City *</label>
                        <input
                          type="text"
                          required
                          value={city}
                          onChange={(e) => setCity(e.target.value)}
                          placeholder="e.g. Hyderabad"
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">State *</label>
                        <input
                          type="text"
                          required
                          value={state}
                          onChange={(e) => setState(e.target.value)}
                          placeholder="e.g. Telangana"
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">Postal Code *</label>
                        <input
                          type="text"
                          required
                          value={postalCode}
                          onChange={(e) => setPostalCode(e.target.value)}
                          placeholder="500001"
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white outline-none"
                        />
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                      <span className="text-xs font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400 block mb-2">
                        Proposed School Administrator Details
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">Admin Full Name *</label>
                          <input
                            type="text"
                            required
                            value={adminFullName}
                            onChange={(e) => setAdminFullName(e.target.value)}
                            placeholder="e.g. Dr. K. Raman"
                            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">Admin Email *</label>
                          <input
                            type="email"
                            required
                            value={adminEmail}
                            onChange={(e) => setAdminEmail(e.target.value)}
                            placeholder="principal@greenwood.edu"
                            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white outline-none"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">Password *</label>
                          <input
                            type="password"
                            required
                            value={adminPassword}
                            onChange={(e) => setAdminPassword(e.target.value)}
                            placeholder="Min. 8 characters"
                            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">Confirm Password *</label>
                          <input
                            type="password"
                            required
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Re-enter password"
                            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-3 px-4 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl text-sm transition shadow-lg shadow-sky-600/30 disabled:opacity-50 mt-2"
                    >
                      {loading ? 'Submitting Application...' : 'Submit School Registration'}
                    </button>

                    <div className="text-center pt-2">
                      <button
                        type="button"
                        onClick={() => setView('LOGIN')}
                        className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                      >
                        Already have an account? Sign In
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
