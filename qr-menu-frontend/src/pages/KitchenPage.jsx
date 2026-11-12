import React, { useState, useEffect, useRef } from 'react';
import {
  ChefHat,
  Clock,
  AlertTriangle,
  CheckCircle,
  Flame,
  ArrowRight,
  Volume2,
  VolumeX,
  RefreshCw,
  Lock,
  Unlock,
  KeyRound,
  Eye,
  EyeOff,
  Bell,
  X,
} from 'lucide-react';
import KrishLogo from '../components/KrishLogo';
import { api } from '../api';
import { socket } from '../socket';
import { parseUtcTimestamp } from '../utils/time';

export default function KitchenPage() {
  const [tickets, setTickets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [restaurantId, setRestaurantId] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const soundEnabledRef = useRef(true);
  const audioContextRef = useRef(null);
  const prevTicketStatusMapRef = useRef(new Map());
  const localTransitionRef = useRef(new Set());
  const isInitialLoadRef = useRef(true);
  const pollCountRef = useRef(0);

  // Kitchen toast alert for new/ready/served audio feedback
  const [kitchenAlert, setKitchenAlert] = useState(null);
  const alertTimeoutRef = useRef(null);

  // Kitchen password protection & reset states
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [kitchenPassInput, setKitchenPassInput] = useState('');
  const [showKitchenPass, setShowKitchenPass] = useState(false);
  const [authError, setAuthError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Reset password mode / modal state (works both from Lock Screen and Header)
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [resetMode, setResetMode] = useState('current'); // 'current' | 'admin'
  const [resetAuthInput, setResetAuthInput] = useState('');
  const [resetNewPass, setResetNewPass] = useState('');
  const [resetConfirmPass, setResetConfirmPass] = useState('');
  const [resetStatus, setResetStatus] = useState({ error: '', success: '', loading: false });

  const ensureAudioContext = () => {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioCtx();
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume().catch(() => {});
    }
    return audioContextRef.current;
  };

  // Unlock Web Audio on first user interaction so background polling chimes play reliably
  useEffect(() => {
    const unlockAudio = () => {
      ensureAudioContext();
    };
    window.addEventListener('pointerdown', unlockAudio, { once: true });
    window.addEventListener('keydown', unlockAudio, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
  }, []);

  const showKitchenBanner = (type, message) => {
    setKitchenAlert({ type, message });
    if (alertTimeoutRef.current) clearTimeout(alertTimeoutRef.current);
    alertTimeoutRef.current = setTimeout(() => setKitchenAlert(null), 4000);
  };

  // Play distinct Web Audio chimes for NEW_ORDER, READY, and SERVED
  const playKitchenChime = (eventType = 'NEW_ORDER') => {
    if (!soundEnabledRef.current) return;
    try {
      const ctx = ensureAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const scheduleTone = (freq, startOffset, duration, peakGain = 0.35, wave = 'sine') => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = wave;
        osc.frequency.setValueAtTime(freq, now + startOffset);
        gain.gain.setValueAtTime(0.001, now + startOffset);
        gain.gain.exponentialRampToValueAtTime(peakGain, now + startOffset + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + startOffset + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + startOffset);
        osc.stop(now + startOffset + duration + 0.02);
      };

      if (eventType === 'READY') {
        // Bright 3-note service pickup bell: G5 -> B5 -> D6
        scheduleTone(783.99, 0.0, 0.28, 0.38, 'triangle');
        scheduleTone(987.77, 0.14, 0.28, 0.42, 'triangle');
        scheduleTone(1174.66, 0.28, 0.55, 0.46, 'sine');
      } else if (eventType === 'SERVED') {
        // Warm 2-note completion confirmation ding: E5 -> C6
        scheduleTone(659.25, 0.0, 0.24, 0.34, 'sine');
        scheduleTone(1046.5, 0.16, 0.45, 0.38, 'sine');
      } else {
        // Crisp 2-tone new order alert: D5 -> A5
        scheduleTone(587.33, 0.0, 0.3, 0.35, 'sine');
        scheduleTone(880.0, 0.15, 0.45, 0.45, 'sine');
      }
    } catch (e) {
      console.warn('Audio chime warning:', e);
    }
  };

  const toggleSound = () => {
    const next = !soundEnabled;
    soundEnabledRef.current = next;
    setSoundEnabled(next);
    if (next) {
      ensureAudioContext();
      playKitchenChime('NEW_ORDER');
    }
  };

  const handleKitchenLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    setIsLoggingIn(true);
    try {
      ensureAudioContext();
      const targetId = restaurantId || 'db4ed920-3d20-420a-9f54-99d3c0b48a08';
      const res = await api.kitchenLogin(kitchenPassInput, targetId);
      if (res?.token) {
        localStorage.setItem('qr_kitchen_token', res.token);
      }
      isInitialLoadRef.current = true;
      setIsUnlocked(true);
      setKitchenPassInput('');
      await loadTickets(res?.restaurantId || targetId);
    } catch (err) {
      setAuthError(err.message || 'Incorrect kitchen password');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleKitchenLogout = () => {
    localStorage.removeItem('qr_kitchen_token');
    setIsUnlocked(false);
    setTickets([]);
    prevTicketStatusMapRef.current = new Map();
    isInitialLoadRef.current = true;
  };

  const handleResetKitchenPassword = async (e) => {
    e.preventDefault();
    setResetStatus({ error: '', success: '', loading: true });

    if (resetNewPass.trim().length < 4) {
      setResetStatus({ error: 'New password must be at least 4 characters.', success: '', loading: false });
      return;
    }
    if (resetNewPass !== resetConfirmPass) {
      setResetStatus({ error: 'New password and confirmation do not match.', success: '', loading: false });
      return;
    }

    try {
      const targetId = restaurantId || 'db4ed920-3d20-420a-9f54-99d3c0b48a08';
      const payload = {
        restaurantId: targetId,
        newPassword: resetNewPass.trim(),
        ...(resetMode === 'current'
          ? { currentPassword: resetAuthInput }
          : { adminPassword: resetAuthInput }),
      };
      const res = await api.resetKitchenPassword(payload);
      if (res?.token) {
        localStorage.setItem('qr_kitchen_token', res.token);
      }
      setResetStatus({ error: '', success: res.message || 'Kitchen password updated!', loading: false });
      setIsUnlocked(true);
      isInitialLoadRef.current = true;
      loadTickets(targetId);

      setTimeout(() => {
        setIsResetOpen(false);
        setResetAuthInput('');
        setResetNewPass('');
        setResetConfirmPass('');
        setResetStatus({ error: '', success: '', loading: false });
      }, 1400);
    } catch (err) {
      setResetStatus({ error: err.message || 'Failed to reset kitchen password', success: '', loading: false });
    }
  };

  const loadTickets = async (restId) => {
    if (!restId) return;
    try {
      const data = await api.getKitchenTickets(restId);
      const rawTickets = Array.isArray(data)
        ? data
        : (Array.isArray(data?.tickets) ? data.tickets : [...(data?.pending || []), ...(data?.preparing || []), ...(data?.ready || [])]);

      const safeTickets = (Array.isArray(rawTickets) ? rawTickets : []).map((t) => ({
        ...t,
        id: t.id || t.order_id,
        order_id: t.order_id || t.id,
      }));

      // Trigger distinct kitchen chimes when polling detects new/add-on/ready/served transitions
      const nextStatusMap = new Map();
      safeTickets.forEach((t) => {
        const itemCount = (t.items || []).reduce((sum, it) => sum + Number(it.quantity || 1), 0);
        nextStatusMap.set(t.id, {
          status: t.status,
          itemCount,
          tableNumber: t.table_number || t.tableNumber || '1',
        });
      });

      if (!isInitialLoadRef.current) {
        const prevMap = prevTicketStatusMapRef.current;

        const newlyPending = safeTickets.find((t) => {
          const prev = prevMap.get(t.id);
          const itemCount = (t.items || []).reduce((sum, it) => sum + Number(it.quantity || 1), 0);
          return (
            t.status === 'PENDING' &&
            (!prev || prev.status !== 'PENDING' || itemCount > (prev.itemCount || 0))
          );
        });

        const newlyReady = safeTickets.find((t) => {
          const prev = prevMap.get(t.id);
          const localKey = `${t.id}:READY`;
          if (localTransitionRef.current.has(localKey)) {
            localTransitionRef.current.delete(localKey);
            return false;
          }
          return t.status === 'READY' && (!prev || prev.status !== 'READY');
        });

        let remotelyServedTable = null;
        prevMap.forEach((prevVal, prevId) => {
          if (prevVal.status === 'READY' && !nextStatusMap.has(prevId)) {
            const localKey = `${prevId}:SERVED`;
            if (localTransitionRef.current.has(localKey)) {
              localTransitionRef.current.delete(localKey);
            } else {
              remotelyServedTable = prevVal.tableNumber;
            }
          }
        });

        if (newlyReady) {
          playKitchenChime('READY');
          showKitchenBanner('READY', `🔔 Food Ready for Table #${newlyReady.table_number || newlyReady.tableNumber || '1'}!`);
        } else if (remotelyServedTable) {
          playKitchenChime('SERVED');
          showKitchenBanner('SERVED', `✅ Food Served for Table #${remotelyServedTable}!`);
        } else if (newlyPending) {
          playKitchenChime('NEW_ORDER');
          showKitchenBanner('NEW_ORDER', `🔥 New Order for Table #${newlyPending.table_number || newlyPending.tableNumber || '1'}!`);
        }
      } else {
        isInitialLoadRef.current = false;
      }

      prevTicketStatusMapRef.current = nextStatusMap;
      setTickets(safeTickets);
    } catch (err) {
      console.error('KDS load error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    async function initKDS() {
      let resolvedId = 'db4ed920-3d20-420a-9f54-99d3c0b48a08';
      try {
        const data = await api.getDefaultTable();
        resolvedId = data.table?.restaurant_id || resolvedId;
      } catch (err) {
        console.warn('Could not load default table, using fallback:', err);
      }
      setRestaurantId(resolvedId);

      const savedToken = localStorage.getItem('qr_kitchen_token');
      if (savedToken) {
        try {
          const verify = await api.verifyKitchenSession(savedToken, resolvedId);
          if (verify?.valid) {
            setIsUnlocked(true);
            await loadTickets(resolvedId);
          } else {
            localStorage.removeItem('qr_kitchen_token');
            setIsUnlocked(false);
            setIsLoading(false);
          }
        } catch {
          setIsUnlocked(false);
          setIsLoading(false);
        }
      } else {
        setIsUnlocked(false);
        setIsLoading(false);
      }
      setIsCheckingAuth(false);
    }
    initKDS();
  }, []);

  // Real-time socket updates + fast polling fallback (only when Kitchen KDS is unlocked)
  useEffect(() => {
    if (!isUnlocked) return undefined;

    function handleNewOrder() {
      playKitchenChime('NEW_ORDER');
      if (restaurantId) loadTickets(restaurantId);
    }

    function handleOrderUpdated(data) {
      if (data?.status === 'READY') {
        playKitchenChime('READY');
      } else if (data?.status === 'SERVED') {
        playKitchenChime('SERVED');
      } else if (data?.playChime) {
        playKitchenChime('NEW_ORDER');
      }
      if (restaurantId) loadTickets(restaurantId);
    }

    socket.on('order:new', handleNewOrder);
    socket.on('order:items_added', handleOrderUpdated);
    socket.on('kitchen:ticket_updated', handleOrderUpdated);
    socket.on('order:status_updated', handleOrderUpdated);
    socket.on('kitchen:ticket_advanced', handleOrderUpdated);

    // Auto-refresh interval every 3.5 seconds; re-verify password token periodically so resets lock remote displays
    const timer = setInterval(async () => {
      if (document.hidden) return;
      const targetId = restaurantId || 'db4ed920-3d20-420a-9f54-99d3c0b48a08';
      pollCountRef.current += 1;
      if (pollCountRef.current % 8 === 0) {
        const tok = localStorage.getItem('qr_kitchen_token');
        const check = await api.verifyKitchenSession(tok, targetId).catch(() => ({ valid: true }));
        if (check && check.valid === false) {
          handleKitchenLogout();
          setAuthError('Kitchen password was changed. Please enter the new password.');
          return;
        }
      }
      loadTickets(targetId);
    }, 3500);

    const handleFocus = () => {
      const targetId = restaurantId || 'db4ed920-3d20-420a-9f54-99d3c0b48a08';
      loadTickets(targetId);
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      socket.off('order:new', handleNewOrder);
      socket.off('order:items_added', handleOrderUpdated);
      socket.off('kitchen:ticket_updated', handleOrderUpdated);
      socket.off('order:status_updated', handleOrderUpdated);
      socket.off('kitchen:ticket_advanced', handleOrderUpdated);
      window.removeEventListener('focus', handleFocus);
      clearInterval(timer);
    };
  }, [restaurantId, soundEnabled, isUnlocked]);

  // Advance ticket stage & immediately trigger READY / SERVED sound alerts
  const handleAdvance = async (ticket) => {
    const orderId = typeof ticket === 'string' ? ticket : (ticket?.id || ticket?.order_id);
    const tableNum = (typeof ticket === 'object' && (ticket?.table_number || ticket?.tableNumber)) || '1';
    if (!orderId || orderId === 'undefined') {
      console.error('Cannot advance ticket with invalid ID:', ticket);
      return;
    }
    try {
      ensureAudioContext();
      const res = await api.advanceKitchenTicket(orderId);
      const nextStatus = res.order?.status || res.status || 'PREPARING';

      if (nextStatus === 'READY') {
        localTransitionRef.current.add(`${orderId}:READY`);
        playKitchenChime('READY');
        showKitchenBanner('READY', `🔔 Food Ready for Table #${tableNum}!`);
      } else if (nextStatus === 'SERVED') {
        localTransitionRef.current.add(`${orderId}:SERVED`);
        playKitchenChime('SERVED');
        showKitchenBanner('SERVED', `✅ Food Served for Table #${tableNum}!`);
      }

      setTickets((prev) =>
        (Array.isArray(prev) ? prev : []).map((t) =>
          t.id === orderId || t.order_id === orderId
            ? { ...t, status: nextStatus }
            : t
        )
      );
      const targetId = restaurantId || 'db4ed920-3d20-420a-9f54-99d3c0b48a08';
      loadTickets(targetId);
    } catch (err) {
      alert(err.message || 'Failed to advance ticket');
    }
  };

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-[#0B0B0D] text-stone-100 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
          <p className="text-xs text-stone-400 font-semibold">Checking Kitchen Access...</p>
        </div>
      </div>
    );
  }

  if (!isUnlocked) {
    return (
      <div className="min-h-screen bg-[#0B0B0D] text-stone-100 flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-to-br from-amber-500/10 via-orange-600/5 to-transparent rounded-full blur-3xl" />
          <div className="absolute bottom-10 left-10 w-72 h-72 bg-emerald-500/5 rounded-full blur-2xl" />
        </div>

        <div className="w-full max-w-md relative z-10">
          <div className="krish-glass-card p-7 sm:p-8 rounded-3xl relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600" />

            <div className="flex flex-col items-center text-center mb-6">
              <KrishLogo size="lg" showMascot={true} showHat={true} subtitle="Cafe & Restaurant" />
              <span className="mt-3 text-[11px] font-black tracking-widest uppercase text-amber-400 bg-amber-500/15 border border-amber-500/30 px-3 py-1 rounded-full">
                Kitchen Display Lock
              </span>
              <p className="text-xs text-stone-400 mt-2">
                {isResetOpen
                  ? 'Reset your Kitchen KDS password using your current password or manager override'
                  : 'Enter the Kitchen Password to view live cooking tickets & enable Ready/Served audio alerts'}
              </p>
            </div>

            {!isResetOpen ? (
              <form onSubmit={handleKitchenLogin} className="space-y-4">
                {authError && (
                  <div className="p-3 bg-rose-500/15 border border-rose-500/40 rounded-2xl text-xs text-rose-300 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                    <span>{authError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-black uppercase tracking-wider text-stone-400 mb-1.5">
                    Kitchen Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-stone-500 absolute left-3.5 top-3.5" />
                    <input
                      type={showKitchenPass ? 'text' : 'password'}
                      required
                      autoFocus
                      value={kitchenPassInput}
                      onChange={(e) => setKitchenPassInput(e.target.value)}
                      placeholder="Enter kitchen password"
                      className="w-full pl-10 pr-10 py-2.5 bg-stone-900/90 border border-white/10 rounded-xl text-sm text-white placeholder-stone-600 outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/50 transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKitchenPass(!showKitchenPass)}
                      className="absolute right-3 top-3 text-stone-400 hover:text-stone-200 cursor-pointer"
                      aria-label={showKitchenPass ? 'Hide password' : 'Show password'}
                    >
                      {showKitchenPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-[10px] text-stone-500 mt-1.5">
                    Kitchen staff password required to access KDS
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isLoggingIn}
                  className="w-full py-3.5 krish-gradient-gold text-stone-950 font-black text-xs uppercase tracking-wider rounded-xl transition shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Unlock className="w-4 h-4" />
                  <span>{isLoggingIn ? 'Unlocking Kitchen...' : 'Unlock Kitchen KDS'}</span>
                </button>

                <div className="pt-2 flex items-center justify-center text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setIsResetOpen(true);
                      setResetStatus({ error: '', success: '', loading: false });
                    }}
                    className="text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Forgot / Reset Kitchen Password</span>
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleResetKitchenPassword} className="space-y-3.5">
                <div className="grid grid-cols-2 gap-2 p-1 bg-stone-900 rounded-xl border border-white/10">
                  <button
                    type="button"
                    onClick={() => {
                      setResetMode('current');
                      setResetAuthInput('');
                    }}
                    className={`py-1.5 text-[11px] font-bold rounded-lg transition cursor-pointer ${
                      resetMode === 'current' ? 'bg-amber-500 text-stone-950' : 'text-stone-400 hover:text-white'
                    }`}
                  >
                    Current Password
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setResetMode('admin');
                      setResetAuthInput('');
                    }}
                    className={`py-1.5 text-[11px] font-bold rounded-lg transition cursor-pointer ${
                      resetMode === 'admin' ? 'bg-amber-500 text-stone-950' : 'text-stone-400 hover:text-white'
                    }`}
                  >
                    Recovery PIN
                  </button>
                </div>

                {resetStatus.error && (
                  <div className="p-2.5 bg-rose-500/15 border border-rose-500/40 rounded-xl text-xs text-rose-300">
                    {resetStatus.error}
                  </div>
                )}
                {resetStatus.success && (
                  <div className="p-2.5 bg-emerald-500/15 border border-emerald-500/40 rounded-xl text-xs text-emerald-300">
                    {resetStatus.success}
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-bold text-stone-400 mb-1">
                    {resetMode === 'current'
                      ? 'Current Kitchen Password'
                      : 'Kitchen Recovery PIN'}
                  </label>
                  <input
                    type="password"
                    required
                    value={resetAuthInput}
                    onChange={(e) => setResetAuthInput(e.target.value)}
                    placeholder={resetMode === 'current' ? 'Enter current kitchen password' : 'Enter 4-digit recovery PIN'}
                    className="w-full px-3.5 py-2.5 bg-stone-900/90 border border-white/10 rounded-xl text-xs text-white outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-stone-400 mb-1">
                    New Kitchen Password (min 4 chars)
                  </label>
                  <input
                    type="password"
                    required
                    minLength={4}
                    value={resetNewPass}
                    onChange={(e) => setResetNewPass(e.target.value)}
                    placeholder="Enter new kitchen password"
                    className="w-full px-3.5 py-2.5 bg-stone-900/90 border border-white/10 rounded-xl text-xs text-white outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-stone-400 mb-1">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    required
                    minLength={4}
                    value={resetConfirmPass}
                    onChange={(e) => setResetConfirmPass(e.target.value)}
                    placeholder="Re-enter new kitchen password"
                    className="w-full px-3.5 py-2.5 bg-stone-900/90 border border-white/10 rounded-xl text-xs text-white outline-none focus:border-amber-400"
                  />
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsResetOpen(false);
                      setResetStatus({ error: '', success: '', loading: false });
                    }}
                    className="flex-1 py-2.5 text-xs font-bold text-stone-300 bg-stone-900 hover:bg-stone-800 rounded-xl border border-white/10 cursor-pointer"
                  >
                    Back to Login
                  </button>
                  <button
                    type="submit"
                    disabled={resetStatus.loading}
                    className="flex-1 py-2.5 text-xs font-black text-stone-950 krish-gradient-gold rounded-xl cursor-pointer disabled:opacity-50"
                  >
                    {resetStatus.loading ? 'Saving...' : 'Update Password'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Safe filter columns
  const ticketList = Array.isArray(tickets) ? tickets : [];
  const pendingTickets = ticketList.filter((t) => t.status === 'PENDING');
  const preparingTickets = ticketList.filter((t) => t.status === 'PREPARING');
  const readyTickets = ticketList.filter((t) => t.status === 'READY');

  return (
    <div className="min-h-screen bg-[#0B0B0D] text-stone-100 flex flex-col font-sans select-none">

      {/* Floating Audio Alert Banner for New / Ready / Served */}
      {kitchenAlert && (
        <div className="fixed top-20 right-4 z-50 animate-fade-in">
          <div
            className={`px-4 py-2.5 rounded-2xl border shadow-2xl text-xs font-black flex items-center gap-2 ${
              kitchenAlert.type === 'READY'
                ? 'bg-emerald-500/95 border-emerald-300 text-stone-950'
                : kitchenAlert.type === 'SERVED'
                ? 'bg-sky-500/95 border-sky-300 text-stone-950'
                : 'bg-amber-400/95 border-yellow-200 text-stone-950'
            }`}
          >
            <Bell className="w-4 h-4" />
            <span>{kitchenAlert.message}</span>
          </div>
        </div>
      )}

      {/* KDS Header Bar */}
      <header className="h-16 px-4 sm:px-6 bg-[#120F0B]/95 backdrop-blur-xl border-b border-white/10 flex items-center justify-between shadow-xl sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <KrishLogo size="sm" showHat={true} showSubtitle={false} />
          <div className="hidden sm:block border-l border-white/15 pl-3">
            <h1 className="font-serif font-black text-sm tracking-tight text-white flex items-center gap-2">
              <span>Kitchen Display System</span>
              <span className="text-[10px] uppercase font-black tracking-widest bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/30 animate-pulse">
                LIVE KDS
              </span>
            </h1>
            <p className="text-[11px] text-stone-400">
              Active Orders: {ticketList.length} &bull; KRISH Cafe & Restaurant
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Sound Test Buttons for Ready & Served */}
          {soundEnabled && (
            <div className="hidden lg:flex items-center gap-1.5 mr-1">
              <button
                type="button"
                onClick={() => {
                  ensureAudioContext();
                  playKitchenChime('READY');
                  showKitchenBanner('READY', '🔔 Food Ready Sound Preview');
                }}
                className="px-2.5 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold cursor-pointer transition"
                title="Preview Food Ready Bell"
              >
                🔔 Ready Sound
              </button>
              <button
                type="button"
                onClick={() => {
                  ensureAudioContext();
                  playKitchenChime('SERVED');
                  showKitchenBanner('SERVED', '✅ Food Served Sound Preview');
                }}
                className="px-2.5 py-1.5 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 text-sky-300 text-[10px] font-bold cursor-pointer transition"
                title="Preview Food Served Chime"
              >
                ✅ Served Sound
              </button>
            </div>
          )}

          {/* Sound Toggle */}
          <button
            onClick={toggleSound}
            className={`p-2.5 rounded-xl border transition flex items-center gap-1.5 cursor-pointer ${
              soundEnabled
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                : 'bg-stone-900 border-white/10 text-stone-500'
            }`}
            title={soundEnabled ? 'Kitchen Chime ON (New / Ready / Served)' : 'Kitchen Chime MUTED'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            <span className="hidden md:inline text-[11px] font-bold">
              {soundEnabled ? 'Chime ON' : 'Muted'}
            </span>
          </button>

          {/* Reset Kitchen Password */}
          <button
            type="button"
            onClick={() => {
              setIsResetOpen(true);
              setResetStatus({ error: '', success: '', loading: false });
            }}
            className="p-2.5 bg-stone-900 hover:bg-stone-800 text-amber-300 rounded-xl border border-white/10 transition flex items-center gap-1.5 cursor-pointer"
            title="Reset Kitchen Password"
          >
            <KeyRound className="w-4 h-4" />
            <span className="hidden xl:inline text-[11px] font-bold">Reset Pass</span>
          </button>

          {/* Lock Kitchen Screen */}
          <button
            type="button"
            onClick={handleKitchenLogout}
            className="p-2.5 bg-stone-900 hover:bg-rose-500/20 text-stone-300 hover:text-rose-300 rounded-xl border border-white/10 transition flex items-center gap-1.5 cursor-pointer"
            title="Lock Kitchen Display"
          >
            <Lock className="w-4 h-4" />
          </button>

          {/* Refresh Button */}
          <button
            onClick={() => loadTickets(restaurantId)}
            className="p-2.5 bg-stone-900 hover:bg-stone-800 text-stone-300 rounded-xl border border-white/10 transition cursor-pointer"
            title="Refresh Tickets"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Modal: Reset Kitchen Password (when unlocked) */}
      {isResetOpen && (
        <div className="fixed inset-0 z-50 bg-stone-950/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="krish-glass-card w-full max-w-sm rounded-3xl p-6 space-y-4 relative border border-amber-500/30">
            <button
              type="button"
              onClick={() => {
                setIsResetOpen(false);
                setResetStatus({ error: '', success: '', loading: false });
              }}
              className="absolute top-4 right-4 p-1.5 rounded-full bg-stone-900 text-stone-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-300 flex items-center justify-center">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-serif font-bold text-base text-white">Reset Kitchen Password</h3>
                <p className="text-[11px] text-stone-400">Secures `/kitchen` KDS access</p>
              </div>
            </div>

            <form onSubmit={handleResetKitchenPassword} className="space-y-3">
              <div className="grid grid-cols-2 gap-2 p-1 bg-stone-900 rounded-xl border border-white/10">
                <button
                  type="button"
                  onClick={() => {
                    setResetMode('current');
                    setResetAuthInput('');
                  }}
                  className={`py-1.5 text-[11px] font-bold rounded-lg transition cursor-pointer ${
                    resetMode === 'current' ? 'bg-amber-500 text-stone-950' : 'text-stone-400 hover:text-white'
                  }`}
                >
                  Current Password
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setResetMode('admin');
                    setResetAuthInput('');
                  }}
                  className={`py-1.5 text-[11px] font-bold rounded-lg transition cursor-pointer ${
                    resetMode === 'admin' ? 'bg-amber-500 text-stone-950' : 'text-stone-400 hover:text-white'
                  }`}
                >
                  Recovery PIN
                </button>
              </div>

              {resetStatus.error && (
                <div className="p-2.5 bg-rose-500/15 border border-rose-500/40 rounded-xl text-xs text-rose-300">
                  {resetStatus.error}
                </div>
              )}
              {resetStatus.success && (
                <div className="p-2.5 bg-emerald-500/15 border border-emerald-500/40 rounded-xl text-xs text-emerald-300">
                  {resetStatus.success}
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-stone-300 mb-1">
                  {resetMode === 'current' ? 'Current Kitchen Password' : 'Kitchen Recovery PIN'}
                </label>
                <input
                  type="password"
                  required
                  value={resetAuthInput}
                  onChange={(e) => setResetAuthInput(e.target.value)}
                  placeholder={resetMode === 'current' ? 'Current password' : 'Enter 4-digit recovery PIN'}
                  className="w-full px-3 py-2 bg-stone-900 border border-white/10 rounded-xl text-xs text-white outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-300 mb-1">
                  New Kitchen Password (min 4 chars)
                </label>
                <input
                  type="password"
                  required
                  minLength={4}
                  value={resetNewPass}
                  onChange={(e) => setResetNewPass(e.target.value)}
                  placeholder="Enter new kitchen password"
                  className="w-full px-3 py-2 bg-stone-900 border border-white/10 rounded-xl text-xs text-white outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-300 mb-1">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  required
                  minLength={4}
                  value={resetConfirmPass}
                  onChange={(e) => setResetConfirmPass(e.target.value)}
                  placeholder="Confirm new password"
                  className="w-full px-3 py-2 bg-stone-900 border border-white/10 rounded-xl text-xs text-white outline-none focus:border-amber-400"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsResetOpen(false)}
                  className="flex-1 py-2.5 text-xs font-bold text-stone-300 bg-stone-900 rounded-xl border border-white/10 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetStatus.loading}
                  className="flex-1 py-2.5 text-xs font-black text-stone-950 krish-gradient-gold rounded-xl cursor-pointer disabled:opacity-50"
                >
                  {resetStatus.loading ? 'Saving...' : 'Save Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3-Column Kanban Board */}
      <div className="flex-1 p-4 sm:p-6 grid grid-cols-1 md:grid-cols-3 gap-5 overflow-hidden">
        
        {/* COLUMN 1: PENDING */}
        <div className="flex flex-col bg-stone-900/60 rounded-3xl border border-amber-500/20 overflow-hidden shadow-2xl">
          <div className="px-5 py-3.5 border-b border-amber-500/20 flex items-center justify-between bg-amber-500/10">
            <div className="flex items-center gap-2.5">
              <span className="w-3 h-3 rounded-full bg-amber-400 animate-ping"></span>
              <h2 className="font-black text-sm uppercase tracking-wider text-amber-300 flex items-center gap-2">
                <span>🟡 Pending</span>
                <span className="bg-amber-400 text-stone-950 text-xs px-2 py-0.5 rounded-full font-black">
                  {pendingTickets.length}
                </span>
              </h2>
            </div>
            <span className="text-[11px] text-amber-200/70 font-semibold">New Tickets</span>
          </div>

          <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5">
            {pendingTickets.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-xs text-stone-500 italic">
                No orders waiting to start
              </div>
            ) : (
              pendingTickets.map((ticket) => (
                <KDSTicketCard
                  key={ticket.id || ticket.order_id}
                  ticket={ticket}
                  onAdvance={() => handleAdvance(ticket)}
                  nextLabel="Start Cooking"
                  nextColor="krish-gradient-gold text-stone-950 font-black"
                />
              ))
            )}
          </div>
        </div>

        {/* COLUMN 2: PREPARING */}
        <div className="flex flex-col bg-stone-900/60 rounded-3xl border border-sky-500/20 overflow-hidden shadow-2xl">
          <div className="px-5 py-3.5 border-b border-sky-500/20 flex items-center justify-between bg-sky-500/10">
            <div className="flex items-center gap-2.5">
              <span className="w-3 h-3 rounded-full bg-sky-400 animate-pulse"></span>
              <h2 className="font-black text-sm uppercase tracking-wider text-sky-300 flex items-center gap-2">
                <span>🔥 Preparing</span>
                <span className="bg-sky-400 text-stone-950 text-xs px-2 py-0.5 rounded-full font-black">
                  {preparingTickets.length}
                </span>
              </h2>
            </div>
            <span className="text-[11px] text-sky-200/70 font-semibold">On Stove & Grill</span>
          </div>

          <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5">
            {preparingTickets.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-xs text-stone-500 italic">
                Kitchen stations ready for cooking
              </div>
            ) : (
              preparingTickets.map((ticket) => (
                <KDSTicketCard
                  key={ticket.id || ticket.order_id}
                  ticket={ticket}
                  onAdvance={() => handleAdvance(ticket)}
                  nextLabel="Mark Ready"
                  nextColor="bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-black"
                />
              ))
            )}
          </div>
        </div>

        {/* COLUMN 3: READY */}
        <div className="flex flex-col bg-stone-900/60 rounded-3xl border border-emerald-500/20 overflow-hidden shadow-2xl">
          <div className="px-5 py-3.5 border-b border-emerald-500/20 flex items-center justify-between bg-emerald-500/10">
            <div className="flex items-center gap-2.5">
              <span className="w-3 h-3 rounded-full bg-emerald-400"></span>
              <h2 className="font-black text-sm uppercase tracking-wider text-emerald-300 flex items-center gap-2">
                <span>✅ Ready</span>
                <span className="bg-emerald-400 text-stone-950 text-xs px-2 py-0.5 rounded-full font-black">
                  {readyTickets.length}
                </span>
              </h2>
            </div>
            <span className="text-[11px] text-emerald-200/70 font-semibold">Ready for Table Runner</span>
          </div>

          <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5">
            {readyTickets.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-xs text-stone-500 italic">
                No orders waiting for pickup
              </div>
            ) : (
              readyTickets.map((ticket) => (
                <KDSTicketCard
                  key={ticket.id || ticket.order_id}
                  ticket={ticket}
                  onAdvance={() => handleAdvance(ticket)}
                  nextLabel="Mark Served"
                  nextColor="bg-sky-400 hover:bg-sky-300 text-stone-950 font-black"
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Individual KDS Ticket Component
function KDSTicketCard({ ticket, onAdvance, nextLabel, nextColor, isCompleted }) {
  // Elapsed timer computation (uses newly added kitchen round timestamp when add-on dishes arrive)
  const createdAt = parseUtcTimestamp(ticket.kitchen_since || ticket.created_at);
  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - createdAt.getTime()) / 60000));
  const customerName = (ticket.customer_name || ticket.customerName || '').trim();
  const sessionLabel = ticket.session_label || ticket.sessionLabel || 'Customer';
  const servedCount = Number(ticket.served_items_count || 0);
  const isAddOn = Boolean(ticket.is_add_on || servedCount > 0);
  const ticketItems = Array.isArray(ticket.items) ? ticket.items : [];
  const hasMixedStatuses = ticketItems.some((i) => i.status && i.status !== ticketItems[0]?.status);

  const getUrgencyBadge = () => {
    if (elapsedMinutes >= 20) {
      return (
        <span className="bg-rose-500/20 text-rose-300 border border-rose-500/50 text-[10px] font-black px-2 py-0.5 rounded-lg flex items-center gap-1 animate-pulse">
          <AlertTriangle className="w-3 h-3 text-rose-400" /> {elapsedMinutes}m (DELAYED)
        </span>
      );
    }
    if (elapsedMinutes >= 10) {
      return (
        <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-black px-2 py-0.5 rounded-lg flex items-center gap-1">
          <Clock className="w-3 h-3 text-amber-400" /> {elapsedMinutes}m
        </span>
      );
    }
    return (
      <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-black px-2 py-0.5 rounded-lg flex items-center gap-1">
        <Clock className="w-3 h-3 text-emerald-400" /> {elapsedMinutes}m
      </span>
    );
  };

  return (
    <div className="krish-glass-card rounded-2xl p-4 transition-all hover:border-amber-400/40 flex flex-col justify-between">
      <div>
        {/* Ticket Top Meta */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-base font-black text-amber-300 bg-amber-400/15 px-2.5 py-1 rounded-xl border border-amber-400/30">
                Table #{ticket.table_number || ticket.tableNumber || '1'}
              </span>
              <span className="text-xs text-stone-500 font-mono">
                #{String(ticket.id || '').slice(0, 6)}
              </span>
              {isAddOn && (
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  + Extra Add-On ({servedCount} served)
                </span>
              )}
            </div>
            {/* Customer Session Identifier */}
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              <span className="text-[11px] font-bold text-sky-300 bg-sky-500/15 px-2 py-0.5 rounded-md border border-sky-500/25">
                {customerName ? `${customerName} • ${sessionLabel}` : sessionLabel}
              </span>
              <span className="text-[10px] text-stone-400 font-mono">
                {createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
          {getUrgencyBadge()}
        </div>

        {/* Customer Cooking Notes */}
        {ticket.notes && (
          <div className="my-2.5 p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-300 font-medium flex items-start gap-1.5">
            <Flame className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
            <span>"{ticket.notes}"</span>
          </div>
        )}

        {/* Items to Cook (only unserved dishes) */}
        <div className="py-2.5 space-y-2">
          {ticketItems.map((item, idx) => (
            <div
              key={item.id || idx}
              className="flex items-center justify-between text-xs py-1 border-b border-white/5 last:border-0"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-6 h-6 rounded-lg bg-stone-800 text-amber-400 font-black flex items-center justify-center text-xs border border-white/10 shrink-0">
                  {item.quantity}x
                </span>
                <span className="font-bold text-stone-100 text-sm truncate">{item.name || item.item_name}</span>
                {hasMixedStatuses && item.status && (
                  <span
                    className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded border shrink-0 ${
                      item.status === 'PENDING'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : item.status === 'PREPARING'
                        ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                        : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    }`}
                  >
                    {item.status === 'PENDING' ? 'New' : item.status === 'PREPARING' ? 'Cooking' : 'Ready'}
                  </span>
                )}
              </div>
              <span className="text-[10px] text-stone-400 uppercase tracking-wider font-semibold shrink-0 ml-2">
                {item.category || 'Kitchen'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Action Footer */}
      {!isCompleted && onAdvance && (
        <button
          onClick={onAdvance}
          className={`w-full mt-3 py-3 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition active:scale-95 shadow-md cursor-pointer ${nextColor}`}
        >
          <span>{nextLabel}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      )}

      {isCompleted && (
        <div className="mt-3 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-center text-xs font-bold flex items-center justify-center gap-1.5">
          <CheckCircle className="w-4 h-4" />
          <span>Plated & Alerted to Waiter</span>
        </div>
      )}
    </div>
  );
}
