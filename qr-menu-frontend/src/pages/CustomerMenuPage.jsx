import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Search,
  Sparkles,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  Receipt,
  Phone,
  MapPin,
  Coffee,
  UtensilsCrossed,
  Gift,
  Truck,
  PartyPopper
} from 'lucide-react';
import Navbar from '../components/Navbar';
import MenuItemCard from '../components/MenuItemCard';
import ItemNotch from '../components/ItemNotch';
import CartDrawer from '../components/CartDrawer';
import ServiceCallModal from '../components/ServiceCallModal';
import FeedbackModal from '../components/FeedbackModal';
import UpiPaymentModal from '../components/UpiPaymentModal';
import KrishLogo from '../components/KrishLogo';
import { useCart } from '../context/CartContext';
import { api } from '../api';
import { socket } from '../socket';

class SafeModalBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(err, info) {
    console.warn('SafeModalBoundary caught modal exception:', err, info);
  }
  componentDidUpdate(prevProps) {
    if (prevProps.isOpen !== this.props.isOpen && this.state.hasError) {
      this.setState({ hasError: false, error: null });
    }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#14110E] border border-white/15 p-6 rounded-2xl max-w-sm text-center text-white space-y-3 shadow-2xl">
            <p className="font-bold text-sm">Order Drawer Notice</p>
            <p className="text-xs text-stone-400">
              {this.state.error?.message || 'An error occurred while displaying your order.'}
            </p>
            <div className="flex gap-2 justify-center pt-2">
              <button
                type="button"
                onClick={() => this.setState({ hasError: false, error: null })}
                className="px-4 py-2 krish-gradient-gold text-stone-950 font-bold text-xs rounded-xl cursor-pointer"
              >
                Reload Drawer
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Category emoji icon mapping for quick visual recognition
const CATEGORY_ICONS = {
  'mojito': '🍹',
  'ice cream': '🍨',
  'coffee & milk': '☕',
  'coffee and milk': '☕',
  'juice': '🧃',
  'fried chicken': '🍗',
  'french fries': '🍟',
  'sandwich': '🥪',
  'snacks': '🍿',
  'bun': '🥯',
  'maggi': '🍜',
  'bread omblate': '🍳',
  'briyani': '🍲',
  'fried rice': '🍚',
  'noodles': '🥢',
  'others': '🥘',
  'omblate': '🥚',
  'starters': '🥟',
  'main course': '🍛',
  'breads': '🫓',
  'beverages': '🥤',
  'desserts': '🍰'
};

const CAFE_CATEGORIES = new Set([
  'mojito', 'ice cream', 'coffee & milk', 'coffee and milk',
  'juice', 'fried chicken', 'french fries', 'sandwich', 'snacks',
  'bun', 'maggi', 'bread omblate', 'beverages', 'desserts', 'starters'
]);

const RESTAURANT_CATEGORIES = new Set([
  'briyani', 'fried rice', 'noodles', 'others', 'omblate',
  'main course', 'breads'
]);

export default function CustomerMenuPage() {
  const [searchParams] = useSearchParams();
  const urlTableId = searchParams.get('tableId') || '';
  const urlTableNumber = searchParams.get('tableNumber') || '1';

  const {
    tableId,
    setTableId,
    tableNumber,
    setTableNumber,
    restaurantId,
    setRestaurantId,
    sessionToken,
    sessionLabel,
    customerName,
    checkSession,
    hasActiveSession,
    activeOrder,
    totalItemCount = 0,
  } = useCart();

  const [menuItems, setMenuItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [menuMode, setMenuMode] = useState('ALL'); // 'ALL' | 'CAFE' | 'RESTAURANT'
  const [dietaryFilter, setDietaryFilter] = useState('ALL'); // 'ALL' | 'VEG' | 'NON_VEG'
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState('');

  // Modals
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [isUpiModalOpen, setIsUpiModalOpen] = useState(false);
  const [upiPaymentData, setUpiPaymentData] = useState({ amount: 0, orderId: null });
  const [lastCompletedOrderId, setLastCompletedOrderId] = useState(() => {
    return localStorage.getItem('qr_last_order_id') || '';
  });

  const handleOpenUpiModal = (target) => {
    setUpiPaymentData({
      amount: target?.amount || parseFloat(activeOrder?.total || activeOrder?.total_amount || 0),
      orderId: target?.orderId || activeOrder?.id
    });
    setIsUpiModalOpen(true);
  };

  const handleUpiPaymentSuccess = () => {
    setToastMessage('🎉 Bill settled via UPI! Thank you for dining with KRISH.');
    checkSession(tableId);
    setTimeout(() => setIsFeedbackModalOpen(true), 1200);
  };

  // Track active order ID to preserve for post-payment review
  useEffect(() => {
    if (activeOrder?.id) {
      setLastCompletedOrderId(activeOrder.id);
      localStorage.setItem('qr_last_order_id', activeOrder.id);
    }
  }, [activeOrder?.id]);

  // Initialize table & fetch menu
  useEffect(() => {
    async function init() {
      setIsLoading(true);
      try {
        let effectiveRestId = searchParams.get('restaurantId') || restaurantId;
        let effectiveTableId = urlTableId;

        if (!effectiveTableId || !effectiveRestId) {
          try {
            const data = await api.getDefaultTable();
            if (data.table) {
              if (!effectiveTableId) effectiveTableId = data.table.id;
              if (!effectiveRestId) effectiveRestId = data.table.restaurant_id;
              if (data.table.number && !urlTableNumber) setTableNumber(data.table.number);
            }
          } catch (e) {
            console.warn('Fallback table fetch warning:', e);
          }
        }

        if (effectiveTableId) {
          setTableId(effectiveTableId);
          if (urlTableNumber) setTableNumber(urlTableNumber);
          const sessData = await checkSession(effectiveTableId);
          if (sessData?.table?.restaurant_id) {
            effectiveRestId = sessData.table.restaurant_id;
          }
          if (sessData?.table?.number && !urlTableNumber) {
            setTableNumber(sessData.table.number);
          }
        }

        if (!effectiveRestId) {
          effectiveRestId = 'db4ed920-3d20-420a-9f54-99d3c0b48a08';
        }

        if (effectiveRestId) {
          setRestaurantId(effectiveRestId);
          const menuData = await api.getMenu(effectiveRestId);
          const rawItems = Array.isArray(menuData)
            ? menuData
            : (Array.isArray(menuData?.items) ? menuData.items : []);
          setMenuItems(rawItems);

          const uniqueCats = Array.from(new Set(rawItems.map((it) => it.category).filter(Boolean)));
          setCategories(uniqueCats);
        }
      } catch (err) {
        console.error('Failed to initialize menu:', err);
      } finally {
        setIsLoading(false);
      }
    }

    init();
  }, [urlTableId, urlTableNumber]);

  // Real-time socket events for menu updates & order status changes
  useEffect(() => {
    function handleMenuUpdate() {
      if (restaurantId) {
        api.getMenu(restaurantId).then((data) => {
          const rawItems = Array.isArray(data) ? data : (data?.items || []);
          setMenuItems(rawItems);
          const uniqueCats = Array.from(new Set(rawItems.map((it) => it.category).filter(Boolean)));
          setCategories(uniqueCats);
        });
      }
    }

    function handleAvailabilityChanged(updated) {
      if (!updated?.id) return;
      setMenuItems((prev) =>
        (Array.isArray(prev) ? prev : []).map((it) => (it.id === updated.id ? { ...it, available: updated.available, is_available: updated.available } : it))
      );
    }

    function handleOrderStatusUpdate(data) {
      if (!data) return;
      if (!activeOrder || activeOrder.id === data.orderId || data.tableId === tableId) {
        const nextSt = data.status || data.newStatus;
        if (nextSt === 'PAID') {
          setToastMessage('🎉 Bill settled! Thank you for dining with us.');
          checkSession(tableId);
          setTimeout(() => setIsFeedbackModalOpen(true), 1200);
        } else {
          setToastMessage(`Kitchen update: Order is now ${nextSt}!`);
          checkSession(tableId);
        }
      }
    }

    function handleSessionEnded() {
      setToastMessage('🎉 Bill settled! Thank you for dining with us.');
      checkSession(tableId);
      setTimeout(() => setIsFeedbackModalOpen(true), 1200);
    }

    socket.on('menu:updated', handleMenuUpdate);
    socket.on('menu:availability_changed', handleAvailabilityChanged);
    socket.on('order:status_updated', handleOrderStatusUpdate);
    socket.on('kitchen:ticket_advanced', handleOrderStatusUpdate);
    socket.on('order:items_added', () => checkSession(tableId));
    socket.on('order:dismissed', handleOrderStatusUpdate);
    socket.on('session:ended', handleSessionEnded);

    return () => {
      socket.off('menu:updated', handleMenuUpdate);
      socket.off('menu:availability_changed', handleAvailabilityChanged);
      socket.off('order:status_updated', handleOrderStatusUpdate);
      socket.off('kitchen:ticket_advanced', handleOrderStatusUpdate);
      socket.off('order:items_added');
      socket.off('order:dismissed', handleOrderStatusUpdate);
      socket.off('session:ended', handleSessionEnded);
    };
  }, [restaurantId, activeOrder, tableId]);

  // Adaptive background sync
  const prevActiveOrderRef = useRef(null);
  useEffect(() => {
    if (!tableId) return;
    const intervalTime = activeOrder ? 4000 : 18000;
    const pollInterval = setInterval(async () => {
      if (document.hidden) return;
      await checkSession(tableId, true);
    }, intervalTime);
    return () => clearInterval(pollInterval);
  }, [tableId, activeOrder]);

  // Toast on status progression
  useEffect(() => {
    const prev = prevActiveOrderRef.current;
    if (prev && prev.id) {
      if (!activeOrder) {
        setToastMessage('🎉 Bill settled! Thank you for dining at KRISH.');
        setTimeout(() => setIsFeedbackModalOpen(true), 800);
      } else if (activeOrder.status !== prev.status) {
        if (activeOrder.status === 'PAID') {
          setToastMessage('🎉 Bill settled! Thank you for dining with us.');
          setTimeout(() => setIsFeedbackModalOpen(true), 800);
        } else if (activeOrder.status === 'PREPARING') {
          setToastMessage('👨‍🍳 Chef is now preparing your dishes!');
        } else if (activeOrder.status === 'READY') {
          setToastMessage('🔔 Your food is ready! Table runner is on the way.');
        } else if (activeOrder.status === 'SERVED') {
          setToastMessage('🍽️ Food served! Enjoy your meal at KRISH.');
        }
      }
    }
    prevActiveOrderRef.current = activeOrder ? { id: activeOrder.id, status: activeOrder.status } : null;
  }, [activeOrder]);

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(''), 3500);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Filter categories by menu mode (Cafe vs Restaurant)
  const displayedCategories = categories.filter((cat) => {
    const lower = cat.toLowerCase();
    if (menuMode === 'CAFE') return CAFE_CATEGORIES.has(lower);
    if (menuMode === 'RESTAURANT') return RESTAURANT_CATEGORIES.has(lower);
    return true;
  });

  // Filtered menu items
  const filteredItems = menuItems.filter((item) => {
    const isVeg = item.is_veg !== undefined
      ? Boolean(item.is_veg)
      : !item.name.toLowerCase().includes('chicken') &&
        !item.name.toLowerCase().includes('mutton') &&
        !item.name.toLowerCase().includes('fish') &&
        !item.name.toLowerCase().includes('meat') &&
        !item.name.toLowerCase().includes('egg') &&
        !item.name.toLowerCase().includes('omblate') &&
        !item.name.toLowerCase().includes('prawn');

    const catKey = (item.category || '').toLowerCase();
    const matchesMode =
      menuMode === 'ALL' ||
      (menuMode === 'CAFE' && CAFE_CATEGORIES.has(catKey)) ||
      (menuMode === 'RESTAURANT' && RESTAURANT_CATEGORIES.has(catKey));

    const matchesCategory =
      activeCategory === 'ALL' ||
      catKey === activeCategory.toLowerCase();

    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      catKey.includes(searchQuery.toLowerCase());

    const matchesDiet =
      dietaryFilter === 'ALL' ||
      (dietaryFilter === 'VEG' && isVeg) ||
      (dietaryFilter === 'NON_VEG' && !isVeg);

    return matchesMode && matchesCategory && matchesSearch && matchesDiet;
  });

  // Diet counts
  const dietCounts = React.useMemo(() => {
    let allVeg = 0;
    let allNonVeg = 0;
    filteredItems.forEach((it) => {
      const isVeg = it.is_veg !== undefined
        ? Boolean(it.is_veg)
        : !(it.name?.toLowerCase().includes('chicken') ||
            it.name?.toLowerCase().includes('mutton') ||
            it.name?.toLowerCase().includes('fish') ||
            it.name?.toLowerCase().includes('meat') ||
            it.name?.toLowerCase().includes('egg') ||
            it.name?.toLowerCase().includes('omblate') ||
            it.name?.toLowerCase().includes('prawn'));
      if (isVeg) allVeg++;
      else allNonVeg++;
    });
    return { allTotal: filteredItems.length, allVeg, allNonVeg };
  }, [filteredItems]);

  return (
    <div className="min-h-screen bg-[#0B0B0D] text-stone-100 pb-28 krish-ambient-glow relative overflow-x-hidden">
      
      {/* Toast Alert Notification */}
      {toastMessage && (
        <div className="fixed top-20 inset-x-0 z-50 flex justify-center px-4 pointer-events-none">
          <div className="pointer-events-auto krish-glass-gold text-amber-200 text-xs font-bold px-5 py-3 rounded-full shadow-[0_8px_30px_rgba(255,196,0,0.4)] border border-amber-400/50 flex items-center gap-2.5 animate-bounce">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Top Navbar */}
      <Navbar
        restaurantName="KRISH Cafe & Restaurant"
        tableNumber={tableNumber}
        sessionLabel={sessionLabel}
        customerName={customerName}
        hasActiveSession={hasActiveSession}
        cartItemCount={totalItemCount}
        onOpenCart={() => setIsCartOpen(true)}
        onViewBill={() => setIsCartOpen(true)}
        onCallWaiter={() => setIsServiceModalOpen(true)}
      />

      {/* Hero Welcome & Brand Atmosphere Section */}
      <div className="relative py-7 px-4 border-b border-white/10 overflow-hidden">
        {/* Subtle Culinary Steam Wisps */}
        <div className="absolute top-0 right-1/4 w-32 h-32 pointer-events-none select-none opacity-20">
          <div className="w-8 h-8 rounded-full bg-gradient-to-t from-white/30 to-transparent blur-md animate-steam-1 absolute bottom-0 left-4" />
          <div className="w-10 h-10 rounded-full bg-gradient-to-t from-white/30 to-transparent blur-md animate-steam-2 absolute bottom-0 left-12" />
          <div className="w-6 h-6 rounded-full bg-gradient-to-t from-white/20 to-transparent blur-md animate-steam-3 absolute bottom-0 left-20" />
        </div>

        <div className="max-w-5xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          {/* Brand Identity & Taglines */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <KrishLogo size="md" showTagline={false} />
              <div className="border-l border-white/15 pl-3">
                <span className="font-script text-base text-amber-300 block leading-tight">
                  Taste the Happiness
                </span>
                <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400 block mt-0.5">
                  Good Food &bull; Good Mood &bull; Always Here!
                </span>
              </div>
            </div>

            {/* Quick Promo Badges Carousel */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {/* BOGO Juice Badge */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-red-600/30 to-amber-500/30 border border-red-500/50 text-[11px] font-black text-amber-200 shadow-sm animate-pulse">
                <Gift className="w-3.5 h-3.5 text-yellow-300" />
                <span>Juice: Buy 1 Get 1 Free</span>
              </div>

              {/* Free Delivery */}
              <a
                href="tel:8760633322"
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 hover:bg-white/10 border border-white/15 text-[11px] font-bold text-stone-300 transition"
              >
                <Truck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Free Home Delivery (8760633322)</span>
              </a>

              {/* Party Hall */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] font-medium text-stone-300">
                <PartyPopper className="w-3.5 h-3.5 text-amber-400" />
                <span>Birthday Party Hall</span>
              </div>

              {/* Location Link */}
              <a
                href="https://maps.google.com/?q=Rathinam+College+Front+Gate,+Eachanari,+Coimbatore+-+641021"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-medium text-amber-300/90 transition"
              >
                <MapPin className="w-3.5 h-3.5 text-red-400" />
                <span>Near Rathinam College Front Gate</span>
              </a>
            </div>
          </div>

          {/* Quick Dietary Filters (Veg / Non-Veg) */}
          <div className="inline-flex p-1 bg-stone-900/90 rounded-2xl border border-white/15 self-start md:self-center shadow-lg gap-1">
            <button
              type="button"
              onClick={() => setDietaryFilter('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                dietaryFilter === 'ALL'
                  ? 'krish-gradient-gold text-stone-950 font-black shadow-sm'
                  : 'text-stone-400 hover:text-white'
              }`}
            >
              <span>All Diet</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                dietaryFilter === 'ALL' ? 'bg-stone-950 text-amber-300' : 'bg-white/10 text-stone-400'
              }`}>
                {dietCounts.allTotal}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setDietaryFilter('VEG')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                dietaryFilter === 'VEG'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-stone-400 hover:text-white'
              }`}
            >
              <div className="w-2.5 h-2.5 border border-current flex items-center justify-center rounded-2xs shrink-0">
                <div className="w-1 h-1 rounded-full bg-current"></div>
              </div>
              <span>Veg</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                dietaryFilter === 'VEG' ? 'bg-emerald-800 text-white' : 'bg-white/10 text-stone-400'
              }`}>
                {dietCounts.allVeg}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setDietaryFilter('NON_VEG')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                dietaryFilter === 'NON_VEG'
                  ? 'bg-rose-600 text-white shadow-md'
                  : 'text-stone-400 hover:text-white'
              }`}
            >
              <div className="w-2.5 h-2.5 border border-current flex items-center justify-center rounded-2xs shrink-0">
                <div className="w-1 h-1 rounded-full bg-current"></div>
              </div>
              <span>Non-Veg</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                dietaryFilter === 'NON_VEG' ? 'bg-rose-800 text-white' : 'bg-white/10 text-stone-400'
              }`}>
                {dietCounts.allNonVeg}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Active Table Session Banner */}
      {hasActiveSession && (
        <div className="max-w-5xl mx-auto px-4 pt-4">
          <div className="krish-glass-card border border-emerald-500/40 rounded-3xl p-5 shadow-xl space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center font-bold shrink-0 shadow-inner">
                  <CheckCircle2 className="w-6 h-6 stroke-[2.5]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-sm sm:text-base">
                      Welcome, {customerName || activeOrder?.customer_name || 'Diner'}!
                    </span>
                    <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full">
                      Table #{tableNumber || '1'} &bull; {sessionLabel || 'Customer 1'} Tab
                    </span>
                  </div>
                  <p className="text-xs text-stone-300 mt-0.5 font-mono">
                    Order #{activeOrder?.id?.slice(0, 8)} &bull; Current Bill: <strong className="text-emerald-400 font-black">₹{parseFloat(activeOrder?.total || activeOrder?.total_amount || 0).toFixed(2)}</strong>
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsCartOpen(true)}
                className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:brightness-110 text-white text-xs font-bold rounded-xl transition shadow-md shrink-0 cursor-pointer flex items-center gap-1.5"
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>View Bill</span>
              </button>
            </div>

            {/* Live Kitchen Status Pill */}
            <div className="pt-2 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-amber-300 uppercase tracking-wider">
                  Kitchen Ticket Status:
                </span>
                <span
                  className={`text-xs font-black px-2.5 py-1 rounded-lg uppercase tracking-wider flex items-center gap-1.5 ${
                    activeOrder?.status === 'READY'
                      ? 'bg-emerald-500 text-white animate-pulse'
                      : activeOrder?.status === 'PREPARING'
                      ? 'bg-amber-500 text-stone-950'
                      : activeOrder?.status === 'SERVED'
                      ? 'bg-purple-600 text-white'
                      : 'bg-stone-800 text-amber-300 border border-amber-500/40'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-white"></span>
                  <span>
                    {activeOrder?.status === 'PENDING'
                      ? 'Forwarded to Kitchen'
                      : activeOrder?.status === 'PREPARING'
                      ? 'Chef Cooking'
                      : activeOrder?.status === 'READY'
                      ? 'Ready to Serve'
                      : activeOrder?.status === 'SERVED'
                      ? 'Served at Table'
                      : activeOrder?.status || 'Processing'}
                  </span>
                </span>
              </div>

              {/* Running Dishes on Tab */}
              {Array.isArray(activeOrder?.items) && activeOrder.items.length > 0 && (
                <p className="text-[11px] text-stone-400 truncate max-w-sm">
                  Active Items: {(Array.isArray(activeOrder?.items) ? activeOrder.items : []).map((i) => `${i?.quantity || 1}x ${i?.name || i?.item_name || 'Item'}`).join(', ')}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sticky Dual Menu Switcher & Category Carousel */}
      <div className="sticky top-16 sm:top-18 z-30 bg-[#0B0B0D]/95 backdrop-blur-xl border-b border-white/10 py-3 shadow-[0_8px_30px_rgba(0,0,0,0.6)]">
        <div className="max-w-5xl mx-auto px-4 space-y-3">
          
          {/* Top Bar: Cafe vs Restaurant Segmented Switch & Search */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            
            {/* Segmented Mode Switch: All / Cafe / Restaurant */}
            <div className="inline-flex p-1 bg-stone-900/90 rounded-2xl border border-white/15 self-start sm:self-auto shadow-md gap-1">
              <button
                type="button"
                onClick={() => {
                  setMenuMode('ALL');
                  setActiveCategory('ALL');
                }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  menuMode === 'ALL'
                    ? 'krish-gradient-gold text-stone-950 font-black shadow-sm'
                    : 'text-stone-400 hover:text-white'
                }`}
              >
                <span>🌟 All Dishes</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMenuMode('CAFE');
                  setActiveCategory('ALL');
                }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  menuMode === 'CAFE'
                    ? 'krish-gradient-gold text-stone-950 font-black shadow-sm'
                    : 'text-stone-400 hover:text-white'
                }`}
              >
                <Coffee className="w-3.5 h-3.5" />
                <span>Cafe Menu</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMenuMode('RESTAURANT');
                  setActiveCategory('ALL');
                }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  menuMode === 'RESTAURANT'
                    ? 'krish-gradient-gold text-stone-950 font-black shadow-sm'
                    : 'text-stone-400 hover:text-white'
                }`}
              >
                <UtensilsCrossed className="w-3.5 h-3.5" />
                <span>Restaurant Menu</span>
              </button>
            </div>

            {/* Search Box */}
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search briyani, mojito, fries, maggi..."
                className="w-full pl-10 pr-9 py-2 text-xs md:text-sm bg-stone-900/90 rounded-xl border border-white/15 text-white placeholder-stone-500 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 outline-none transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-2.5 text-xs text-stone-400 hover:text-white font-bold cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Swipeable Horizontal Category Chips */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
            <button
              type="button"
              onClick={() => setActiveCategory('ALL')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                activeCategory === 'ALL'
                  ? 'krish-gradient-gold text-stone-950 font-black shadow-[0_2px_10px_rgba(255,196,0,0.3)]'
                  : 'bg-stone-900/90 text-stone-300 hover:text-white border border-white/10'
              }`}
            >
              <span>🔥 All {menuMode === 'CAFE' ? 'Cafe' : menuMode === 'RESTAURANT' ? 'Restaurant' : 'Menu'}</span>
            </button>

            {displayedCategories.map((cat) => {
              const lower = cat.toLowerCase();
              const icon = CATEGORY_ICONS[lower] || '🍽️';
              const isSelected = activeCategory.toLowerCase() === lower;

              return (
                <button
                  type="button"
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all capitalize cursor-pointer flex items-center gap-1.5 ${
                    isSelected
                      ? 'krish-gradient-gold text-stone-950 font-black shadow-[0_2px_10px_rgba(255,196,0,0.3)]'
                      : 'bg-stone-900/90 text-stone-300 hover:text-white border border-white/10'
                  }`}
                >
                  <span>{icon}</span>
                  <span>{cat}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Dishes Grid */}
      <main className="max-w-5xl mx-auto px-4 pt-6">
        {isLoading ? (
          <div className="py-24 flex flex-col items-center justify-center text-stone-400">
            <RefreshCw className="w-9 h-9 animate-spin text-amber-400 mb-3" />
            <p className="text-sm font-bold text-stone-200">Loading KRISH Menu...</p>
            <p className="text-xs text-stone-500 mt-1">Preparing fresh dishes</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="py-20 text-center krish-glass-card rounded-3xl border border-white/10 p-8 shadow-xl max-w-md mx-auto">
            <AlertCircle className="w-12 h-12 text-amber-400 mx-auto mb-3" />
            <h3 className="font-bold text-white text-base">No dishes found</h3>
            <p className="text-xs text-stone-400 mt-1 max-w-sm mx-auto">
              We couldn't find any items matching "{searchQuery}". Try exploring another category or clearing your search.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setActiveCategory('ALL');
                setDietaryFilter('ALL');
                setMenuMode('ALL');
              }}
              className="mt-4 px-5 py-2 krish-gradient-gold text-stone-950 text-xs font-black rounded-xl hover:brightness-110 transition cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Header info bar */}
            <div className="flex items-center justify-between text-xs text-stone-400 px-1">
              <span className="font-semibold text-stone-300 flex items-center gap-1.5">
                <span>{activeCategory === 'ALL' ? (menuMode === 'CAFE' ? 'Cafe Menu' : menuMode === 'RESTAURANT' ? 'Restaurant Menu' : 'All Catalog') : activeCategory}</span>
                <span className="text-stone-500">&bull;</span>
                <span className="text-amber-400 font-mono font-bold">{filteredItems.length} dishes</span>
              </span>
              <div className="flex items-center gap-2 text-[11px] font-bold">
                <span className="text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  {dietCounts.allVeg} Veg
                </span>
                <span className="text-stone-600">&bull;</span>
                <span className="text-rose-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                  {dietCounts.allNonVeg} Non-Veg
                </span>
              </div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-4">
              {filteredItems.map((item) => (
                <MenuItemCard key={item.id} item={item} />
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Floating Bottom Sticky Notch */}
      <ItemNotch
        onOpenCart={() => setIsCartOpen(true)}
        onOpenActiveBill={() => setIsCartOpen(true)}
        onOpenUpiModal={handleOpenUpiModal}
      />

      {/* Cart & Ordering Drawer */}
      <SafeModalBoundary isOpen={isCartOpen}>
        <CartDrawer
          isOpen={isCartOpen}
          onClose={() => setIsCartOpen(false)}
          onOrderSuccess={(msg) => setToastMessage(msg)}
          onOpenUpiModal={handleOpenUpiModal}
        />
      </SafeModalBoundary>

      {/* Dynamic UPI Payment Modal */}
      <SafeModalBoundary>
        <UpiPaymentModal
          isOpen={isUpiModalOpen}
          onClose={() => setIsUpiModalOpen(false)}
          amount={upiPaymentData.amount || parseFloat(activeOrder?.total || activeOrder?.total_amount || 0)}
          tableId={tableId || ''}
          tableNumber={tableNumber || '1'}
          orderId={upiPaymentData.orderId || activeOrder?.id}
          sessionToken={sessionToken || ''}
          customerName={customerName || ''}
          upiId="8760633322@oksbi"
          upiName="KRISH Cafe & Restaurant"
          onPaymentSuccess={handleUpiPaymentSuccess}
        />
      </SafeModalBoundary>

      {/* Service Request / Call Waiter Modal */}
      <SafeModalBoundary>
        <ServiceCallModal
          isOpen={isServiceModalOpen}
          onClose={() => setIsServiceModalOpen(false)}
          tableId={tableId || ''}
          tableNumber={tableNumber || '1'}
          sessionToken={sessionToken || ''}
          sessionLabel={sessionLabel || 'Customer 1'}
          customerName={customerName || ''}
          onCallSuccess={(msg) => setToastMessage(msg)}
        />
      </SafeModalBoundary>

      {/* Customer 5-Star Feedback Modal */}
      <SafeModalBoundary>
        <FeedbackModal
          isOpen={isFeedbackModalOpen}
          onClose={() => setIsFeedbackModalOpen(false)}
          orderId={lastCompletedOrderId || activeOrder?.id}
          tableId={tableId}
          restaurantId={restaurantId}
          onSubmitSuccess={(msg) => setToastMessage(msg)}
        />
      </SafeModalBoundary>
    </div>
  );
}
