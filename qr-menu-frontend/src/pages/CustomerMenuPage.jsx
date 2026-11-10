import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Sparkles, Filter, AlertCircle, RefreshCw, CheckCircle2, Receipt } from 'lucide-react';
import Navbar from '../components/Navbar';
import MenuItemCard from '../components/MenuItemCard';
import ItemNotch from '../components/ItemNotch';
import CartDrawer from '../components/CartDrawer';
import ServiceCallModal from '../components/ServiceCallModal';
import FeedbackModal from '../components/FeedbackModal';
import UpiPaymentModal from '../components/UpiPaymentModal';
import { useCart } from '../context/CartContext';
import { api } from '../api';
import { socket } from '../socket';

class SafeModalBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err) {
    console.warn('SafeModalBoundary caught modal exception:', err);
  }
  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

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
  } = useCart();

  const [menuItems, setMenuItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState('ALL');
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
    setToastMessage('🎉 Bill settled via UPI! Thank you for dining with us.');
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

        // Fetch default table if none provided in URL or to discover restaurantId
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

        // Final fallback if restaurantId is still missing
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

          // Extract unique categories
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
        prev.map((it) => (it.id === updated.id ? { ...it, available: updated.available, is_available: updated.available } : it))
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

  // Silent background auto-sync so the diner never needs to reload the page
  const prevActiveOrderRef = useRef(null);

  // Smart adaptive background auto-sync: pauses when phone is asleep/tab hidden, relaxes interval when idle
  useEffect(() => {
    if (!tableId) return;

    const intervalTime = activeOrder ? 4000 : 18000; // 4s when cooking, 18s when idle/browsing

    const pollInterval = setInterval(async () => {
      if (document.hidden) return; // Don't burn database queries if phone screen is off or tab hidden
      await checkSession(tableId, true);
    }, intervalTime);

    return () => clearInterval(pollInterval);
  }, [tableId, activeOrder]);

  // Automatically detect when order status advances or when order is settled/paid to show feedback modal
  useEffect(() => {
    const prev = prevActiveOrderRef.current;
    if (prev && prev.id) {
      if (!activeOrder) {
        // Order transitioned from active to settled!
        setToastMessage('🎉 Bill settled! Thank you for dining with us.');
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
          setToastMessage('🍽️ Food served! Enjoy your meal.');
        }
      }
    }
    prevActiveOrderRef.current = activeOrder ? { id: activeOrder.id, status: activeOrder.status } : null;
  }, [activeOrder]);

  // Toast auto-dismiss
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(''), 3500);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Filtered menu with smart dietary inference
  const filteredItems = menuItems.filter((item) => {
    const isVeg = item.is_veg !== undefined
      ? Boolean(item.is_veg)
      : !item.name.toLowerCase().includes('chicken') &&
        !item.name.toLowerCase().includes('mutton') &&
        !item.name.toLowerCase().includes('fish') &&
        !item.name.toLowerCase().includes('meat') &&
        !item.name.toLowerCase().includes('egg') &&
        !item.name.toLowerCase().includes('prawn');

    const matchesCategory = activeCategory === 'ALL' || (item.category || '').toLowerCase() === activeCategory.toLowerCase();
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (item.description || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDiet = dietaryFilter === 'ALL' ||
                        (dietaryFilter === 'VEG' && isVeg) ||
                        (dietaryFilter === 'NON_VEG' && !isVeg);
    return matchesCategory && matchesSearch && matchesDiet;
  });

  // Calculate Veg vs Non-Veg metrics across all available dishes and filtered list
  const dietCounts = React.useMemo(() => {
    let allVeg = 0;
    let allNonVeg = 0;
    menuItems.forEach((it) => {
      const isVeg = it.is_veg !== undefined
        ? Boolean(it.is_veg)
        : !(it.name?.toLowerCase().includes('chicken') ||
            it.name?.toLowerCase().includes('mutton') ||
            it.name?.toLowerCase().includes('fish') ||
            it.name?.toLowerCase().includes('meat') ||
            it.name?.toLowerCase().includes('egg') ||
            it.name?.toLowerCase().includes('prawn'));
      if (isVeg) allVeg++;
      else allNonVeg++;
    });

    let filteredVeg = 0;
    let filteredNonVeg = 0;
    filteredItems.forEach((it) => {
      const isVeg = it.is_veg !== undefined
        ? Boolean(it.is_veg)
        : !(it.name?.toLowerCase().includes('chicken') ||
            it.name?.toLowerCase().includes('mutton') ||
            it.name?.toLowerCase().includes('fish') ||
            it.name?.toLowerCase().includes('meat') ||
            it.name?.toLowerCase().includes('egg') ||
            it.name?.toLowerCase().includes('prawn'));
      if (isVeg) filteredVeg++;
      else filteredNonVeg++;
    });

    return {
      allTotal: menuItems.length,
      allVeg,
      allNonVeg,
      filteredVeg,
      filteredNonVeg
    };
  }, [menuItems, filteredItems]);

  return (
    <div className="min-h-screen bg-stone-50 pb-28 text-stone-900">
      
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-20 inset-x-0 z-50 flex justify-center px-4 pointer-events-none">
          <div className="pointer-events-auto bg-stone-900 text-white text-xs font-semibold px-4 py-2.5 rounded-full shadow-xl border border-stone-700 flex items-center gap-2 animate-bounce">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Top Navbar */}
      <Navbar
        restaurantName="Royal Spice Bistro"
        tableNumber={tableNumber}
        sessionLabel={sessionLabel}
        customerName={customerName}
        hasActiveSession={hasActiveSession}
        onViewBill={() => setIsCartOpen(true)}
        onCallWaiter={() => setIsServiceModalOpen(true)}
      />

      {/* Hero Welcome Banner */}
      <div className="bg-linear-to-b from-amber-500/10 to-transparent py-5 px-4 border-b border-stone-200/50">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-800 text-[11px] font-bold tracking-wide uppercase mb-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Contactless Dining</span>
            </div>
            <h2 className="font-serif font-black text-2xl md:text-3xl text-stone-950 tracking-tight">
              Order Fresh to Table #{tableNumber || '1'}
            </h2>
            <p className="text-xs md:text-sm text-stone-600 mt-1 max-w-xl">
              Browse our seasonal chef creations, customize your taste preferences, and order straight from your mobile screen.
            </p>
          </div>

          {/* Quick Dietary Filters */}
          <div className="inline-flex p-1 bg-stone-200/80 rounded-2xl self-start md:self-auto shadow-2xs gap-1">
            <button
              onClick={() => setDietaryFilter('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                dietaryFilter === 'ALL'
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <span>All</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                dietaryFilter === 'ALL' ? 'bg-stone-100 text-stone-800' : 'bg-stone-300/60 text-stone-600'
              }`}>
                {dietCounts.allTotal}
              </span>
            </button>
            <button
              onClick={() => setDietaryFilter('VEG')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                dietaryFilter === 'VEG'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <div className="w-2.5 h-2.5 border border-current flex items-center justify-center rounded-2xs shrink-0">
                <div className="w-1 h-1 rounded-full bg-current"></div>
              </div>
              <span>Veg</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                dietaryFilter === 'VEG' ? 'bg-emerald-700 text-white' : 'bg-emerald-100 text-emerald-800'
              }`}>
                {dietCounts.allVeg}
              </span>
            </button>
            <button
              onClick={() => setDietaryFilter('NON_VEG')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                dietaryFilter === 'NON_VEG'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <div className="w-2.5 h-2.5 border border-current flex items-center justify-center rounded-2xs shrink-0">
                <div className="w-1 h-1 rounded-full bg-current"></div>
              </div>
              <span>Non-Veg</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                dietaryFilter === 'NON_VEG' ? 'bg-rose-700 text-white' : 'bg-rose-100 text-rose-800'
              }`}>
                {dietCounts.allNonVeg}
              </span>
            </button>
          </div>
        </div>
      </div>



      {/* Active Table Session Banner */}
      {hasActiveSession && (
        <div className="max-w-4xl mx-auto px-4 pt-4">
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-3xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-white flex items-center justify-center font-bold shrink-0 shadow-sm">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-serif font-black text-emerald-950 text-sm md:text-base">
                      Welcome, {customerName || activeOrder?.customer_name || 'Diner'}!
                    </span>
                    <span className="bg-emerald-200/90 text-emerald-950 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full">
                      Table #{tableNumber || '1'} &bull; {sessionLabel || 'Customer 1'} Active Tab
                    </span>
                  </div>
                  <p className="text-xs text-emerald-800 mt-0.5">
                    Order #{activeOrder?.id?.slice(0, 8)} &bull; Current Bill: <strong className="text-emerald-950 font-black">₹{parseFloat(activeOrder?.total || activeOrder?.total_amount || 0).toFixed(2)}</strong>
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsCartOpen(true)}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl transition shadow-xs shrink-0 cursor-pointer flex items-center gap-1.5"
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>View Bill / Items</span>
              </button>
            </div>

            {/* Live Kitchen Status Pill */}
            <div className="pt-2 border-t border-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-emerald-900 uppercase tracking-wider">
                  Kitchen Status:
                </span>
                <span
                  className={`text-xs font-black px-2.5 py-1 rounded-lg uppercase tracking-wider flex items-center gap-1.5 ${
                    activeOrder?.status === 'READY'
                      ? 'bg-emerald-500 text-white animate-pulse'
                      : activeOrder?.status === 'PREPARING'
                      ? 'bg-amber-500 text-stone-950'
                      : activeOrder?.status === 'SERVED'
                      ? 'bg-purple-600 text-white'
                      : 'bg-stone-900 text-white'
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
                <p className="text-[11px] text-emerald-800/90 truncate max-w-sm">
                  Dishes: {activeOrder.items.map((i) => `${i.quantity}x ${i.name || i.item_name}`).join(', ')}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sticky Search & Category Carousel */}
      <div className="sticky top-16 z-30 bg-white/95 backdrop-blur-md border-b border-stone-200/80 py-3 shadow-xs">
        <div className="max-w-4xl mx-auto px-4 space-y-3">
          
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search dishes, curries, breads or desserts..."
              className="w-full pl-10 pr-4 py-2 text-xs md:text-sm bg-stone-100 rounded-xl border border-transparent focus:border-amber-500 focus:bg-white focus:ring-1 focus:ring-amber-500 outline-none transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 text-xs text-stone-400 hover:text-stone-600 font-bold"
              >
                Clear
              </button>
            )}
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
            <button
              onClick={() => setActiveCategory('ALL')}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                activeCategory === 'ALL'
                  ? 'bg-stone-900 text-white shadow-xs'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              All Menu ({menuItems.length})
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all capitalize ${
                  activeCategory === cat
                    ? 'bg-stone-900 text-white shadow-xs'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>



      {/* Main Dishes Grid */}
      <main className="max-w-4xl mx-auto px-4 pt-6">
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center text-stone-400">
            <RefreshCw className="w-8 h-8 animate-spin text-amber-500 mb-3" />
            <p className="text-sm font-semibold">Loading Fresh Menu...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="py-20 text-center bg-white rounded-3xl border border-stone-200 p-8 shadow-xs">
            <AlertCircle className="w-10 h-10 text-stone-300 mx-auto mb-3" />
            <h3 className="font-bold text-stone-800 text-base">No dishes found</h3>
            <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
              We couldn't find any dishes matching "{searchQuery}". Try searching for another item or resetting filters.
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setActiveCategory('ALL');
                setDietaryFilter('ALL');
              }}
              className="mt-4 px-4 py-2 bg-stone-900 text-white text-xs font-bold rounded-xl hover:bg-amber-600 transition"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Dietary Status Pill */}
            <div className="flex items-center justify-between text-xs text-stone-500 px-1">
              <span className="font-semibold text-stone-700">
                {activeCategory === 'ALL' ? 'All Categories' : activeCategory} ({filteredItems.length} items)
              </span>
              <div className="flex items-center gap-2 text-[11px] font-bold">
                <span className="text-emerald-700 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                  {dietCounts.filteredVeg} Veg
                </span>
                <span className="text-stone-300">&bull;</span>
                <span className="text-rose-700 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
                  {dietCounts.filteredNonVeg} Non-Veg
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3.5 sm:gap-4">
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
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        onOrderSuccess={(msg) => setToastMessage(msg)}
        onOpenUpiModal={handleOpenUpiModal}
      />

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
          upiId="vallipriya1212-1@oksbi"
          upiName="Royal Spice Bistro"
          onPaymentSuccess={handleUpiPaymentSuccess}
        />
      </SafeModalBoundary>

      {/* Service Request / Call Waiter Modal */}
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

      {/* Customer 5-Star Feedback Modal */}
      <FeedbackModal
        isOpen={isFeedbackModalOpen}
        onClose={() => setIsFeedbackModalOpen(false)}
        orderId={lastCompletedOrderId || activeOrder?.id}
        tableId={tableId}
        restaurantId={restaurantId}
        onSubmitSuccess={(msg) => setToastMessage(msg)}
      />
    </div>
  );
}

