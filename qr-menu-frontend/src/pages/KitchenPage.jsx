import React, { useState, useEffect, useRef } from 'react';
import { ChefHat, Clock, AlertTriangle, CheckCircle, Flame, ArrowRight, Volume2, VolumeX, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { socket } from '../socket';

export default function KitchenPage() {
  const [tickets, setTickets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [restaurantId, setRestaurantId] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const audioContextRef = useRef(null);

  // Play kitchen audio chime using Web Audio API
  const playKitchenChime = () => {
    if (!soundEnabled) return;
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const now = ctx.currentTime;
      // Tone 1
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.frequency.setValueAtTime(587.33, now); // D5
      gain1.gain.setValueAtTime(0.3, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.3);

      // Tone 2
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.frequency.setValueAtTime(880.00, now + 0.15); // A5
      gain2.gain.setValueAtTime(0.4, now + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.15);
      osc2.stop(now + 0.55);
    } catch (e) {
      console.warn('Audio chime warning:', e);
    }
  };

  const loadTickets = async (restId) => {
    if (!restId) return;
    try {
      const data = await api.getKitchenTickets(restId);
      const rawTickets = Array.isArray(data)
        ? data
        : (data.tickets || [...(data.pending || []), ...(data.preparing || []), ...(data.ready || [])]);
      setTickets(
        rawTickets.map((t) => ({
          ...t,
          id: t.id || t.order_id,
          order_id: t.order_id || t.id,
        }))
      );
    } catch (err) {
      console.error('KDS load error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    async function initKDS() {
      try {
        const res = await fetch('/api/order/tables/default');
        const data = await res.json();
        const rId = data.table?.restaurant_id || '2dbedc29-66a4-43fd-9dbb-68f86f5608e5';
        setRestaurantId(rId);
        await loadTickets(rId);
      } catch {
        setIsLoading(false);
      }
    }
    initKDS();
  }, []);

  // Real-time socket updates for new orders
  useEffect(() => {
    function handleNewOrder(order) {
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

    // Auto-refresh interval every 15s
    const timer = setInterval(() => {
      if (restaurantId) loadTickets(restaurantId);
    }, 15000);

    return () => {
      socket.off('order:new', handleNewOrder);
      socket.off('order:items_added', handleOrderUpdated);
      socket.off('kitchen:ticket_updated', handleOrderUpdated);
      socket.off('order:status_updated', handleOrderUpdated);
      socket.off('kitchen:ticket_advanced', handleOrderUpdated);
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
      setTickets((prev) =>
        prev.map((t) =>
          t.id === orderId || t.order_id === orderId
            ? { ...t, status: res.order.status }
            : t
        )
      );
    } catch (err) {
      alert(err.message || 'Failed to advance ticket');
    }
  };

  // Filter columns
  const pendingTickets = tickets.filter((t) => t.status === 'PENDING');
  const preparingTickets = tickets.filter((t) => t.status === 'PREPARING');
  const readyTickets = tickets.filter((t) => t.status === 'READY');

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col font-sans">
      
      {/* KDS Header Bar */}
      <header className="h-16 px-6 bg-stone-900 border-b border-stone-800 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500 text-stone-950 flex items-center justify-center font-bold">
            <ChefHat className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-serif font-black text-lg tracking-tight text-white flex items-center gap-2">
              Kitchen Display System (KDS)
              <span className="text-[10px] uppercase font-bold tracking-widest bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/30">
                LIVE
              </span>
            </h1>
            <p className="text-xs text-stone-400">
              Active Orders: {tickets.length} &bull; Royal Spice Bistro
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-2 rounded-xl border transition ${
              soundEnabled
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                : 'bg-stone-800 border-stone-700 text-stone-400'
            }`}
            title={soundEnabled ? 'Chime Enabled' : 'Chime Muted'}
          >
            {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>

          <button
            onClick={() => loadTickets(restaurantId)}
            className="p-2 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-xl border border-stone-700 transition"
            title="Refresh Tickets"
          >
            <RefreshCw className="w-5 h-5" />
          </button>

          <Link
            to="/admin"
            className="text-xs font-bold px-3 py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-xl border border-stone-700 transition"
          >
            Exit to Dashboard
          </Link>
        </div>
      </header>

      {/* 3-Column Kanban Board */}
      <div className="flex-1 p-6 grid grid-cols-1 md:grid-cols-3 gap-6 overflow-hidden">
        
        {/* COLUMN 1: PENDING */}
        <div className="flex flex-col bg-stone-900/60 rounded-3xl border border-stone-800 overflow-hidden shadow-xl">
          <div className="px-5 py-4 border-b border-stone-800 flex items-center justify-between bg-stone-900">
            <div className="flex items-center gap-2.5">
              <span className="w-3 h-3 rounded-full bg-amber-500 animate-pulse"></span>
              <h2 className="font-bold text-sm uppercase tracking-wider text-stone-200">
                Pending ({pendingTickets.length})
              </h2>
            </div>
            <span className="text-xs text-stone-500 font-semibold">New Orders</span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
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
                  nextColor="bg-amber-500 hover:bg-amber-400 text-stone-950"
                />
              ))
            )}
          </div>
        </div>

        {/* COLUMN 2: PREPARING */}
        <div className="flex flex-col bg-stone-900/60 rounded-3xl border border-stone-800 overflow-hidden shadow-xl">
          <div className="px-5 py-4 border-b border-stone-800 flex items-center justify-between bg-stone-900">
            <div className="flex items-center gap-2.5">
              <span className="w-3 h-3 rounded-full bg-blue-500 animate-pulse"></span>
              <h2 className="font-bold text-sm uppercase tracking-wider text-stone-200">
                Preparing ({preparingTickets.length})
              </h2>
            </div>
            <span className="text-xs text-stone-500 font-semibold">On Stove & Grill</span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {preparingTickets.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-xs text-stone-500 italic">
                Kitchen stations ready for action
              </div>
            ) : (
              preparingTickets.map((ticket) => (
                <KDSTicketCard
                  key={ticket.id || ticket.order_id}
                  ticket={ticket}
                  onAdvance={() => handleAdvance(ticket)}
                  nextLabel="Mark Ready"
                  nextColor="bg-emerald-500 hover:bg-emerald-400 text-stone-950"
                />
              ))
            )}
          </div>
        </div>

        {/* COLUMN 3: READY */}
        <div className="flex flex-col bg-stone-900/60 rounded-3xl border border-stone-800 overflow-hidden shadow-xl">
          <div className="px-5 py-4 border-b border-stone-800 flex items-center justify-between bg-stone-900">
            <div className="flex items-center gap-2.5">
              <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
              <h2 className="font-bold text-sm uppercase tracking-wider text-stone-200">
                Ready ({readyTickets.length})
              </h2>
            </div>
            <span className="text-xs text-stone-500 font-semibold">Ready for Table Runner</span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
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
                  nextColor="bg-sky-400 hover:bg-sky-300 text-stone-950"
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
  // Elapsed timer computation
  const createdAt = new Date(ticket.created_at || Date.now());
  const elapsedMinutes = Math.floor((Date.now() - createdAt.getTime()) / 60000);

  const getUrgencyBadge = () => {
    if (elapsedMinutes >= 20) {
      return (
        <span className="bg-rose-500/20 text-rose-400 border border-rose-500/40 text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 animate-pulse">
          <AlertTriangle className="w-3 h-3" /> {elapsedMinutes}m (DELAYED)
        </span>
      );
    }
    if (elapsedMinutes >= 10) {
      return (
        <span className="bg-amber-500/20 text-amber-400 border border-amber-500/40 text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
          <Clock className="w-3 h-3" /> {elapsedMinutes}m
        </span>
      );
    }
    return (
      <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
        <Clock className="w-3 h-3" /> {elapsedMinutes}m
      </span>
    );
  };

  return (
    <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 shadow-lg transition-all hover:border-stone-700 flex flex-col justify-between">
      <div>
        {/* Ticket Top Meta */}
        <div className="flex items-center justify-between pb-3 border-b border-stone-800">
          <div className="flex items-center gap-2">
            <span className="text-base font-black text-amber-400 bg-amber-400/10 px-2.5 py-1 rounded-xl border border-amber-400/20">
              Table #{ticket.table_number || ticket.tableNumber || '1'}
            </span>
            <span className="text-xs text-stone-400 font-medium">
              #{ticket.id?.slice(0, 6)}
            </span>
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
              className="flex items-center justify-between text-xs py-1 border-b border-stone-800/50 last:border-0"
            >
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-stone-800 text-stone-200 font-black flex items-center justify-center text-xs">
                  {item.quantity}x
                </span>
                <span className="font-bold text-stone-100 text-sm">{item.name || item.item_name}</span>
              </div>
              <span className="text-[10px] text-stone-500 uppercase tracking-wider font-semibold">
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
          className={`w-full mt-3 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition active:scale-95 shadow-md cursor-pointer ${nextColor}`}
        >
          <span>{nextLabel}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      )}

      {isCompleted && (
        <div className="mt-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-center text-xs font-bold flex items-center justify-center gap-1.5">
          <CheckCircle className="w-4 h-4" />
          <span>Plated & Alerted to Waiter</span>
        </div>
      )}
    </div>
  );
}

