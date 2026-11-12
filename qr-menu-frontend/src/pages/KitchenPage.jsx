import React, { useState, useEffect, useRef } from 'react';
import { ChefHat, Clock, AlertTriangle, CheckCircle, Flame, ArrowRight, Volume2, VolumeX, RefreshCw, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
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
  const prevTicketIdsRef = useRef(new Set());
  const isInitialLoadRef = useRef(true);

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

  // Unlock Web Audio on first user interaction so background polling chimes can play reliably
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

  // Play kitchen audio chime using Web Audio API
  const playKitchenChime = () => {
    if (!soundEnabledRef.current) return;
    try {
      const ctx = ensureAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      // Tone 1
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.frequency.setValueAtTime(587.33, now); // D5
      gain1.gain.setValueAtTime(0.35, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.3);

      // Tone 2
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.frequency.setValueAtTime(880.00, now + 0.15); // A5
      gain2.gain.setValueAtTime(0.45, now + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.15);
      osc2.stop(now + 0.55);
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
      playKitchenChime();
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

      // Trigger kitchen chime when polling detects newly arrived pending tickets
      const currentIds = new Set(safeTickets.map((t) => t.id));
      if (!isInitialLoadRef.current) {
        const hasNewPendingTicket = safeTickets.some(
          (t) => t.status === 'PENDING' && !prevTicketIdsRef.current.has(t.id)
        );
        if (hasNewPendingTicket) {
          playKitchenChime();
        }
      } else {
        isInitialLoadRef.current = false;
      }
      prevTicketIdsRef.current = currentIds;

      setTickets(safeTickets);
    } catch (err) {
      console.error('KDS load error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    async function initKDS() {
      try {
        const data = await api.getDefaultTable();
        const rId = data.table?.restaurant_id || 'db4ed920-3d20-420a-9f54-99d3c0b48a08';
        setRestaurantId(rId);
        await loadTickets(rId);
      } catch (err) {
        console.warn('Could not load default table, using fallback:', err);
        const fallbackId = 'db4ed920-3d20-420a-9f54-99d3c0b48a08';
        setRestaurantId(fallbackId);
        await loadTickets(fallbackId);
      } finally {
        setIsLoading(false);
      }
    }
    initKDS();
  }, []);

  // Real-time socket updates + fast polling fallback
  useEffect(() => {
    function handleNewOrder() {
      playKitchenChime();
      if (restaurantId) loadTickets(restaurantId);
    }

    function handleOrderUpdated(data) {
      if (data?.playChime) {
        playKitchenChime();
      }
      if (restaurantId) loadTickets(restaurantId);
    }

    socket.on('order:new', handleNewOrder);
    socket.on('order:items_added', handleOrderUpdated);
    socket.on('kitchen:ticket_updated', handleOrderUpdated);
    socket.on('order:status_updated', handleOrderUpdated);
    socket.on('kitchen:ticket_advanced', handleOrderUpdated);

    // Auto-refresh interval every 3.5 seconds
    const timer = setInterval(() => {
      if (document.hidden) return;
      const targetId = restaurantId || 'db4ed920-3d20-420a-9f54-99d3c0b48a08';
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
  }, [restaurantId, soundEnabled]);

  // Advance ticket stage
  const handleAdvance = async (ticket) => {
    const orderId = typeof ticket === 'string' ? ticket : (ticket?.id || ticket?.order_id);
    if (!orderId || orderId === 'undefined') {
      console.error('Cannot advance ticket with invalid ID:', ticket);
      return;
    }
    try {
      const res = await api.advanceKitchenTicket(orderId);
      const nextStatus = res.order?.status || res.status || 'PREPARING';
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

  // Safe filter columns
  const ticketList = Array.isArray(tickets) ? tickets : [];
  const pendingTickets = ticketList.filter((t) => t.status === 'PENDING');
  const preparingTickets = ticketList.filter((t) => t.status === 'PREPARING');
  const readyTickets = ticketList.filter((t) => t.status === 'READY');

  return (
    <div className="min-h-screen bg-[#0B0B0D] text-stone-100 flex flex-col font-sans select-none">
      
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

        <div className="flex items-center gap-2.5">
          {/* Sound Toggle */}
          <button
            onClick={toggleSound}
            className={`p-2.5 rounded-xl border transition flex items-center gap-1.5 cursor-pointer ${
              soundEnabled
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                : 'bg-stone-900 border-white/10 text-stone-500'
            }`}
            title={soundEnabled ? 'Kitchen Chime ON' : 'Kitchen Chime MUTED'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            <span className="hidden md:inline text-[11px] font-bold">
              {soundEnabled ? 'Chime ON' : 'Muted'}
            </span>
          </button>

          {/* Refresh Button */}
          <button
            onClick={() => loadTickets(restaurantId)}
            className="p-2.5 bg-stone-900 hover:bg-stone-800 text-stone-300 rounded-xl border border-white/10 transition cursor-pointer"
            title="Refresh Tickets"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {/* Exit Link */}
          <Link
            to="/admin"
            className="text-xs font-black px-3.5 py-2.5 bg-stone-900 hover:bg-stone-800 text-stone-200 rounded-xl border border-white/15 transition flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Manager Portal</span>
          </Link>
        </div>
      </header>

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
  // Elapsed timer computation (handles SQLite UTC timestamps reliably in local timezones)
  const createdAt = parseUtcTimestamp(ticket.created_at);
  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - createdAt.getTime()) / 60000));
  const customerName = (ticket.customer_name || ticket.customerName || '').trim();
  const sessionLabel = ticket.session_label || ticket.sessionLabel || 'Customer';

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
            <div className="flex items-center gap-2">
              <span className="text-base font-black text-amber-300 bg-amber-400/15 px-2.5 py-1 rounded-xl border border-amber-400/30">
                Table #{ticket.table_number || ticket.tableNumber || '1'}
              </span>
              <span className="text-xs text-stone-500 font-mono">
                #{String(ticket.id || '').slice(0, 6)}
              </span>
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

        {/* Items to Cook */}
        <div className="py-2.5 space-y-2">
          {(ticket.items || []).map((item, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between text-xs py-1 border-b border-white/5 last:border-0"
            >
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-stone-800 text-amber-400 font-black flex items-center justify-center text-xs border border-white/10">
                  {item.quantity}x
                </span>
                <span className="font-bold text-stone-100 text-sm">{item.name || item.item_name}</span>
              </div>
              <span className="text-[10px] text-stone-400 uppercase tracking-wider font-semibold">
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
