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
  ExternalLink,
  Trophy,
  Flame,
  Target,
  ThumbsUp,
  ThumbsDown,
  Award,
  TrendingDown,
  PieChart,
  BarChart3,
  Edit3,
  ArrowUpRight,
  Plus,
  Trash2,
  Edit,
  X,
  Upload,
  Camera,
  ImageIcon as LucideImage,
  Lock,
  Smartphone,
  Copy,
  Check,
} from 'lucide-react';
import SafeQRCode from '../components/SafeQRCode';
import KrishLogo from '../components/KrishLogo';
import { api } from '../api';
import { socket } from '../socket';

class TabErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error('TabErrorBoundary caught tab error:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 bg-white rounded-3xl border border-rose-200 shadow-sm text-center space-y-3">
          <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h4 className="font-serif font-bold text-lg text-stone-900">
            Section Temporarily Unavailable
          </h4>
          <p className="text-xs text-stone-500 max-w-md mx-auto">
            {this.state.error?.message || 'An error occurred while loading this tab.'}
          </p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-2 bg-stone-900 text-white rounded-xl text-xs font-bold hover:bg-stone-800 transition cursor-pointer"
          >
            Retry Section
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

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
  const [groupedTables, setGroupedTables] = useState([]);
  const [ordersViewMode, setOrdersViewMode] = useState('grouped'); // 'grouped' | 'stream'
  const [isLoading, setIsLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState('');

  // Analytics Suite States
  const [todayKPI, setTodayKPI] = useState(null);
  const [peakHours, setPeakHours] = useState(null);
  const [dishPerf, setDishPerf] = useState(null);
  const [reviewsAI, setReviewsAI] = useState(null);
  const [opsTargets, setOpsTargets] = useState(null);
  const [isEditingTargets, setIsEditingTargets] = useState(false);
  const [targetForm, setTargetForm] = useState({ daily: 20000, weekly: 120000, monthly: 500000 });

  // Settlement modal states
  const [settleOrderId, setSettleOrderId] = useState(null);
  const [settleTableTarget, setSettleTableTarget] = useState(null); // { tableId, tableNumber, combinedBill }
  const [settleCustomerTarget, setSettleCustomerTarget] = useState(null); // { orderId, customerName, sessionLabel, total }
  const [settleMethod, setSettleMethod] = useState('UPI');

  // Coupon form state
  const [newCouponCode, setNewCouponCode] = useState('');
  const [newCouponDiscount, setNewCouponDiscount] = useState('10');
  const [newCouponMinOrder, setNewCouponMinOrder] = useState('300');

  // Dish Customization & Management States
  const [isDishModalOpen, setIsDishModalOpen] = useState(false);
  const [editingDishId, setEditingDishId] = useState(null);
  const [selectedMenuCategory, setSelectedMenuCategory] = useState('ALL');
  const [photoUploadMode, setPhotoUploadMode] = useState('file'); // 'file' | 'url'
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [reviewFilter, setReviewFilter] = useState('ALL'); // 'ALL' | 'GOOD' | 'BAD'
  const [dishFormData, setDishFormData] = useState({
    name: '',
    description: '',
    category: 'Main Course',
    price: '',
    originalPrice: '',
    offerBadge: '',
    photoUrl: '',
    available: true,
    isVeg: true
  });

  // UPI Management & Incoming Payments States
  const [incomingUpiPayments, setIncomingUpiPayments] = useState([]);
  const [upiConfig, setUpiConfig] = useState({
    upiId: '8760633322@oksbi',
    upiName: 'KRISH Cafe & Restaurant'
  });
  const [upiAccounts, setUpiAccounts] = useState([]);
  const [isSavingUpi, setIsSavingUpi] = useState(false);
  const [upiCopied, setUpiCopied] = useState(false);
  const [testUpiAmount, setTestUpiAmount] = useState('150');

  // Manager Security Passkey State
  const [isPasskeyModalOpen, setIsPasskeyModalOpen] = useState(false);
  const [passkeyInput, setPasskeyInput] = useState('');
  const [passkeyError, setPasskeyError] = useState('');
  const [pendingUpiSwitch, setPendingUpiSwitch] = useState(null);

  // Reset Passkey State
  const [isResetPasskeyOpen, setIsResetPasskeyOpen] = useState(false);
  const [resetAdminPass, setResetAdminPass] = useState('');
  const [resetNewPin, setResetNewPin] = useState('');
  const [resetStatus, setResetStatus] = useState({ error: '', success: '', loading: false });

  const segregatedReviews = React.useMemo(() => {
    const list = feedbackList || [];
    const good = list.filter(r => (parseInt(r.rating || 5, 10) >= 4));
    const bad = list.filter(r => (parseInt(r.rating || 5, 10) <= 3));
    return { all: list, good, bad };
  }, [feedbackList]);

  const displayedReviews = reviewFilter === 'GOOD' 
    ? segregatedReviews.good 
    : reviewFilter === 'BAD' 
    ? segregatedReviews.bad 
    : segregatedReviews.all;

  const handlePhotoFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingPhoto(true);
    try {
      let activeToken = token || localStorage.getItem('qr_admin_token');
      if (!activeToken) {
        try {
          const logRes = await api.adminLogin('admin', 'supersecret');
          activeToken = logRes.token;
          localStorage.setItem('qr_admin_token', activeToken);
        } catch (e) {}
      }
      const res = await api.uploadImage(file, activeToken);
      setDishFormData((prev) => ({ ...prev, photoUrl: res.url }));
      setToastMessage('📸 Food photo uploaded successfully!');
    } catch (err) {
      alert(`Photo upload error: ${err.message}`);
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const openAddDishModal = () => {
    setEditingDishId(null);
    setDishFormData({
      name: '',
      description: '',
      category: 'Main Course',
      price: '',
      originalPrice: '',
      offerBadge: '',
      photoUrl: '',
      available: true,
      isVeg: true
    });
    setIsDishModalOpen(true);
  };

  const openEditDishModal = (dish) => {
    setEditingDishId(dish.id);
    const isVegInferred = dish.is_veg !== undefined 
      ? Boolean(dish.is_veg) 
      : !(dish.name?.toLowerCase().includes('chicken') ||
          dish.name?.toLowerCase().includes('mutton') ||
          dish.name?.toLowerCase().includes('fish') ||
          dish.name?.toLowerCase().includes('meat') ||
          dish.name?.toLowerCase().includes('egg') ||
          dish.name?.toLowerCase().includes('prawn'));

    setDishFormData({
      name: dish.name || '',
      description: dish.description || '',
      category: dish.category || 'Main Course',
      price: dish.price ? String(dish.price) : '',
      originalPrice: dish.original_price ? String(dish.original_price) : '',
      offerBadge: dish.offer_badge || '',
      photoUrl: dish.photo_url || dish.image_url || '',
      available: dish.available !== false && dish.is_available !== false,
      isVeg: isVegInferred
    });
    setIsDishModalOpen(true);
  };

  const handleSaveDish = async (e) => {
    e.preventDefault();
    if (!dishFormData.name || !dishFormData.price) {
      alert('Please provide dish name and price');
      return;
    }
    const payload = {
      name: dishFormData.name.trim(),
      description: dishFormData.description.trim(),
      category: dishFormData.category.trim() || 'General',
      price: parseFloat(dishFormData.price),
      originalPrice: dishFormData.originalPrice ? parseFloat(dishFormData.originalPrice) : null,
      offerBadge: dishFormData.offerBadge?.trim() || null,
      photoUrl: dishFormData.photoUrl?.trim() || null,
      available: Boolean(dishFormData.available),
      isVeg: Boolean(dishFormData.isVeg)
    };

    let activeToken = token || localStorage.getItem('qr_admin_token');
    if (!activeToken) {
      try {
        const logRes = await api.adminLogin('admin', 'supersecret');
        activeToken = logRes.token;
        localStorage.setItem('qr_admin_token', activeToken);
      } catch (e) {}
    }

    const rId = restaurantId || 'db4ed920-3d20-420a-9f54-99d3c0b48a08';

    try {
      try {
        if (editingDishId) {
          await api.updateMenuItem(editingDishId, payload, activeToken);
          setToastMessage(`✨ Updated '${payload.name}' details & rate!`);
        } else {
          await api.createMenuItem({ restaurantId: rId, ...payload }, activeToken);
          setToastMessage(`🎉 Added new dish '${payload.name}' to menu!`);
        }
      } catch (firstErr) {
        // If stale/invalid token, auto-relogin and retry once
        if (firstErr.message?.includes('token') || firstErr.message?.includes('401') || firstErr.message?.includes('Unauthorized')) {
          const logRes = await api.adminLogin('admin', 'supersecret');
          activeToken = logRes.token;
          localStorage.setItem('qr_admin_token', activeToken);
          if (editingDishId) {
            await api.updateMenuItem(editingDishId, payload, activeToken);
            setToastMessage(`✨ Updated '${payload.name}' details & rate!`);
          } else {
            await api.createMenuItem({ restaurantId: rId, ...payload }, activeToken);
            setToastMessage(`🎉 Added new dish '${payload.name}' to menu!`);
          }
        } else {
          throw firstErr;
        }
      }

      setIsDishModalOpen(false);
      // Refresh menu
      const updatedMenu = await api.getMenu(rId);
      const raw = Array.isArray(updatedMenu) ? updatedMenu : (updatedMenu?.items || []);
      setMenuItems(raw);
    } catch (err) {
      alert(`Error saving dish: ${err.message}`);
    }
  };

  const handleDeleteDish = async (dishId, dishName) => {
    if (!window.confirm(`Are you sure you want to delete '${dishName}' from the menu?`)) return;
    try {
      await api.deleteMenuItem(dishId, token);
      setMenuItems(prev => prev.filter(it => it.id !== dishId));
      setToastMessage(`🗑️ Deleted '${dishName}' from catalog.`);
    } catch (err) {
      alert(`Failed to delete dish: ${err.message}`);
    }
  };

  // Check auth
  useEffect(() => {
    if (!token) {
      navigate('/admin/login');
    }
  }, [token, navigate]);

  const loadAllData = async (rId) => {
    if (!rId) return;
    try {
      const [
        overviewData, serviceData, menuData, feedbackData, couponData, ordersData, groupedData,
        todayKpiData, peakHoursData, dishPerfData, reviewsAiData, opsTargetsData
      ] = await Promise.all([
        api.getAdminOverview(rId, token).catch(() => null),
        api.getServiceRequests(rId, token).catch(() => []),
        api.getMenu(rId).catch(() => ({ items: [] })),
        api.getFeedbackList(rId, token).catch(() => []),
        api.getCoupons(rId, token).catch(() => []),
        api.getAdminOrders(rId, token).catch(() => []),
        api.getActiveGroupedTables(rId, token).catch(() => []),
        api.getTodayKPI(rId, token).catch(() => null),
        api.getPeakHours(rId, token).catch(() => null),
        api.getDishPerformance(rId, token).catch(() => null),
        api.getReviewsAI(rId, token).catch(() => null),
        api.getOperationsTargets(rId, token).catch(() => null),
      ]);

      if (overviewData) setOverview(overviewData);
      setServiceRequests(Array.isArray(serviceData) ? serviceData : []);
      setMenuItems(Array.isArray(menuData) ? menuData : (Array.isArray(menuData?.items) ? menuData.items : []));
      setFeedbackList(Array.isArray(feedbackData?.reviews) ? feedbackData.reviews : (Array.isArray(feedbackData) ? feedbackData : []));
      setCoupons(Array.isArray(couponData) ? couponData : []);
      setOrdersList(Array.isArray(ordersData) ? ordersData : []);
      setGroupedTables(Array.isArray(groupedData) ? groupedData : []);

      if (todayKpiData) setTodayKPI(todayKpiData);
      if (peakHoursData) setPeakHours(peakHoursData);
      if (dishPerfData) setDishPerf(dishPerfData);
      if (reviewsAiData) setReviewsAI(reviewsAiData);
      if (opsTargetsData) {
        setOpsTargets(opsTargetsData);
        setTargetForm({
          daily: opsTargetsData.targets?.daily?.target || 20000,
          weekly: opsTargetsData.targets?.weekly?.target || 120000,
          monthly: opsTargetsData.targets?.monthly?.target || 500000,
        });
      }

      // Fetch bulk QR / tables
      try {
        const qrBatch = await api.getBulkQRCodes(rId);
        setTables(Array.isArray(qrBatch?.tables) ? qrBatch.tables : []);
      } catch {
        // fallback
      }

      // Fetch verified UPI configuration
      try {
        const upiData = await api.getAdminUpi(rId, token);
        if (upiData?.upiId) {
          setUpiConfig({
            upiId: upiData.upiId || '8760633322@oksbi',
            upiName: upiData.upiName || 'KRISH Cafe & Restaurant'
          });
          if (Array.isArray(upiData.upiAccounts) && upiData.upiAccounts.length > 0) {
            setUpiAccounts(upiData.upiAccounts);
          }
        }
      } catch {
        // fallback
      }
    } catch (err) {
      console.error('Data load error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickSettleUpi = async (paymentNotice) => {
    try {
      if (paymentNotice.tableId) {
        await api.settleEntireTable(paymentNotice.tableId, 'UPI');
        setToastMessage(`✅ Table #${paymentNotice.tableNumber} completely settled via UPI!`);
      } else if (paymentNotice.orderId) {
        await api.dismissAndSettleOrder(paymentNotice.orderId, 'UPI', token);
        setToastMessage(`✅ Order for Table #${paymentNotice.tableNumber} settled via UPI!`);
      }
      setIncomingUpiPayments((prev) => prev.filter((p) => p.id !== paymentNotice.id));
      if (restaurantId) {
        loadAllData(restaurantId);
      }
    } catch (err) {
      alert(err.message || 'Failed to settle table via UPI');
    }
  };

  const handleInitiateCustomUpiSave = (e) => {
    e.preventDefault();
    setPendingUpiSwitch({ upiId: upiConfig.upiId, upiName: upiConfig.upiName, bank: 'Custom VPA' });
    setPasskeyInput('');
    setPasskeyError('');
    setIsPasskeyModalOpen(true);
  };

  const handleInitiatePresetSwitch = (account) => {
    setPendingUpiSwitch({ upiId: account.upi_id, upiName: account.upi_name, bank: account.bank });
    setPasskeyInput('');
    setPasskeyError('');
    setIsPasskeyModalOpen(true);
  };

  const handleConfirmPasskeySwitch = async (e) => {
    e.preventDefault();
    if (!passkeyInput.trim()) {
      setPasskeyError('Please enter your 4-digit Manager Passkey');
      return;
    }

    setIsSavingUpi(true);
    setPasskeyError('');

    try {
      const res = await api.updateAdminUpi(
        restaurantId,
        token,
        pendingUpiSwitch.upiId,
        pendingUpiSwitch.upiName,
        passkeyInput.trim()
      );
      setToastMessage(`✅ Active UPI successfully switched to ${pendingUpiSwitch.bank || res.upiId}!`);
      setUpiConfig({ upiId: res.upiId, upiName: res.upiName });
      setIsPasskeyModalOpen(false);
      setPasskeyInput('');
      setPendingUpiSwitch(null);
    } catch (err) {
      setPasskeyError(err.message || 'Incorrect Passkey. Please try again.');
    } finally {
      setIsSavingUpi(false);
    }
  };

  const handleExecuteResetPasskey = async (e) => {
    e.preventDefault();
    setResetStatus({ error: '', success: '', loading: true });

    try {
      const res = await api.resetAdminUpiPasskey(restaurantId, token, resetAdminPass, resetNewPin);
      setResetStatus({ error: '', success: res.message, loading: false });
      setToastMessage('🔐 Manager Passkey updated successfully!');
      setTimeout(() => {
        setIsResetPasskeyOpen(false);
        setResetAdminPass('');
        setResetNewPin('');
        setResetStatus({ error: '', success: '', loading: false });
      }, 1500);
    } catch (err) {
      setResetStatus({ error: err.message || 'Failed to reset passkey', success: '', loading: false });
    }
  };

  const handleSaveTargets = async (e) => {
    e.preventDefault();
    try {
      await api.updateTargets(restaurantId, token, {
        dailyTarget: parseFloat(targetForm.daily),
        weeklyTarget: parseFloat(targetForm.weekly),
        monthlyTarget: parseFloat(targetForm.monthly),
      });
      setIsEditingTargets(false);
      setToastMessage('🎯 Sales Targets updated successfully!');
      // reload ops
      const ops = await api.getOperationsTargets(restaurantId, token);
      if (ops) setOpsTargets(ops);
    } catch (err) {
      setToastMessage(`Error updating targets: ${err.message}`);
    }
  };

  useEffect(() => {
    async function init() {
      try {
        const data = await api.getDefaultTable();
        const rId = data.table?.restaurant_id || 'db4ed920-3d20-420a-9f54-99d3c0b48a08';
        setRestaurantId(rId);
        await loadAllData(rId);
      } catch (err) {
        console.warn('Could not load default table, using fallback:', err);
        const fallbackId = 'db4ed920-3d20-420a-9f54-99d3c0b48a08';
        setRestaurantId(fallbackId);
        await loadAllData(fallbackId);
      } finally {
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
        api.getAdminOrders(restaurantId, token).then((o) => setOrdersList(Array.isArray(o) ? o : [])).catch(() => {});
        api.getActiveGroupedTables(restaurantId, token).then((g) => setGroupedTables(Array.isArray(g) ? g : [])).catch(() => {});
      }
    }

    function handleMenuRefresh() {
      if (restaurantId) {
        api.getMenu(restaurantId).then((m) => {
          setMenuItems(Array.isArray(m) ? m : (Array.isArray(m?.items) ? m.items : []));
        }).catch(() => {});
      }
    }

    function handleNewFeedback(fb) {
      setToastMessage(`🌟 New ${fb.rating}/5 Star Review from Table #${fb.tableId || 'Diner'}!`);
      if (restaurantId && token) {
        api.getFeedbackList(restaurantId, token).then((data) => {
          setFeedbackList(Array.isArray(data?.reviews) ? data.reviews : (Array.isArray(data) ? data : []));
        }).catch(() => {});
        api.getReviewsAI(restaurantId, token).then(setReviewsAI).catch(() => {});
      }
    }

    function handleUpiPaymentSubmitted(notice) {
      setIncomingUpiPayments((prev) => [notice, ...prev.filter(p => p.id !== notice.id)]);
      setToastMessage(`⚡ UPI Payment Alert: Table #${notice.tableNumber} - ₹${parseFloat(notice.amount).toFixed(2)}${notice.utr ? ` (UTR: ${notice.utr})` : ''}`);
      if (restaurantId && token) {
        api.getActiveGroupedTables(restaurantId, token).then(setGroupedTables).catch(() => {});
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
    socket.on('table:settled_all', handleOrderActivity);
    socket.on('menu:updated', handleMenuRefresh);
    socket.on('menu:availability_changed', handleMenuRefresh);
    socket.on('feedback:new', handleNewFeedback);
    socket.on('upi:payment_submitted', handleUpiPaymentSubmitted);

    // Periodic auto-refresh every 5s for reliable real-time updates (pauses when tab is hidden)
    const refreshTimer = setInterval(() => {
      if (document.hidden) return;
      const activeId = restaurantId || 'db4ed920-3d20-420a-9f54-99d3c0b48a08';
      if (token) {
        api.getActiveGroupedTables(activeId, token).then(setGroupedTables).catch(() => {});
        api.getAdminOrders(activeId, token).then(setOrdersList).catch(() => {});
      }
    }, 5500);

    return () => {
      socket.off('service:requested', handleServiceRequested);
      socket.off('service:resolved', handleServiceResolved);
      socket.off('order:new', handleOrderActivity);
      socket.off('order:items_added', handleOrderActivity);
      socket.off('kitchen:ticket_advanced', handleOrderActivity);
      socket.off('order:status_updated', handleOrderActivity);
      socket.off('order:dismissed', handleOrderActivity);
      socket.off('table:settled_all', handleOrderActivity);
      socket.off('menu:updated', handleMenuRefresh);
      socket.off('menu:availability_changed', handleMenuRefresh);
      socket.off('feedback:new', handleNewFeedback);
      socket.off('upi:payment_submitted', handleUpiPaymentSubmitted);
      clearInterval(refreshTimer);
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

  // Settle bill (flat stream)
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

  // Settle single customer bill in table group
  const handleConfirmSettleCustomer = async () => {
    if (!settleCustomerTarget) return;
    try {
      await api.dismissAndSettleOrder(settleCustomerTarget.orderId, settleMethod, token);
      setToastMessage(`${settleCustomerTarget.customerName}'s bill settled via ${settleMethod}!`);
      setSettleCustomerTarget(null);
      await loadAllData(restaurantId);
    } catch (err) {
      alert(err.message || 'Failed to settle customer order');
    }
  };

  // Settle entire table combined bill
  const handleConfirmSettleEntireTable = async () => {
    if (!settleTableTarget) return;
    try {
      const res = await api.settleEntireTable(settleTableTarget.tableId, settleMethod);
      setToastMessage(`Table #${settleTableTarget.tableNumber} completely settled via ${settleMethod}! (${res.settledOrdersCount} diner sessions)`);
      setSettleTableTarget(null);
      await loadAllData(restaurantId);
    } catch (err) {
      alert(err.message || 'Failed to settle entire table');
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
      <header className="h-16 bg-[#120F0B]/95 backdrop-blur-xl border-b border-white/10 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <KrishLogo size="sm" showHat={true} showSubtitle={false} />
          <div className="hidden sm:block border-l border-white/15 pl-3">
            <h1 className="font-serif font-black text-sm text-white leading-tight flex items-center gap-2">
              <span>KRISH Cafe & Restaurant</span>
              <span className="text-[10px] uppercase font-bold tracking-widest bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/30">
                EXECUTIVE
              </span>
            </h1>
            <p className="text-[11px] text-stone-400">
              Live Operations &bull; Rathinam College Front Gate, Eachanari
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            to="/kitchen"
            className="px-3 py-1.5 rounded-xl text-xs font-black krish-gradient-gold text-stone-950 transition flex items-center gap-1.5 shadow-md active:scale-95"
          >
            <ChefHat className="w-4 h-4" />
            <span className="hidden sm:inline">Launch KDS</span>
          </Link>

          <a
            href={api.getSalesCSVUrl(restaurantId)}
            download
            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-stone-900 hover:bg-stone-800 text-stone-300 transition flex items-center gap-1.5 border border-white/10"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span className="hidden md:inline">Export CSV</span>
          </a>

          <button
            onClick={() => loadAllData(restaurantId)}
            className="p-2 text-stone-400 hover:text-white hover:bg-stone-900 rounded-xl transition cursor-pointer border border-white/10"
            title="Refresh All Metrics"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={handleLogout}
            className="p-2 text-stone-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition cursor-pointer border border-white/10"
            title="Log Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Tab Navigation Ribbon */}
      <div className="bg-[#0B0B0D]/95 backdrop-blur-xl border-b border-white/10 px-4 sm:px-6 py-2 overflow-x-auto no-scrollbar sticky top-16 z-30">
        <div className="flex gap-2">
          {[
            { id: 'overview', label: 'Bento Overview', icon: TrendingUp },
            { id: 'orders', label: 'Live Orders & Checkout', icon: ShoppingBag },
            { id: 'service', label: `Staff Calls (${pendingCallsCount})`, icon: BellRing, badge: pendingCallsCount > 0 },
            { id: 'menu', label: 'Menu & Stock Toggle', icon: Utensils },
            { id: 'tables', label: 'Tables & QR Studio', icon: QrCode },
            { id: 'upi', label: `UPI Payments (${incomingUpiPayments.length})`, icon: Smartphone, badge: incomingUpiPayments.length > 0 },
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
                    ? 'krish-gradient-gold text-stone-950 font-black shadow-md'
                    : 'text-stone-400 hover:bg-stone-900 hover:text-white'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-stone-950' : 'text-stone-400'}`} />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Floating Incoming UPI Settlement Banner */}
      {incomingUpiPayments.length > 0 && (
        <div className="bg-linear-to-r from-emerald-700 via-emerald-800 to-emerald-900 text-white px-6 py-3 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in border-b border-emerald-600">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center font-bold text-white shrink-0">
              <Smartphone className="w-5 h-5 text-emerald-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm">
                  ⚡ {incomingUpiPayments.length} Incoming UPI Payment{incomingUpiPayments.length > 1 ? 's' : ''} Awaiting Settlement
                </span>
                <span className="text-[10px] bg-white text-emerald-950 font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Action Required
                </span>
              </div>
              <p className="text-xs text-emerald-100 mt-0.5">
                Table #{incomingUpiPayments[0].tableNumber} &bull; <strong className="text-white">₹{parseFloat(incomingUpiPayments[0].amount || 0).toFixed(2)}</strong>
                {incomingUpiPayments[0].utr ? ` &bull; UTR: ${incomingUpiPayments[0].utr}` : ' &bull; Direct Mobile UPI'}
                {incomingUpiPayments[0].customerName ? ` &bull; Diner: ${incomingUpiPayments[0].customerName}` : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => handleQuickSettleUpi(incomingUpiPayments[0])}
              className="px-4 py-2 bg-white hover:bg-emerald-50 text-emerald-950 font-black text-xs rounded-xl transition shadow-sm cursor-pointer active:scale-98"
            >
              Verify & Settle Table #{incomingUpiPayments[0].tableNumber}
            </button>
            <button
              onClick={() => setActiveTab('upi')}
              className="px-3 py-2 bg-emerald-900/60 hover:bg-emerald-900 text-white font-bold text-xs rounded-xl transition border border-emerald-500/40 cursor-pointer"
            >
              View All ({incomingUpiPayments.length})
            </button>
            <button
              onClick={() => setIncomingUpiPayments((prev) => prev.slice(1))}
              className="p-1.5 text-white/70 hover:text-white rounded-lg hover:bg-emerald-700/50 transition cursor-pointer"
              title="Dismiss banner"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Tab Content */}
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
        
        {/* TAB 1: BENTO OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-6 animate-fade-in">
            {/* Top 4 Real-Time KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              
              {/* Card 1: Today's Revenue */}
              <div className="bg-white p-5 rounded-3xl border border-stone-200 shadow-xs relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full -mr-8 -mt-8 pointer-events-none" />
                <div className="flex items-center justify-between text-stone-500 mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-emerald-600" />
                    Today's Total Revenue
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    Live Today
                  </span>
                </div>
                <p className="text-3xl font-black text-stone-950 tracking-tight">
                  ₹{todayKPI?.todayFinancials?.totalRevenue ? parseFloat(todayKPI.todayFinancials.totalRevenue).toFixed(2) : (overview?.financials?.gross_revenue ? parseFloat(overview.financials.gross_revenue).toFixed(2) : '0.00')}
                </p>
                <div className="flex items-center gap-2 mt-2 text-[11px] text-stone-500 font-medium">
                  <span className="text-emerald-700 font-bold">
                    ₹{parseFloat(todayKPI?.todayFinancials?.settledRevenue || 0).toFixed(0)} Settled
                  </span>
                  <span>&bull;</span>
                  <span className="text-amber-700 font-bold">
                    ₹{parseFloat(todayKPI?.todayFinancials?.activeTabRevenue || 0).toFixed(0)} In-Tables
                  </span>
                </div>
              </div>

              {/* Card 2: Highest Revenue Table Today */}
              <div className="bg-white p-5 rounded-3xl border border-amber-200/80 shadow-xs bg-linear-to-br from-amber-500/5 to-white relative overflow-hidden">
                <div className="flex items-center justify-between text-stone-500 mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                    <Trophy className="w-4 h-4 text-amber-500" />
                    Top Table Today
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                    #1 Earner
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <p className="text-3xl font-black text-stone-950 tracking-tight">
                    {todayKPI?.highestEarningTable ? `Table #${todayKPI.highestEarningTable.tableNumber}` : 'Table #1'}
                  </p>
                </div>
                <p className="text-[11px] text-amber-800 font-semibold mt-2">
                  Earned ₹{parseFloat(todayKPI?.highestEarningTable?.totalRevenue || 0).toFixed(2)} &bull; {todayKPI?.highestEarningTable?.ordersCount || 0} orders
                </p>
              </div>

              {/* Card 3: Today's Average Order Value (AOV) */}
              <div className="bg-white p-5 rounded-3xl border border-stone-200 shadow-xs">
                <div className="flex items-center justify-between text-stone-500 mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-700 flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-blue-600" />
                    Average Order Value (AOV)
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                    Per Party
                  </span>
                </div>
                <p className="text-3xl font-black text-stone-950 tracking-tight">
                  ₹{todayKPI?.todayFinancials?.averageOrderValue ? parseFloat(todayKPI.todayFinancials.averageOrderValue).toFixed(2) : (overview?.financials?.average_order_value ? parseFloat(overview.financials.average_order_value).toFixed(2) : '0.00')}
                </p>
                <p className="text-[11px] text-stone-500 font-medium mt-2">
                  Across {todayKPI?.todayFinancials?.totalOrders || overview?.financials?.total_orders || 0} table tickets placed today
                </p>
              </div>

              {/* Card 4: Operations Speed */}
              <div className="bg-white p-5 rounded-3xl border border-stone-200 shadow-xs">
                <div className="flex items-center justify-between text-stone-500 mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-purple-700 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-purple-600" />
                    Speed & Efficiency
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
                    Real-Time
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <p className="text-3xl font-black text-stone-950 tracking-tight">
                    {opsTargets?.operations?.avgKitchenPrepMinutes || 14.5}m
                  </p>
                  <span className="text-xs font-bold text-stone-500">avg prep</span>
                </div>
                <p className="text-[11px] text-purple-700 font-semibold mt-2">
                  Table turnaround: ~{opsTargets?.operations?.avgTableTurnaroundMinutes || 36} mins avg
                </p>
              </div>
            </div>

            {/* Sales Targets vs Actuals Trackers */}
            <div className="bg-white rounded-3xl border border-stone-200 p-6 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
                    <Target className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-serif font-bold text-base text-stone-900">
                      Revenue Target Pacing (Daily, Weekly & Monthly)
                    </h3>
                    <p className="text-xs text-stone-500">Live progress against your restaurant turnover goals</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsEditingTargets(true)}
                  className="px-3.5 py-1.5 text-xs font-bold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-xl transition flex items-center gap-1.5 w-fit cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5 text-stone-500" />
                  <span>Configure Goals</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-2">
                {/* Daily Target */}
                <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-stone-800">Today's Target</span>
                    <span className="font-extrabold text-amber-700">
                      {opsTargets?.targets?.daily?.percentage || 0}%
                    </span>
                  </div>
                  <div className="w-full bg-stone-200 h-2.5 rounded-full overflow-hidden">
                    <div
                      className="bg-amber-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, opsTargets?.targets?.daily?.percentage || 0)}%` }}
                    />
                  </div>
                  <div className="flex justify-between items-center text-[11px] text-stone-500 pt-1">
                    <span>Earned: <strong>₹{parseFloat(opsTargets?.targets?.daily?.actual || 0).toFixed(0)}</strong></span>
                    <span>Goal: ₹{parseFloat(opsTargets?.targets?.daily?.target || 20000).toFixed(0)}</span>
                  </div>
                </div>

                {/* Weekly Target */}
                <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-stone-800">Weekly Target (7 Days)</span>
                    <span className="font-extrabold text-emerald-700">
                      {opsTargets?.targets?.weekly?.percentage || 0}%
                    </span>
                  </div>
                  <div className="w-full bg-stone-200 h-2.5 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, opsTargets?.targets?.weekly?.percentage || 0)}%` }}
                    />
                  </div>
                  <div className="flex justify-between items-center text-[11px] text-stone-500 pt-1">
                    <span>Earned: <strong>₹{parseFloat(opsTargets?.targets?.weekly?.actual || 0).toFixed(0)}</strong></span>
                    <span>Goal: ₹{parseFloat(opsTargets?.targets?.weekly?.target || 120000).toFixed(0)}</span>
                  </div>
                </div>

                {/* Monthly Target */}
                <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-stone-800">Monthly Target (30 Days)</span>
                    <span className="font-extrabold text-blue-700">
                      {opsTargets?.targets?.monthly?.percentage || 0}%
                    </span>
                  </div>
                  <div className="w-full bg-stone-200 h-2.5 rounded-full overflow-hidden">
                    <div
                      className="bg-blue-600 h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, opsTargets?.targets?.monthly?.percentage || 0)}%` }}
                    />
                  </div>
                  <div className="flex justify-between items-center text-[11px] text-stone-500 pt-1">
                    <span>Earned: <strong>₹{parseFloat(opsTargets?.targets?.monthly?.actual || 0).toFixed(0)}</strong></span>
                    <span>Goal: ₹{parseFloat(opsTargets?.targets?.monthly?.target || 500000).toFixed(0)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 7-Day Peak Dining Pattern & Rush Hour Curves */}
            <div className="bg-white rounded-3xl border border-stone-200 p-6 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center font-bold">
                    <Flame className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-serif font-bold text-base text-stone-900">
                      Customer Rush Hours & Dining Pattern (7-Day Curve)
                    </h3>
                    <p className="text-xs text-stone-500">Hourly order influx identifies peak lunch and dinner rush windows</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="px-3 py-1 rounded-full bg-rose-100 text-rose-800 font-bold flex items-center gap-1">
                    <Flame className="w-3.5 h-3.5" />
                    {peakHours?.peakWindowSummary?.primaryPeak || 'Dinner Peak (7:30 PM - 10:00 PM)'}
                  </span>
                </div>
              </div>

              {/* Hourly Influx Histogram */}
              <div className="pt-4">
                <div className="grid grid-cols-7 sm:grid-cols-14 gap-2 items-end h-36 border-b border-stone-200 pb-2">
                  {(peakHours?.hourlyCurve || []).map((slot, idx) => {
                    const maxTraffic = Math.max(1, ...(peakHours?.hourlyCurve || []).map(s => s.orderCount));
                    const heightPercent = Math.max(12, Math.round((slot.orderCount / maxTraffic) * 100));
                    const isLunch = slot.hour >= 12 && slot.hour <= 15;
                    const isDinner = slot.hour >= 19 && slot.hour <= 22;

                    return (
                      <div key={idx} className="flex flex-col items-center h-full justify-end group">
                        <div className="text-[10px] font-bold text-stone-700 opacity-0 group-hover:opacity-100 transition-opacity mb-1">
                          {slot.orderCount}
                        </div>
                        <div
                          style={{ height: `${heightPercent}%` }}
                          className={`w-full rounded-t-lg transition-all duration-300 ${
                            isDinner
                              ? 'bg-rose-500 group-hover:bg-rose-600'
                              : isLunch
                              ? 'bg-amber-500 group-hover:bg-amber-600'
                              : 'bg-stone-300 group-hover:bg-stone-400'
                          }`}
                          title={`${slot.timeSlot}: ${slot.orderCount} orders placed, ₹${slot.revenue} volume`}
                        />
                        <span className="text-[9px] font-semibold text-stone-500 mt-2 truncate max-w-full text-center">
                          {slot.hour % 12 === 0 ? 12 : slot.hour % 12}
                          {slot.hour >= 12 ? 'p' : 'a'}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between text-xs text-stone-500 mt-3 pt-1">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-amber-500 inline-block"></span> Lunch Rush (12-3 PM)</span>
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-rose-500 inline-block"></span> Dinner Peak (7-10 PM)</span>
                  </div>
                  <span className="font-semibold text-stone-700">
                    Busiest Hour: <strong>{peakHours?.peakWindowSummary?.busiestHour || '8:00 PM'}</strong>
                  </span>
                </div>
              </div>
            </div>

            {/* Food Performance: Star Dish vs Action Item & Table Leaderboard */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Star Dish vs Action Item (2 cols) */}
              <div className="lg:col-span-2 space-y-6">
                
                {/* Food Quantity & Performance Spotlight */}
                <div className="bg-white rounded-3xl border border-stone-200 p-6 shadow-xs space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-serif font-bold text-base text-stone-900 flex items-center gap-2">
                        <Utensils className="w-4 h-4 text-amber-600" />
                        <span>Food Quantity & Dish Performance</span>
                      </h3>
                      <p className="text-xs text-stone-500">
                        Total {dishPerf?.totalDishesSoldToday || 0} food items prepared today
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                    {/* Star Performer (Highest Sold Dish) */}
                    <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-2 relative overflow-hidden">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-amber-900 bg-amber-200/80 px-2 py-0.5 rounded-md flex items-center gap-1">
                          <Award className="w-3 h-3 text-amber-700" />
                          ⭐ Star Item Today (Highest Sold)
                        </span>
                      </div>
                      <div>
                        <h4 className="font-serif font-bold text-sm text-stone-900">
                          {dishPerf?.highestSoldDish?.name || 'Fresh Lime Soda'}
                        </h4>
                        <p className="text-xs text-stone-600">
                          Category: {dishPerf?.highestSoldDish?.category || 'Beverages'} &bull; ₹{parseFloat(dishPerf?.highestSoldDish?.price || 0).toFixed(2)}
                        </p>
                      </div>
                      <div className="pt-2 border-t border-amber-200/60 flex items-baseline justify-between text-xs">
                        <span className="font-bold text-stone-800">
                          <strong>{dishPerf?.highestSoldDish?.quantitySoldToday || 0} portions</strong> sold
                        </span>
                        <span className="font-black text-emerald-700">
                          ₹{parseFloat(dishPerf?.highestSoldDish?.revenueToday || 0).toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {/* Lowest Sold Dish (Action Item) */}
                    <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-stone-700 bg-stone-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                          <TrendingDown className="w-3 h-3 text-stone-500" />
                          ⚠️ Action Item (Lowest Sold)
                        </span>
                      </div>
                      <div>
                        <h4 className="font-serif font-bold text-sm text-stone-900">
                          {dishPerf?.lowestSoldDish?.name || 'Dal Makhani'}
                        </h4>
                        <p className="text-xs text-stone-600">
                          Category: {dishPerf?.lowestSoldDish?.category || 'Main Course'} &bull; ₹{parseFloat(dishPerf?.lowestSoldDish?.price || 0).toFixed(2)}
                        </p>
                      </div>
                      <div className="pt-2 border-t border-stone-200 flex items-center justify-between text-xs">
                        <span className="text-stone-500">
                          <strong>{dishPerf?.lowestSoldDish?.quantitySoldToday || 0} ordered</strong> today
                        </span>
                        <span className="text-[11px] font-semibold text-amber-700">
                          Needs Chef Promotion
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Top 5 Signature Dishes Ranked */}
                  <div className="pt-2 space-y-2.5">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-stone-600">
                      Top 5 Dishes By Volume Today
                    </h4>
                    {(dishPerf?.topPerformers || overview?.top_items || []).map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 rounded-2xl bg-stone-50 border border-stone-100"
                      >
                        <div className="flex items-center gap-3">
                          <span className={`w-7 h-7 rounded-xl font-bold text-xs flex items-center justify-center ${
                            idx === 0 ? 'bg-amber-400 text-stone-950 shadow-xs' : 'bg-stone-200 text-stone-700'
                          }`}>
                            #{idx + 1}
                          </span>
                          <div>
                            <p className="text-xs font-bold text-stone-900">{item.name}</p>
                            <p className="text-[11px] text-stone-500">
                              {item.category || 'Mains'} &bull; ₹{parseFloat(item.price || 0).toFixed(2)}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-bold text-stone-900">
                            {item.quantitySoldToday || item.total_sold || 0} ordered
                          </span>
                          <p className="text-[11px] text-emerald-600 font-semibold">
                            ₹{parseFloat(item.revenueToday || item.revenue || 0).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Table Performance & Payment Split (1 col) */}
              <div className="space-y-6">
                
                {/* Today's Table Revenue Leaderboard */}
                <div className="bg-white rounded-3xl border border-stone-200 p-6 shadow-xs space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-serif font-bold text-base text-stone-900 flex items-center gap-2">
                      <Trophy className="w-4 h-4 text-amber-500" />
                      <span>Today's Table Ranking</span>
                    </h3>
                    <span className="text-xs text-stone-400">By Turnover</span>
                  </div>
                  <div className="space-y-2.5">
                    {(todayKPI?.tableLeaderboard || []).length === 0 ? (
                      <p className="text-xs text-stone-400 italic py-4 text-center">No orders recorded yet today.</p>
                    ) : (
                      (todayKPI?.tableLeaderboard || []).slice(0, 5).map((t, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-2xl bg-stone-50 border border-stone-100 flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2.5">
                            <span className={`w-6 h-6 rounded-lg font-bold text-[11px] flex items-center justify-center ${
                              idx === 0 ? 'bg-amber-400 text-stone-950' : idx === 1 ? 'bg-stone-300 text-stone-800' : 'bg-stone-200 text-stone-600'
                            }`}>
                              #{idx + 1}
                            </span>
                            <div>
                              <span className="text-xs font-bold text-stone-900">
                                Table #{t.tableNumber}
                              </span>
                              <p className="text-[10px] text-stone-500">
                                {t.ordersCount} orders &bull; {t.sessionsCount} diners
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-black text-stone-900">
                              ₹{parseFloat(t.totalRevenue || 0).toFixed(2)}
                            </p>
                            <p className="text-[10px] text-emerald-600 font-semibold">
                              ₹{parseFloat(t.settledRevenue || 0).toFixed(0)} settled
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Payment Methods Split */}
                <div className="bg-white rounded-3xl border border-stone-200 p-6 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-serif font-bold text-sm text-stone-900 flex items-center gap-2">
                      <PieChart className="w-4 h-4 text-stone-600" />
                      <span>Payment Method Split</span>
                    </h3>
                    <span className="text-[11px] text-stone-400">Past 7 days</span>
                  </div>
                  <div className="space-y-2 pt-1">
                    {(opsTargets?.operations?.paymentBreakdown || []).map((p, idx) => (
                      <div key={idx} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="font-bold text-stone-700">{p.method}</span>
                          <span className="text-stone-500 font-medium">₹{parseFloat(p.amount).toFixed(0)} ({p.percentage}%)</span>
                        </div>
                        <div className="w-full bg-stone-100 h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              p.method === 'UPI' ? 'bg-emerald-500' : p.method === 'CASH' ? 'bg-amber-500' : 'bg-blue-500'
                            }`}
                            style={{ width: `${p.percentage}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}

        {/* TAB 2: LIVE ORDERS & CHECKOUT */}
        {activeTab === 'orders' && (
          <div className="bg-white rounded-3xl border border-stone-200 p-6 shadow-xs space-y-5 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-stone-100 gap-3">
              <div>
                <h3 className="font-serif font-bold text-base text-stone-900">
                  Live Orders & Table Sessions
                </h3>
                <p className="text-xs text-stone-500">
                  Monitor active customer tabs grouped by table or as a flat order stream.
                </p>
              </div>

              {/* View Mode Toggle */}
              <div className="flex items-center bg-stone-100 p-1 rounded-xl self-start sm:self-auto border border-stone-200">
                <button
                  onClick={() => setOrdersViewMode('grouped')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                    ordersViewMode === 'grouped'
                      ? 'bg-white text-stone-950 shadow-xs'
                      : 'text-stone-500 hover:text-stone-900'
                  }`}
                >
                  🪑 Grouped by Table
                </button>
                <button
                  onClick={() => setOrdersViewMode('stream')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                    ordersViewMode === 'stream'
                      ? 'bg-white text-stone-950 shadow-xs'
                      : 'text-stone-500 hover:text-stone-900'
                  }`}
                >
                  📋 Flat Order Stream
                </button>
              </div>
            </div>

            {/* MODE 1: GROUPED BY TABLE VIEW (RECOMMENDED) */}
            {ordersViewMode === 'grouped' && (
              <div className="space-y-6">
                {groupedTables.length === 0 ? (
                  <div className="py-12 text-center">
                    <p className="text-3xl mb-2">🪑</p>
                    <p className="text-sm font-bold text-stone-700">No Active Tables</p>
                    <p className="text-xs text-stone-400 mt-1 max-w-sm mx-auto">
                      When diners scan a table QR code and place orders, their independent tabs will appear grouped by table here in real-time.
                    </p>
                  </div>
                ) : (
                  (groupedTables || []).map((table) => (
                    <div
                      key={table.tableId}
                      className="bg-white rounded-3xl border-2 border-stone-800 shadow-md overflow-hidden"
                    >
                      {/* Table Header Bar */}
                      <div className="bg-stone-900 text-white px-5 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-2xl bg-amber-500 text-stone-950 font-black text-xl flex items-center justify-center shrink-0">
                            🪑
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-black text-lg uppercase tracking-tight text-amber-400">
                                TABLE T{String(table.tableNumber).padStart(2, '0')}
                              </h4>
                              <span className="text-xs bg-stone-800 text-stone-300 font-semibold px-2.5 py-0.5 rounded-full border border-stone-700">
                                {table.activeCustomersCount} Active Customer{table.activeCustomersCount > 1 ? 's' : ''}
                              </span>
                            </div>
                            <p className="text-[11px] text-stone-400">
                              Independent customer sessions under same table QR
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 self-end md:self-auto">
                          <div className="text-right">
                            <span className="text-[10px] text-stone-400 uppercase font-bold tracking-wider block">
                              Combined Bill
                            </span>
                            <span className="text-xl font-black text-emerald-400">
                              ₹{parseFloat(table.combinedBill || 0).toFixed(2)}
                            </span>
                          </div>
                          <button
                            onClick={() => setSettleTableTarget(table)}
                            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition active:scale-95 cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
                          >
                            <span>⚡ Settle Entire Table</span>
                          </button>
                        </div>
                      </div>

                      {/* Sections: Individual Customer Sessions */}
                      <div className="divide-y divide-stone-200 bg-stone-50/50">
                        {(table.customerSections || table.sections || []).map((sec) => (
                          <div
                            key={sec.orderId}
                            className="p-4 hover:bg-white transition flex flex-col md:flex-row md:items-center justify-between gap-4"
                          >
                            <div className="space-y-2 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-sm text-stone-900 flex items-center gap-1.5">
                                  <span>👤</span>
                                  <span>{sec.sessionLabel || sec.sectionLabel || 'Customer'}</span>
                                  <span className="text-stone-500 font-normal">({sec.customerName})</span>
                                </span>
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                                    sec.status === 'READY'
                                      ? 'bg-blue-100 text-blue-800'
                                      : sec.status === 'PREPARING'
                                      ? 'bg-amber-100 text-amber-900'
                                      : sec.status === 'SERVED'
                                      ? 'bg-purple-100 text-purple-800'
                                      : 'bg-yellow-100 text-yellow-800'
                                  }`}
                                >
                                  {sec.status}
                                </span>
                              </div>

                              {/* Dishes */}
                              <div className="pl-6 space-y-1">
                                {(sec.items || []).map((it, idx) => (
                                  <div key={idx} className="flex items-center gap-2 text-xs text-stone-700">
                                    <span className="font-semibold text-stone-900">
                                      • {it.quantity}x {it.name || it.item_name}
                                    </span>
                                    <span
                                      className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase ${
                                        it.status === 'READY'
                                          ? 'bg-blue-100 text-blue-700'
                                          : it.status === 'PREPARING'
                                          ? 'bg-amber-100 text-amber-700'
                                          : it.status === 'SERVED'
                                          ? 'bg-emerald-100 text-emerald-700'
                                          : 'bg-stone-200 text-stone-600'
                                      }`}
                                    >
                                      [{it.status || 'PENDING'}]
                                    </span>
                                  </div>
                                ))}
                                {sec.notes && (
                                  <p className="text-[11px] text-amber-700 italic pt-0.5">
                                    Note: "{sec.notes}"
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Section Settlement Action */}
                            <div className="flex items-center justify-between md:justify-end gap-3 border-t md:border-0 pt-2 md:pt-0 border-stone-200">
                              <div className="text-right">
                                <span className="text-[10px] text-stone-500 block uppercase font-semibold">
                                  Subtotal
                                </span>
                                <span className="text-base font-black text-stone-900">
                                  ₹{parseFloat(sec.total || 0).toFixed(2)}
                                </span>
                              </div>
                              <button
                                onClick={() => setSettleCustomerTarget(sec)}
                                className="px-3.5 py-2 bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs rounded-xl transition active:scale-95 cursor-pointer whitespace-nowrap shadow-xs"
                              >
                                Settle {sec.customerName}'s Bill (₹{parseFloat(sec.total || 0).toFixed(2)})
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* MODE 2: FLAT ORDER STREAM */}
            {ordersViewMode === 'stream' && (
              <div className="space-y-3">
                {(ordersList.length === 0 && (!overview?.recent_orders || overview.recent_orders.length === 0)) ? (
                  <p className="text-xs text-stone-400 italic py-8 text-center">
                    No active orders recorded. Fresh orders placed from table QR codes will appear here in real-time.
                  </p>
                ) : (
                  (ordersList.length > 0 ? ordersList : (overview?.recent_orders || [])).map((order) => (
                    <div
                      key={order.id}
                      className="p-4 rounded-2xl bg-stone-50 border border-stone-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-stone-900 bg-amber-200/80 px-2.5 py-1 rounded-lg">
                            Table #{order.table_number || '1'}
                          </span>
                          {order.session_label && (
                            <span className="text-xs font-bold text-sky-700 bg-sky-100 px-2 py-0.5 rounded-md border border-sky-200">
                              {order.session_label}
                            </span>
                          )}
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
                            {(order.items || []).map((it, idx) => (
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
            )}
          </div>
        )}

        {/* TAB 3: STAFF SERVICE REQUESTS */}
        {activeTab === 'service' && (
          <TabErrorBoundary>
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
              {(serviceRequests || []).length === 0 ? (
                <div className="py-12 text-center text-stone-400 text-xs italic">
                  All table service calls have been resolved!
                </div>
              ) : (
                (serviceRequests || []).map((req) => (
                  <div
                    key={req.id}
                    className="p-4 rounded-2xl bg-stone-50 border border-stone-200 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-700 flex items-center justify-center font-bold">
                        <BellRing className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-stone-900 flex items-center gap-2 flex-wrap">
                          <span>Table #{req.table_number || '1'}</span>
                          {(req.session_label || req.customer_name) && (
                            <span className="text-[11px] font-semibold text-sky-700 bg-sky-100 px-2 py-0.5 rounded-md border border-sky-200">
                              {req.session_label || 'Customer'}{req.customer_name ? ` (${req.customer_name})` : ''}
                            </span>
                          )}
                          <span className="text-stone-400">&bull;</span>
                          <span>{req.request_type}</span>
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
          </TabErrorBoundary>
        )}

        {/* TAB 4: MENU & FOOD CATALOG STUDIO */}
        {activeTab === 'menu' && (
          <div className="bg-white rounded-3xl border border-stone-200 p-6 shadow-xs space-y-6 animate-fade-in">
            {/* Header with Add Food Button */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-100">
              <div>
                <h3 className="font-serif font-bold text-lg text-stone-900 flex items-center gap-2">
                  <Utensils className="w-5 h-5 text-amber-600" />
                  <span>Menu & Food Catalog Studio</span>
                </h3>
                <p className="text-xs text-stone-500">
                  Add new dishes with photos, alter rates, configure promotional discount offers & toggle live stock.
                </p>
              </div>

              <button
                onClick={openAddDishModal}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs rounded-xl transition flex items-center gap-2 shadow-xs cursor-pointer w-fit"
              >
                <Plus className="w-4 h-4 text-stone-950" />
                <span>Add New Food Item</span>
              </button>
            </div>

            {/* Category Filter Ribbon */}
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              {['ALL', 'Starters', 'Main Course', 'Breads', 'Desserts', 'Beverages'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedMenuCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    selectedMenuCategory === cat
                      ? 'bg-stone-900 text-white shadow-xs'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Menu Items Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(Array.isArray(menuItems) ? menuItems : [])
                .filter((it) => selectedMenuCategory === 'ALL' || (it?.category || '').toLowerCase() === selectedMenuCategory.toLowerCase())
                .map((item) => {
                  const isAvail = item.is_available !== false && item.available !== false;
                  const hasOffer = item.original_price && parseFloat(item.original_price) > parseFloat(item.price);
                  const displayImg = item.photo_url || item.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80';

                  return (
                    <div
                      key={item.id}
                      className={`rounded-2xl border p-4 transition-all flex flex-col justify-between ${
                        isAvail ? 'bg-stone-50/70 border-stone-200 hover:border-stone-300' : 'bg-rose-50/40 border-rose-200 opacity-75'
                      }`}
                    >
                      <div>
                        {/* Food Image with Offer & Stock Badges */}
                        <div className="relative aspect-16/9 rounded-xl overflow-hidden bg-stone-200 mb-3">
                          <img
                            src={displayImg}
                            alt={item.name}
                            className={`w-full h-full object-cover ${!isAvail ? 'grayscale-60' : ''}`}
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80';
                            }}
                          />

                          {/* Offer Badge Overlay */}
                          {(item.offer_badge || hasOffer) && isAvail && (
                            <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-linear-to-r from-amber-500 to-rose-600 text-white font-black text-[10px] uppercase shadow-md flex items-center gap-1">
                              <Tag className="w-2.5 h-2.5" />
                              {item.offer_badge || 'OFFER'}
                            </span>
                          )}

                          {/* Stock status pill */}
                          <span className={`absolute top-2 right-2 px-2 py-0.5 rounded-full font-bold text-[10px] shadow-xs ${
                            isAvail ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
                          }`}>
                            {isAvail ? 'In Stock' : 'Out of Stock'}
                          </span>
                        </div>

                        {/* Title, Category & Description */}
                        <div className="space-y-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              {/* Veg / Non-Veg Indicator */}
                              <div className={`w-3.5 h-3.5 border-2 flex items-center justify-center shrink-0 rounded-xs ${
                                (item.is_veg !== undefined ? Boolean(item.is_veg) : !(item.name?.toLowerCase().includes('chicken') || item.name?.toLowerCase().includes('mutton') || item.name?.toLowerCase().includes('fish') || item.name?.toLowerCase().includes('meat') || item.name?.toLowerCase().includes('egg') || item.name?.toLowerCase().includes('prawn')))
                                  ? 'border-emerald-600'
                                  : 'border-rose-600'
                              }`}>
                                <div className={`w-1.5 h-1.5 rounded-full ${
                                  (item.is_veg !== undefined ? Boolean(item.is_veg) : !(item.name?.toLowerCase().includes('chicken') || item.name?.toLowerCase().includes('mutton') || item.name?.toLowerCase().includes('fish') || item.name?.toLowerCase().includes('meat') || item.name?.toLowerCase().includes('egg') || item.name?.toLowerCase().includes('prawn')))
                                    ? 'bg-emerald-600'
                                    : 'bg-rose-600'
                                }`}></div>
                              </div>
                              <h4 className="font-bold text-sm text-stone-900 leading-snug truncate">
                                {item.name}
                              </h4>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-semibold text-amber-700">
                              {item.category || 'General'}
                            </span>
                            <span className="text-stone-300">&bull;</span>
                            <span className={`text-[10px] font-bold ${
                              (item.is_veg !== undefined ? Boolean(item.is_veg) : !(item.name?.toLowerCase().includes('chicken') || item.name?.toLowerCase().includes('mutton') || item.name?.toLowerCase().includes('fish') || item.name?.toLowerCase().includes('meat') || item.name?.toLowerCase().includes('egg') || item.name?.toLowerCase().includes('prawn')))
                                ? 'text-emerald-700'
                                : 'text-rose-700'
                            }`}>
                              {(item.is_veg !== undefined ? Boolean(item.is_veg) : !(item.name?.toLowerCase().includes('chicken') || item.name?.toLowerCase().includes('mutton') || item.name?.toLowerCase().includes('fish') || item.name?.toLowerCase().includes('meat') || item.name?.toLowerCase().includes('egg') || item.name?.toLowerCase().includes('prawn')))
                                ? 'Pure Veg'
                                : 'Non-Veg'}
                            </span>
                          </div>
                          {item.description && (
                            <p className="text-xs text-stone-500 line-clamp-2">
                              {item.description}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Pricing & Control Bar */}
                      <div className="mt-4 pt-3 border-t border-stone-200/70 flex items-center justify-between">
                        <div>
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-base font-black text-stone-950">
                              ₹{parseFloat(item.price).toFixed(0)}
                            </span>
                            {hasOffer && (
                              <span className="text-xs font-semibold text-stone-400 line-through">
                                ₹{parseFloat(item.original_price).toFixed(0)}
                              </span>
                            )}
                          </div>
                          {hasOffer && (
                            <p className="text-[10px] text-emerald-600 font-bold">
                              Save ₹{(parseFloat(item.original_price) - parseFloat(item.price)).toFixed(0)}
                            </p>
                          )}
                        </div>

                        {/* Actions: Stock Toggle, Edit, Delete */}
                        <div className="flex items-center gap-1.5">
                          {/* 1-Click Stock Toggle */}
                          <button
                            onClick={() => handleToggleStock(item.id)}
                            title={isAvail ? 'Click to Mark Out of Stock' : 'Click to Restock'}
                            className={`p-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                              isAvail
                                ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                : 'bg-rose-600 text-white hover:bg-rose-500'
                            }`}
                          >
                            {isAvail ? <ToggleRight className="w-4 h-4 text-emerald-700" /> : <ToggleLeft className="w-4 h-4 text-white" />}
                          </button>

                          {/* Edit Dish */}
                          <button
                            onClick={() => openEditDishModal(item)}
                            title="Edit dish, price & offer"
                            className="p-1.5 rounded-xl bg-stone-200 hover:bg-stone-300 text-stone-700 transition cursor-pointer"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete Dish */}
                          <button
                            onClick={() => handleDeleteDish(item.id, item.name)}
                            title="Delete food item"
                            className="p-1.5 rounded-xl bg-stone-200 hover:bg-rose-100 hover:text-rose-700 text-stone-500 transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
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

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
              {(Array.isArray(tables) ? tables : []).map((tbl) => {
                const tableIdVal = tbl.tableId || tbl.table_id || tbl.id;
                const tableNumVal = tbl.tableNumber || tbl.table_number || tbl.number;
                const qrSrc = tbl.qrCodeDataUrl || tbl.qr_data_url || tbl.qr_code_url || `/api/qr/${tableIdVal}`;
                const orderLink = `/order?tableId=${tableIdVal}&tableNumber=${tableNumVal}`;

                return (
                  <div
                    key={tableIdVal}
                    className="p-5 rounded-3xl bg-stone-900 border border-amber-500/20 text-center flex flex-col items-center justify-between shadow-xl relative overflow-hidden"
                  >
                    {/* Branded Stand Header */}
                    <div className="w-full flex items-center justify-between pb-3 border-b border-white/10">
                      <div className="flex items-center gap-1.5">
                        <img src="/krish_logo.png" alt="KRISH Logo" className="h-6 w-auto object-contain" />
                        <span className="font-serif font-black text-xs text-amber-300 tracking-tight">KRISH</span>
                      </div>
                      <span className="text-xs font-black uppercase text-stone-950 bg-amber-400 px-2.5 py-0.5 rounded-lg shadow-sm">
                        TABLE #{tableNumVal}
                      </span>
                    </div>

                    <div className="my-3 p-4 bg-white rounded-2xl shadow-lg border border-stone-100 flex flex-col items-center w-full">
                      <p className="text-[10px] font-black uppercase tracking-wider text-stone-700 mb-2">
                        Scan with GPay / PhonePe / Camera
                      </p>
                      <img
                        src={qrSrc}
                        alt={`Table ${tableNumVal} QR`}
                        className="w-40 h-40 mx-auto object-contain"
                      />
                      <p className="text-[10px] text-stone-500 font-bold mt-2">
                        Order & Pay Instantly via UPI
                      </p>
                    </div>

                    <div className="w-full space-y-2 pt-1">
                      <div className="flex gap-2 w-full">
                        <a
                          href={`/api/qr/${tableIdVal}`}
                          download={`krish_table_${tableNumVal}_qr.png`}
                          className="flex-1 py-2 bg-stone-800 hover:bg-stone-700 text-amber-300 text-[11px] font-bold rounded-xl transition text-center border border-white/10"
                        >
                          Download PNG
                        </a>
                        <a
                          href={`/api/qr/${tableIdVal}?format=svg`}
                          download={`krish_table_${tableNumVal}_qr.svg`}
                          className="flex-1 py-2 bg-stone-800 hover:bg-stone-700 text-stone-300 text-[11px] font-bold rounded-xl transition text-center border border-white/10"
                        >
                          Vector SVG
                        </a>
                      </div>

                      <a
                        href={orderLink}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full py-2.5 krish-gradient-gold text-stone-950 text-xs font-black rounded-xl transition flex items-center justify-center gap-1.5 shadow-md active:scale-98"
                      >
                        <span>Open Diner Menu (Table {tableNumVal})</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                );
              })}
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
              {(coupons || []).map((c) => (
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

        {/* TAB 7: DINER REVIEWS & AI SENTIMENT */}
        {activeTab === 'reviews' && (
          <div className="space-y-6 animate-fade-in">
            
            {/* Top Review Metrics & AI Intelligence Card */}
            <div className="bg-white rounded-3xl border border-stone-200 p-6 shadow-xs space-y-6">
              
              {/* Header Score & AI Tag */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-100 pb-5">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-600 flex flex-col items-center justify-center font-serif font-black shadow-xs">
                    <span className="text-xl leading-none">{reviewsAI?.averageRating || 4.9}</span>
                    <span className="text-[10px] text-amber-700/80 font-sans font-bold">/ 5.0</span>
                  </div>
                  <div>
                    <h3 className="font-serif font-bold text-lg text-stone-900 flex items-center gap-2">
                      <span>Diner Reviews & AI Intelligence</span>
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-sans font-bold">
                        {reviewsAI?.goodPercentage || 98}% Positive
                      </span>
                    </h3>
                    <p className="text-xs text-stone-500">
                      Based on {reviewsAI?.totalReviews || feedbackList.length || 0} authenticated customer dining reviews
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-50 border border-purple-200 text-purple-900 text-xs font-bold shadow-2xs">
                    <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                    <span>{reviewsAI?.engine || 'Local SLM Engine (Free Lifetime)'}</span>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-1 rounded-lg border border-emerald-200">
                    ⚡ 100% Free Lifetime
                  </span>
                </div>
              </div>

              {/* AI Executive Summary Card */}
              <div className="p-4 rounded-2xl bg-linear-to-r from-purple-50/70 via-stone-50 to-amber-50/40 border border-purple-200/80 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-purple-950">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                  <span className="uppercase tracking-wider text-[11px]">AI Review Context & Operational Analysis</span>
                </div>
                <p className="text-xs text-stone-800 leading-relaxed font-medium">
                  {reviewsAI?.executiveSummary || reviewsAI?.aiSummary || 'Diners consistently praise the food flavor and smooth contactless ordering experience. Minor feedback focuses on table water refill turnaround during peak dining hours.'}
                </p>

                {/* Manager / Chef Action Points */}
                {Array.isArray(reviewsAI?.managerActionItems) && reviewsAI.managerActionItems.length > 0 && (
                  <div className="pt-2 mt-2 border-t border-purple-200/50 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-purple-900">
                      Recommended Immediate Action Points:
                    </span>
                    <ul className="text-xs text-stone-700 space-y-1 list-disc pl-4">
                      {(reviewsAI?.managerActionItems || []).map((item, idx) => (
                        <li key={idx} className="leading-snug">{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Praise Tags vs Bad Notice / Pain Points */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Green: What Diners Love */}
                <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-emerald-900">
                      <ThumbsUp className="w-4 h-4 text-emerald-600" />
                      <span>What Diners Love (Common Praise)</span>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                      Good Segregation
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {(reviewsAI?.topPraises || reviewsAI?.praiseTags || [
                      { badge: '😋 Delicious Taste', topic: 'Food Taste & Flavors', count: 18, percent: 85 },
                      { badge: '⚡ Fast Kitchen Pacing', topic: 'Speed & Service Promptness', count: 12, percent: 60 },
                      { badge: '📱 Smooth QR Ordering', topic: 'Contactless QR Convenience', count: 9, percent: 45 },
                      { badge: '🔥 Hot & Fresh', topic: 'Freshness & Serving Temperature', count: 7, percent: 35 }
                    ]).map((pt, idx) => (
                      <div
                        key={idx}
                        className="px-2.5 py-1.5 rounded-xl bg-white border border-emerald-200 text-emerald-900 text-xs font-bold flex items-center gap-2 shadow-2xs"
                      >
                        <span>{pt.badge || pt.tag || '✨ ' + pt.topic}</span>
                        <span className="text-[10px] text-emerald-700 font-bold bg-emerald-100/70 px-1.5 py-0.2 rounded-md">
                          {pt.count || 1} mentions
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Red: Core Pain Points (Bad Notice) */}
                <div className="p-4 rounded-2xl bg-rose-50/60 border border-rose-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-rose-900">
                      <ThumbsDown className="w-4 h-4 text-rose-600" />
                      <span>Operational Problems & Feedback</span>
                    </div>
                    <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full">
                      Needs Attention
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {(reviewsAI?.commonProblems || reviewsAI?.criticalNotices || [
                      { badge: '⏳ Long Waiting Time', topic: 'Wait Times & Kitchen Delays', count: 2, severity: 'HIGH', advice: 'Streamline kitchen pass-through' },
                      { badge: '💧 Delayed Water Refills', topic: 'Water & Drink Refill Response', count: 1, severity: 'MEDIUM', advice: 'Floor runner check-in' }
                    ]).map((cn, idx) => (
                      <div
                        key={idx}
                        className="px-2.5 py-1.5 rounded-xl bg-white border border-rose-200 text-rose-900 text-xs font-bold flex items-center gap-2 shadow-2xs"
                      >
                        <span>{cn.badge || cn.notice || '⚠️ ' + cn.topic}</span>
                        <span className="text-[10px] text-rose-700 font-bold bg-rose-100/70 px-1.5 py-0.2 rounded-md">
                          {cn.count || 1} issues
                        </span>
                        {cn.severity && (
                          <span className={`text-[9px] px-1 py-0.2 rounded uppercase font-black ${
                            cn.severity === 'HIGH' ? 'bg-rose-600 text-white' : 'bg-amber-500 text-white'
                          }`}>
                            {cn.severity}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Segregated Reviews Stream & Filtering */}
            <div className="bg-white rounded-3xl border border-stone-200 p-6 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-4">
                <div>
                  <h3 className="font-serif font-bold text-base text-stone-900">
                    Customer Reviews Stream
                  </h3>
                  <p className="text-xs text-stone-500">
                    Segregated by customer sentiment and satisfaction rating
                  </p>
                </div>

                {/* Segregation Filter Buttons */}
                <div className="flex items-center gap-1.5 p-1 bg-stone-100 rounded-2xl w-fit">
                  <button
                    onClick={() => setReviewFilter('ALL')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                      reviewFilter === 'ALL'
                        ? 'bg-white text-stone-900 shadow-2xs'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    <span>All</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-stone-200 text-stone-700 font-bold">
                      {segregatedReviews.all.length}
                    </span>
                  </button>

                  <button
                    onClick={() => setReviewFilter('GOOD')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                      reviewFilter === 'GOOD'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'text-stone-600 hover:text-emerald-800'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    <span>Good Reviews</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      reviewFilter === 'GOOD' ? 'bg-emerald-700 text-white' : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {segregatedReviews.good.length}
                    </span>
                  </button>

                  <button
                    onClick={() => setReviewFilter('BAD')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                      reviewFilter === 'BAD'
                        ? 'bg-rose-600 text-white shadow-2xs'
                        : 'text-stone-600 hover:text-rose-800'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-rose-400"></span>
                    <span>Needs Attention (Bad)</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      reviewFilter === 'BAD' ? 'bg-rose-700 text-white' : 'bg-rose-100 text-rose-800'
                    }`}>
                      {segregatedReviews.bad.length}
                    </span>
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {displayedReviews.length === 0 ? (
                  <div className="py-12 text-center text-stone-400 space-y-1">
                    <p className="text-sm font-semibold text-stone-600">No reviews found in this category</p>
                    <p className="text-xs text-stone-400">
                      {reviewFilter === 'BAD'
                        ? 'Awesome! You have zero negative reviews.'
                        : 'No reviews submitted matching the selected filter.'}
                    </p>
                  </div>
                ) : (
                  (displayedReviews || []).map((fb) => {
                    const ratingNum = parseInt(fb.rating || 5, 10);
                    const isGood = ratingNum >= 4;

                    return (
                      <div
                        key={fb.id}
                        className={`p-4 rounded-2xl border transition space-y-2 ${
                          isGood
                            ? 'bg-emerald-50/30 border-emerald-200/80 hover:border-emerald-300'
                            : 'bg-rose-50/40 border-rose-200 hover:border-rose-300'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            {/* Stars */}
                            <div className="flex items-center gap-0.5 text-amber-400">
                              {Array.from({ length: ratingNum }).map((_, i) => (
                                <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                              ))}
                            </div>

                            {/* Good vs Bad Badge */}
                            <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                              isGood
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : 'bg-rose-600 text-white shadow-2xs'
                            }`}>
                              {isGood ? '🟢 Good Experience' : '🔴 Needs Attention'}
                            </span>

                            {/* Customer & Table */}
                            <span className="text-xs font-bold text-stone-800">
                              {fb.customer_name ? fb.customer_name : 'Verified Diner'}
                            </span>

                            {fb.table_number && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-stone-200 text-stone-700 font-semibold">
                                Table #{fb.table_number}
                              </span>
                            )}
                          </div>

                          <span className="text-[11px] text-stone-400">
                            {new Date(fb.created_at).toLocaleDateString()} &bull; {new Date(fb.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        {fb.comments && (
                          <div className="text-xs text-stone-700 pl-1 leading-relaxed">
                            "{fb.comments}"
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

          </div>
        )}

        {/* TAB 8: DYNAMIC UPI PAYMENTS & SETTINGS */}
        {activeTab === 'upi' && (
          <TabErrorBoundary>
            <div className="space-y-6 animate-fade-in">
            {/* Header / Benefits Card */}
            <div className="bg-linear-to-r from-stone-900 via-stone-850 to-stone-900 text-white rounded-3xl p-6 shadow-md border border-stone-800">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                    <Smartphone className="w-7 h-7" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-serif font-bold text-xl text-white">
                        Dynamic UPI Payment Engine
                      </h3>
                      <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-2.5 py-0.5 rounded-full">
                        0% Commission
                      </span>
                    </div>
                    <p className="text-xs text-stone-400 mt-1 max-w-xl">
                      Generates exact-amount dynamic QR codes for each dining table. Payments route straight to your bank account with zero payment gateway transaction deductions.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="bg-stone-800/80 rounded-2xl p-3 border border-stone-700 text-center min-w-[120px]">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block">
                      Active VPA
                    </span>
                    <span className="text-xs font-mono font-bold text-amber-400 truncate block max-w-[150px]">
                      {upiConfig.upiId}
                    </span>
                  </div>
                  <div className="bg-stone-800/80 rounded-2xl p-3 border border-stone-700 text-center min-w-[100px]">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block">
                      Gateway Fees
                    </span>
                    <span className="text-xs font-bold text-emerald-400 block">
                      ₹0 (Free)
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Two-Column: Settings & Live QR Simulator */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Left: UPI Multi-Bank Switcher & Custom Configuration */}
              <div className="bg-white rounded-3xl border border-stone-200 p-6 shadow-xs space-y-6">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md">
                      Bank Limit Switcher
                    </span>
                    <h4 className="font-serif font-bold text-lg text-stone-900 mt-1.5">
                      Bank Accounts & Daily Limits
                    </h4>
                    <p className="text-xs text-stone-500">
                      When your primary bank hits its daily transaction limit (e.g. ₹1 Lakh), switch to a backup account instantly.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsResetPasskeyOpen(true)}
                    className="text-[11px] font-bold text-stone-600 hover:text-amber-800 bg-stone-100 hover:bg-stone-200 border border-stone-300 px-2.5 py-1 rounded-xl transition flex items-center gap-1 cursor-pointer"
                  >
                    <Lock className="w-3 h-3 text-amber-600" />
                    <span>Reset Passkey</span>
                  </button>
                </div>

                {/* Preset Accounts List */}
                <div className="space-y-2.5">
                  {(Array.isArray(upiAccounts) && upiAccounts.length > 0 ? upiAccounts : [
                    { id: 'acc_1', bank: 'State Bank of India (SBI)', upi_id: '8760633322@oksbi', upi_name: 'KRISH Cafe & Restaurant (SBI)', daily_limit: '₹1,00,000 / day', notes: 'Primary Account (GPay / PhonePe / Paytm)' },
                    { id: 'acc_2', bank: 'HDFC Bank', upi_id: 'krishcafe@okhdfcbank', upi_name: 'KRISH Cafe & Restaurant (HDFC)', daily_limit: '₹2,00,000 / day', notes: 'Secondary Backup (Switches when SBI daily limit hits)' },
                    { id: 'acc_3', bank: 'ICICI Bank', upi_id: 'krishcafe@icici', upi_name: 'KRISH Cafe & Restaurant (ICICI)', daily_limit: '₹2,00,000 / day', notes: 'Weekend High-Volume Backup' }
                  ]).map((acc) => {
                    const isActive = (upiConfig.upiId || '').toLowerCase() === (acc.upi_id || '').toLowerCase();
                    return (
                      <div
                        key={acc.id}
                        className={`p-3.5 rounded-2xl border transition-all ${
                          isActive
                            ? 'bg-amber-50/60 border-amber-300 ring-2 ring-amber-400/30'
                            : 'bg-stone-50/80 border-stone-200 hover:border-stone-300'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs text-stone-900">{acc.bank}</span>
                              {isActive ? (
                                <span className="bg-emerald-600 text-white text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full flex items-center gap-1">
                                  <Check className="w-2.5 h-2.5" />
                                  Active Live
                                </span>
                              ) : (
                                <span className="text-[10px] font-semibold text-stone-500 bg-stone-200/70 px-2 py-0.5 rounded-md">
                                  {acc.daily_limit}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] font-mono font-semibold text-stone-600 mt-0.5">
                              {acc.upi_id}
                            </p>
                            {acc.notes && (
                              <p className="text-[10px] text-stone-400 mt-0.5">
                                {acc.notes}
                              </p>
                            )}
                          </div>

                          {!isActive && (
                            <button
                              type="button"
                              onClick={() => handleInitiatePresetSwitch(acc)}
                              className="px-3 py-1.5 bg-stone-900 hover:bg-amber-600 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95 shrink-0"
                            >
                              <Lock className="w-3 h-3 text-amber-400" />
                              <span>Switch</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="border-t border-stone-200 pt-5">
                  <div className="mb-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
                      Custom VPA Configuration
                    </span>
                    <h5 className="font-bold text-xs text-stone-900 mt-0.5">
                      Or Set a Custom Merchant UPI ID
                    </h5>
                  </div>

                  <form onSubmit={handleInitiateCustomUpiSave} className="space-y-4">
                    <div>
                      <label className="text-xs font-bold text-stone-700 block mb-1">
                        UPI ID / Virtual Payment Address (VPA)
                      </label>
                      <input
                        type="text"
                        required
                        value={upiConfig.upiId}
                        onChange={(e) => setUpiConfig({ ...upiConfig, upiId: e.target.value.trim() })}
                        placeholder="e.g. vallipriya1212-1@oksbi"
                        className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-xs font-mono font-bold text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
                      />
                      <p className="text-[11px] text-stone-400 mt-1">
                        Must be a valid handle (e.g. <code>vallipriya1212-1@oksbi</code>, <code>merchant@okhdfcbank</code>).
                      </p>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-stone-700 block mb-1">
                        Merchant Payee Name (Appears in Diner's UPI App)
                      </label>
                      <input
                        type="text"
                        required
                        value={upiConfig.upiName}
                        onChange={(e) => setUpiConfig({ ...upiConfig, upiName: e.target.value })}
                        placeholder="e.g. KRISH Cafe & Restaurant"
                        className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-xs font-bold text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isSavingUpi}
                      className="w-full py-3 bg-stone-900 hover:bg-stone-800 disabled:bg-stone-400 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                    >
                      <Lock className="w-4 h-4 text-amber-400" />
                      <span>Save with Manager Passkey</span>
                    </button>
                  </form>
                </div>
              </div>

              {/* Right: Live Dynamic QR Code Simulator */}
              <div className="bg-white rounded-3xl border border-stone-200 p-6 shadow-xs space-y-5">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                    Live Testing
                  </span>
                  <h4 className="font-serif font-bold text-lg text-stone-900 mt-1.5">
                    Dynamic QR Code Preview & Simulator
                  </h4>
                  <p className="text-xs text-stone-500">
                    Test the dynamic QR code generated for diners. Amount is auto-locked in the QR payload.
                  </p>
                </div>

                {/* Amount Selector */}
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-stone-500 block mb-1.5">
                    Test Simulation Amount (₹)
                  </label>
                  <div className="flex items-center gap-2">
                    {['100', '250', '500', '1250'].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setTestUpiAmount(amt)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                          testUpiAmount === amt
                            ? 'bg-amber-500 text-stone-950 font-black shadow-xs'
                            : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                        }`}
                      >
                        ₹{amt}
                      </button>
                    ))}
                    <input
                      type="number"
                      min="1"
                      value={testUpiAmount}
                      onChange={(e) => setTestUpiAmount(e.target.value)}
                      className="w-24 px-2.5 py-1.5 bg-stone-50 border border-stone-300 rounded-xl text-xs font-mono font-bold text-stone-900 focus:outline-hidden"
                      placeholder="Custom"
                    />
                  </div>
                </div>

                {/* QR Display Frame */}
                {(() => {
                  const amtVal = parseFloat(testUpiAmount || 100).toFixed(2);
                  const simUri = `upi://pay?pa=${encodeURIComponent(upiConfig.upiId)}&pn=${encodeURIComponent(upiConfig.upiName)}&am=${amtVal}&cu=INR&tn=Table%201%20Bill`;

                  return (
                    <div className="p-4 bg-stone-50 rounded-2xl border-2 border-dashed border-stone-200 text-center space-y-3">
                      <div className="inline-block p-3 bg-white rounded-2xl shadow-sm border border-stone-200">
                        <SafeQRCode
                          value={simUri}
                          size={180}
                          level="M"
                          className="mx-auto"
                        />
                      </div>

                      <div className="text-xs font-bold text-stone-900">
                        ₹{amtVal} &bull; {upiConfig.upiName}
                      </div>

                      <div className="flex items-center justify-center gap-2 text-stone-500 text-[11px] font-medium">
                        <span>GPay</span> &bull; <span>PhonePe</span> &bull; <span>Paytm</span> &bull; <span>BHIM</span> &bull; <span>CRED</span>
                      </div>

                      <div className="bg-white p-2 rounded-xl border border-stone-200 flex items-center justify-between text-left">
                        <div className="min-w-0 pr-2">
                          <span className="text-[10px] text-stone-400 uppercase font-bold block">
                            Generated Deep Link
                          </span>
                          <span className="text-[11px] font-mono text-stone-700 truncate block">
                            {simUri}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(simUri);
                            setUpiCopied(true);
                            setTimeout(() => setUpiCopied(false), 2000);
                          }}
                          className="px-2.5 py-1 text-xs font-bold rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 shrink-0 cursor-pointer flex items-center gap-1"
                        >
                          {upiCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{upiCopied ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>

            </div>

            {/* Bottom: Incoming Verification Queue */}
            <div className="bg-white rounded-3xl border border-stone-200 p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-serif font-bold text-lg text-stone-900">
                    Live UPI Verification Queue ({incomingUpiPayments.length})
                  </h4>
                  <p className="text-xs text-stone-500">
                    Real-time payment notifications submitted by diners at their tables.
                  </p>
                </div>
                {incomingUpiPayments.length > 0 && (
                  <button
                    onClick={() => setIncomingUpiPayments([])}
                    className="text-xs text-stone-500 hover:text-stone-800 underline cursor-pointer"
                  >
                    Clear All Alerts
                  </button>
                )}
              </div>

              {incomingUpiPayments.length === 0 ? (
                <div className="py-12 text-center text-stone-400 bg-stone-50 rounded-2xl border border-dashed border-stone-200 space-y-1">
                  <Smartphone className="w-8 h-8 text-stone-300 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-stone-600">No Pending UPI Settlements</p>
                  <p className="text-xs text-stone-400">
                    When diners scan and complete payment on their phones, their verification alerts will appear here instantly.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {(incomingUpiPayments || []).map((notice) => (
                    <div
                      key={notice.id}
                      className="p-4 rounded-2xl bg-emerald-50/40 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                          T{notice.tableNumber}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-stone-900 text-sm">
                              Table #{notice.tableNumber}
                            </span>
                            <span className="text-sm font-black text-emerald-800">
                              ₹{parseFloat(notice.amount || 0).toFixed(2)}
                            </span>
                            <span className="text-[10px] font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full">
                              Pending Cashier Verification
                            </span>
                          </div>
                          <p className="text-xs text-stone-500 mt-0.5">
                            {notice.customerName ? `Diner: ${notice.customerName} &bull; ` : ''}
                            {notice.utr ? `UTR: ${notice.utr} &bull; ` : 'Direct Intent &bull; '}
                            {notice.timestamp ? new Date(notice.timestamp).toLocaleTimeString() : 'Just now'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleQuickSettleUpi(notice)}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition shadow-xs cursor-pointer active:scale-98 flex items-center gap-1.5"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Verify & Settle Table</span>
                        </button>
                        <button
                          onClick={() => setIncomingUpiPayments((prev) => prev.filter((p) => p.id !== notice.id))}
                          className="p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-200 rounded-xl transition cursor-pointer"
                          title="Dismiss notice"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          </TabErrorBoundary>
        )}
      </main>

      {/* Target Configuration Modal */}
      {isEditingTargets && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/60 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl space-y-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md">
                Settings
              </span>
              <h3 className="font-serif font-bold text-base text-stone-900 mt-1.5">
                Configure Revenue Targets
              </h3>
              <p className="text-xs text-stone-500">
                Adjust turnover targets for real-time pacing tracking.
              </p>
            </div>

            <form onSubmit={handleSaveTargets} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-stone-700 block mb-1">
                  Daily Target (₹)
                </label>
                <input
                  type="number"
                  value={targetForm.daily}
                  onChange={(e) => setTargetForm({ ...targetForm, daily: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-stone-700 block mb-1">
                  Weekly Target (₹)
                </label>
                <input
                  type="number"
                  value={targetForm.weekly}
                  onChange={(e) => setTargetForm({ ...targetForm, weekly: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-stone-700 block mb-1">
                  Monthly Target (₹)
                </label>
                <input
                  type="number"
                  value={targetForm.monthly}
                  onChange={(e) => setTargetForm({ ...targetForm, monthly: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditingTargets(false)}
                  className="flex-1 py-2 text-xs font-bold text-stone-600 bg-stone-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 text-xs font-bold text-white bg-stone-900 hover:bg-stone-800 rounded-xl transition cursor-pointer shadow-sm"
                >
                  Save Goals
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Individual Customer Bill Settlement Modal */}
      {settleCustomerTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/60 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl space-y-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md">
                Individual Customer Settlement
              </span>
              <h3 className="font-serif font-bold text-base text-stone-900 mt-1.5">
                Settle {settleCustomerTarget.customerName}'s Bill
              </h3>
              <p className="text-xs text-stone-500">
                {settleCustomerTarget.sectionLabel} &bull; Total: <strong className="text-stone-900">₹{parseFloat(settleCustomerTarget.total || 0).toFixed(2)}</strong>
              </p>
            </div>

            <p className="text-xs text-stone-500">Select payment method received:</p>
            <div className="grid grid-cols-3 gap-2">
              {['UPI', 'CASH', 'CARD'].map((m) => (
                <button
                  key={m}
                  onClick={() => setSettleMethod(m)}
                  className={`py-2 text-xs font-bold rounded-xl border transition cursor-pointer ${
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
                onClick={() => setSettleCustomerTarget(null)}
                className="flex-1 py-2 text-xs font-bold text-stone-600 bg-stone-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSettleCustomer}
                className="flex-1 py-2 text-xs font-bold text-white bg-stone-900 hover:bg-stone-800 rounded-xl transition cursor-pointer shadow-sm"
              >
                Settle Bill (₹{parseFloat(settleCustomerTarget.total || 0).toFixed(2)})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Entire Table Combined Settlement Modal */}
      {settleTableTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/60 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl space-y-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md">
                Combined Table Settlement
              </span>
              <h3 className="font-serif font-black text-lg text-stone-900 mt-1.5 flex items-center gap-2">
                <span>⚡</span>
                <span>Table T{String(settleTableTarget.tableNumber).padStart(2, '0')} Entire Bill</span>
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">
                Settles all <strong className="text-stone-900">{settleTableTarget.activeCustomersCount} active customer tabs</strong> together in a single transaction.
              </p>
            </div>

            <div className="p-3 bg-stone-50 border border-stone-200 rounded-2xl flex items-center justify-between">
              <span className="text-xs text-stone-600 font-semibold">Combined Bill Total:</span>
              <span className="text-xl font-black text-emerald-600">
                ₹{parseFloat(settleTableTarget.combinedBill || 0).toFixed(2)}
              </span>
            </div>

            <p className="text-xs text-stone-500">Select payment method:</p>
            <div className="grid grid-cols-3 gap-2">
              {['UPI', 'CASH', 'CARD'].map((m) => (
                <button
                  key={m}
                  onClick={() => setSettleMethod(m)}
                  className={`py-2 text-xs font-bold rounded-xl border transition cursor-pointer ${
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
                onClick={() => setSettleTableTarget(null)}
                className="flex-1 py-2 text-xs font-bold text-stone-600 bg-stone-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSettleEntireTable}
                className="flex-1 py-2 text-xs font-black text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition cursor-pointer shadow-md"
              >
                Settle All (₹{parseFloat(settleTableTarget.combinedBill || 0).toFixed(2)})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Flat Stream Settlement Modal */}
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

      {/* Add / Edit Dish Modal */}
      {isDishModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-xs animate-fade-in overflow-y-auto">
          <div className="w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md">
                  Food Catalog
                </span>
                <h3 className="font-serif font-bold text-lg text-stone-900 mt-1">
                  {editingDishId ? 'Edit Food Item & Rates' : 'Add New Food Item'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsDishModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-stone-100 text-stone-400 hover:text-stone-700 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveDish} className="space-y-4">
              {/* Row 1: Name & Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">
                    Dish Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Tandoori Chicken Tikka"
                    value={dishFormData.name}
                    onChange={(e) => setDishFormData({ ...dishFormData, name: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">
                    Category
                  </label>
                  <select
                    value={dishFormData.category}
                    onChange={(e) => setDishFormData({ ...dishFormData, category: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 focus:outline-none focus:border-amber-500 bg-white"
                  >
                    <option value="Starters">Starters</option>
                    <option value="Main Course">Main Course</option>
                    <option value="Breads">Breads</option>
                    <option value="Desserts">Desserts</option>
                    <option value="Beverages">Beverages</option>
                  </select>
                </div>
              </div>

              {/* Diet Classification: Veg vs Non-Veg */}
              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1.5">
                  Food Diet Category *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDishFormData({ ...dishFormData, isVeg: true })}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                      dishFormData.isVeg
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-900 ring-1 ring-emerald-500 shadow-2xs'
                        : 'bg-white border-stone-200 text-stone-500 hover:bg-stone-50'
                    }`}
                  >
                    <div className="w-3.5 h-3.5 border-2 border-emerald-600 flex items-center justify-center rounded-xs shrink-0">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-600"></div>
                    </div>
                    <span>🌱 Pure Vegetarian (Veg)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDishFormData({ ...dishFormData, isVeg: false })}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                      !dishFormData.isVeg
                        ? 'bg-rose-50 border-rose-500 text-rose-900 ring-1 ring-rose-500 shadow-2xs'
                        : 'bg-white border-stone-200 text-stone-500 hover:bg-stone-50'
                    }`}
                  >
                    <div className="w-3.5 h-3.5 border-2 border-rose-600 flex items-center justify-center rounded-xs shrink-0">
                      <div className="w-1.5 h-1.5 rounded-full bg-rose-600"></div>
                    </div>
                    <span>🍗 Non-Vegetarian (Non-Veg)</span>
                  </button>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Describe ingredients, cooking style, taste profile..."
                  value={dishFormData.description}
                  onChange={(e) => setDishFormData({ ...dishFormData, description: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 focus:outline-none focus:border-amber-500 resize-none"
                />
              </div>

              {/* Row 2: Rate, Original Price & Offer Badge */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-stone-50 p-3 rounded-2xl border border-stone-200">
                <div>
                  <label className="text-xs font-bold text-stone-900 block mb-1">
                    Selling Rate (₹) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="e.g. 280"
                    value={dishFormData.price}
                    onChange={(e) => setDishFormData({ ...dishFormData, price: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 focus:outline-none focus:border-amber-500 bg-white font-bold"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-stone-500 block mb-1">
                    Original Price (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 350 (strikethrough)"
                    value={dishFormData.originalPrice}
                    onChange={(e) => setDishFormData({ ...dishFormData, originalPrice: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 focus:outline-none focus:border-amber-500 bg-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-stone-500 block mb-1">
                    Offer Badge
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 20% OFF"
                    value={dishFormData.offerBadge}
                    onChange={(e) => setDishFormData({ ...dishFormData, offerBadge: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 focus:outline-none focus:border-amber-500 bg-white"
                  />
                </div>
              </div>

              {/* Photo Upload: File Picker or Web Link */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-stone-700">
                    Food Photo
                  </label>
                  <div className="flex rounded-lg bg-stone-100 p-0.5 border border-stone-200">
                    <button
                      type="button"
                      onClick={() => setPhotoUploadMode('file')}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition cursor-pointer ${
                        photoUploadMode === 'file'
                          ? 'bg-white text-stone-900 shadow-2xs'
                          : 'text-stone-500 hover:text-stone-800'
                      }`}
                    >
                      📁 Upload File
                    </button>
                    <button
                      type="button"
                      onClick={() => setPhotoUploadMode('url')}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition cursor-pointer ${
                        photoUploadMode === 'url'
                          ? 'bg-white text-stone-900 shadow-2xs'
                          : 'text-stone-500 hover:text-stone-800'
                      }`}
                    >
                      🔗 Paste Link
                    </button>
                  </div>
                </div>

                {photoUploadMode === 'file' ? (
                  <div className="border-2 border-dashed border-stone-200 hover:border-amber-400 rounded-2xl p-4 text-center bg-stone-50/60 transition group cursor-pointer relative">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoFileChange}
                      disabled={isUploadingPhoto}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div className="flex flex-col items-center justify-center space-y-1.5">
                      <div className="w-10 h-10 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center">
                        {isUploadingPhoto ? (
                          <RefreshCw className="w-5 h-5 animate-spin" />
                        ) : (
                          <Camera className="w-5 h-5" />
                        )}
                      </div>
                      <p className="text-xs font-bold text-stone-800">
                        {isUploadingPhoto ? 'Uploading photo...' : 'Click or tap to upload photo'}
                      </p>
                      <p className="text-[10px] text-stone-400">
                        Select directly from camera, photo gallery, or device (PNG, JPG, WEBP)
                      </p>
                    </div>
                  </div>
                ) : (
                  <input
                    type="url"
                    placeholder="Paste image link (e.g. https://images.unsplash.com/...)"
                    value={dishFormData.photoUrl}
                    onChange={(e) => setDishFormData({ ...dishFormData, photoUrl: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 focus:outline-none focus:border-amber-500"
                  />
                )}
              </div>

              {/* Live Image & Card Preview */}
              {dishFormData.photoUrl && (
                <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-stone-100 border border-stone-200">
                  <img
                    src={dishFormData.photoUrl}
                    alt="Preview"
                    className="w-16 h-12 object-cover rounded-xl"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=200&q=80';
                    }}
                  />
                  <div className="text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className={`w-3 h-3 border flex items-center justify-center rounded-2xs ${
                        dishFormData.isVeg ? 'border-emerald-600' : 'border-rose-600'
                      }`}>
                        <div className={`w-1 h-1 rounded-full ${
                          dishFormData.isVeg ? 'bg-emerald-600' : 'bg-rose-600'
                        }`}></div>
                      </div>
                      <p className="font-bold text-stone-900">{dishFormData.name || 'Dish Preview'}</p>
                    </div>
                    <p className="text-stone-500 mt-0.5">
                      ₹{dishFormData.price || 0}{' '}
                      {dishFormData.originalPrice && <span className="line-through text-stone-400">₹{dishFormData.originalPrice}</span>}
                      {dishFormData.offerBadge && <span className="ml-1 text-emerald-600 font-bold">({dishFormData.offerBadge})</span>}
                      <span className={`ml-1.5 font-bold ${dishFormData.isVeg ? 'text-emerald-700' : 'text-rose-700'}`}>
                        &bull; {dishFormData.isVeg ? 'Pure Veg' : 'Non-Veg'}
                      </span>
                    </p>
                  </div>
                </div>
              )}

              {/* Stock Availability Toggle */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-stone-50 border border-stone-200">
                <div>
                  <p className="text-xs font-bold text-stone-900">Stock Availability</p>
                  <p className="text-[11px] text-stone-500">
                    {dishFormData.available ? 'Dish is in stock and available for diners to order' : 'Mark as Out of Stock (Sold Out)'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDishFormData({ ...dishFormData, available: !dishFormData.available })}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                    dishFormData.available ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-600 text-white'
                  }`}
                >
                  {dishFormData.available ? (
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

              {/* Form Buttons */}
              <div className="flex gap-2 pt-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setIsDishModalOpen(false)}
                  className="flex-1 py-2.5 text-xs font-bold text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 text-xs font-black text-stone-950 bg-amber-500 hover:bg-amber-400 rounded-xl transition cursor-pointer shadow-sm"
                >
                  {editingDishId ? 'Save Changes' : 'Add Food Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Manager Passkey Authorization */}
      {isPasskeyModalOpen && (
        <div className="fixed inset-0 bg-stone-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-stone-200 animate-scale-in space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center">
                <Lock className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-serif font-bold text-base text-stone-900">
                  Manager Passkey Required
                </h4>
                <p className="text-[11px] text-stone-500">
                  Authorize payment routing change
                </p>
              </div>
            </div>

            <div className="p-3 bg-stone-50 border border-stone-200 rounded-2xl">
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 block">
                Target Bank Account
              </span>
              <p className="text-xs font-bold text-stone-900 mt-0.5">
                {pendingUpiSwitch?.bank || 'Custom UPI'}
              </p>
              <p className="text-[11px] font-mono font-semibold text-amber-700">
                {pendingUpiSwitch?.upiId}
              </p>
            </div>

            {passkeyError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium">
                {passkeyError}
              </div>
            )}

            <form onSubmit={handleConfirmPasskeySwitch} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">
                  Enter 4-Digit Manager PIN
                </label>
                <input
                  type="password"
                  autoFocus
                  required
                  maxLength={10}
                  value={passkeyInput}
                  onChange={(e) => setPasskeyInput(e.target.value)}
                  placeholder="••••"
                  className="w-full text-center tracking-widest text-lg font-mono font-bold px-3 py-2.5 bg-stone-50 border border-stone-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
                />
                <p className="text-[10px] text-stone-400 text-center mt-1">
                  Default Manager PIN is <strong className="text-stone-600">1234</strong>
                </p>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsPasskeyModalOpen(false);
                    setPasskeyInput('');
                    setPasskeyError('');
                    setPendingUpiSwitch(null);
                  }}
                  className="flex-1 py-2.5 text-xs font-bold text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingUpi}
                  className="flex-1 py-2.5 text-xs font-bold text-stone-950 bg-amber-500 hover:bg-amber-400 disabled:bg-stone-300 rounded-xl transition cursor-pointer shadow-sm flex items-center justify-center gap-1.5"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>{isSavingUpi ? 'Verifying...' : 'Authorize'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Reset Manager Passkey PIN */}
      {isResetPasskeyOpen && (
        <div className="fixed inset-0 bg-stone-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-stone-200 animate-scale-in space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-stone-900 text-amber-400 flex items-center justify-center">
                <Lock className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-serif font-bold text-base text-stone-900">
                  Reset Manager Passkey
                </h4>
                <p className="text-[11px] text-stone-500">
                  Update your 4-digit security PIN
                </p>
              </div>
            </div>

            <p className="text-xs text-stone-600 leading-relaxed">
              To prevent unauthorized changes to the receiving bank account, enter the Admin Master Password to set a new PIN.
            </p>

            {resetStatus.error && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium">
                {resetStatus.error}
              </div>
            )}

            {resetStatus.success && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-medium">
                {resetStatus.success}
              </div>
            )}

            <form onSubmit={handleExecuteResetPasskey} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">
                  Admin Master Password
                </label>
                <input
                  type="password"
                  required
                  value={resetAdminPass}
                  onChange={(e) => setResetAdminPass(e.target.value)}
                  placeholder="Master Admin Password (e.g. admin123)"
                  className="w-full text-xs px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">
                  New 4-Digit Passkey PIN
                </label>
                <input
                  type="password"
                  required
                  maxLength={10}
                  value={resetNewPin}
                  onChange={(e) => setResetNewPin(e.target.value)}
                  placeholder="e.g. 5678"
                  className="w-full text-center tracking-widest text-base font-mono font-bold px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsResetPasskeyOpen(false);
                    setResetAdminPass('');
                    setResetNewPin('');
                    setResetStatus({ error: '', success: '', loading: false });
                  }}
                  className="flex-1 py-2.5 text-xs font-bold text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetStatus.loading}
                  className="flex-1 py-2.5 text-xs font-black text-stone-950 bg-amber-500 hover:bg-amber-400 disabled:bg-stone-300 rounded-xl transition cursor-pointer shadow-sm flex items-center justify-center gap-1.5"
                >
                  <span>{resetStatus.loading ? 'Updating...' : 'Set New PIN'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

