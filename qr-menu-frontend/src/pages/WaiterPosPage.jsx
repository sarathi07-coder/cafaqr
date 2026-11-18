import React, { useState, useEffect, useMemo, useRef, Suspense, lazy } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UtensilsCrossed,
  Printer,
  History,
  CheckCircle2,
  Clock,
  Plus,
  Minus,
  Search,
  Users,
  ChevronLeft,
  Smartphone,
  CreditCard,
  Banknote,
  RefreshCw,
  ShoppingBag,
  Flame,
  Coffee,
  X,
  FileText,
  Download,
  AlertCircle,
  Sparkles,
  Send,
  UserCheck,
  Scissors,
  ChefHat,
  Star,
  AlertTriangle,
  TrendingUp,
  Edit3,
  Trash2,
  Eye,
  EyeOff,
  LayoutGrid,
  ShieldCheck,
  ArrowLeftRight
} from 'lucide-react';
import { api } from '../api';
import KrishLogo from '../components/KrishLogo';
import {
  getSyncToken,
  hydratePersistentAuth,
  removePersistentToken,
  setPersistentToken,
} from '../utils/persistentAuth';

const KitchenPage = lazy(() => import('./KitchenPage'));
const AdminDashboardPage = lazy(() => import('./AdminDashboardPage'));
const AdminLoginPage = lazy(() => import('./AdminLoginPage'));

const RESTAURANT_ID = 'db4ed920-3d20-420a-9f54-99d3c0b48a08';

// Emoji Category Icons
const CATEGORY_ICONS = {
  'briyani': '🍲',
  'fried rice': '🍚',
  'noodles': '🥢',
  'parotta': '🫓',
  'porotta': '🫓',
  'mojito': '🍹',
  'ice cream': '🍨',
  'coffee & milk': '☕',
  'juice': '🧃',
  'fried chicken': '🍗',
  'french fries': '🍟',
  'sandwich': '🥪',
  'snacks': '🍿',
  'bun': '🥯',
  'maggi': '🍜',
  'bread omblate': '🍳',
  'others': '🥘',
  'omblate': '🥚'
};

const getCategoryPriority = (category = '') => {
  const norm = String(category).trim().toLowerCase();
  if (norm === 'briyani' || norm === 'biryani') return 1;
  if (norm === 'fried rice' || norm === 'rice') return 2;
  if (norm === 'noodles' || norm === 'noodle') return 3;
  if (norm === 'parotta' || norm === 'porotta') return 4;
  return 10;
};

// Component: Multi-Customer Individual & Master Thermal Bill Renderer
function MultiCustomerReceiptSlip({ data, viewMode, setViewMode, isPreBill = false }) {
  if (!data) return null;

  const breakdown = useMemo(() => {
    // 1. If customerBreakdown already formatted array
    if (Array.isArray(data.customerBreakdown) && data.customerBreakdown.length > 0) {
      return data.customerBreakdown.map((s) => ({
        seat: Number(s.seat !== undefined ? s.seat : (s.seatNumber !== undefined ? s.seatNumber : 1)),
        seatLabel: s.seatLabel || s.label || (Number(s.seat) === 0 ? 'Table Shared' : `Customer ${s.seat || 1}`),
        individualBillNumber: s.individualBillNumber || `${data.billNumber || 'BILL'}-${s.seat === 0 ? 'SHR' : 'C' + (s.seat || 1)}`,
        items: (s.items || []).map((it) => ({
          name: it.name,
          quantity: Number(it.quantity || 1),
          price: Number(it.price || it.price_at_order || 0),
          amount: Number(it.amount || it.lineTotal || (Number(it.price || 0) * Number(it.quantity || 1)))
        })),
        subtotal: Number(s.subtotal || 0),
        total: Number(s.total || s.subtotal || 0)
      }));
    }

    // 2. If seatsBreakdown from active order
    if (Array.isArray(data.seatsBreakdown) && data.seatsBreakdown.length > 0) {
      return data.seatsBreakdown.map((s) => ({
        seat: Number(s.seatNumber),
        seatLabel: s.label || (s.seatNumber === 0 ? 'Table Shared' : `Customer ${s.seatNumber}`),
        individualBillNumber: `${data.orderId ? data.orderId.slice(-4).toUpperCase() : 'PRE'}-C${s.seatNumber}`,
        items: (s.items || []).map((it) => ({
          name: it.name,
          quantity: Number(it.quantity || 1),
          price: Number(it.price || 0),
          amount: Number(it.lineTotal || (Number(it.price || 0) * Number(it.quantity || 1)))
        })),
        subtotal: Number(s.subtotal || 0),
        total: Number(s.subtotal || 0)
      }));
    }

    // 3. Derive from flat items array
    const items = data.items || [];
    const map = {};
    for (const it of items) {
      const sNum = it.seat !== undefined ? Number(it.seat) : (it.customer_seat !== undefined ? Number(it.customer_seat) : 1);
      const sLabel = it.seatLabel || it.customer_label || (sNum === 0 ? 'Table Shared' : `Customer ${sNum}`);
      if (!map[sNum]) {
        map[sNum] = {
          seat: sNum,
          seatLabel: sLabel,
          individualBillNumber: `${data.billNumber || 'BILL'}-${sNum === 0 ? 'SHR' : 'C' + sNum}`,
          items: [],
          subtotal: 0,
          total: 0
        };
      }
      const amt = Number(it.amount || it.lineTotal || (Number(it.price || it.price_at_order || 0) * Number(it.quantity || 1)));
      map[sNum].items.push({
        name: it.name,
        quantity: Number(it.quantity || 1),
        price: Number(it.price || it.price_at_order || 0),
        amount: amt
      });
      map[sNum].subtotal += amt;
      map[sNum].total += amt;
    }

    return Object.values(map).sort((a, b) => {
      const sA = a.seat === 0 ? 99 : a.seat;
      const sB = b.seat === 0 ? 99 : b.seat;
      return sA - sB;
    });
  }, [data]);

  const displayedSeats = useMemo(() => {
    if (viewMode === 'ALL_SEPARATE') return breakdown;
    if (typeof viewMode === 'number') {
      const matched = breakdown.find((s) => s.seat === viewMode);
      return matched ? [matched] : breakdown;
    }
    return breakdown;
  }, [breakdown, viewMode]);

  const formattedDate = data.paidAt
    ? new Date(data.paidAt).toLocaleString()
    : (data.createdAt ? new Date(data.createdAt).toLocaleString() : new Date().toLocaleString());

  return (
    <div className="space-y-3">
      {/* View Mode Selector Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-stone-900 rounded-2xl border border-white/10 text-[11px] font-bold">
        <button
          type="button"
          onClick={() => setViewMode('ALL_SEPARATE')}
          className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer ${
            viewMode === 'ALL_SEPARATE'
              ? 'bg-amber-500 text-stone-950 font-black shadow-md'
              : 'text-stone-300 hover:text-white'
          }`}
        >
          <Scissors className="w-3.5 h-3.5" />
          <span>All Separate Slips ({breakdown.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setViewMode('COMBINED')}
          className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer ${
            viewMode === 'COMBINED'
              ? 'bg-amber-500 text-stone-950 font-black shadow-md'
              : 'text-stone-300 hover:text-white'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Combined Table Bill</span>
        </button>

        <div className="h-4 w-px bg-white/20 mx-1 hidden sm:block" />

        {breakdown.map((seat) => (
          <button
            key={seat.seat}
            type="button"
            onClick={() => setViewMode(seat.seat)}
            className={`px-2.5 py-1.5 rounded-xl transition flex items-center gap-1 cursor-pointer ${
              viewMode === seat.seat
                ? 'bg-emerald-500 text-stone-950 font-black shadow-md'
                : 'text-stone-400 hover:text-white'
            }`}
          >
            <span>{seat.seat === 0 ? '👥' : '🧑'}</span>
            <span>{seat.seatLabel} (₹{seat.subtotal})</span>
          </button>
        ))}
      </div>

      {/* Printable Thermal Receipt */}
      <div
        id="printable-thermal-receipt"
        className="bg-white text-black p-4 rounded-2xl font-mono text-[11px] leading-tight space-y-4 border border-stone-300 max-h-80 overflow-y-auto shadow-inner"
      >
        {viewMode === 'COMBINED' ? (
          /* COMBINED MASTER TABLE BILL (Sectioned per Customer) */
          <div className="space-y-2">
            <div className="text-center border-b border-black pb-2">
              <p className="font-bold text-xs uppercase tracking-wider">KRISH CAFE AND RESTAURANT</p>
              <p className="text-[10px]">Rathinam College Front Gate, Eachanari, Coimbatore</p>
              <p className="text-[10px]">Ph: 8760633322</p>
            </div>

            <div className="bg-stone-100 p-1.5 rounded text-center font-bold text-xs border border-stone-300 uppercase tracking-wide">
              {isPreBill ? 'Pre-Bill Memo' : 'Table Master Bill'} &bull; {data.tableLabel}
            </div>

            <div className="flex justify-between text-[10px] border-b border-dashed border-black pb-1 font-bold">
              <span>BILL: {data.billNumber || 'PENDING'}</span>
              <span>{data.tableLabel}</span>
            </div>
            <div className="flex justify-between text-[10px]">
              <span>SERVER: {data.serverName || 'Captain'}</span>
              <span>DINERS: {breakdown.length} Guests</span>
            </div>
            <div className="text-[10px]">
              <span>DATE: {formattedDate}</span>
            </div>

            {/* Customer-by-Customer Sectioned Breakdown */}
            <div className="space-y-2.5 pt-1 border-t border-black">
              {breakdown.map((seat) => (
                <div key={seat.seat} className="border border-stone-300 rounded p-2 bg-stone-50/70 space-y-1">
                  <div className="flex justify-between font-bold text-[11px] border-b border-stone-400 pb-0.5 text-black">
                    <span className="uppercase">&gt;&gt;&gt; {seat.seatLabel} Bill</span>
                    <span>₹{seat.subtotal.toFixed(2)}</span>
                  </div>
                  {seat.items.map((it, idx) => (
                    <div key={idx} className="flex justify-between text-[10px]">
                      <span>{it.quantity}x {it.name}</span>
                      <span className="font-bold">₹{it.amount}</span>
                    </div>
                  ))}
                  <div className="text-right text-[10px] text-stone-700 font-bold border-t border-dotted border-stone-300 pt-0.5">
                    {seat.seatLabel} Subtotal: ₹{seat.subtotal.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>

            {/* Table Totals (0% GST) */}
            <div className="border-t-2 border-black pt-1.5 space-y-0.5 text-right font-bold">
              <div className="flex justify-between">
                <span>TABLE SUBTOTAL:</span>
                <span>₹{Number(data.subtotal || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-stone-600">
                <span>TAX (0% GST):</span>
                <span>₹0.00</span>
              </div>
              <div className="flex justify-between text-xs pt-1 border-t border-black font-black">
                <span>TABLE GRAND TOTAL:</span>
                <span className="text-sm">₹{Number(data.total || data.subtotal || 0).toFixed(2)}</span>
              </div>
            </div>

            <div className="text-center text-[10px] pt-1.5 border-t border-dashed border-black">
              <p className="font-bold">{isPreBill ? 'PLEASE PAY AT CASHIER COUNTER' : `PAID VIA ${data.paymentMethod || 'CASH'}`}</p>
              <p>THANK YOU! VISIT AGAIN!</p>
            </div>
          </div>
        ) : (
          /* INDIVIDUAL CUSTOMER SLIPS (Separate Per Person) */
          <div className="space-y-4">
            {displayedSeats.map((seat, sIdx) => (
              <div key={seat.seat} className="thermal-slip-card thermal-slip-break space-y-2">
                <div className="text-center border-b border-black pb-2">
                  <p className="font-bold text-xs uppercase tracking-wider">KRISH CAFE AND RESTAURANT</p>
                  <p className="text-[10px]">Rathinam College Front Gate, Eachanari, Coimbatore</p>
                  <p className="text-[10px]">Ph: 8760633322</p>
                </div>

                <div className="bg-stone-100 p-1.5 rounded text-center font-bold text-xs border border-stone-300 uppercase tracking-wide">
                  ★ {seat.seatLabel} Bill Slip ★
                </div>

                <div className="flex justify-between text-[10px] border-b border-dashed border-black pb-1">
                  <span>BILL: {seat.individualBillNumber}</span>
                  <span className="font-bold">{data.tableLabel}</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span>SERVER: {data.serverName || 'Captain'}</span>
                  <span className="font-bold">DINER: {seat.seatLabel}</span>
                </div>
                <div className="text-[10px]">
                  <span>DATE: {formattedDate}</span>
                </div>

                {/* Items for this customer */}
                <div className="space-y-1 pt-1 border-t border-black">
                  <div className="flex justify-between text-[10px] font-bold border-b border-dashed border-stone-400 pb-0.5">
                    <span>ITEM</span>
                    <span className="flex gap-3">
                      <span>QTY</span>
                      <span>PRICE</span>
                      <span>AMT</span>
                    </span>
                  </div>
                  {seat.items.map((it, idx) => (
                    <div key={idx} className="flex justify-between items-center text-[10px]">
                      <span className="truncate pr-2">{it.name}</span>
                      <span className="flex gap-3 font-mono">
                        <span className="w-3 text-center">{it.quantity}</span>
                        <span className="w-7 text-right">₹{it.price}</span>
                        <span className="w-9 text-right font-bold">₹{it.amount}</span>
                      </span>
                    </div>
                  ))}
                </div>

                {/* Individual Totals (0% GST) */}
                <div className="border-t border-black pt-1 space-y-0.5 text-right font-bold">
                  <div className="flex justify-between">
                    <span>{seat.seatLabel.toUpperCase()} SUBTOTAL:</span>
                    <span>₹{seat.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-stone-600">
                    <span>TAX (0% GST):</span>
                    <span>₹0.00</span>
                  </div>
                  <div className="flex justify-between text-xs pt-1 border-t border-black">
                    <span>INDIVIDUAL PAYABLE:</span>
                    <span className="text-sm font-black">₹{seat.subtotal.toFixed(2)}</span>
                  </div>
                </div>

                <div className="text-center text-[10px] pt-1.5 border-t border-dashed border-black">
                  <p className="font-bold">{isPreBill ? 'INDIVIDUAL PRE-BILL' : `PAID VIA ${data.paymentMethod || 'CASH'}`}</p>
                  <p>THANK YOU! VISIT AGAIN!</p>
                </div>

                {sIdx < displayedSeats.length - 1 && (
                  <div className="text-center py-2 text-[10px] font-bold text-stone-400 border-b-2 border-dashed border-stone-400 print:hidden">
                    - - - - - - [ ✂️ CUT / TEAR HERE FOR NEXT CUSTOMER ] - - - - - -
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function WaiterPosPage({ appSection = 'ALL', onSwitchSection = null }) {
  const navigate = useNavigate();

  const isOrderOnly = appSection === 'ORDER_ONLY';
  const isBillingSuite = appSection === 'BILLING_SUITE';

  // Mode: 'TABLES' | 'ORDERING' | 'BILLING' | 'HISTORY' | 'PERFORMANCE' | 'KITCHEN' | 'ADMIN'
  const [activeTab, setActiveTab] = useState(() => (appSection === 'BILLING_SUITE' ? 'BILLING' : 'TABLES'));

  // Embedded Admin Auth State (for Billing & Management Section)
  const [adminToken, setAdminToken] = useState(() => getSyncToken('qr_admin_token'));

  useEffect(() => {
    if (appSection === 'ORDER_ONLY' && activeTab !== 'TABLES' && activeTab !== 'ORDERING') {
      setActiveTab('TABLES');
    } else if (appSection === 'BILLING_SUITE' && (activeTab === 'TABLES' || activeTab === 'ORDERING')) {
      setActiveTab('BILLING');
    }
  }, [appSection]);

  useEffect(() => {
    let cancelled = false;
    hydratePersistentAuth().then(async ({ adminToken: restoredAdmin, kitchenToken: restoredKitchen }) => {
      if (cancelled) return;
      if (restoredAdmin) {
        setAdminToken(restoredAdmin);
        if (!restoredKitchen) {
          try {
            const v = await api.verifyAdminSession(restoredAdmin);
            if (!cancelled && v?.valid && v?.kitchenToken) {
              await setPersistentToken('qr_kitchen_token', v.kitchenToken);
            }
          } catch {}
        }
      }
    });
    const syncToken = () => setAdminToken(getSyncToken('qr_admin_token'));
    window.addEventListener('storage', syncToken);
    return () => {
      cancelled = true;
      window.removeEventListener('storage', syncToken);
    };
  }, []);

  // Server selection
  const [serverName, setServerName] = useState(() => localStorage.getItem('krish_server_name') || 'Captain');
  const [isEditingServer, setIsEditingServer] = useState(false);
  const [tempServerName, setTempServerName] = useState(serverName);

  // Table grid status
  const [tablesData, setTablesData] = useState({ totalTables: 16, vacantCount: 16, occupiedCount: 0, tables: [] });
  const [isLoadingTables, setIsLoadingTables] = useState(true);

  // Selected table for ordering
  const [selectedTable, setSelectedTable] = useState(null); // { tableNumber, tableLabel, ... }
  const [activeTableOrder, setActiveTableOrder] = useState(null);

  // Menu items & categories
  const [menuItems, setMenuItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Active Order Cart for current table
  // Array of { menuItemId, name, price, quantity, customerSeat (1-4 or 0), customerLabel }
  const [cartItems, setCartItems] = useState([]);
  const [selectedSeat, setSelectedSeat] = useState(1); // 1, 2, 3, 4, or 0 (Shared)
  const [orderNotes, setOrderNotes] = useState('');
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Settlement & Thermal Print Modal
  const [settleModalOrder, setSettleModalOrder] = useState(null);
  const [targetSeatToSettle, setTargetSeatToSettle] = useState(null); // null for whole table, or 1, 2, 3, 4, 0
  const [settlingMethod, setSettlingMethod] = useState('CASH');
  const [isSettling, setIsSettling] = useState(false);
  const [printedReceipt, setPrintedReceipt] = useState(null);
  const [receiptViewMode, setReceiptViewMode] = useState('ALL_SEPARATE'); // 'ALL_SEPARATE' | 'COMBINED' | 1 | 2 | 3 | 4 | 0
  const [showPreBillPreview, setShowPreBillPreview] = useState(false);
  const [preBillViewMode, setPreBillViewMode] = useState('ALL_SEPARATE');

  // Bill History & Search Archive
  const [billsArchive, setBillsArchive] = useState([]);
  const [billsDateFilter, setBillsDateFilter] = useState('today');
  const [billsSearch, setBillsSearch] = useState('');
  const [billsTableFilter, setBillsTableFilter] = useState('');
  const [isLoadingBills, setIsLoadingBills] = useState(false);
  const [viewBillModal, setViewBillModal] = useState(null);
  const [archiveReceiptViewMode, setArchiveReceiptViewMode] = useState('ALL_SEPARATE');

  // Food Quantity & Dish Performance & Menu Management
  const [dishPerformanceData, setDishPerformanceData] = useState(null);
  const [isLoadingPerformance, setIsLoadingPerformance] = useState(false);
  const [perfCategoryFilter, setPerfCategoryFilter] = useState('ALL');
  const [perfSearch, setPerfSearch] = useState('');
  const [isDishModalOpen, setIsDishModalOpen] = useState(false);
  const [editingDish, setEditingDish] = useState(null);
  const [dishFormData, setDishFormData] = useState({
    name: '',
    category: 'Briyani',
    price: '',
    isVeg: false,
    available: true
  });

  // Fetch Tables
  const loadTableStatus = async () => {
    try {
      const data = await api.getPosTableStatus(RESTAURANT_ID);
      setTablesData(data);
    } catch (err) {
      console.error('Error fetching tables status:', err);
    } finally {
      setIsLoadingTables(false);
    }
  };

  // Fetch Menu
  const loadMenu = async () => {
    try {
      const data = await api.getMenu(RESTAURANT_ID);
      const items = Array.isArray(data) ? data : (data?.items || []);
      setMenuItems(items);

      const cats = Array.from(new Set(items.map((it) => it.category).filter(Boolean))).sort((a, b) => {
        const pA = getCategoryPriority(a);
        const pB = getCategoryPriority(b);
        if (pA !== pB) return pA - pB;
        return a.localeCompare(b);
      });
      setCategories(cats);
    } catch (err) {
      console.error('Error fetching menu:', err);
    }
  };

  // Fetch Dish Performance
  const loadDishPerformance = async () => {
    setIsLoadingPerformance(true);
    try {
      const data = await api.getDishPerformance(RESTAURANT_ID);
      setDishPerformanceData(data);
    } catch (err) {
      console.error('Error fetching dish performance:', err);
    } finally {
      setIsLoadingPerformance(false);
    }
  };

  // 1-Click Stock Toggle
  const handleToggleStock = async (dishId) => {
    try {
      await api.toggleDishAvailability(dishId);
      showToast('Food stock status updated!');
      await Promise.all([loadDishPerformance(), loadMenu()]);
    } catch (err) {
      alert('Failed to update stock: ' + err.message);
    }
  };

  // Open Dish Modal (Add)
  const handleOpenAddDishModal = () => {
    setEditingDish(null);
    setDishFormData({
      name: '',
      category: categories[0] || 'Briyani',
      price: '',
      isVeg: false,
      available: true
    });
    setIsDishModalOpen(true);
  };

  // Open Dish Modal (Edit)
  const handleOpenEditDishModal = (dish) => {
    setEditingDish(dish);
    setDishFormData({
      name: dish.name || '',
      category: dish.category || 'General',
      price: String(dish.price || ''),
      isVeg: Boolean(dish.isVeg ?? dish.is_veg),
      available: Boolean(dish.available !== false)
    });
    setIsDishModalOpen(true);
  };

  // Save Dish (Add or Update)
  const handleSaveDish = async (e) => {
    e.preventDefault();
    if (!dishFormData.name.trim() || !dishFormData.price) {
      alert('Please fill in dish name and price');
      return;
    }

    try {
      const payload = {
        name: dishFormData.name.trim(),
        category: dishFormData.category.trim(),
        price: parseFloat(dishFormData.price),
        isVeg: Boolean(dishFormData.isVeg),
        available: Boolean(dishFormData.available),
        restaurantId: RESTAURANT_ID
      };

      if (editingDish) {
        await api.updateMenuItem(editingDish.id, payload);
        showToast(`✨ Updated '${payload.name}' details & rate!`);
      } else {
        await api.createMenuItem(payload);
        showToast(`🎉 Added new dish '${payload.name}' to menu!`);
      }

      setIsDishModalOpen(false);
      await Promise.all([loadDishPerformance(), loadMenu()]);
    } catch (err) {
      alert('Failed to save food item: ' + err.message);
    }
  };

  // Fetch Bills Archive
  const loadBillsArchive = async () => {
    setIsLoadingBills(true);
    try {
      const res = await api.getArchivedBills({
        restaurantId: RESTAURANT_ID,
        date: billsDateFilter,
        table: billsTableFilter,
        search: billsSearch,
        limit: 50
      });
      setBillsArchive(res.bills || []);
    } catch (err) {
      console.error('Error loading bills archive:', err);
    } finally {
      setIsLoadingBills(false);
    }
  };

  useEffect(() => {
    loadTableStatus();
    loadMenu();
    loadDishPerformance();
    const interval = setInterval(loadTableStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (activeTab === 'HISTORY') {
      loadBillsArchive();
    } else if (activeTab === 'PERFORMANCE') {
      loadDishPerformance();
    }
  }, [activeTab, billsDateFilter, billsTableFilter, billsSearch]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  const handleSaveServerName = (e) => {
    e.preventDefault();
    if (tempServerName.trim()) {
      setServerName(tempServerName.trim());
      localStorage.setItem('krish_server_name', tempServerName.trim());
      setIsEditingServer(false);
      showToast(`Server set to: ${tempServerName.trim()}`);
    }
  };

  // Open Table for Ordering
  const handleSelectTable = async (table) => {
    setSelectedTable(table);
    setSelectedSeat(1);
    setCartItems([]);
    setOrderNotes('');
    setActiveTab('ORDERING');

    // Check if table already has an active order
    try {
      const ord = await api.getActivePosTableOrder(table.tableNumber, RESTAURANT_ID);
      if (ord.hasActiveOrder) {
        setActiveTableOrder(ord);
      } else {
        setActiveTableOrder(null);
      }
    } catch (err) {
      console.error('Error loading active table order:', err);
      setActiveTableOrder(null);
    }
  };

  // Add Item to Cart for specific Customer Seat (1-4 or 0 for Shared)
  const handleAddItemToSeat = (dish, seatNum) => {
    const seatLabel = seatNum === 0 ? 'Table Shared' : `Customer ${seatNum}`;
    setCartItems((prev) => {
      const existingIdx = prev.findIndex(
        (it) => it.menuItemId === dish.id && it.customerSeat === seatNum
      );
      if (existingIdx >= 0) {
        const next = [...prev];
        next[existingIdx] = { ...next[existingIdx], quantity: next[existingIdx].quantity + 1 };
        return next;
      } else {
        return [
          ...prev,
          {
            menuItemId: dish.id,
            name: dish.name,
            category: dish.category,
            price: Number(dish.price),
            quantity: 1,
            customerSeat: seatNum,
            customerLabel: seatLabel,
            isVeg: Boolean(dish.is_veg)
          }
        ];
      }
    });
  };

  // Remove or decrease quantity for item in specific seat
  const handleRemoveItemFromSeat = (dishId, seatNum) => {
    setCartItems((prev) => {
      const existingIdx = prev.findIndex(
        (it) => it.menuItemId === dishId && it.customerSeat === seatNum
      );
      if (existingIdx === -1) return prev;
      const current = prev[existingIdx];
      if (current.quantity > 1) {
        const next = [...prev];
        next[existingIdx] = { ...current, quantity: current.quantity - 1 };
        return next;
      } else {
        return prev.filter((_, idx) => idx !== existingIdx);
      }
    });
  };

  // Get total quantity of dish across all seats in active cart
  const getItemQuantityForSeat = (dishId, seatNum) => {
    const match = cartItems.find((it) => it.menuItemId === dishId && it.customerSeat === seatNum);
    return match ? match.quantity : 0;
  };

  // Filtered menu items
  const filteredDishes = useMemo(() => {
    return menuItems
      .filter((dish) => {
        const matchesCategory = activeCategory === 'ALL' || dish.category?.toLowerCase() === activeCategory.toLowerCase();
        const matchesSearch =
          !searchQuery.trim() ||
          dish.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          dish.category?.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCategory && matchesSearch;
      })
      .sort((a, b) => {
        if (activeCategory === 'ALL') {
          const pA = getCategoryPriority(a.category);
          const pB = getCategoryPriority(b.category);
          if (pA !== pB) return pA - pB;
          const catComp = (a.category || '').localeCompare(b.category || '');
          if (catComp !== 0) return catComp;
        }
        return (a.name || '').localeCompare(b.name || '');
      });
  }, [menuItems, activeCategory, searchQuery]);

  // Cart Totals
  const cartTotals = useMemo(() => {
    const subtotal = cartItems.reduce((sum, it) => sum + it.price * it.quantity, 0);
    const totalCount = cartItems.reduce((sum, it) => sum + it.quantity, 0);

    // Seat groupings
    const seatBreakdown = {
      1: { seat: 1, label: 'Customer 1', items: [], subtotal: 0 },
      2: { seat: 2, label: 'Customer 2', items: [], subtotal: 0 },
      3: { seat: 3, label: 'Customer 3', items: [], subtotal: 0 },
      4: { seat: 4, label: 'Customer 4', items: [], subtotal: 0 },
      0: { seat: 0, label: 'Table Shared', items: [], subtotal: 0 },
    };

    cartItems.forEach((it) => {
      const s = seatBreakdown[it.customerSeat] || seatBreakdown[1];
      s.items.push(it);
      s.subtotal += it.price * it.quantity;
    });

    return {
      subtotal,
      totalCount,
      seats: Object.values(seatBreakdown).filter((s) => s.items.length > 0)
    };
  }, [cartItems]);

  // Dispatch Order to Kitchen & Billing
  const handleDispatchOrder = async () => {
    if (!selectedTable || cartItems.length === 0) return;

    setIsSubmittingOrder(true);
    try {
      const payload = {
        restaurantId: RESTAURANT_ID,
        tableNumber: selectedTable.tableNumber,
        tableId: selectedTable.tableId,
        serverName,
        guestCount: Math.max(1, ...cartItems.map((it) => it.customerSeat).filter((s) => s > 0)),
        notes: orderNotes,
        items: cartItems.map((it) => ({
          menuItemId: it.menuItemId,
          quantity: it.quantity,
          customerSeat: it.customerSeat,
          customerLabel: it.customerLabel,
        }))
      };

      const res = await api.createPosOrder(payload);
      showToast(
        isOrderOnly
          ? `✅ ${selectedTable.tableLabel} order sent to kitchen!`
          : `✅ ${selectedTable.tableLabel} order dispatched to kitchen & billing! Total: ₹${res.total}`
      );
      setCartItems([]);
      setOrderNotes('');
      await loadTableStatus();
      setActiveTab('TABLES');
    } catch (err) {
      alert('Failed to place order: ' + err.message);
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  // Settle Order in Billing Area (whole table or individual customer seat)
  const handleOpenSettleModal = async (table, seatNum = null) => {
    try {
      const ord = await api.getActivePosTableOrder(table.tableNumber, RESTAURANT_ID);
      if (ord.hasActiveOrder) {
        setSettleModalOrder(ord);
        setTargetSeatToSettle(seatNum);
        setSettlingMethod('CASH');
        setShowPreBillPreview(false);
        if (seatNum !== null) {
          setPreBillViewMode(seatNum);
          setReceiptViewMode(seatNum);
        } else {
          setPreBillViewMode('ALL_SEPARATE');
          setReceiptViewMode('ALL_SEPARATE');
        }
      } else {
        alert('No active order on ' + table.tableLabel);
      }
    } catch (err) {
      alert('Error fetching active order: ' + err.message);
    }
  };

  const handlePrintCustomerBillDirect = async (table, seatNum = null) => {
    try {
      const ord = await api.getActivePosTableOrder(table.tableNumber, RESTAURANT_ID);
      if (ord.hasActiveOrder) {
        setSettleModalOrder(ord);
        setTargetSeatToSettle(seatNum === 'COMBINED' ? null : seatNum);
        setPreBillViewMode(seatNum !== null ? seatNum : 'ALL_SEPARATE');
        setShowPreBillPreview(true);
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const handleConfirmSettle = async () => {
    if (!settleModalOrder) return;
    setIsSettling(true);
    try {
      const payload = {
        paymentMethod: settlingMethod,
        cashierName: serverName
      };
      if (targetSeatToSettle !== null) {
        payload.seat = targetSeatToSettle;
      }

      const res = await api.settlePosOrder(settleModalOrder.orderId, payload);
      setPrintedReceipt(res);
      showToast(
        res.isIndividualSeat
          ? `${res.seatLabel || 'Customer'} bill ${res.billNumber} settled via ${settlingMethod}!`
          : `Table bill ${res.billNumber} settled via ${settlingMethod}!`
      );
      await loadTableStatus();
    } catch (err) {
      alert('Failed to settle bill: ' + err.message);
    } finally {
      setIsSettling(false);
    }
  };

  // Thermal Print Trigger
  const handleTriggerBrowserPrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-[#0E0C0A] text-stone-100 flex flex-col font-sans selection:bg-amber-500 selection:text-black">
      
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-4 inset-x-0 z-50 flex justify-center px-4 pointer-events-none">
          <div className="pointer-events-auto bg-amber-500 text-stone-950 font-black text-xs px-5 py-2.5 rounded-full shadow-[0_8px_30px_rgba(245,158,11,0.5)] flex items-center gap-2 animate-bounce">
            <Sparkles className="w-4 h-4" />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Top POS Header Navigation (Safe-Area Mobile App Aware) */}
      <header className="sticky top-0 z-40 bg-[#161310]/95 backdrop-blur-md border-b border-white/10 px-3 sm:px-4 py-2 sm:py-3 pt-[max(0.5rem,env(safe-area-inset-top))] shadow-md print:hidden">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-3">
          
          {/* Brand, Section Switcher & Server Tag */}
          <div className="flex items-center justify-between w-full sm:w-auto gap-2 sm:gap-3">
            <div
              className="flex items-center gap-2.5 cursor-pointer min-w-0"
              onClick={() => setActiveTab(isBillingSuite ? 'BILLING' : 'TABLES')}
            >
              <KrishLogo className="w-8 h-8 sm:w-9 sm:h-9 shrink-0" />
              <div className="min-w-0">
                <h1 className="font-serif font-black text-sm sm:text-base text-amber-400 tracking-wide uppercase leading-tight truncate">
                  {isOrderOnly ? (
                    <>
                      <span className="sm:hidden">KRISH ORDER</span>
                      <span className="hidden sm:inline">KRISH ORDER TAKING</span>
                    </>
                  ) : isBillingSuite ? (
                    <>
                      <span className="sm:hidden">KRISH BILLING</span>
                      <span className="hidden sm:inline">KRISH BILLING &amp; OPS</span>
                    </>
                  ) : (
                    'KRISH POS'
                  )}
                </h1>
                <p className="hidden sm:block text-[10px] text-stone-400 tracking-wider uppercase font-semibold truncate">
                  {isOrderOnly
                    ? 'Waiter Floor & Customer 1–4 Ordering'
                    : isBillingSuite
                    ? 'Cashier Billing • History • Food • Kitchen • Admin'
                    : 'Staff Waiter & Billing Terminal'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {/* Server Badge (Shown in Order Taking & All modes) */}
              {!isBillingSuite && (
                isEditingServer ? (
                  <form onSubmit={handleSaveServerName} className="flex items-center gap-1">
                    <input
                      type="text"
                      value={tempServerName}
                      onChange={(e) => setTempServerName(e.target.value)}
                      className="text-xs px-2 py-1 bg-stone-900 border border-amber-400 rounded-lg text-white font-bold w-24 outline-none"
                      autoFocus
                    />
                    <button type="submit" className="text-xs bg-amber-500 text-black px-2 py-1 rounded-lg font-bold">
                      Save
                    </button>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => { setTempServerName(serverName); setIsEditingServer(true); }}
                    className="px-2.5 py-1 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] sm:text-xs font-bold flex items-center gap-1 hover:bg-amber-500/20 transition cursor-pointer"
                    title="Click to change server name"
                  >
                    <UserCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span className="max-w-18 sm:max-w-none truncate">{serverName}</span>
                  </button>
                )
              )}

              {/* Switch App Section Button (Returns to 2-Section Launcher) */}
              {onSwitchSection && (
                <button
                  type="button"
                  onClick={onSwitchSection}
                  className="px-2.5 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 border border-white/15 text-stone-200 hover:text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap"
                  title="Switch between Order Taking & Billing sections"
                >
                  <ArrowLeftRight className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden sm:inline">Switch Mode</span>
                </button>
              )}
            </div>
          </div>

          {/* Navigation Mode Tabs (Hidden on mobile when Bottom Navigation Bar is active) */}
          <div
            className={`${
              isOrderOnly || isBillingSuite ? 'hidden sm:flex' : 'flex'
            } items-center gap-1.5 bg-stone-900/90 p-1 rounded-2xl border border-white/10 text-xs font-bold w-full sm:w-auto overflow-x-auto no-scrollbar`}
          >
            {/* ORDER TAKING SECTION TABS */}
            {!isBillingSuite && (
              <button
                type="button"
                onClick={() => setActiveTab('TABLES')}
                className={`px-3.5 py-1.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  activeTab === 'TABLES' || activeTab === 'ORDERING'
                    ? 'bg-amber-500 text-stone-950 font-black shadow-sm'
                    : 'text-stone-400 hover:text-white'
                }`}
              >
                <UtensilsCrossed className="w-3.5 h-3.5" />
                <span>Floor Tables ({tablesData.occupiedCount} Active)</span>
              </button>
            )}

            {/* BILLING & REMAINING SECTION TABS */}
            {!isOrderOnly && (
              <>
                <button
                  type="button"
                  onClick={() => setActiveTab('BILLING')}
                  className={`px-3.5 py-1.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                    activeTab === 'BILLING'
                      ? 'bg-amber-500 text-stone-950 font-black shadow-sm'
                      : 'text-stone-400 hover:text-white'
                  }`}
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Billing Counter</span>
                  {tablesData.occupiedCount > 0 && (
                    <span className="w-5 h-5 rounded-full bg-rose-600 text-white text-[10px] flex items-center justify-center font-mono">
                      {tablesData.occupiedCount}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('HISTORY')}
                  className={`px-3.5 py-1.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                    activeTab === 'HISTORY'
                      ? 'bg-amber-500 text-stone-950 font-black shadow-sm'
                      : 'text-stone-400 hover:text-white'
                  }`}
                >
                  <History className="w-3.5 h-3.5" />
                  <span>Bills &amp; History</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('PERFORMANCE')}
                  className={`px-3.5 py-1.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                    activeTab === 'PERFORMANCE'
                      ? 'bg-amber-500 text-stone-950 font-black shadow-sm'
                      : 'text-stone-400 hover:text-white'
                  }`}
                >
                  <ChefHat className="w-3.5 h-3.5" />
                  <span>Food Manager</span>
                </button>

                <button
                  type="button"
                  onClick={() => (isBillingSuite ? setActiveTab('KITCHEN') : navigate('/kitchen'))}
                  className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                    activeTab === 'KITCHEN'
                      ? 'bg-emerald-400 text-stone-950 font-black shadow-sm'
                      : 'text-stone-400 hover:text-white'
                  }`}
                >
                  <Flame className="w-3.5 h-3.5" />
                  <span>Kitchen</span>
                </button>

                <button
                  type="button"
                  onClick={() => (isBillingSuite ? setActiveTab('ADMIN') : navigate('/admin'))}
                  className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                    activeTab === 'ADMIN'
                      ? 'bg-amber-400 text-stone-950 font-black shadow-sm'
                      : 'text-stone-400 hover:text-white'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Admin</span>
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main
        className={
          activeTab === 'KITCHEN' || activeTab === 'ADMIN'
            ? 'flex-1 w-full pb-24 sm:pb-6'
            : activeTab === 'ORDERING' && cartItems.length > 0
            ? 'flex-1 max-w-7xl w-full mx-auto px-3 py-3 sm:p-6 pb-48 sm:pb-10'
            : 'flex-1 max-w-7xl w-full mx-auto px-3 py-3 sm:p-6 pb-24 sm:pb-8'
        }
      >
        
        {/* ============================================================== */}
        {/* TAB 1: INTERACTIVE FLOOR TABLE MAP (Stage 6) */}
        {/* ============================================================== */}
        {activeTab === 'TABLES' && (
          <div className="space-y-6">
            
            {/* Quick Status Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-stone-900/60 p-4 rounded-3xl border border-white/10">
              <div>
                <h2 className="text-lg font-serif font-black text-white flex items-center gap-2">
                  <span>Dining Floor &amp; Takeaway Tables</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-sans font-bold">
                    {tablesData.totalTables} Service Points
                  </span>
                </h2>
                <p className="text-xs text-stone-400">
                  Select any table to take an order for Customers 1 to 4 or add dishes to a running tab.
                </p>
              </div>

              <div className="flex items-center gap-4 text-xs font-bold">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
                  <span className="text-stone-300">{tablesData.vacantCount} Vacant</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"></span>
                  <span className="text-stone-300">{tablesData.occupiedCount} Active Dining</span>
                </div>
                <button
                  type="button"
                  onClick={loadTableStatus}
                  className="p-2 bg-stone-800 hover:bg-stone-700 rounded-xl transition text-stone-300 cursor-pointer"
                  title="Refresh Table Status"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoadingTables ? 'animate-spin text-amber-400' : ''}`} />
                </button>
              </div>
            </div>

            {/* 16 Tables Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-4">
              {tablesData.tables.map((t) => {
                const isOccupied = t.status !== 'VACANT';
                const isParcel = t.isParcel;

                return (
                  <div
                    key={t.tableId}
                    className={`p-4 rounded-3xl border transition-all flex flex-col justify-between cursor-pointer relative overflow-hidden group ${
                      isOccupied
                        ? 'bg-linear-to-b from-blue-950/40 via-stone-900 to-stone-950 border-blue-500/40 hover:border-blue-400 shadow-[0_4px_20px_rgba(37,99,235,0.15)]'
                        : 'bg-stone-900/80 hover:bg-stone-900 border-white/10 hover:border-amber-400/50 shadow-md'
                    }`}
                    onClick={() => handleSelectTable(t)}
                  >
                    {/* Card Top */}
                    <div className="flex items-start justify-between">
                      <div>
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          isOccupied ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' : 'bg-emerald-500/20 text-emerald-400'
                        }`}>
                          {isOccupied ? 'Active Dining' : 'Available'}
                        </span>
                        <h3 className="text-xl font-serif font-black text-white mt-1.5">
                          {t.tableLabel}
                        </h3>
                      </div>

                      <div className={`w-9 h-9 rounded-2xl flex items-center justify-center font-bold text-sm ${
                        isOccupied ? 'bg-blue-500 text-white' : 'bg-stone-800 text-stone-400 group-hover:bg-amber-500 group-hover:text-black transition'
                      }`}>
                        {isParcel ? <ShoppingBag className="w-4 h-4" /> : `#${t.tableNumber}`}
                      </div>
                    </div>

                    {/* Card Content */}
                    <div className="my-4">
                      {isOccupied && t.activeOrder ? (
                        <div className="space-y-2 font-mono text-xs">
                          <div className="flex items-baseline justify-between text-white font-black text-lg">
                            {isOrderOnly ? (
                              <span className="font-sans text-base font-black text-amber-300">
                                {t.activeOrder.itemCount} Dishes
                              </span>
                            ) : (
                              <>
                                <span>₹{t.activeOrder.total.toFixed(2)}</span>
                                <span className="text-[11px] font-sans font-bold text-stone-400">{t.activeOrder.itemCount} items</span>
                              </>
                            )}
                          </div>
                          <div className="text-[11px] text-stone-400 flex items-center justify-between font-sans">
                            <span>By: {t.activeOrder.serverName}</span>
                            <span className="flex items-center gap-1 text-blue-300">
                              <Clock className="w-3 h-3" />
                              {t.activeOrder.elapsedMinutes}m
                            </span>
                          </div>

                          {/* Customer 1 to 4 Seat Chips */}
                          {t.activeOrder.seatsBreakdown && t.activeOrder.seatsBreakdown.length > 0 && (
                            <div className="flex flex-wrap gap-1 pt-1.5 border-t border-white/5 font-sans">
                              {t.activeOrder.seatsBreakdown.map((s) => {
                                const seatQty = (s.items || []).reduce((sum, it) => sum + Number(it.quantity || 1), 0);
                                return (
                                  <span
                                    key={s.seatNumber}
                                    className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1 ${
                                      !isOrderOnly && s.isPaid
                                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                        : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                                    }`}
                                    title={isOrderOnly ? `${s.label}: ${seatQty} dishes` : `${s.label}: ₹${s.subtotal} (${s.isPaid ? 'PAID' : 'UNPAID'})`}
                                  >
                                    <span>{s.seatNumber === 0 ? '👥' : `C${s.seatNumber}`}:</span>
                                    {isOrderOnly ? (
                                      <span className="font-mono">{seatQty}</span>
                                    ) : (
                                      <>
                                        <span className="font-mono">₹{s.subtotal}</span>
                                        {s.isPaid && <span>✓</span>}
                                      </>
                                    )}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-stone-500">
                          Empty table. Tap to start taking orders.
                        </p>
                      )}
                    </div>

                    {/* Card Footer Actions */}
                    <div className="pt-2 border-t border-white/5 flex gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectTable(t);
                        }}
                        className={`flex-1 py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer ${
                          isOccupied
                            ? 'bg-stone-800 hover:bg-stone-700 text-white'
                            : 'bg-amber-500 hover:bg-amber-400 text-stone-950 font-black'
                        }`}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{isOccupied ? 'Add Dishes' : 'Take Order'}</span>
                      </button>

                      {isOccupied && !isOrderOnly && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenSettleModal(t);
                          }}
                          className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                          title="Settle & Print Bill"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 2: WAITER MULTI-SEAT ORDERING TERMINAL (Stage 7) */}
        {/* ============================================================== */}
        {activeTab === 'ORDERING' && selectedTable && (
          <div className="space-y-3 sm:space-y-5 animate-fade-in">
            
            {/* Top Bar for Selected Table (Compact 1-row on mobile) */}
            <div className="bg-[#171411] p-2.5 sm:p-4 rounded-2xl sm:rounded-3xl border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-2.5 sm:gap-3 shadow-lg">
              <div className="flex items-center justify-between sm:justify-start gap-2.5 sm:gap-3 w-full md:w-auto">
                <div className="flex items-center gap-2.5 min-w-0">
                  <button
                    type="button"
                    onClick={() => setActiveTab('TABLES')}
                    className="px-2.5 py-2 sm:p-2.5 rounded-xl sm:rounded-2xl bg-stone-800 hover:bg-stone-700 text-white transition cursor-pointer flex items-center gap-1 text-xs font-bold shrink-0"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Floor</span>
                  </button>
                  <div className="min-w-0">
                    <h2 className="text-base sm:text-xl font-serif font-black text-amber-400 flex items-center gap-2 truncate">
                      <span>{selectedTable.tableLabel}</span>
                      <span className="text-[10px] sm:text-xs px-2 py-0.5 rounded-full bg-stone-800 text-stone-300 font-sans font-bold whitespace-nowrap">
                        {serverName}
                      </span>
                    </h2>
                    <p className="hidden sm:block text-xs text-stone-400">
                      Select a customer seat below, then tap dishes to add them directly to that customer&apos;s tab.
                    </p>
                  </div>
                </div>

                {/* Compact Running Order Count (Order Only) or Total (All Mode) on Mobile */}
                {activeTableOrder && (
                  <div className="sm:hidden text-right font-mono shrink-0 bg-stone-900 px-2.5 py-1 rounded-xl border border-blue-500/30">
                    {isOrderOnly ? (
                      <>
                        <span className="text-[9px] text-stone-400 uppercase block font-sans font-bold leading-none">Ordered</span>
                        <span className="text-xs font-black text-amber-400 font-sans">
                          {(activeTableOrder.seatsBreakdown || []).reduce(
                            (sum, s) => sum + (s.items || []).reduce((acc, it) => acc + Number(it.quantity || 1), 0),
                            0
                          )}{' '}
                          dishes
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="text-[9px] text-stone-400 uppercase block font-sans font-bold leading-none">Running</span>
                        <span className="text-xs font-black text-emerald-400">₹{activeTableOrder.total.toFixed(0)}</span>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Active Tab Summary (Tablet & Desktop) */}
              {activeTableOrder && (
                <div className="hidden sm:flex items-center gap-3 bg-stone-900/80 px-4 py-2 rounded-2xl border border-blue-500/30">
                  {isOrderOnly ? (
                    <div>
                      <span className="text-[10px] text-stone-400 uppercase tracking-wider block font-bold">Table Active Orders</span>
                      <span className="text-base font-black text-amber-400 font-sans">
                        {(activeTableOrder.seatsBreakdown || []).reduce(
                          (sum, s) => sum + (s.items || []).reduce((acc, it) => acc + Number(it.quantity || 1), 0),
                          0
                        )}{' '}
                        Dishes Sent
                      </span>
                    </div>
                  ) : (
                    <>
                      <div>
                        <span className="text-[10px] text-stone-400 uppercase tracking-wider block font-bold">Running Table Total</span>
                        <span className="text-base font-black text-emerald-400 font-mono">₹{activeTableOrder.total.toFixed(2)}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleOpenSettleModal(selectedTable)}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Print Bill</span>
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* 4 INDIVIDUAL CUSTOMER ORDERING PANELS (Diners 1 to 4 — Zero-Wrap Mobile Cards) */}
            <div className="space-y-2 sm:space-y-3">
              <div className="flex items-center justify-between gap-2 px-0.5">
                <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                  <span>Select Customer (1 to 4)</span>
                </span>
                <span className="hidden sm:inline text-[11px] text-stone-400">
                  Tap a customer card to view their ordered dishes and add more
                </span>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
                {[1, 2, 3, 4].map((seatNum) => {
                  const isSelected = selectedSeat === seatNum;

                  // Existing ordered items for this seat
                  const existingSeatData = activeTableOrder?.seatsBreakdown?.find((s) => s.seatNumber === seatNum);
                  const existingCount = existingSeatData?.items?.reduce((sum, it) => sum + it.quantity, 0) || 0;
                  const existingSubtotal = existingSeatData?.subtotal || 0;
                  const isPaid = existingSeatData?.isPaid;

                  // Cart additions for this seat
                  const cartSeatItems = cartItems.filter((it) => it.customerSeat === seatNum);
                  const cartCount = cartSeatItems.reduce((sum, it) => sum + it.quantity, 0);
                  const cartSubtotal = cartSeatItems.reduce((sum, it) => sum + it.price * it.quantity, 0);

                  const totalSeatItems = existingCount + cartCount;
                  const totalSeatAmount = existingSubtotal + cartSubtotal;

                  return (
                    <div
                      key={seatNum}
                      onClick={() => setSelectedSeat(seatNum)}
                      className={`p-2.5 sm:p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between relative overflow-hidden ${
                        isSelected
                          ? 'bg-[#221C16] border-amber-400 shadow-[0_0_16px_rgba(245,158,11,0.22)] ring-1 sm:ring-2 ring-amber-400/50'
                          : 'bg-stone-900/80 hover:bg-stone-900 border-white/10 hover:border-white/20'
                      }`}
                    >
                      {/* Card Top — Guaranteed Single Line on iPhone & Android */}
                      <div>
                        <div className="flex items-center justify-between gap-1 pb-1.5 sm:pb-2 border-b border-white/10">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center font-bold text-[11px] sm:text-xs shrink-0 ${
                              isSelected ? 'bg-amber-500 text-stone-950 font-black' : 'bg-stone-800 text-stone-400'
                            }`}>
                              C{seatNum}
                            </div>
                            <span className="font-bold text-white text-xs sm:text-sm whitespace-nowrap truncate">
                              <span className="sm:hidden">Cust {seatNum}</span>
                              <span className="hidden sm:inline">Customer {seatNum}</span>
                            </span>
                          </div>

                          {isSelected ? (
                            <span className="px-1.5 sm:px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black bg-amber-500 text-stone-950 uppercase tracking-wide whitespace-nowrap shrink-0">
                              ACTIVE
                            </span>
                          ) : !isOrderOnly && isPaid ? (
                            <span className="px-1.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold bg-emerald-500/20 text-emerald-300 whitespace-nowrap shrink-0">
                              PAID
                            </span>
                          ) : totalSeatItems > 0 ? (
                            <span className="px-1.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold bg-stone-800 text-amber-300 whitespace-nowrap shrink-0">
                              {totalSeatItems}
                            </span>
                          ) : (
                            <span className="text-[9px] sm:text-[10px] text-stone-500 font-semibold whitespace-nowrap shrink-0">
                              Empty
                            </span>
                          )}
                        </div>

                        {/* Dish Count (Order Taking) or Subtotal (Full Mode) */}
                        <div className="mt-1.5 sm:mt-2.5 space-y-0.5 sm:space-y-1">
                          {isOrderOnly ? (
                            <div className="flex justify-between items-baseline gap-1">
                              <span className="text-[10px] sm:text-[11px] font-sans text-stone-400 font-bold whitespace-nowrap">
                                Orders
                              </span>
                              <span className={`text-xs sm:text-sm font-black whitespace-nowrap ${isSelected ? 'text-amber-400' : 'text-stone-200'}`}>
                                {totalSeatItems} {totalSeatItems === 1 ? 'dish' : 'dishes'}
                              </span>
                            </div>
                          ) : (
                            <div className="flex justify-between items-baseline gap-1 font-mono">
                              <span className="text-[10px] sm:text-[11px] font-sans text-stone-400 font-bold whitespace-nowrap">
                                <span className="sm:hidden">Bill</span>
                                <span className="hidden sm:inline">Individual Bill:</span>
                              </span>
                              <span className={`text-sm sm:text-base font-black whitespace-nowrap ${isSelected ? 'text-amber-400' : 'text-stone-200'}`}>
                                ₹{totalSeatAmount.toFixed(0)}
                              </span>
                            </div>
                          )}

                          <div className="text-[10px] sm:text-[11px] text-stone-400 space-y-0.5 font-sans">
                            {cartCount > 0 && (
                              <div className="text-amber-300 font-bold flex items-center justify-between gap-1">
                                <span className="truncate">+{cartCount} new in cart</span>
                                {!isOrderOnly && <span className="font-mono shrink-0">+₹{cartSubtotal}</span>}
                              </div>
                            )}
                            {existingCount > 0 && (
                              <div className="text-stone-400 flex items-center justify-between gap-1">
                                <span className="truncate">{existingCount} sent to kitchen</span>
                                {!isOrderOnly && <span className="font-mono shrink-0">₹{existingSubtotal}</span>}
                              </div>
                            )}
                            {totalSeatItems === 0 && (
                              <p className="text-stone-500 text-[10px] sm:text-[11px] italic truncate">
                                Tap to view / add
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Action Tap indicator (Desktop/Tablet only to save vertical space on phone) */}
                      <div className="hidden sm:flex mt-3 pt-2 border-t border-white/5 items-center justify-between text-[11px]">
                        <span className={`font-bold ${isSelected ? 'text-amber-400' : 'text-stone-400'}`}>
                          {isSelected ? '✓ Viewing & Adding Orders' : 'Tap to view orders'}
                        </span>
                        <Users className="w-3.5 h-3.5 text-stone-500" />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* SELECTED CUSTOMER CLEAR ORDER LIST PANEL (Shows exact ordered dishes clearly — NO payment info!) */}
              {(() => {
                const activeSeatLabel = selectedSeat === 0 ? 'Table Shared' : `Customer ${selectedSeat}`;
                const activeSeatCode = selectedSeat === 0 ? '👥' : `C${selectedSeat}`;
                const sentSeatData = activeTableOrder?.seatsBreakdown?.find((s) => s.seatNumber === selectedSeat);
                const sentItems = sentSeatData?.items || [];
                const pendingCartItems = cartItems.filter((it) => it.customerSeat === selectedSeat);
                const totalItemsCount =
                  sentItems.reduce((sum, it) => sum + Number(it.quantity || 1), 0) +
                  pendingCartItems.reduce((sum, it) => sum + Number(it.quantity || 1), 0);

                return (
                  <div className="bg-[#171411] rounded-2xl border border-amber-500/40 p-3 sm:p-4 shadow-lg space-y-2.5">
                    {/* Panel Header */}
                    <div className="flex items-center justify-between gap-2 pb-2 border-b border-white/10">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center font-black text-xs shrink-0">
                          {activeSeatCode}
                        </div>
                        <h3 className="font-bold text-white text-sm sm:text-base truncate">
                          {activeSeatLabel} &bull; Ordered Dishes
                        </h3>
                      </div>

                      <span className="px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 whitespace-nowrap shrink-0">
                        {totalItemsCount} {totalItemsCount === 1 ? 'dish' : 'dishes'}
                      </span>
                    </div>

                    {/* Clear Itemized Order Rows (No Payment / No Settle Buttons) */}
                    {totalItemsCount === 0 ? (
                      <p className="text-xs text-stone-400 py-1.5 text-center italic">
                        No dishes ordered yet for <strong className="text-amber-300">{activeSeatLabel}</strong> — tap dishes in the menu below to add.
                      </p>
                    ) : (
                      <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                        {/* Already Sent to Kitchen Items */}
                        {sentItems.map((it, idx) => (
                          <div
                            key={`sent-${it.id || idx}`}
                            className="flex items-center justify-between gap-2 bg-stone-900/90 border border-white/5 px-3 py-2 rounded-xl text-xs sm:text-sm"
                          >
                            <span className="font-semibold text-stone-100 truncate">
                              <span className="text-amber-400 font-black font-mono mr-1.5">{it.quantity}x</span>
                              {it.name}
                            </span>
                            <span className="px-2 py-0.5 rounded-md bg-blue-500/15 text-blue-300 border border-blue-500/30 text-[10px] font-bold uppercase tracking-wider shrink-0">
                              Sent
                            </span>
                          </div>
                        ))}

                        {/* Newly Added Cart Items (Editable +/- right here!) */}
                        {pendingCartItems.map((it, idx) => (
                          <div
                            key={`cart-${it.menuItemId}-${idx}`}
                            className="flex items-center justify-between gap-2 bg-amber-500/10 border border-amber-500/35 px-3 py-1.5 rounded-xl text-xs sm:text-sm"
                          >
                            <span className="font-bold text-white truncate">
                              <span className="text-amber-400 font-black font-mono mr-1.5">{it.quantity}x</span>
                              {it.name}
                              <span className="ml-1.5 text-[10px] font-bold text-amber-300 uppercase">(New)</span>
                            </span>

                            <div className="flex items-center gap-1.5 shrink-0 font-mono">
                              <button
                                type="button"
                                onClick={() => handleRemoveItemFromSeat(it.menuItemId, selectedSeat)}
                                className="w-6 h-6 rounded-lg bg-stone-800 hover:bg-rose-600 text-white flex items-center justify-center cursor-pointer"
                                title="Decrease quantity"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="text-xs font-black text-amber-300 w-4 text-center">{it.quantity}</span>
                              <button
                                type="button"
                                onClick={() => handleAddItemToSeat({ id: it.menuItemId, name: it.name, price: it.price, category: it.category, is_veg: it.isVeg }, selectedSeat)}
                                className="w-6 h-6 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 flex items-center justify-center cursor-pointer"
                                title="Increase quantity"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Table Shared Option Bar (Compact 1-row on mobile) */}
              <div className="flex items-center justify-between gap-2 bg-stone-900/60 px-2.5 py-2 rounded-2xl border border-white/10">
                <button
                  type="button"
                  onClick={() => setSelectedSeat(0)}
                  className={`px-2.5 sm:px-3.5 py-1.5 rounded-xl text-[11px] sm:text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                    selectedSeat === 0
                      ? 'bg-amber-500 text-stone-950 font-black shadow-md'
                      : 'bg-stone-800 text-stone-400 hover:text-white border border-white/10'
                  }`}
                >
                  <Users className="w-3.5 h-3.5 shrink-0" />
                  <span className="sm:hidden">👥 Shared Items</span>
                  <span className="hidden sm:inline">👥 Order Shared / Table Items (Starters, Water, Bread)</span>
                  {cartItems.filter((it) => it.customerSeat === 0).length > 0 && (
                    <span className="px-1.5 py-0.2 bg-stone-950 text-amber-400 rounded-full font-mono text-[10px]">
                      {cartItems.filter((it) => it.customerSeat === 0).reduce((sum, it) => sum + it.quantity, 0)}
                    </span>
                  )}
                </button>

                <div className="text-[11px] sm:text-xs font-bold text-amber-300 flex items-center gap-1 whitespace-nowrap shrink-0">
                  <span className="hidden sm:inline">Currently Ordering For:</span>
                  <span className="sm:hidden text-stone-400">For:</span>
                  <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-400 border border-amber-500/40">
                    {selectedSeat === 0 ? 'Shared' : `Customer ${selectedSeat}`}
                  </span>
                </div>
              </div>
            </div>

            {/* Menu Navigation & Search */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                {/* Priority Categories Ribbon (Briyani, Rice, Noodles, Parotta First) */}
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setActiveCategory('ALL')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                      activeCategory === 'ALL'
                        ? 'bg-amber-500 text-stone-950 font-black'
                        : 'bg-stone-900 text-stone-400 hover:text-white border border-white/10'
                    }`}
                  >
                    🌟 All Dishes
                  </button>

                  {categories.map((cat) => {
                    const icon = CATEGORY_ICONS[cat.toLowerCase()] || '🍽️';
                    const isSelected = activeCategory.toLowerCase() === cat.toLowerCase();
                    return (
                      <button
                        type="button"
                        key={cat}
                        onClick={() => setActiveCategory(cat)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-1.5 cursor-pointer ${
                          isSelected
                            ? 'bg-amber-500 text-stone-950 font-black'
                            : 'bg-stone-900 text-stone-400 hover:text-white border border-white/10'
                        }`}
                      >
                        <span>{icon}</span>
                        <span>{cat}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Search Input */}
                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search dishes..."
                    className="w-full text-xs bg-stone-900 pl-9 pr-3 py-2 rounded-xl border border-white/10 text-white placeholder-stone-500 outline-none focus:border-amber-400"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-2 text-xs text-stone-400 hover:text-white"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Dishes Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {filteredDishes.map((dish) => {
                  const qtyInActiveSeat = getItemQuantityForSeat(dish.id, selectedSeat);

                  return (
                    <div
                      key={dish.id}
                      className="bg-[#171411] rounded-2xl border border-white/10 p-3 flex flex-col justify-between hover:border-amber-400/40 transition shadow-sm"
                    >
                      <div>
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className="text-stone-400 font-semibold">{dish.category}</span>
                          <span className={`w-2.5 h-2.5 rounded-full ${dish.is_veg ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                        </div>
                        <h4 className="font-bold text-sm text-white line-clamp-1" title={dish.name}>
                          {dish.name}
                        </h4>
                        <p className="text-amber-400 font-black text-sm font-mono mt-1">
                          ₹{Number(dish.price).toFixed(0)}
                        </p>
                      </div>

                      {/* Rapid Seat Add/Remove */}
                      <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between">
                        {qtyInActiveSeat > 0 ? (
                          <div className="flex items-center justify-between w-full bg-stone-900 rounded-xl p-1 border border-amber-500/40 font-mono">
                            <button
                              type="button"
                              onClick={() => handleRemoveItemFromSeat(dish.id, selectedSeat)}
                              className="w-7 h-7 rounded-lg bg-stone-800 text-white hover:bg-rose-600 flex items-center justify-center font-bold text-xs cursor-pointer"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <div className="flex flex-col items-center">
                              <span className="font-black text-amber-300 text-xs px-2">
                                {qtyInActiveSeat}
                              </span>
                              <span className="text-[9px] text-stone-400 font-sans font-bold">
                                {selectedSeat === 0 ? 'Shared' : `C${selectedSeat}`}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleAddItemToSeat(dish, selectedSeat)}
                              className="w-7 h-7 rounded-lg bg-amber-500 text-stone-950 hover:bg-amber-400 flex items-center justify-center font-bold text-xs cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleAddItemToSeat(dish, selectedSeat)}
                            className="w-full py-1.5 bg-stone-900 hover:bg-amber-500 text-stone-300 hover:text-stone-950 font-bold text-xs rounded-xl border border-white/10 transition flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>+ Add to {selectedSeat === 0 ? 'Shared' : `C${selectedSeat}`}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Sticky / Floating Bottom Order Bar & Seat Cart (Safe-Area Aware Above Mobile Bottom Nav) */}
            {cartItems.length > 0 && (
              <div
                className={`${
                  isOrderOnly && onSwitchSection
                    ? 'fixed inset-x-3 bottom-[calc(4.15rem+env(safe-area-inset-bottom))] sm:sticky sm:inset-x-auto sm:bottom-4'
                    : 'sticky bottom-[max(1rem,env(safe-area-inset-bottom))]'
                } z-40 bg-[#1A1612]/95 backdrop-blur-xl rounded-2xl sm:rounded-3xl border border-amber-500/50 p-2.5 sm:p-4 shadow-[0_8px_30px_rgba(0,0,0,0.85)] space-y-2 sm:space-y-3`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 sm:gap-3">
                  
                  {/* Seat Breakdown Chips (Single horizontal scrollable line on mobile) */}
                  <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar">
                    <span className="text-[10px] sm:text-xs font-bold text-stone-400 uppercase tracking-wider shrink-0">
                      New ({cartTotals.totalCount}):
                    </span>
                    {cartTotals.seats.map((s) => {
                      const seatItemCount = s.items.reduce((acc, it) => acc + it.quantity, 0);
                      return (
                        <div
                          key={s.seat}
                          className="px-2 sm:px-3 py-0.5 sm:py-1 rounded-lg sm:rounded-xl bg-stone-900 border border-white/10 text-[11px] sm:text-xs font-bold flex items-center gap-1 sm:gap-1.5 whitespace-nowrap shrink-0"
                        >
                          <span className="text-amber-400">{s.seat === 0 ? 'Shared' : `C${s.seat}`}:</span>
                          <span className="text-white font-mono">
                            {seatItemCount} {seatItemCount === 1 ? 'dish' : 'dishes'}
                          </span>
                          {!isOrderOnly && (
                            <>
                              <span className="text-stone-500">&bull;</span>
                              <span className="text-emerald-400 font-mono">₹{s.subtotal}</span>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Summary & Action Button */}
                  <div className="flex items-center justify-between md:justify-end gap-3 sm:gap-4 w-full md:w-auto">
                    <div className="min-w-0">
                      {isOrderOnly ? (
                        <>
                          <span className="text-[9px] sm:text-[10px] text-stone-400 uppercase tracking-wider block font-bold leading-none">
                            Ready to Send
                          </span>
                          <span className="text-lg sm:text-xl font-black text-amber-400 font-sans leading-tight">
                            {cartTotals.totalCount} {cartTotals.totalCount === 1 ? 'Dish' : 'Dishes'}
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="text-[9px] sm:text-[10px] text-stone-400 uppercase tracking-wider block font-bold leading-none">
                            Order Total
                          </span>
                          <span className="text-xl sm:text-2xl font-black text-amber-400 font-mono leading-tight">
                            ₹{cartTotals.subtotal.toFixed(0)}
                          </span>
                        </>
                      )}
                    </div>

                    <button
                      type="button"
                      disabled={isSubmittingOrder}
                      onClick={handleDispatchOrder}
                      className="px-4 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-amber-500 to-amber-400 hover:brightness-110 active:scale-98 text-stone-950 font-black text-xs sm:text-sm uppercase tracking-wider rounded-xl sm:rounded-2xl shadow-[0_4px_20px_rgba(245,158,11,0.4)] flex items-center gap-1.5 sm:gap-2 cursor-pointer transition disabled:opacity-50 whitespace-nowrap shrink-0"
                    >
                      <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                      <span className="sm:hidden">{isSubmittingOrder ? 'Sending...' : 'Send Order'}</span>
                      <span className="hidden sm:inline">
                        {isSubmittingOrder ? 'Sending...' : isOrderOnly ? 'Send Order to Kitchen' : 'Send to Kitchen & Billing'}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 3: BILLING COUNTER & PRINT STATION (Stage 8) */}
        {/* ============================================================== */}
        {activeTab === 'BILLING' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-stone-900/60 p-4 rounded-3xl border border-white/10">
              <div>
                <h2 className="text-lg font-serif font-black text-white flex items-center gap-2">
                  <span>Cashier Billing &amp; Thermal Printing Station</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-sans font-bold">
                    {tablesData.occupiedCount} Active Tabs
                  </span>
                </h2>
                <p className="text-xs text-stone-400">
                  Review open dining tables, trigger instant 80mm/58mm thermal receipts, and settle payments.
                </p>
              </div>

              <button
                type="button"
                onClick={loadTableStatus}
                className="px-3.5 py-2 bg-stone-800 hover:bg-stone-700 rounded-xl text-xs font-bold text-stone-300 transition flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Refresh Station</span>
              </button>
            </div>

            {/* Active Billing Stations Section */}
            {tablesData.occupiedCount === 0 ? (
              <div className="py-20 text-center bg-stone-900/40 rounded-3xl border border-white/10 p-8">
                <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
                <h3 className="font-bold text-white text-base">All Tables Cleared</h3>
                <p className="text-xs text-stone-400 mt-1 max-w-sm mx-auto">
                  There are currently no active dining orders awaiting billing. New orders from waiters will appear here automatically.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {tablesData.tables.filter((t) => t.status !== 'VACANT').map((t) => {
                  const seats = t.activeOrder?.seatsBreakdown || [];
                  const customerSeats = [1, 2, 3, 4].map((sNum) => {
                    const existing = seats.find((s) => s.seatNumber === sNum);
                    return existing || {
                      seatNumber: sNum,
                      label: `Customer ${sNum}`,
                      items: [],
                      subtotal: 0,
                      unpaidSubtotal: 0,
                      isPaid: false
                    };
                  });
                  const sharedSeat = seats.find((s) => s.seatNumber === 0);
                  const unpaidTotal = seats.reduce((sum, s) => sum + (s.isPaid ? 0 : s.subtotal), 0);

                  return (
                    <div
                      key={t.tableId}
                      className="bg-[#171411] rounded-3xl border border-blue-500/30 p-5 sm:p-6 shadow-2xl space-y-5"
                    >
                      {/* Master Table Header Bar */}
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-white/10">
                        <div className="flex items-center gap-3.5">
                          <div className="w-12 h-12 rounded-2xl bg-blue-500/20 border border-blue-500/40 text-blue-400 flex items-center justify-center font-black text-lg shrink-0">
                            {t.isParcel ? <ShoppingBag className="w-6 h-6" /> : `#${t.tableNumber}`}
                          </div>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-2xl font-serif font-black text-white">{t.tableLabel}</h3>
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-500/30">
                                {unpaidTotal === 0 ? 'All Diners Settled' : 'Ready for Billing'}
                              </span>
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20">
                                0% GST • Exact Menu
                              </span>
                            </div>
                            <p className="text-xs text-stone-400 mt-1 flex flex-wrap items-center gap-2.5">
                              <span>Server: <strong className="text-white">{t.activeOrder?.serverName}</strong></span>
                              <span>•</span>
                              <span>Diners: <strong className="text-white">{t.activeOrder?.guestCount || 4} Guests</strong></span>
                              <span>•</span>
                              <span>Total Dishes: <strong className="text-white">{t.activeOrder?.itemCount || 0}</strong></span>
                              <span>•</span>
                              <span className="text-blue-300 flex items-center gap-1 font-mono">
                                <Clock className="w-3.5 h-3.5" /> {t.activeOrder?.elapsedMinutes} mins ago
                              </span>
                            </p>
                          </div>
                        </div>

                        {/* Master Table Totals & Actions */}
                        <div className="flex flex-wrap items-center gap-3">
                          <div className="bg-stone-900/90 px-4 py-2 rounded-2xl border border-white/10 font-mono text-right">
                            <span className="text-[10px] text-stone-400 font-sans uppercase font-bold block">Table Balance</span>
                            <div className="flex items-baseline gap-2">
                              <span className="text-2xl font-black text-emerald-400">₹{t.activeOrder?.total.toFixed(2)}</span>
                              {unpaidTotal < (t.activeOrder?.total || 0) && (
                                <span className="text-xs text-amber-400 font-bold font-sans">(Unpaid: ₹{unpaidTotal.toFixed(2)})</span>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handlePrintCustomerBillDirect(t, 'COMBINED')}
                              className="px-3.5 py-2.5 bg-stone-800 hover:bg-stone-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 border border-white/10 transition cursor-pointer"
                              title="Print Combined Table Bill"
                            >
                              <FileText className="w-3.5 h-3.5 text-amber-400" />
                              <span>Combined Bill</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handlePrintCustomerBillDirect(t, 'ALL_SEPARATE')}
                              className="px-3.5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                              title="Print 4 Separate Individual Slips"
                            >
                              <Scissors className="w-3.5 h-3.5" />
                              <span>All Slips (✂️ Tear-off)</span>
                            </button>

                            {unpaidTotal > 0 && (
                              <button
                                type="button"
                                onClick={() => handleOpenSettleModal(t, null)}
                                className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:brightness-110 text-white font-black text-xs rounded-xl flex items-center gap-1.5 shadow-lg transition cursor-pointer"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Settle Whole Table</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* 4 INDIVIDUAL CUSTOMER BILLING CARDS (Customer 1 to 4) */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                            <Users className="w-4 h-4" />
                            <span>Individual Customer Billing Sections (Diners 1 to 4)</span>
                          </h4>
                          <span className="text-[11px] text-stone-400">
                            Each diner has an independent bill slip and separate settlement
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3.5">
                          {customerSeats.map((seat) => {
                            const hasItems = seat.items && seat.items.length > 0;
                            const isPaid = seat.isPaid;

                            return (
                              <div
                                key={seat.seatNumber}
                                className={`rounded-2xl border p-4 flex flex-col justify-between transition relative overflow-hidden ${
                                  isPaid
                                    ? 'bg-emerald-950/20 border-emerald-500/40 shadow-sm'
                                    : hasItems
                                    ? 'bg-stone-900/90 border-amber-500/30 shadow-md'
                                    : 'bg-stone-900/40 border-white/5 opacity-75'
                                }`}
                              >
                                {/* Customer Card Top */}
                                <div>
                                  <div className="flex items-center justify-between pb-2 border-b border-white/10">
                                    <div className="flex items-center gap-2">
                                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                                        isPaid ? 'bg-emerald-500 text-stone-950 font-black' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                      }`}>
                                        C{seat.seatNumber}
                                      </div>
                                      <span className="font-bold text-white text-sm">{seat.label}</span>
                                    </div>

                                    {isPaid ? (
                                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                                        <CheckCircle2 className="w-3 h-3" />
                                        <span>PAID</span>
                                      </span>
                                    ) : hasItems ? (
                                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                        UNPAID
                                      </span>
                                    ) : (
                                      <span className="text-[10px] text-stone-500 font-semibold">NO ITEMS</span>
                                    )}
                                  </div>

                                  {/* Itemized Dishes */}
                                  <div className="my-3 min-h-24 max-h-40 overflow-y-auto no-scrollbar space-y-1.5 font-mono text-xs">
                                    {hasItems ? (
                                      seat.items.map((it, idx) => (
                                        <div key={idx} className="flex justify-between items-center text-stone-300 text-[11px] bg-black/30 px-2 py-1 rounded-lg">
                                          <span className="truncate pr-1 font-sans">{it.quantity}x {it.name}</span>
                                          <span className="font-bold text-white shrink-0">₹{it.lineTotal}</span>
                                        </div>
                                      ))
                                    ) : (
                                      <div className="h-full flex flex-col items-center justify-center text-center text-stone-500 py-4 font-sans text-xs">
                                        <p>No dishes assigned to Customer {seat.seatNumber}</p>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            handleSelectTable(t);
                                            setSelectedSeat(seat.seatNumber);
                                          }}
                                          className="mt-2 text-[11px] text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
                                        >
                                          <Plus className="w-3 h-3" />
                                          <span>Take C{seat.seatNumber} Order</span>
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Customer Subtotal & Individual Actions */}
                                <div className="pt-2 border-t border-white/10 space-y-2">
                                  <div className="flex justify-between items-baseline font-mono">
                                    <span className="text-[11px] text-stone-400 font-sans font-bold">Diner Payable:</span>
                                    <span className="text-lg font-black text-amber-400">₹{seat.subtotal.toFixed(2)}</span>
                                  </div>

                                  {hasItems && (
                                    <div className="grid grid-cols-2 gap-1.5 pt-1">
                                      <button
                                        type="button"
                                        onClick={() => handlePrintCustomerBillDirect(t, seat.seatNumber)}
                                        className="py-1.5 px-2 bg-stone-800 hover:bg-stone-700 text-white rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer border border-white/10"
                                        title={`Print Customer ${seat.seatNumber} Bill Slip`}
                                      >
                                        <Printer className="w-3 h-3 text-amber-400" />
                                        <span>Print Bill</span>
                                      </button>

                                      {!isPaid ? (
                                        <button
                                          type="button"
                                          onClick={() => handleOpenSettleModal(t, seat.seatNumber)}
                                          className="py-1.5 px-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                                          title={`Settle Customer ${seat.seatNumber}`}
                                        >
                                          <CheckCircle2 className="w-3 h-3" />
                                          <span>Settle C{seat.seatNumber}</span>
                                        </button>
                                      ) : (
                                        <span className="text-[10px] text-emerald-400 font-mono font-bold flex items-center justify-center bg-emerald-950/40 rounded-lg py-1 border border-emerald-500/20">
                                          via {seat.paymentMethod || 'CASH'}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Shared dishes section if any */}
                        {sharedSeat && sharedSeat.items.length > 0 && (
                          <div className="bg-stone-900/60 rounded-2xl border border-white/10 p-3 mt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                              <span className="text-xs font-bold text-amber-300 shrink-0">👥 Table Shared Items:</span>
                              <div className="flex flex-wrap gap-1.5 text-xs text-stone-300 font-mono">
                                {sharedSeat.items.map((it, idx) => (
                                  <span key={idx} className="bg-black/40 px-2 py-0.5 rounded text-[11px]">
                                    {it.quantity}x {it.name} (₹{it.lineTotal})
                                  </span>
                                ))}
                              </div>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <span className="font-mono font-black text-amber-400 text-sm">₹{sharedSeat.subtotal.toFixed(2)}</span>
                              <button
                                type="button"
                                onClick={() => handlePrintCustomerBillDirect(t, 0)}
                                className="px-2.5 py-1 bg-stone-800 text-white text-xs rounded-lg font-bold flex items-center gap-1 border border-white/10 cursor-pointer"
                              >
                                <Printer className="w-3 h-3 text-amber-400" /> Print
                              </button>
                              {!sharedSeat.isPaid && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenSettleModal(t, 0)}
                                  className="px-2.5 py-1 bg-emerald-600 text-white text-xs rounded-lg font-bold flex items-center gap-1 cursor-pointer"
                                >
                                  <CheckCircle2 className="w-3 h-3" /> Settle
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 4: BILLS ARCHIVE & ORDER HISTORY (Stage 9) */}
        {/* ============================================================== */}
        {activeTab === 'HISTORY' && (
          <div className="space-y-6">
            
            {/* Header & Controls */}
            <div className="bg-[#171411] p-5 rounded-3xl border border-white/10 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-serif font-black text-white flex items-center gap-2">
                    <span>Searchable Bills &amp; Order History Archive</span>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-sans font-bold">
                      {billsArchive.length} Archived Bills
                    </span>
                  </h2>
                  <p className="text-xs text-stone-400">
                    Search previous customer bills, view customer 1-4 seat receipts, reprint thermal slips, or export CSV.
                  </p>
                </div>

                <a
                  href={`https://cafaqr-api.p7404467.workers.dev/api/pos/bills-export/csv?restaurantId=${RESTAURANT_ID}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition w-fit cursor-pointer border border-white/10"
                >
                  <Download className="w-3.5 h-3.5 text-amber-400" />
                  <span>Export History CSV</span>
                </a>
              </div>

              {/* Filters Toolbar */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-white/5">
                
                {/* Search Input */}
                <div className="relative">
                  <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={billsSearch}
                    onChange={(e) => setBillsSearch(e.target.value)}
                    placeholder="Search by Bill # or Server..."
                    className="w-full text-xs bg-stone-900 pl-9 pr-3 py-2 rounded-xl border border-white/10 text-white placeholder-stone-500 outline-none focus:border-amber-400"
                  />
                </div>

                {/* Date Filter */}
                <div className="flex items-center gap-1.5 text-xs font-bold">
                  {['today', 'yesterday', 'all'].map((df) => (
                    <button
                      key={df}
                      type="button"
                      onClick={() => setBillsDateFilter(df)}
                      className={`px-3 py-2 rounded-xl capitalize transition cursor-pointer flex-1 ${
                        billsDateFilter === df
                          ? 'bg-amber-500 text-stone-950 font-black'
                          : 'bg-stone-900 text-stone-400 hover:text-white border border-white/10'
                      }`}
                    >
                      {df === 'all' ? 'All Time' : df}
                    </button>
                  ))}
                </div>

                {/* Table Filter */}
                <div>
                  <select
                    value={billsTableFilter}
                    onChange={(e) => setBillsTableFilter(e.target.value)}
                    className="w-full text-xs bg-stone-900 px-3 py-2 rounded-xl border border-white/10 text-white outline-none focus:border-amber-400"
                  >
                    <option value="">All Service Tables</option>
                    <option value="0">Takeaway Parcel (0)</option>
                    {[...Array(15)].map((_, i) => (
                      <option key={i + 1} value={i + 1}>Table #{i + 1}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Bills List Table */}
            {isLoadingBills ? (
              <div className="py-20 text-center text-stone-400">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto text-amber-400 mb-2" />
                <p className="text-xs">Loading archived bills...</p>
              </div>
            ) : billsArchive.length === 0 ? (
              <div className="py-20 text-center bg-stone-900/40 rounded-3xl border border-white/10 p-8">
                <FileText className="w-12 h-12 text-stone-600 mx-auto mb-3" />
                <h3 className="font-bold text-white text-base">No Archived Bills Found</h3>
                <p className="text-xs text-stone-400 mt-1 max-w-sm mx-auto">
                  No completed bills match your selected filters. Completed orders will be stored here permanently.
                </p>
              </div>
            ) : (
              <div className="bg-[#171411] rounded-3xl border border-white/10 overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-stone-300">
                    <thead className="bg-stone-900/90 text-stone-400 uppercase tracking-wider text-[10px] font-bold border-b border-white/10">
                      <tr>
                        <th className="px-4 py-3">Bill Number</th>
                        <th className="px-4 py-3">Paid Date &amp; Time</th>
                        <th className="px-4 py-3">Table</th>
                        <th className="px-4 py-3">Server</th>
                        <th className="px-4 py-3">Items</th>
                        <th className="px-4 py-3">Payment</th>
                        <th className="px-4 py-3">Total (₹)</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 font-mono">
                      {billsArchive.map((b) => (
                        <tr key={b.id} className="hover:bg-white/5 transition">
                          <td className="px-4 py-3 font-bold text-amber-400">{b.billNumber}</td>
                          <td className="px-4 py-3 font-sans text-stone-400">{new Date(b.paidAt).toLocaleString()}</td>
                          <td className="px-4 py-3 font-sans font-bold text-white">{b.tableLabel}</td>
                          <td className="px-4 py-3 font-sans text-stone-300">{b.serverName}</td>
                          <td className="px-4 py-3">{b.itemCount} items</td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-0.5 rounded-md bg-stone-800 text-[10px] font-bold text-stone-300 border border-white/10">
                              {b.paymentMethod}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-black text-emerald-400 text-sm">₹{b.total.toFixed(2)}</td>
                          <td className="px-4 py-3 text-right font-sans">
                            <button
                              type="button"
                              onClick={() => setViewBillModal(b)}
                              className="px-3 py-1 bg-stone-800 hover:bg-stone-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 ml-auto cursor-pointer"
                            >
                              <Printer className="w-3 h-3 text-amber-400" />
                              <span>View / Print</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 5: FOOD MANAGER, QUANTITY TRACKER & DISH PERFORMANCE */}
        {/* ============================================================== */}
        {activeTab === 'PERFORMANCE' && (
          <div className="space-y-6">
            {/* Top Header & Add Dish CTA */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#171411] p-5 rounded-3xl border border-white/10 shadow-lg">
              <div>
                <h2 className="text-xl font-serif font-black text-white flex items-center gap-2">
                  <ChefHat className="w-6 h-6 text-amber-400" />
                  <span>Food Manager &amp; Dish Performance</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-sans font-bold">
                    {dishPerformanceData?.summaryCounts?.totalMenuItems || menuItems.length} Menu Dishes
                  </span>
                </h2>
                <p className="text-xs text-stone-400 mt-0.5">
                  Track exact dish quantities sold today, identify highest sellers &amp; unsold dishes needing chef promotion, and update menu items/rates instantly.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={loadDishPerformance}
                  className="px-3.5 py-2 bg-stone-800 hover:bg-stone-700 rounded-xl text-xs font-bold text-stone-300 transition flex items-center gap-1.5 cursor-pointer border border-white/10"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoadingPerformance ? 'animate-spin text-amber-400' : ''}`} />
                  <span>Refresh Stats</span>
                </button>
                <button
                  type="button"
                  onClick={handleOpenAddDishModal}
                  className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-400 hover:brightness-110 text-stone-950 font-black text-xs rounded-xl flex items-center gap-1.5 shadow-md transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add New Food Item</span>
                </button>
              </div>
            </div>

            {isLoadingPerformance && !dishPerformanceData ? (
              <div className="py-20 text-center text-stone-400">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto text-amber-400 mb-2" />
                <p className="text-xs">Loading live dish performance &amp; quantities...</p>
              </div>
            ) : (
              <>
                {/* 3 KPI PERFORMANCE HIGHLIGHTS */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Card 1: Total Food Prepared Today */}
                  <div className="bg-[#171411] rounded-3xl border border-white/10 p-5 flex flex-col justify-between shadow-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-stone-400 uppercase tracking-wider">Food Quantity Today</span>
                      <TrendingUp className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div className="my-3">
                      <p className="text-3xl font-black text-white font-mono">
                        {dishPerformanceData?.totalDishesSoldToday || 0} <span className="text-sm font-sans font-bold text-stone-400">portions sold</span>
                      </p>
                      <p className="text-sm font-black text-emerald-400 font-mono mt-1">
                        ₹{(dishPerformanceData?.totalDishRevenueToday || 0).toFixed(2)} today&apos;s dish sales
                      </p>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-stone-400 pt-2 border-t border-white/5">
                      <span>Ordered Today: <strong className="text-emerald-400">{dishPerformanceData?.summaryCounts?.soldTodayCount || 0} dishes</strong></span>
                      <span>Not Ordered: <strong className="text-amber-400">{dishPerformanceData?.summaryCounts?.notOrderedTodayCount || 0} dishes</strong></span>
                    </div>
                  </div>

                  {/* Card 2: Star Item Today (Highest Sold) */}
                  <div className="bg-gradient-to-br from-amber-500/15 via-[#171411] to-[#171411] rounded-3xl border border-amber-500/40 p-5 flex flex-col justify-between shadow-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Star className="w-4 h-4 fill-amber-400" />
                        <span>Star Item Today (Highest Sold)</span>
                      </span>
                    </div>
                    {dishPerformanceData?.highestSoldDish ? (
                      <div className="my-3">
                        <h3 className="text-xl font-serif font-black text-white line-clamp-1">
                          {dishPerformanceData.highestSoldDish.name}
                        </h3>
                        <p className="text-xs text-stone-400">
                          {dishPerformanceData.highestSoldDish.category} &bull; ₹{dishPerformanceData.highestSoldDish.price.toFixed(2)}
                        </p>
                        <div className="flex items-baseline justify-between mt-2 font-mono">
                          <span className="text-lg font-black text-amber-400">
                            {dishPerformanceData.highestSoldDish.quantitySoldToday} portions sold
                          </span>
                          <span className="text-sm font-bold text-emerald-400">
                            ₹{dishPerformanceData.highestSoldDish.revenueToday.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-stone-400 my-4">No dishes sold yet today.</p>
                    )}
                    <div className="text-[11px] text-amber-300/80 pt-2 border-t border-amber-500/20 font-semibold">
                      🏆 #1 Top Performing Dish by Volume Today
                    </div>
                  </div>

                  {/* Card 3: Action Item (Lowest / Not Sold Today) */}
                  <div className="bg-gradient-to-br from-rose-500/15 via-[#171411] to-[#171411] rounded-3xl border border-rose-500/40 p-5 flex flex-col justify-between shadow-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4" />
                        <span>Action Item (Needs Chef Promotion)</span>
                      </span>
                    </div>
                    {dishPerformanceData?.lowestSoldDish ? (
                      <div className="my-3">
                        <h3 className="text-xl font-serif font-black text-white line-clamp-1">
                          {dishPerformanceData.lowestSoldDish.name}
                        </h3>
                        <p className="text-xs text-stone-400">
                          {dishPerformanceData.lowestSoldDish.category} &bull; ₹{dishPerformanceData.lowestSoldDish.price.toFixed(2)}
                        </p>
                        <div className="flex items-baseline justify-between mt-2 font-mono">
                          <span className="text-lg font-black text-rose-400">
                            {dishPerformanceData.lowestSoldDish.quantitySoldToday} ordered today
                          </span>
                          <span className="text-[11px] font-sans px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-bold">
                            Promote Today
                          </span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-stone-400 my-4">All menu dishes are moving well today!</p>
                    )}
                    <div className="text-[11px] text-rose-300/80 pt-2 border-t border-rose-500/20 font-semibold">
                      ⚠️ Total {dishPerformanceData?.notOrderedToday?.length || 0} dishes have 0 orders today
                    </div>
                  </div>
                </div>

                {/* TOP 5 VOLUME LEADERS & DISHES NOT SOLD TODAY */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left: Top 5 Dishes By Volume Today */}
                  <div className="bg-[#171411] rounded-3xl border border-white/10 p-5 space-y-3 shadow-lg">
                    <div className="flex items-center justify-between border-b border-white/10 pb-3">
                      <h3 className="text-sm font-serif font-black text-white flex items-center gap-2">
                        <Flame className="w-4 h-4 text-amber-400" />
                        <span>Top 5 Highest Sold Dishes Today</span>
                      </h3>
                      <span className="text-[11px] text-stone-400 font-bold">By Volume</span>
                    </div>

                    <div className="space-y-2.5">
                      {(dishPerformanceData?.topPerformers || []).map((dish, idx) => (
                        <div
                          key={dish.id}
                          className="flex items-center justify-between p-3 rounded-2xl bg-stone-900/90 border border-white/5 hover:border-amber-500/30 transition"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className={`w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                              idx === 0
                                ? 'bg-amber-500 text-stone-950'
                                : idx === 1
                                ? 'bg-stone-300 text-stone-950'
                                : idx === 2
                                ? 'bg-amber-700 text-white'
                                : 'bg-stone-800 text-stone-400'
                            }`}>
                              #{idx + 1}
                            </span>
                            <div className="min-w-0">
                              <p className="font-bold text-sm text-white truncate">{dish.name}</p>
                              <p className="text-[11px] text-stone-400">{dish.category} &bull; ₹{dish.price.toFixed(2)}</p>
                            </div>
                          </div>
                          <div className="text-right font-mono shrink-0 ml-2">
                            <p className="text-sm font-black text-amber-400">{dish.quantitySoldToday} ordered</p>
                            <p className="text-[11px] font-bold text-emerald-400">₹{dish.revenueToday.toFixed(2)}</p>
                          </div>
                        </div>
                      ))}
                      {(!dishPerformanceData?.topPerformers || dishPerformanceData.topPerformers.length === 0) && (
                        <p className="text-xs text-stone-500 text-center py-6">No dish sales recorded yet today.</p>
                      )}
                    </div>
                  </div>

                  {/* Right: Dishes NOT Sold Today (0 Ordered — Needs Chef Promotion) */}
                  <div className="bg-[#171411] rounded-3xl border border-rose-500/30 p-5 space-y-3 shadow-lg flex flex-col">
                    <div className="flex items-center justify-between border-b border-white/10 pb-3">
                      <h3 className="text-sm font-serif font-black text-white flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-rose-400" />
                        <span>Dishes NOT Sold Today (0 Orders)</span>
                      </h3>
                      <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 text-[11px] font-bold border border-rose-500/30">
                        {dishPerformanceData?.notOrderedToday?.length || 0} Unsold Items
                      </span>
                    </div>

                    <p className="text-[11px] text-stone-400">
                      Every menu item listed below has <strong className="text-rose-300">0 orders today</strong>. Recommend these items to customers or check stock availability.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
                      {(dishPerformanceData?.notOrderedToday || []).map((dish) => (
                        <div
                          key={dish.id}
                          className="p-2.5 rounded-xl bg-stone-900/90 border border-rose-500/20 flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-white truncate" title={dish.name}>{dish.name}</p>
                            <p className="text-[10px] text-stone-400">{dish.category} &bull; ₹{dish.price}</p>
                          </div>
                          <span className="px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-300 text-[10px] font-bold whitespace-nowrap border border-rose-500/20">
                            0 sold
                          </span>
                        </div>
                      ))}
                      {(!dishPerformanceData?.notOrderedToday || dishPerformanceData.notOrderedToday.length === 0) && (
                        <p className="text-xs text-emerald-400 text-center py-6 col-span-2">
                          🎉 Incredible! Every single dish on the menu has been ordered today!
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* FULL MENU FOOD MANAGER & QUANTITY SOLD TRACKER */}
                <div className="bg-[#171411] rounded-3xl border border-white/10 p-5 space-y-4 shadow-xl">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-white/10 pb-4">
                    <div>
                      <h3 className="text-base font-serif font-black text-white">
                        Complete Menu Catalog, Sales Quantity &amp; Instant Updater
                      </h3>
                      <p className="text-xs text-stone-400">
                        View exact quantity sold for every dish, toggle stock availability, or edit dish rates instantly.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <div className="relative">
                        <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                        <input
                          type="text"
                          value={perfSearch}
                          onChange={(e) => setPerfSearch(e.target.value)}
                          placeholder="Search dish or category..."
                          className="text-xs bg-stone-900 pl-9 pr-3 py-2 rounded-xl border border-white/10 text-white placeholder-stone-500 outline-none focus:border-amber-400 w-52"
                        />
                      </div>

                      <select
                        value={perfCategoryFilter}
                        onChange={(e) => setPerfCategoryFilter(e.target.value)}
                        className="text-xs bg-stone-900 px-3 py-2 rounded-xl border border-white/10 text-white outline-none focus:border-amber-400"
                      >
                        <option value="ALL">All Menu Items</option>
                        <option value="SOLD_TODAY">🔥 Sold Today Only</option>
                        <option value="NOT_SOLD">⚠️ 0 Ordered Today (Unsold)</option>
                        <option value="OUT_OF_STOCK">🚫 Out of Stock Only</option>
                        {categories.map((cat) => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Dishes Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-stone-300">
                      <thead className="bg-stone-900/90 text-stone-400 uppercase tracking-wider text-[10px] font-bold border-b border-white/10">
                        <tr>
                          <th className="px-4 py-3">Food Item</th>
                          <th className="px-4 py-3">Category</th>
                          <th className="px-4 py-3">Rate (₹)</th>
                          <th className="px-4 py-3">Qty Sold Today</th>
                          <th className="px-4 py-3">Today&apos;s Revenue</th>
                          <th className="px-4 py-3">All-Time Qty</th>
                          <th className="px-4 py-3">Stock Status</th>
                          <th className="px-4 py-3 text-right">Edit</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 font-mono">
                        {(dishPerformanceData?.allDishes || menuItems.map((m) => ({
                          ...m,
                          isVeg: Boolean(m.is_veg),
                          quantitySoldToday: 0,
                          revenueToday: 0,
                          allTimeQuantitySold: 0
                        })))
                          .filter((dish) => {
                            const matchesSearch =
                              !perfSearch.trim() ||
                              dish.name.toLowerCase().includes(perfSearch.toLowerCase()) ||
                              (dish.category || '').toLowerCase().includes(perfSearch.toLowerCase());
                            if (!matchesSearch) return false;
                            if (perfCategoryFilter === 'ALL') return true;
                            if (perfCategoryFilter === 'SOLD_TODAY') return dish.quantitySoldToday > 0;
                            if (perfCategoryFilter === 'NOT_SOLD') return dish.quantitySoldToday === 0;
                            if (perfCategoryFilter === 'OUT_OF_STOCK') return !dish.available;
                            return (dish.category || '').toLowerCase() === perfCategoryFilter.toLowerCase();
                          })
                          .map((dish) => (
                            <tr key={dish.id} className="hover:bg-white/5 transition">
                              <td className="px-4 py-3 font-sans font-bold text-white flex items-center gap-2">
                                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${dish.isVeg ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                <span>{dish.name}</span>
                              </td>
                              <td className="px-4 py-3 font-sans text-stone-400">{dish.category}</td>
                              <td className="px-4 py-3 font-bold text-amber-400">₹{Number(dish.price).toFixed(0)}</td>
                              <td className="px-4 py-3">
                                {dish.quantitySoldToday > 0 ? (
                                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-black border border-emerald-500/30">
                                    {dish.quantitySoldToday} sold
                                  </span>
                                ) : (
                                  <span className="px-2.5 py-0.5 rounded-full bg-rose-500/15 text-rose-300 font-bold border border-rose-500/20">
                                    0 sold today
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 font-bold text-emerald-400">
                                ₹{(dish.revenueToday || 0).toFixed(2)}
                              </td>
                              <td className="px-4 py-3 text-stone-400">
                                {dish.allTimeQuantitySold || 0} total
                              </td>
                              <td className="px-4 py-3 font-sans">
                                <button
                                  type="button"
                                  onClick={() => handleToggleStock(dish.id)}
                                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer transition border ${
                                    dish.available
                                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25'
                                      : 'bg-rose-500/15 text-rose-300 border-rose-500/30 hover:bg-rose-500/25'
                                  }`}
                                >
                                  {dish.available ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                                  <span>{dish.available ? 'In Stock' : 'Out of Stock'}</span>
                                </button>
                              </td>
                              <td className="px-4 py-3 text-right font-sans">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditDishModal(dish)}
                                  className="px-2.5 py-1 bg-stone-800 hover:bg-stone-700 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1 cursor-pointer border border-white/10"
                                >
                                  <Edit3 className="w-3 h-3 text-amber-400" />
                                  <span>Edit</span>
                                </button>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 6: EMBEDDED KITCHEN DISPLAY (Inside Billing & Ops Section) */}
        {/* ============================================================== */}
        {activeTab === 'KITCHEN' && (
          <Suspense
            fallback={
              <div className="py-20 text-center text-stone-400">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto text-emerald-400 mb-2" />
                <p className="text-xs">Loading Kitchen Display...</p>
              </div>
            }
          >
            <KitchenPage embedded={true} />
          </Suspense>
        )}

        {/* ============================================================== */}
        {/* TAB 7: EMBEDDED ADMIN DASHBOARD (Inside Billing & Ops Section) */}
        {/* ============================================================== */}
        {activeTab === 'ADMIN' && (
          <Suspense
            fallback={
              <div className="py-20 text-center text-stone-400">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto text-amber-400 mb-2" />
                <p className="text-xs">Loading Admin Dashboard...</p>
              </div>
            }
          >
            {adminToken ? (
              <AdminDashboardPage
                embedded={true}
                onLogout={() => {
                  removePersistentToken('qr_admin_token');
                  setAdminToken('');
                }}
              />
            ) : (
              <AdminLoginPage
                embedded={true}
                onLoginSuccess={(tok) => setAdminToken(tok || getSyncToken('qr_admin_token'))}
              />
            )}
          </Suspense>
        )}
      </main>

      {/* ============================================================== */}
      {/* NATIVE MOBILE APP FIXED BOTTOM NAVIGATION BAR (Android & iOS) */}
      {/* ============================================================== */}
      {isBillingSuite && (
        <nav className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-[#120F0C]/95 backdrop-blur-xl border-t border-white/15 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_25px_rgba(0,0,0,0.7)] print:hidden">
          <div className="grid grid-cols-5 gap-1 px-2 py-2">
            <button
              type="button"
              onClick={() => setActiveTab('BILLING')}
              className={`py-1.5 rounded-xl flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold transition cursor-pointer relative ${
                activeTab === 'BILLING' ? 'bg-amber-500 text-stone-950 font-black' : 'text-stone-400'
              }`}
            >
              <Printer className="w-4 h-4" />
              <span>Billing</span>
              {tablesData.occupiedCount > 0 && activeTab !== 'BILLING' && (
                <span className="absolute top-0.5 right-2 w-4 h-4 rounded-full bg-rose-600 text-white text-[9px] flex items-center justify-center font-mono">
                  {tablesData.occupiedCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('HISTORY')}
              className={`py-1.5 rounded-xl flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold transition cursor-pointer ${
                activeTab === 'HISTORY' ? 'bg-amber-500 text-stone-950 font-black' : 'text-stone-400'
              }`}
            >
              <History className="w-4 h-4" />
              <span>History</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('PERFORMANCE')}
              className={`py-1.5 rounded-xl flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold transition cursor-pointer ${
                activeTab === 'PERFORMANCE' ? 'bg-amber-500 text-stone-950 font-black' : 'text-stone-400'
              }`}
            >
              <ChefHat className="w-4 h-4" />
              <span>Food</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('KITCHEN')}
              className={`py-1.5 rounded-xl flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold transition cursor-pointer ${
                activeTab === 'KITCHEN' ? 'bg-emerald-400 text-stone-950 font-black' : 'text-stone-400'
              }`}
            >
              <Flame className="w-4 h-4" />
              <span>Kitchen</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('ADMIN')}
              className={`py-1.5 rounded-xl flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold transition cursor-pointer ${
                activeTab === 'ADMIN' ? 'bg-amber-400 text-stone-950 font-black' : 'text-stone-400'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Admin</span>
            </button>
          </div>
        </nav>
      )}

      {isOrderOnly && onSwitchSection && (
        <nav className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-[#120F0C]/95 backdrop-blur-xl border-t border-white/15 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_25px_rgba(0,0,0,0.7)] print:hidden">
          <div className="grid grid-cols-2 gap-2 px-4 py-2">
            <button
              type="button"
              onClick={() => setActiveTab('TABLES')}
              className={`py-2 rounded-xl flex items-center justify-center gap-1.5 text-xs font-black transition cursor-pointer ${
                activeTab === 'TABLES' || activeTab === 'ORDERING'
                  ? 'bg-amber-500 text-stone-950'
                  : 'bg-stone-900 text-stone-300'
              }`}
            >
              <UtensilsCrossed className="w-4 h-4" />
              <span>Floor Tables ({tablesData.occupiedCount})</span>
            </button>

            <button
              type="button"
              onClick={onSwitchSection}
              className="py-2 rounded-xl flex items-center justify-center gap-1.5 text-xs font-bold bg-stone-900 text-stone-200 border border-white/10 cursor-pointer"
            >
              <ArrowLeftRight className="w-4 h-4 text-amber-400" />
              <span>Switch Section</span>
            </button>
          </div>
        </nav>
      )}

      {/* ============================================================== */}
      {/* MODAL 1: SETTLE BILL & MULTI-CUSTOMER THERMAL PRINT MODAL */}
      {/* ============================================================== */}
      {settleModalOrder && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#1A1613] rounded-3xl border border-white/20 max-w-lg w-full p-6 space-y-5 shadow-2xl relative">
            <button
              type="button"
              onClick={() => { setSettleModalOrder(null); setPrintedReceipt(null); setShowPreBillPreview(false); }}
              className="absolute right-4 top-4 text-stone-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            {!printedReceipt ? (
              !showPreBillPreview ? (
                <>
                  {/* Modal Header */}
                  <div className="text-center">
                    <Printer className="w-10 h-10 text-amber-400 mx-auto mb-2" />
                    <h3 className="font-serif font-black text-xl text-white">
                      {targetSeatToSettle !== null
                        ? `Settle Bill: ${settleModalOrder.seatsBreakdown?.find((s) => s.seatNumber === targetSeatToSettle)?.label || `Customer ${targetSeatToSettle}`}`
                        : 'Table Billing & Settlement'}
                    </h3>
                    <p className="text-xs text-stone-400">
                      {settleModalOrder.tableLabel} &bull; Server: {settleModalOrder.serverName}
                    </p>
                  </div>

                  {/* Individual Customer Target Banner */}
                  {targetSeatToSettle !== null && (
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-amber-500 text-stone-950 font-black flex items-center justify-center text-xs">
                          {targetSeatToSettle === 0 ? '👥' : `C${targetSeatToSettle}`}
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-amber-300">
                            Single Diner Settlement Mode
                          </h4>
                          <p className="text-[11px] text-stone-300">
                            Settling bill exclusively for {targetSeatToSettle === 0 ? 'Table Shared' : `Customer ${targetSeatToSettle}`}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setTargetSeatToSettle(null);
                          setPreBillViewMode('ALL_SEPARATE');
                          setReceiptViewMode('ALL_SEPARATE');
                        }}
                        className="text-[11px] text-stone-400 hover:text-white underline cursor-pointer"
                      >
                        Settle Whole Table
                      </button>
                    </div>
                  )}

                  {/* Diner Items Breakdown */}
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-stone-400 uppercase tracking-wider block">
                      {targetSeatToSettle !== null ? 'Diner Order Items' : `Individual Diner Bills (${settleModalOrder.seatsBreakdown?.length || 0} Diners)`}
                    </label>
                    <div className="bg-stone-900/90 p-3.5 rounded-2xl border border-white/10 space-y-2 max-h-52 overflow-y-auto font-mono text-xs">
                      {(targetSeatToSettle !== null
                        ? (settleModalOrder.seatsBreakdown?.filter((s) => s.seatNumber === targetSeatToSettle) || [])
                        : (settleModalOrder.seatsBreakdown || [])
                      ).map((seat) => (
                        <div key={seat.seatNumber} className="border border-white/5 rounded-xl p-2.5 bg-black/30 space-y-1">
                          <div className="flex justify-between items-center text-amber-300 font-sans font-bold text-xs border-b border-white/10 pb-1">
                            <span className="flex items-center gap-1.5">
                              <span>{seat.seatNumber === 0 ? '👥' : '🧑'}</span>
                              <span>{seat.label}</span>
                            </span>
                            <span className="font-mono text-emerald-400 font-black">₹{seat.subtotal.toFixed(2)}</span>
                          </div>
                          {seat.items.map((it, idx) => (
                            <div key={idx} className="flex justify-between text-stone-300 text-[11px] pl-1">
                              <span className="truncate pr-2 font-sans">{it.quantity}x {it.name}</span>
                              <span className="font-bold">₹{it.lineTotal}</span>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Settlement Total (0% GST) */}
                  {(() => {
                    const targetSeatObj = targetSeatToSettle !== null
                      ? settleModalOrder.seatsBreakdown?.find((s) => s.seatNumber === targetSeatToSettle)
                      : null;
                    const unpaidTableTotal = (settleModalOrder.seatsBreakdown || []).reduce(
                      (sum, s) => sum + (s.unpaidSubtotal ?? (s.isPaid ? 0 : s.subtotal)),
                      0
                    );
                    const payableAmount = targetSeatObj
                      ? (targetSeatObj.unpaidSubtotal > 0 ? targetSeatObj.unpaidSubtotal : targetSeatObj.subtotal)
                      : (unpaidTableTotal > 0 ? unpaidTableTotal : settleModalOrder.total);

                    return (
                      <div className="flex justify-between items-baseline font-mono pt-2 border-t border-white/10">
                        <span className="text-xs uppercase tracking-wider text-stone-400 font-sans font-bold">
                          {targetSeatObj ? `${targetSeatObj.label} Payable:` : 'Remaining Payable:'}
                        </span>
                        <span className="text-3xl font-black text-emerald-400">₹{payableAmount.toFixed(2)}</span>
                      </div>
                    );
                  })()}

                  {/* Payment Method Selector */}
                  <div>
                    <label className="text-xs font-bold text-stone-400 block mb-1.5">Payment Method</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setSettlingMethod('CASH')}
                        className={`py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                          settlingMethod === 'CASH'
                            ? 'bg-emerald-600 text-white font-black'
                            : 'bg-stone-900 text-stone-400 border border-white/10'
                        }`}
                      >
                        <Banknote className="w-4 h-4" />
                        <span>CASH</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSettlingMethod('UPI')}
                        className={`py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                          settlingMethod === 'UPI'
                            ? 'bg-emerald-600 text-white font-black'
                            : 'bg-stone-900 text-stone-400 border border-white/10'
                        }`}
                      >
                        <Smartphone className="w-4 h-4" />
                        <span>UPI (QR)</span>
                      </button>
                    </div>
                  </div>

                  {/* Action Buttons: Print Pre-Bill vs Confirm Settle */}
                  {(() => {
                    const targetSeatObj = targetSeatToSettle !== null
                      ? settleModalOrder.seatsBreakdown?.find((s) => s.seatNumber === targetSeatToSettle)
                      : null;
                    const unpaidTableTotal = (settleModalOrder.seatsBreakdown || []).reduce(
                      (sum, s) => sum + (s.unpaidSubtotal ?? (s.isPaid ? 0 : s.subtotal)),
                      0
                    );
                    const payableAmount = targetSeatObj
                      ? (targetSeatObj.unpaidSubtotal > 0 ? targetSeatObj.unpaidSubtotal : targetSeatObj.subtotal)
                      : (unpaidTableTotal > 0 ? unpaidTableTotal : settleModalOrder.total);

                    return (
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setShowPreBillPreview(true)}
                          className="py-3 bg-stone-800 hover:bg-stone-700 text-white font-bold text-xs rounded-2xl flex items-center justify-center gap-1.5 border border-white/10 transition cursor-pointer"
                        >
                          <Printer className="w-4 h-4 text-amber-400" />
                          <span>{targetSeatToSettle !== null ? 'Print Diner Slip' : 'Print Pre-Bill Slips'}</span>
                        </button>

                        <button
                          type="button"
                          disabled={isSettling}
                          onClick={handleConfirmSettle}
                          className="py-3 bg-gradient-to-r from-amber-500 to-amber-400 hover:brightness-110 active:scale-98 text-stone-950 font-black text-xs uppercase tracking-wider rounded-2xl shadow-lg flex items-center justify-center gap-2 cursor-pointer transition disabled:opacity-50"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>
                            {isSettling
                              ? 'Settling...'
                              : targetSeatObj
                              ? `Settle ${targetSeatObj.label} (₹${payableAmount.toFixed(2)})`
                              : `Settle Table (₹${payableAmount.toFixed(2)})`}
                          </span>
                        </button>
                      </div>
                    );
                  })()}
                </>
              ) : (
                /* Pre-Bill Printable View */
                <div className="space-y-4">
                  <div className="text-center">
                    <Printer className="w-8 h-8 text-amber-400 mx-auto mb-1" />
                    <h3 className="font-serif font-black text-lg text-white">
                      Pre-Bill Slips &bull; {settleModalOrder.tableLabel}
                    </h3>
                    <p className="text-xs text-stone-400">
                      Choose to print separate individual bills per customer or table combined bill
                    </p>
                  </div>

                  <MultiCustomerReceiptSlip
                    data={settleModalOrder}
                    viewMode={preBillViewMode}
                    setViewMode={setPreBillViewMode}
                    isPreBill={true}
                  />

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={handleTriggerBrowserPrint}
                      className="py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Printer className="w-4 h-4" />
                      <span>Print Thermal Slip</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowPreBillPreview(false)}
                      className="py-2.5 bg-stone-800 hover:bg-stone-700 text-white font-bold text-xs rounded-xl cursor-pointer"
                    >
                      Back to Payment
                    </button>
                  </div>
                </div>
              )
            ) : (
              /* Receipt Settle Success & Multi-Customer Printable Slips */
              <div className="space-y-4">
                <div className="text-center">
                  <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-1.5" />
                  <h3 className="font-serif font-black text-xl text-white">
                    Bill Settled &amp; Archived!
                  </h3>
                  <p className="text-xs text-amber-400 font-mono font-bold">
                    Master Bill: {printedReceipt.billNumber}
                  </p>
                </div>

                <MultiCustomerReceiptSlip
                  data={printedReceipt}
                  viewMode={receiptViewMode}
                  setViewMode={setReceiptViewMode}
                />

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleTriggerBrowserPrint}
                    className="py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Print Thermal Slip</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => { setSettleModalOrder(null); setPrintedReceipt(null); setShowPreBillPreview(false); setActiveTab('TABLES'); }}
                    className="py-2.5 bg-stone-800 hover:bg-stone-700 text-white font-bold text-xs rounded-xl cursor-pointer"
                  >
                    Done &bull; Next Table
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 2: VIEW / REPRINT HISTORICAL BILL */}
      {/* ============================================================== */}
      {viewBillModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#1A1613] rounded-3xl border border-white/20 max-w-lg w-full p-6 space-y-4 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setViewBillModal(null)}
              className="absolute right-4 top-4 text-stone-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center">
              <Printer className="w-8 h-8 text-amber-400 mx-auto mb-1" />
              <h3 className="font-serif font-black text-lg text-white">
                Archived Bill Receipt
              </h3>
              <p className="text-xs text-amber-400 font-mono font-bold">
                Master Bill: {viewBillModal.billNumber}
              </p>
            </div>

            <MultiCustomerReceiptSlip
              data={viewBillModal}
              viewMode={archiveReceiptViewMode}
              setViewMode={setArchiveReceiptViewMode}
            />

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleTriggerBrowserPrint}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Print Thermal Slip</span>
              </button>

              <button
                type="button"
                onClick={() => setViewBillModal(null)}
                className="px-4 py-2.5 bg-stone-800 hover:bg-stone-700 text-white font-bold text-xs rounded-xl cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 3: ADD / EDIT FOOD ITEM MODAL */}
      {/* ============================================================== */}
      {isDishModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#1A1613] rounded-3xl border border-white/20 max-w-md w-full p-6 space-y-5 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setIsDishModalOpen(false)}
              className="absolute right-4 top-4 text-stone-400 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center">
              <ChefHat className="w-9 h-9 text-amber-400 mx-auto mb-1.5" />
              <h3 className="font-serif font-black text-xl text-white">
                {editingDish ? 'Edit Food Item & Rate' : 'Add New Food Item'}
              </h3>
              <p className="text-xs text-stone-400">
                Changes update live across the Waiter POS &amp; Kitchen instantly
              </p>
            </div>

            <form onSubmit={handleSaveDish} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-stone-400 block mb-1">Dish Name</label>
                <input
                  type="text"
                  required
                  value={dishFormData.name}
                  onChange={(e) => setDishFormData({ ...dishFormData, name: e.target.value })}
                  placeholder="e.g. Chicken Briyani & Egg"
                  className="w-full text-sm bg-stone-900 px-3.5 py-2.5 rounded-xl border border-white/10 text-white outline-none focus:border-amber-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-stone-400 block mb-1">Category</label>
                  <input
                    type="text"
                    required
                    list="pos-menu-categories"
                    value={dishFormData.category}
                    onChange={(e) => setDishFormData({ ...dishFormData, category: e.target.value })}
                    placeholder="e.g. Briyani"
                    className="w-full text-sm bg-stone-900 px-3.5 py-2.5 rounded-xl border border-white/10 text-white outline-none focus:border-amber-400"
                  />
                  <datalist id="pos-menu-categories">
                    {categories.map((cat) => (
                      <option key={cat} value={cat} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="text-xs font-bold text-stone-400 block mb-1">Menu Rate (₹)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    step="0.01"
                    value={dishFormData.price}
                    onChange={(e) => setDishFormData({ ...dishFormData, price: e.target.value })}
                    placeholder="120"
                    className="w-full text-sm bg-stone-900 px-3.5 py-2.5 rounded-xl border border-white/10 text-white font-mono outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              {/* Veg / Non-Veg & Stock Status */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setDishFormData({ ...dishFormData, isVeg: !dishFormData.isVeg })}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-2 cursor-pointer ${
                    dishFormData.isVeg
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                  }`}
                >
                  <span className={`w-2.5 h-2.5 rounded-full ${dishFormData.isVeg ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                  <span>{dishFormData.isVeg ? 'Vegetarian' : 'Non-Veg'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDishFormData({ ...dishFormData, available: !dishFormData.available })}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-2 cursor-pointer ${
                    dishFormData.available
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-stone-800 text-stone-400 border-white/10'
                  }`}
                >
                  {dishFormData.available ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  <span>{dishFormData.available ? 'In Stock' : 'Out of Stock'}</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsDishModalOpen(false)}
                  className="py-2.5 bg-stone-800 hover:bg-stone-700 text-white font-bold text-xs rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="py-2.5 bg-gradient-to-r from-amber-500 to-amber-400 hover:brightness-110 text-stone-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-md cursor-pointer"
                >
                  {editingDish ? 'Save Changes' : 'Add to Menu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Print CSS for Thermal 80mm / 58mm Slips */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-thermal-receipt, #printable-thermal-receipt * {
            visibility: visible !important;
          }
          #printable-thermal-receipt {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 80mm !important;
            margin: 0 !important;
            padding: 3mm !important;
            color: #000 !important;
            background: #fff !important;
            font-size: 11px !important;
            line-height: 1.25 !important;
          }
          .thermal-slip-break {
            page-break-after: always !important;
            break-after: page !important;
            margin-bottom: 8mm !important;
            padding-bottom: 4mm !important;
            border-bottom: 2px dashed #000 !important;
          }
        }
      `}</style>
    </div>
  );
}
