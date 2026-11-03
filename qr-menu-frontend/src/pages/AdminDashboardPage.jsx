import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  TrendingUp,
  ShoppingBag,
  Users,
  Percent,
  Receipt,
  BellRing,
  Utensils,
  QrCode,
  Tag,
  Star,
  FileSpreadsheet,
  LogOut,
  RefreshCw,
  CheckCircle,
  Eye,
  Download,
  AlertCircle,
  Clock,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  ChefHat,
} from 'lucide-react';
import { api } from '../api';
import { socket } from '../socket';

export default function AdminDashboardPage() {
  const navigate = useNavigate();
  const token = localStorage.getItem('qr_admin_token');

  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'orders' | 'service' | 'menu' | 'tables' | 'coupons' | 'reviews'
  const [restaurantId, setRestaurantId] = useState('');
  const [overview, setOverview] = useState(null);
  const [serviceRequests, setServiceRequests] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [tables, setTables] = useState([]);
  const [feedbackList, setFeedbackList] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [ordersList, setOrdersList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState('');

  // Settlement modal state
  const [settleOrderId, setSettleOrderId] = useState(null);
  const [settleMethod, setSettleMethod] = useState('UPI');

  // Coupon form state
  const [newCouponCode, setNewCouponCode] = useState('');
  const [newCouponDiscount, setNewCouponDiscount] = useState('10');
  const [newCouponMinOrder, setNewCouponMinOrder] = useState('300');

  // Check auth
  useEffect(() => {
    if (!token) {
      navigate('/admin/login');
    }
  }, [token, navigate]);

  const loadAllData = async (rId) => {
    if (!rId) return;
    try {
      const [overviewData, serviceData, menuData, feedbackData, couponData, ordersData] = await Promise.all([
        api.getAdminOverview(rId, token).catch(() => null),
        api.getServiceRequests(rId, token).catch(() => []),
        api.getMenu(rId).catch(() => ({ items: [] })),
        api.getFeedbackList(rId, token).catch(() => []),
        api.getCoupons(rId, token).catch(() => []),
        api.getAdminOrders(rId, token).catch(() => []),
      ]);

      if (overviewData) setOverview(overviewData);
      setServiceRequests(serviceData);
      setMenuItems(menuData.items || menuData);
      setFeedbackList(feedbackData.reviews || (Array.isArray(feedbackData) ? feedbackData : []));
      setCoupons(couponData);
      setOrdersList(Array.isArray(ordersData) ? ordersData : []);

      // Fetch bulk QR / tables
      try {
        const qrBatch = await api.getBulkQRCodes(rId);
        setTables(qrBatch.tables || []);
      } catch {
        // fallback
      }
    } catch (err) {
      console.error('Data load error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    async function init() {
      try {
        const res = await fetch('/api/order/tables/default');
        const data = await res.json();
        const rId = data.table?.restaurant_id || '2dbedc29-66a4-43fd-9dbb-68f86f5608e5';
        setRestaurantId(rId);
        await loadAllData(rId);
      } catch {
        setIsLoading(false);
      }
    }
    init();
  }, []);

  // Real-time socket events
  useEffect(() => {
    function handleServiceRequested(req) {
      setToastMessage(`🛎️ New Table Call: ${req.request_type || 'Assistance'} on Table #${req.table_number || ''}`);
      setServiceRequests((prev) => [req, ...prev]);
    }

    function handleServiceResolved(data) {
      setServiceRequests((prev) => prev.filter((r) => r.id !== data.requestId));
    }

    function handleOrderActivity() {
      if (restaurantId && token) {
        api.getAdminOverview(restaurantId, token).then(setOverview).catch(() => {});
        api.getAdminOrders(restaurantId, token).then(setOrdersList).catch(() => {});
      }
    }

    socket.on('service:requested', handleServiceRequested);
    socket.on('service:resolved', handleServiceResolved);
    socket.on('order:new', handleOrderActivity);
    socket.on('order:items_added', handleOrderActivity);
    socket.on('kitchen:ticket_advanced', handleOrderActivity);
    socket.on('order:status_updated', handleOrderActivity);
    socket.on('order:dismissed', handleOrderActivity);

    return () => {
      socket.off('service:requested', handleServiceRequested);
      socket.off('service:resolved', handleServiceResolved);
      socket.off('order:new', handleOrderActivity);
      socket.off('order:items_added', handleOrderActivity);
      socket.off('kitchen:ticket_advanced', handleOrderActivity);
      socket.off('order:status_updated', handleOrderActivity);
      socket.off('order:dismissed', handleOrderActivity);
    };
  }, [restaurantId, token]);

  // Toast timer
  useEffect(() => {
    if (toastMessage) {
      const t = setTimeout(() => setToastMessage(''), 4000);
      return () => clearTimeout(t);
    }
  }, [toastMessage]);

  const handleLogout = () => {
    localStorage.removeItem('qr_admin_token');
    navigate('/admin/login');
  };

  // Toggle item stock
  const handleToggleStock = async (itemId) => {
    try {
      const res = await api.toggleDishAvailability(itemId, token);
      setMenuItems((prev) =>
        prev.map((item) =>
          item.id === itemId
            ? { ...item, available: res.item.available, is_available: res.item.available }
            : item
        )
      );
      setToastMessage(`Updated '${res.item.name}' stock status!`);
    } catch (err) {
      alert(err.message || 'Failed to toggle availability');
    }
  };

  // Resolve service call
  const handleResolveService = async (reqId) => {
    try {
      await api.resolveServiceRequest(reqId, token);
      setServiceRequests((prev) => prev.filter((r) => r.id !== reqId));
      setToastMessage('Table request marked resolved!');
    } catch (err) {
      alert(err.message || 'Failed to resolve request');
    }
  };

  // Settle bill
  const handleConfirmSettle = async () => {
    if (!settleOrderId) return;
    try {
      await api.dismissAndSettleOrder(settleOrderId, settleMethod, token);
      setToastMessage(`Order settled via ${settleMethod}! Table is now free.`);
      setSettleOrderId(null);
      await loadAllData(restaurantId);
    } catch (err) {
      alert(err.message || 'Failed to settle order');
    }
  };

  // Create coupon
  const handleCreateCoupon = async (e) => {
    e.preventDefault();
    if (!newCouponCode) return;
    try {
      const res = await api.createCoupon(
        {
          restaurant_id: restaurantId,
          code: newCouponCode.trim().toUpperCase(),
          discount_percentage: parseFloat(newCouponDiscount),
          minimum_order_amount: parseFloat(newCouponMinOrder),
        },
        token
      );
      setCoupons((prev) => [res.coupon, ...prev]);
      setToastMessage(`Coupon ${newCouponCode} created!`);
      setNewCouponCode('');
    } catch (err) {
      alert(err.message || 'Failed to create coupon');
    }
  };

  const pendingCallsCount = serviceRequests.filter((r) => r.status === 'PENDING').length;

  return (
    <div className="min-h-screen bg-stone-100 flex flex-col font-sans text-stone-900">
      
      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-20 inset-x-0 z-50 flex justify-center px-4 pointer-events-none">
          <div className="pointer-events-auto bg-stone-900 text-white text-xs font-semibold px-4 py-2.5 rounded-full shadow-2xl border border-stone-700 flex items-center gap-2 animate-bounce">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Admin Top Navigation */}
      <header className="h-16 bg-white border-b border-stone-200 px-6 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-linear-to-tr from-amber-600 to-amber-500 text-white flex items-center justify-center font-bold shadow-md shadow-amber-500/20">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-serif font-bold text-base text-stone-900 leading-tight">
              Royal Spice Bistro &bull; Executive Portal
            </h1>
            <p className="text-[11px] text-stone-500">
              Live Operations &bull; Restaurant ID: {restaurantId?.slice(0, 8)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/kitchen"
            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500 text-stone-950 hover:bg-amber-400 transition flex items-center gap-1.5 shadow-xs"
          >
            <ChefHat className="w-4 h-4" />
            <span>Launch KDS</span>
          </Link>

          <a
            href={api.getSalesCSVUrl(restaurantId)}
            download
            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-stone-100 hover:bg-stone-200 text-stone-700 transition flex items-center gap-1.5 border border-stone-200"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Export CSV</span>
          </a>

          <button
            onClick={() => loadAllData(restaurantId)}
            className="p-2 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-xl transition"
            title="Refresh All Metrics"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={handleLogout}
            className="p-2 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition"
            title="Log Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Tab Navigation Ribbon */}
      <div className="bg-white border-b border-stone-200 px-6 py-2 overflow-x-auto no-scrollbar">
        <div className="flex gap-2">
          {[
            { id: 'overview', label: 'Bento Overview', icon: TrendingUp },
            { id: 'orders', label: 'Live Orders & Checkout', icon: ShoppingBag },
            { id: 'service', label: `Staff Calls (${pendingCallsCount})`, icon: BellRing, badge: pendingCallsCount > 0 },
            { id: 'menu', label: 'Menu & Stock Toggle', icon: Utensils },
            { id: 'tables', label: 'Tables & QR Studio', icon: QrCode },
            { id: 'coupons', label: 'Promos & Coupons', icon: Tag },
            { id: 'reviews', label: 'Diner Reviews', icon: Star },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${
                  isActive
                    ? 'bg-stone-900 text-white shadow-xs'
                    : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-amber-400' : 'text-stone-500'}`} />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Tab Content */}
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
        
        {/* TAB 1: BENTO OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-6 animate-fade-in">
            {/* Top 4 KPI Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-3xl border border-stone-200 shadow-xs">
                <div className="flex items-center justify-between text-stone-500 mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider">Gross Revenue</span>
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                </div>
                <p className="text-2xl font-black text-stone-950">
                  ₹{overview?.financials?.gross_revenue ? parseFloat(overview.financials.gross_revenue).toFixed(2) : '0.00'}
                </p>
                <p className="text-[11px] text-emerald-600 font-semibold mt-1">
                  Includes settled + running tabs
                </p>
              </div>

              <div className="bg-white p-5 rounded-3xl border border-stone-200 shadow-xs">
                <div className="flex items-center justify-between text-stone-500 mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider">Total Orders</span>
                  <ShoppingBag className="w-4 h-4 text-amber-600" />
                </div>
                <p className="text-2xl font-black text-stone-950">
                  {overview?.financials?.total_orders || 0}
                </p>
                <p className="text-[11px] text-stone-500 font-medium mt-1">
                  Across all dining tables
                </p>
              </div>

              <div className="bg-white p-5 rounded-3xl border border-stone-200 shadow-xs">
                <div className="flex items-center justify-between text-stone-500 mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider">Avg Order Value (AOV)</span>
                  <Users className="w-4 h-4 text-blue-600" />
                </div>
                <p className="text-2xl font-black text-stone-950">
                  ₹{overview?.financials?.average_order_value ? parseFloat(overview.financials.average_order_value).toFixed(2) : '0.00'}
                </p>
                <p className="text-[11px] text-stone-500 font-medium mt-1">
                  Per table party
                </p>
              </div>

              <div className="bg-white p-5 rounded-3xl border border-stone-200 shadow-xs">
                <div className="flex items-center justify-between text-stone-500 mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider">GST Tax (5%)</span>
                  <Percent className="w-4 h-4 text-purple-600" />
                </div>
                <p className="text-2xl font-black text-stone-950">
                  ₹{overview?.financials?.total_tax_collected ? parseFloat(overview.financials.total_tax_collected).toFixed(2) : '0.00'}
                </p>
                <p className="text-[11px] text-purple-600 font-semibold mt-1">
                  Automated accounting audit
                </p>
              </div>
            </div>

            {/* Bento Grid: Best Sellers + Table Ranking */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Best-Sellers (2 cols) */}
              <div className="lg:col-span-2 bg-white rounded-3xl border border-stone-200 p-6 shadow-xs">
                <h3 className="font-serif font-bold text-base text-stone-900 mb-4 flex items-center justify-between">
                  <span>Top-Selling Signature Dishes</span>
                  <span className="text-xs text-stone-400 font-sans font-normal">Real-time volume</span>
                </h3>
                <div className="space-y-3">
                  {(overview?.top_items || []).length === 0 ? (
                    <p className="text-xs text-stone-400 italic py-6 text-center">
                      No order sales recorded today yet.
                    </p>
                  ) : (
                    overview.top_items.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 rounded-2xl bg-stone-50 border border-stone-100"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-7 h-7 rounded-xl bg-amber-500/20 text-amber-900 font-bold text-xs flex items-center justify-center">
                            #{idx + 1}
                          </span>
                          <div>
                            <p className="text-xs font-bold text-stone-900">{item.name}</p>
                            <p className="text-[11px] text-stone-500">Category: {item.category || 'Mains'}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-bold text-stone-900">{item.total_sold} ordered</span>
                          <p className="text-[11px] text-emerald-600 font-semibold">
                            ₹{parseFloat(item.revenue || 0).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Table Performance */}
              <div className="bg-white rounded-3xl border border-stone-200 p-6 shadow-xs">
                <h3 className="font-serif font-bold text-base text-stone-900 mb-4">
                  Table Turnaround
                </h3>
                <div className="space-y-2.5">
                  {(overview?.table_performance || []).map((t, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-2xl bg-stone-50 border border-stone-100 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                        <span className="text-xs font-bold text-stone-900">
                          Table #{t.table_number}
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-stone-900">
                          ₹{parseFloat(t.revenue || 0).toFixed(2)}
                        </p>
                        <p className="text-[10px] text-stone-500">{t.orders_count} orders</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: LIVE ORDERS & CHECKOUT */}
        {activeTab === 'orders' && (
          <div className="bg-white rounded-3xl border border-stone-200 p-6 shadow-xs space-y-4 animate-fade-in">
            <div className="flex items-center justify-between pb-4 border-b border-stone-100">
              <div>
                <h3 className="font-serif font-bold text-base text-stone-900">
                  Live Orders Stream
                </h3>
                <p className="text-xs text-stone-500">
                  Monitor active table tabs and mark bills as settled to free up tables.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {(ordersList.length === 0 && (!overview?.recent_orders || overview.recent_orders.length === 0)) ? (
                <p className="text-xs text-stone-400 italic py-8 text-center">
                  No active orders recorded. Fresh orders placed from table QR codes will appear here in real-time.
                </p>
              ) : (
                (ordersList.length > 0 ? ordersList : overview.recent_orders).map((order) => (
                  <div
                    key={order.id}
                    className="p-4 rounded-2xl bg-stone-50 border border-stone-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-stone-900 bg-amber-200/80 px-2.5 py-1 rounded-lg">
                          Table #{order.table_number || '1'}
                        </span>
                        <span className="text-xs text-stone-500 font-mono">#{order.id.slice(0, 8)}</span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                            order.status === 'PAID'
                              ? 'bg-emerald-100 text-emerald-800'
                              : order.status === 'SERVED'
                              ? 'bg-purple-100 text-purple-800'
                              : order.status === 'READY'
                              ? 'bg-blue-100 text-blue-800'
                              : order.status === 'PREPARING'
                              ? 'bg-amber-100 text-amber-900'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}
                        >
                          {order.status === 'PENDING' ? 'Forwarded to Kitchen' : order.status}
                        </span>
                      </div>
                      <p className="text-xs text-stone-600 mt-1">
                        Diner: <strong className="text-stone-900">{order.customer_name || 'Guest'}</strong> {order.customer_phone || order.phone ? `(${order.customer_phone || order.phone})` : ''}
                      </p>
                      
                      {/* Dishes ordered on this bill */}
                      {Array.isArray(order.items) && order.items.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {order.items.map((it, idx) => (
                            <span
                              key={idx}
                              className={`text-[11px] font-medium px-2 py-0.5 rounded-md flex items-center gap-1 ${
                                it.status === 'SERVED'
                                  ? 'bg-emerald-100/80 text-emerald-900 border border-emerald-200'
                                  : it.status === 'PREPARING'
                                  ? 'bg-amber-100/80 text-amber-900 border border-amber-200'
                                  : 'bg-stone-200/80 text-stone-800'
                              }`}
                            >
                              <span>{it.quantity}x {it.item_name || it.name}</span>
                              {it.status === 'SERVED' && <span className="text-[9px] font-bold text-emerald-700">(Served)</span>}
                            </span>
                          ))}
                        </div>
                      )}

                      {order.notes && (
                        <p className="text-[11px] text-amber-700 italic mt-1">
                          Chef Note: "{order.notes}"
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between md:justify-end gap-4 border-t md:border-0 pt-3 md:pt-0 border-stone-200">
                      <div className="text-right">
                        <p className="text-base font-black text-stone-950">
                          ₹{parseFloat(order.total || order.total_amount || 0).toFixed(2)}
                        </p>
                        <p className="text-[10px] text-stone-500 uppercase font-bold tracking-wider">
                          {order.status === 'PAID' ? `Settled (${order.payment_method || 'CASH'})` : 'Bill Unsettled'}
                        </p>
                      </div>

                      {order.status !== 'PAID' && (
                        <button
                          onClick={() => setSettleOrderId(order.id)}
                          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-xs transition active:scale-95 cursor-pointer whitespace-nowrap"
                        >
                          Settle & Free Table
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 3: STAFF SERVICE REQUESTS */}
        {activeTab === 'service' && (
          <div className="bg-white rounded-3xl border border-stone-200 p-6 shadow-xs space-y-4 animate-fade-in">
            <div className="flex items-center justify-between pb-4 border-b border-stone-100">
              <div>
                <h3 className="font-serif font-bold text-base text-stone-900">
                  Waiter Calling & Service Queue
                </h3>
                <p className="text-xs text-stone-500">
                  Live table bells pressed by customers for assistance.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {serviceRequests.length === 0 ? (
                <div className="py-12 text-center text-stone-400 text-xs italic">
                  All table service calls have been resolved!
                </div>
              ) : (
                serviceRequests.map((req) => (
                  <div
                    key={req.id}
                    className="p-4 rounded-2xl bg-stone-50 border border-stone-200 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-700 flex items-center justify-center font-bold">
                        <BellRing className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-stone-900">
                          Table #{req.table_number || '1'} &bull; {req.request_type}
                        </p>
                        <p className="text-xs text-stone-500 mt-0.5">
                          {req.note || 'Assistance requested'}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleResolveService(req.id)}
                      className="px-3.5 py-1.5 bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs rounded-xl transition"
                    >
                      Resolve Call
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 4: MENU & STOCK CONTROLS */}
        {activeTab === 'menu' && (
          <div className="bg-white rounded-3xl border border-stone-200 p-6 shadow-xs space-y-4 animate-fade-in">
            <div className="flex items-center justify-between pb-4 border-b border-stone-100">
              <div>
                <h3 className="font-serif font-bold text-base text-stone-900">
                  Menu & 1-Click Out-of-Stock Controls
                </h3>
                <p className="text-xs text-stone-500">
                  Toggle dish availability in real-time. Instantly disables ordering on customer phones.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {menuItems.map((item) => {
                const isAvail = item.is_available !== false && item.available !== false;
                return (
                  <div
                    key={item.id}
                    className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between ${
                      isAvail ? 'bg-stone-50 border-stone-200' : 'bg-rose-50/50 border-rose-200 opacity-70'
                    }`}
                  >
                    <div>
                      <p className="text-xs font-bold text-stone-900">{item.name}</p>
                      <p className="text-[11px] text-stone-500">
                        {item.category} &bull; ₹{parseFloat(item.price).toFixed(2)}
                      </p>
                    </div>

                    <button
                      onClick={() => handleToggleStock(item.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
                        isAvail
                          ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                          : 'bg-rose-600 text-white hover:bg-rose-500'
                      }`}
                    >
                      {isAvail ? (
                        <>
                          <ToggleRight className="w-4 h-4 text-emerald-600" />
                          <span>In Stock</span>
                        </>
                      ) : (
                        <>
                          <ToggleLeft className="w-4 h-4 text-white" />
                          <span>Out of Stock</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 5: TABLES & QR STUDIO */}
        {activeTab === 'tables' && (
          <div className="bg-white rounded-3xl border border-stone-200 p-6 shadow-xs space-y-6 animate-fade-in">
            <div className="flex items-center justify-between pb-4 border-b border-stone-100">
              <div>
                <h3 className="font-serif font-bold text-base text-stone-900">
                  Table QR Code Studio
                </h3>
                <p className="text-xs text-stone-500">
                  Preview and download individual PNG/SVG vector QR codes or print bulk sticker sheets.
                </p>
              </div>

              <button
                onClick={() => window.print()}
                className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 font-bold text-xs text-stone-950 rounded-xl transition flex items-center gap-1.5 shadow-xs"
              >
                <Download className="w-4 h-4" />
                <span>Print Sticker Sheets</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {tables.map((tbl) => (
                <div
                  key={tbl.table_id}
                  className="p-5 rounded-3xl bg-stone-50 border border-stone-200 text-center flex flex-col items-center justify-between"
                >
                  <span className="font-black text-sm text-stone-900">
                    Table #{tbl.table_number}
                  </span>

                  <div className="my-3 p-3 bg-white rounded-2xl shadow-xs border border-stone-100">
                    <img
                      src={tbl.qr_data_url}
                      alt={`Table ${tbl.table_number} QR`}
                      className="w-36 h-36 mx-auto object-contain"
                    />
                  </div>

                  <div className="flex gap-2 w-full pt-2">
                    <a
                      href={`/api/qr/${tbl.table_id}`}
                      download={`table_${tbl.table_number}_qr.png`}
                      className="flex-1 py-1.5 bg-stone-900 hover:bg-stone-800 text-white text-[11px] font-bold rounded-xl transition"
                    >
                      PNG
                    </a>
                    <a
                      href={`/api/qr/${tbl.table_id}?format=svg`}
                      download={`table_${tbl.table_number}_qr.svg`}
                      className="flex-1 py-1.5 bg-stone-200 hover:bg-stone-300 text-stone-800 text-[11px] font-bold rounded-xl transition"
                    >
                      SVG
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 6: PROMOS & COUPONS */}
        {activeTab === 'coupons' && (
          <div className="bg-white rounded-3xl border border-stone-200 p-6 shadow-xs space-y-6 animate-fade-in">
            <h3 className="font-serif font-bold text-base text-stone-900">
              Promotional Discount Coupons
            </h3>

            {/* Create Coupon Form */}
            <form onSubmit={handleCreateCoupon} className="p-4 bg-stone-50 rounded-2xl border border-stone-200 grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-bold uppercase text-stone-500 mb-1">Coupon Code</label>
                <input
                  type="text"
                  placeholder="E.g. FESTIVE15"
                  value={newCouponCode}
                  onChange={(e) => setNewCouponCode(e.target.value.toUpperCase())}
                  className="w-full text-xs p-2 rounded-xl border border-stone-200 uppercase font-bold"
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase text-stone-500 mb-1">Discount %</label>
                <input
                  type="number"
                  placeholder="10"
                  value={newCouponDiscount}
                  onChange={(e) => setNewCouponDiscount(e.target.value)}
                  className="w-full text-xs p-2 rounded-xl border border-stone-200"
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase text-stone-500 mb-1">Min Order (₹)</label>
                <input
                  type="number"
                  placeholder="300"
                  value={newCouponMinOrder}
                  onChange={(e) => setNewCouponMinOrder(e.target.value)}
                  className="w-full text-xs p-2 rounded-xl border border-stone-200"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full py-2 bg-stone-900 hover:bg-amber-600 text-white text-xs font-bold rounded-xl transition"
                >
                  Create Code
                </button>
              </div>
            </form>

            <div className="space-y-2">
              {coupons.map((c) => (
                <div
                  key={c.id}
                  className="p-3 bg-stone-50 border border-stone-200 rounded-xl flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2">
                    <Tag className="w-4 h-4 text-amber-600" />
                    <span className="font-bold text-stone-900">{c.code}</span>
                    <span className="text-emerald-700 font-semibold bg-emerald-100 px-2 py-0.5 rounded-md">
                      {c.discount_percentage}% OFF
                    </span>
                  </div>
                  <span className="text-stone-500">Min spend: ₹{c.minimum_order_amount}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 7: DINER REVIEWS */}
        {activeTab === 'reviews' && (
          <div className="bg-white rounded-3xl border border-stone-200 p-6 shadow-xs space-y-4 animate-fade-in">
            <h3 className="font-serif font-bold text-base text-stone-900">
              Customer Ratings & Reviews
            </h3>

            <div className="space-y-3">
              {feedbackList.length === 0 ? (
                <p className="text-xs text-stone-400 italic py-6 text-center">No reviews submitted yet.</p>
              ) : (
                feedbackList.map((fb) => (
                  <div
                    key={fb.id}
                    className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1 text-amber-400">
                        {Array.from({ length: fb.rating }).map((_, i) => (
                          <Star key={i} className="w-4 h-4 fill-amber-400" />
                        ))}
                      </div>
                      <span className="text-[11px] text-stone-400">
                        {new Date(fb.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    {fb.comments && (
                      <p className="text-xs text-stone-700 italic">"{fb.comments}"</p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </main>

      {/* Settlement Modal */}
      {settleOrderId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/60 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl space-y-4">
            <h3 className="font-serif font-bold text-base text-stone-900">
              Settle Table Bill & Free Table
            </h3>
            <p className="text-xs text-stone-500">
              Select payment method received from customer:
            </p>

            <div className="grid grid-cols-3 gap-2">
              {['UPI', 'CASH', 'CARD'].map((m) => (
                <button
                  key={m}
                  onClick={() => setSettleMethod(m)}
                  className={`py-2 text-xs font-bold rounded-xl border transition ${
                    settleMethod === m
                      ? 'bg-amber-500 text-stone-950 border-amber-500 shadow-xs'
                      : 'bg-stone-50 text-stone-700 border-stone-200'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setSettleOrderId(null)}
                className="flex-1 py-2 text-xs font-bold text-stone-600 bg-stone-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSettle}
                className="flex-1 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition"
              >
                Confirm Settlement
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

