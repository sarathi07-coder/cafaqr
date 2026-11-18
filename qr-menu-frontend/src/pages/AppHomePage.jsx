import React, { useState, useEffect } from 'react';
import {
  UtensilsCrossed,
  Printer,
  ChevronRight,
  Users,
  ChefHat,
  History,
  ShieldCheck,
  Flame,
  CheckCircle2,
  Smartphone,
  Sparkles,
  Share,
  X
} from 'lucide-react';
import WaiterPosPage from './WaiterPosPage';
import { api } from '../api';

const RESTAURANT_ID = 'db4ed920-3d20-420a-9f54-99d3c0b48a08';
const SAVED_SECTION_KEY = 'krish_pos_device_section';

export default function AppHomePage({ initialSection = null }) {
  const [activeSection, setActiveSection] = useState(() => {
    if (initialSection) return initialSection;
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(SAVED_SECTION_KEY);
      if (saved === 'ORDER_ONLY' || saved === 'BILLING_SUITE') return saved;
    }
    return null; // Show Two-Section App Launcher
  });

  const [rememberChoice, setRememberChoice] = useState(() => {
    if (typeof window !== 'undefined') {
      return Boolean(localStorage.getItem(SAVED_SECTION_KEY));
    }
    return false;
  });

  const [liveStatus, setLiveStatus] = useState({ occupiedCount: 0, vacantCount: 16, totalTables: 16 });
  const [showMobileInstallTip, setShowMobileInstallTip] = useState(() => {
    if (typeof window === 'undefined') return false;
    const isNative = Boolean(window.Capacitor?.isNativePlatform?.());
    const isStandalone =
      window.navigator.standalone === true ||
      window.matchMedia?.('(display-mode: standalone)')?.matches;
    const isMobile = /Android|iPhone|iPad|iPod/i.test(window.navigator.userAgent || '');
    const dismissed = localStorage.getItem('krish_app_tip_dismissed') === '1';
    return isMobile && !isNative && !isStandalone && !dismissed;
  });

  useEffect(() => {
    if (initialSection) {
      setActiveSection(initialSection);
    }
  }, [initialSection]);

  useEffect(() => {
    if (activeSection !== null) return;
    let cancelled = false;
    const fetchSummary = async () => {
      try {
        const data = await api.getPosTableStatus(RESTAURANT_ID);
        if (!cancelled && data) {
          setLiveStatus({
            occupiedCount: data.occupiedCount || 0,
            vacantCount: data.vacantCount || 0,
            totalTables: data.totalTables || 16
          });
        }
      } catch {}
    };
    fetchSummary();
    const timer = setInterval(fetchSummary, 15000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [activeSection]);

  const handleSelectSection = (section) => {
    if (rememberChoice) {
      localStorage.setItem(SAVED_SECTION_KEY, section);
    } else {
      localStorage.removeItem(SAVED_SECTION_KEY);
    }
    setActiveSection(section);
  };

  const handleSwitchSection = () => {
    localStorage.removeItem(SAVED_SECTION_KEY);
    setRememberChoice(false);
    setActiveSection(null);
  };

  // Render Section 1 (Order Taking) or Section 2 (Billing & Remaining)
  if (activeSection === 'ORDER_ONLY' || activeSection === 'BILLING_SUITE') {
    return (
      <WaiterPosPage
        appSection={activeSection}
        onSwitchSection={handleSwitchSection}
      />
    );
  }

  // Two-Section App Launcher Home Screen
  return (
    <div className="min-h-screen bg-[#0B0A08] text-stone-100 flex flex-col justify-between font-sans selection:bg-amber-500 selection:text-black pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      {/* Install as App Tip Banner (Mobile Web Browsers Only) */}
      {showMobileInstallTip && (
        <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-2.5 flex items-center justify-between gap-3 text-xs text-amber-100">
          <div className="flex items-center gap-2 min-w-0">
            <Share className="w-4 h-4 text-amber-300 shrink-0" />
            <p className="truncate sm:whitespace-normal">
              <span className="font-black text-amber-300">Install App:</span> Tap browser menu &rarr;{' '}
              <span className="font-bold">Add to Home Screen</span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              localStorage.setItem('krish_app_tip_dismissed', '1');
              setShowMobileInstallTip(false);
            }}
            className="p-1 rounded-lg text-amber-200 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Centered App Launcher */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8 sm:py-12 max-w-5xl w-full mx-auto space-y-8">
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center gap-3 bg-stone-900/90 border border-amber-500/30 px-4 py-2 rounded-2xl shadow-xl">
            <img
              src="/krish_chef_mascot.png"
              alt="KRISH Cafe Chef"
              className="w-11 h-11 object-contain"
            />
            <div className="text-left">
              <img
                src="/krish_logo.png"
                alt="KRISH Cafe & Restaurant"
                className="h-7 sm:h-8 w-auto object-contain"
              />
              <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400">
                Restaurant POS Application
              </p>
            </div>
          </div>

          <h1 className="text-2xl sm:text-3xl font-serif font-black text-white tracking-tight">
            Choose Your App Section
          </h1>
          <p className="text-xs sm:text-sm text-stone-400 max-w-lg mx-auto">
            Dedicated two-section workflow — keep floor <strong className="text-amber-300">Order Taking</strong> separate from <strong className="text-emerald-300">Billing, Printing &amp; Management</strong>.
          </p>

          {/* Live Floor Status Pill */}
          <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full bg-stone-900/80 border border-white/10 text-xs font-bold">
            <span className="flex items-center gap-1.5 text-blue-300">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
              <span>{liveStatus.occupiedCount} Active Tables</span>
            </span>
            <span className="text-stone-600">&bull;</span>
            <span className="flex items-center gap-1.5 text-emerald-400">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span>{liveStatus.vacantCount} Vacant</span>
            </span>
          </div>
        </div>

        {/* TWO SEPARATE SECTION CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 w-full">
          {/* ========================================================== */}
          {/* SECTION 1: ORDER TAKING (SEPARATE WAITER APP) */}
          {/* ========================================================== */}
          <button
            type="button"
            onClick={() => handleSelectSection('ORDER_ONLY')}
            className="group text-left bg-gradient-to-b from-amber-950/35 via-[#17130E] to-[#120F0B] hover:from-amber-900/40 rounded-3xl border-2 border-amber-500/40 hover:border-amber-400 p-6 sm:p-7 shadow-[0_12px_40px_rgba(245,158,11,0.12)] hover:shadow-[0_16px_50px_rgba(245,158,11,0.22)] transition-all flex flex-col justify-between gap-6 cursor-pointer active:scale-[0.99]"
          >
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div className="w-14 h-14 rounded-2xl bg-amber-500 text-stone-950 flex items-center justify-center shadow-lg group-hover:scale-105 transition">
                  <UtensilsCrossed className="w-7 h-7" />
                </div>
                <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] font-black uppercase tracking-wider">
                  Section 1
                </span>
              </div>

              <div>
                <h2 className="text-2xl font-serif font-black text-white group-hover:text-amber-300 transition">
                  Order Taking
                </h2>
                <p className="text-xs text-stone-400 mt-1">
                  Dedicated floor captain &amp; waiter ordering terminal — clean, fast, distraction-free.
                </p>
              </div>

              <ul className="space-y-2 text-xs text-stone-300 pt-2 border-t border-white/10">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Interactive Floor Map (Tables #1–15 + Parcel)</span>
                </li>
                <li className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Separate Customer 1, 2, 3, 4 Ordering Sections</span>
                </li>
                <li className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Instant Dispatch directly to Kitchen &amp; Billing</span>
                </li>
              </ul>
            </div>

            <div className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-400 text-stone-950 font-black text-sm uppercase tracking-wider flex items-center justify-between shadow-lg group-hover:brightness-110 transition">
              <span>Open Order Taking</span>
              <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition" />
            </div>
          </button>

          {/* ========================================================== */}
          {/* SECTION 2: BILLING & REMAINING (CASHIER & MANAGEMENT SUITE) */}
          {/* ========================================================== */}
          <button
            type="button"
            onClick={() => handleSelectSection('BILLING_SUITE')}
            className="group text-left bg-gradient-to-b from-emerald-950/35 via-[#121614] to-[#0D100E] hover:from-emerald-900/40 rounded-3xl border-2 border-emerald-500/40 hover:border-emerald-400 p-6 sm:p-7 shadow-[0_12px_40px_rgba(16,185,129,0.12)] hover:shadow-[0_16px_50px_rgba(16,185,129,0.22)] transition-all flex flex-col justify-between gap-6 cursor-pointer active:scale-[0.99]"
          >
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500 text-stone-950 flex items-center justify-center shadow-lg group-hover:scale-105 transition">
                  <Printer className="w-7 h-7" />
                </div>
                <div className="flex items-center gap-2">
                  {liveStatus.occupiedCount > 0 && (
                    <span className="px-2.5 py-1 rounded-full bg-rose-600 text-white text-[10px] font-black uppercase">
                      {liveStatus.occupiedCount} Open Bills
                    </span>
                  )}
                  <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-black uppercase tracking-wider">
                    Section 2
                  </span>
                </div>
              </div>

              <div>
                <h2 className="text-2xl font-serif font-black text-white group-hover:text-emerald-300 transition">
                  Billing &amp; Remaining
                </h2>
                <p className="text-xs text-stone-400 mt-1">
                  Cashier counter, thermal receipts, bills archive, food manager, kitchen KDS &amp; admin dashboard.
                </p>
              </div>

              <ul className="space-y-2 text-xs text-stone-300 pt-2 border-t border-white/10">
                <li className="flex items-center gap-2">
                  <Printer className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>4 Separate Customer Bills &amp; 80mm/58mm Slips</span>
                </li>
                <li className="flex items-center gap-2">
                  <History className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Searchable Bills History &amp; CSV Export</span>
                </li>
                <li className="flex items-center gap-2">
                  <ChefHat className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Food Manager, Highest Sold &amp; Unsold Tracker</span>
                </li>
                <li className="flex items-center gap-2">
                  <Flame className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Live Kitchen Display (KDS) &amp; Admin Analytics</span>
                </li>
              </ul>
            </div>

            <div className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-400 text-stone-950 font-black text-sm uppercase tracking-wider flex items-center justify-between shadow-lg group-hover:brightness-110 transition">
              <span>Open Billing &amp; Remaining</span>
              <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition" />
            </div>
          </button>
        </div>

        {/* Remember Device Section Preference */}
        <label className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-stone-900/80 border border-white/10 text-xs text-stone-300 cursor-pointer hover:border-amber-500/30 transition select-none">
          <input
            type="checkbox"
            checked={rememberChoice}
            onChange={(e) => setRememberChoice(e.target.checked)}
            className="w-4 h-4 rounded accent-amber-500 cursor-pointer"
          />
          <Smartphone className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            Remember my selected section on this device{' '}
            <span className="text-stone-500">(you can still switch anytime via top bar)</span>
          </span>
        </label>
      </main>

      {/* Footer */}
      <footer className="text-center py-4 px-4 text-[11px] text-stone-500 border-t border-white/5">
        KRISH Cafe &amp; Restaurant &bull; Rathinam College Front Gate, Eachanari, Coimbatore &bull; 0% GST Exact Menu POS
      </footer>
    </div>
  );
}
