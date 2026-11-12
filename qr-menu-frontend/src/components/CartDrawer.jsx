import React, { useState } from 'react';
import { X, Trash2, Plus, Minus, Users, CheckCircle2, AlertCircle, Sparkles, Lock, Unlock, Receipt, ChefHat, Smartphone, Volume2 } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { api } from '../api';
import { unlockOrderAudio, playOrderConfirmationSound } from '../utils/sound';
import { isParcelTable } from '../utils/tableDisplay';

const triggerConfetti = async (opts) => {
  try {
    const { default: confetti } = await import('canvas-confetti');
    confetti(opts);
  } catch (err) {
    console.warn('Confetti animation skipped', err);
  }
};

export default function CartDrawer({ isOpen, onClose, onOrderSuccess, onOpenUpiModal }) {
  const {
    tableId,
    tableNumber,
    restaurantId,
    sessionToken,
    customerName,
    customerPhone,
    consentGiven,
    updateCustomerInfo,
    cartItems,
    updateQuantity,
    removeItem,
    clearCart,
    cookingNotes,
    setCookingNotes,
    subtotal,
    discountAmount,
    grandTotal,
    dietaryStats,
    hasActiveSession,
    activeOrder,
    checkSession,
  } = useCart();

  const [nameInput, setNameInput] = useState(customerName || '');
  const [phoneInput, setPhoneInput] = useState(customerPhone || '');
  const [consentCheck, setConsentCheck] = useState(Boolean(consentGiven));

  React.useEffect(() => {
    if (customerName) setNameInput(customerName);
    if (customerPhone) setPhoneInput(customerPhone);
    if (consentGiven !== undefined) setConsentCheck(Boolean(consentGiven));
  }, [customerName, customerPhone, consentGiven]);
  
  // Bill split
  const [splitWays, setSplitWays] = useState(2);
  const [splitResult, setSplitResult] = useState(null);

  // Submitting state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRemovingItem, setIsRemovingItem] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const itemsList = Object.values(cartItems || {});

  // Active table order dietary calculation (Always called at top level for consistent hook counts)
  const activeDietaryStats = React.useMemo(() => {
    if (!activeOrder?.items || !Array.isArray(activeOrder.items)) return { vegCount: 0, nonVegCount: 0, vegTotal: 0, nonVegTotal: 0 };
    let vegCount = 0;
    let nonVegCount = 0;
    let vegTotal = 0;
    let nonVegTotal = 0;

    activeOrder.items.forEach((it) => {
      if (!it) return;
      const name = it.name || it.item_name || '';
      const isVeg = it.is_veg !== undefined
        ? Boolean(it.is_veg)
        : !(name.toLowerCase().includes('chicken') ||
            name.toLowerCase().includes('mutton') ||
            name.toLowerCase().includes('fish') ||
            name.toLowerCase().includes('meat') ||
            name.toLowerCase().includes('egg') ||
            name.toLowerCase().includes('prawn'));
      const qty = Number(it.quantity) || 1;
      const lineTotal = parseFloat(it.line_total || ((it.price_at_order || it.price || 0) * qty) || 0);
      if (isVeg) {
        vegCount += qty;
        vegTotal += lineTotal;
      } else {
        nonVegCount += qty;
        nonVegTotal += lineTotal;
      }
    });

    return { vegCount, nonVegCount, vegTotal, nonVegTotal };
  }, [activeOrder]);

  const isOrderEditable = Boolean(
    hasActiveSession &&
      activeOrder &&
      ((Array.isArray(activeOrder.orders) && activeOrder.orders.some((o) => o.status === 'PENDING')) ||
        activeOrder.status === 'PENDING')
  );

  // Remove dish from active order (allowed ONLY before preparation starts for that dish's order)
  const handleRemoveActiveItem = async (itemId, itemOrderId) => {
    const targetOrderId = itemOrderId || activeOrder?.id;
    if (!targetOrderId) return;
    const targetItem = (activeOrder.items || []).find((i) => i.id === itemId);
    const parentStatus = targetItem?.order_status || activeOrder.status;
    if (parentStatus && parentStatus !== 'PENDING') {
      alert(`Cannot remove dish because kitchen is already ${parentStatus.toLowerCase()}.`);
      return;
    }
    if (targetItem && targetItem.status && targetItem.status !== 'PENDING') {
      alert(`Cannot remove dish because it is already ${targetItem.status.toLowerCase()}.`);
      return;
    }
    if (!window.confirm('Are you sure you want to remove this dish from your order?')) return;
    setIsRemovingItem(true);
    try {
      await api.removeOrderItem(targetOrderId, itemId);
      await checkSession(tableId);
    } catch (err) {
      alert(err.message || 'Failed to remove dish');
    } finally {
      setIsRemovingItem(false);
    }
  };

  // Calculate bill split on the fly
  const handleCalculateSplit = async (ways) => {
    setSplitWays(ways);
    if (activeOrder?.id) {
      try {
        const split = await api.getBillSplit(activeOrder.id, ways);
        setSplitResult(split);
      } catch (err) {
        console.warn('Split error:', err.message);
      }
    } else {
      // Local estimation
      const baseShare = Math.floor((grandTotal / ways) * 100) / 100;
      setSplitResult({
        totalAmount: grandTotal,
        splitWays: ways,
        perPersonShare: parseFloat(baseShare || 0).toFixed(2),
      });
    }
  };

  if (!isOpen) return null;

  // Place Order or Add Items to existing tab
  const handlePlaceOrder = async () => {
    setErrorMsg('');

    // Validate GDPR & info for new sessions
    if (!hasActiveSession) {
      if (!nameInput.trim()) {
        setErrorMsg('Please enter your name.');
        return;
      }
      if (!phoneInput.trim()) {
        setErrorMsg('Please enter your phone number.');
        return;
      }
      if (!consentCheck) {
        setErrorMsg('GDPR consent is required to place your table order.');
        return;
      }
      updateCustomerInfo(nameInput.trim(), phoneInput.trim(), consentCheck);
    }

    if (itemsList.length === 0) {
      setErrorMsg('Your cart is empty.');
      return;
    }

    // Unlock audio within the user click gesture before async order request
    unlockOrderAudio();

    setIsSubmitting(true);
    try {
      if (hasActiveSession && activeOrder?.id) {
        // Add items to existing running bill
        const itemsPayload = itemsList.map((it) => ({
          menu_item_id: it.id,
          quantity: it.quantity,
          unit_price: parseFloat(it.price),
        }));

        const addRes = await api.addItemsToOrder(activeOrder.id, itemsPayload);

        playOrderConfirmationSound(true);
        triggerConfetti({
          particleCount: 80,
          spread: 60,
          origin: { y: 0.8 },
        });

        clearCart();
        await checkSession(tableId);
        if (onOrderSuccess) {
          const isParcel = isParcelTable(tableNumber);
          onOrderSuccess(
            addRes?.isNewTicket
              ? `New ${isParcel ? 'parcel ' : ''}order sent to kitchen! Ticket #${String(addRes.orderId || '').slice(0, 6)}`
              : isParcel
              ? 'Added to your parcel order & sent to kitchen!'
              : 'Added to your table bill & sent to kitchen!'
          );
        }
        onClose();
      } else {
        // Create initial table order
        const orderPayload = {
          restaurantId,
          tableId,
          sessionToken: sessionToken || null,
          customer: {
            name: nameInput.trim(),
            phone: phoneInput.trim(),
            consentGiven: consentCheck,
          },
          notes: cookingNotes,
          items: itemsList.map((it) => ({
            menuItemId: it.id,
            quantity: it.quantity,
          })),
        };

        const res = await api.createOrder(orderPayload);

        playOrderConfirmationSound(false);
        triggerConfetti({
          particleCount: 120,
          spread: 80,
          origin: { y: 0.7 },
        });

        clearCart();
        await checkSession(tableId);
        if (onOrderSuccess) onOrderSuccess(`Order placed & sent to kitchen! Ticket #${res.order?.id?.slice(0, 8)}`);
        onClose();
      }
    } catch (err) {
      setErrorMsg(err.message || 'Failed to submit order');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-stone-950/75 backdrop-blur-sm transition-opacity animate-fade-in"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-0 sm:pl-10">
        <div className="w-screen max-w-md bg-[#0E0C0A] border-l border-white/10 shadow-2xl flex flex-col justify-between text-stone-100">
          
          {/* Header */}
          <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between bg-[#15120E]/90 backdrop-blur-md">
            <div>
              <h2 className="font-bold text-lg text-white leading-tight flex items-center gap-2">
                <span>
                  {isParcelTable(tableNumber)
                    ? (hasActiveSession ? 'Parcel Bill & Order Summary' : 'Your Parcel / Takeaway Cart')
                    : (hasActiveSession ? 'Table Bill & Order Summary' : 'Your Table Cart')}
                </span>
              </h2>
              <p className="text-xs text-amber-300/80 font-medium mt-0.5">
                {isParcelTable(tableNumber) ? '🛍️ Parcel / Takeaway' : `Table #${tableNumber || '1'}`} &bull; KRISH Cafe &amp; Restaurant
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => playOrderConfirmationSound(hasActiveSession)}
                className="p-2 text-amber-300/80 hover:text-amber-300 hover:bg-amber-500/10 rounded-full transition cursor-pointer"
                title="Test Order Confirmation Sound"
              >
                <Volume2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-2 text-stone-400 hover:text-white hover:bg-white/10 rounded-full transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            
            {/* Active Table Order Bill Section */}
            {hasActiveSession && activeOrder && (
              <div className="krish-glass-card rounded-2xl border border-white/15 p-4 space-y-3 shadow-lg">
                <div className="flex items-center justify-between pb-2 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-emerald-400" />
                    <span className="font-black text-white text-sm">
                      Current Active Bill #{String(activeOrder?.id || '').slice(0, 8)}
                    </span>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                      activeOrder.status === 'PENDING'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : activeOrder.status === 'PREPARING'
                        ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                        : activeOrder.status === 'READY'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                    }`}
                  >
                    {activeOrder.status === 'PENDING' ? 'Forwarded to Kitchen' : activeOrder.status}
                  </span>
                </div>

                {/* Editability status banner */}
                <div
                  className={`p-3 rounded-xl text-xs flex items-center justify-between gap-2 ${
                    isOrderEditable
                      ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                      : 'bg-stone-900 text-stone-400 border border-white/10'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {isOrderEditable ? (
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0"></span>
                    ) : (
                      <Lock className="w-4 h-4 text-stone-500 shrink-0" />
                    )}
                    <span className="font-bold text-xs">
                      {isOrderEditable
                        ? ((activeOrder.items || []).some((it) => it.status && it.status !== 'PENDING')
                          ? '🆕 Extra items sent to kitchen — Previously served dishes stay served; you can cancel new items before cooking starts.'
                          : '🟢 Editable (Cooking hasn\'t started): You can cancel or remove dishes before chef begins preparation.')
                        : (activeOrder.status === 'SERVED'
                          ? '🍽️ All dishes served! You can add extra dishes anytime or settle your bill.'
                          : '🔒 Locked (Cooking in progress): Preparation has begun. Dishes cannot be removed.')}
                    </span>
                  </div>
                </div>

                {/* Dishes currently placed on this bill */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-amber-300/80">
                      Dishes on Your Active Bill ({activeOrder.items?.length || 0})
                    </p>
                    <span className="text-[10px] text-stone-400 font-medium">
                      {isOrderEditable ? 'Tap Cancel to remove' : 'Locked for cooking'}
                    </span>
                  </div>
                  {(activeOrder.items || []).map((it) => {
                    const itemName = it.name || it.item_name || '';
                    const itIsVeg = it.is_veg !== undefined
                      ? Boolean(it.is_veg)
                      : !(itemName.toLowerCase().includes('chicken') ||
                          itemName.toLowerCase().includes('mutton') ||
                          itemName.toLowerCase().includes('fish') ||
                          itemName.toLowerCase().includes('meat') ||
                          itemName.toLowerCase().includes('egg') ||
                          itemName.toLowerCase().includes('prawn'));

                    return (
                      <div
                        key={it.id}
                        className="flex items-center justify-between text-xs py-2 border-b border-white/5 last:border-0"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-black text-amber-300 bg-white/10 px-2 py-0.5 rounded-md text-xs shrink-0 font-mono">
                            {it.quantity}x
                          </span>
                          <div className={`w-3 h-3 border flex items-center justify-center shrink-0 rounded-2xs ${itIsVeg ? 'border-emerald-500' : 'border-rose-500'}`}>
                            <div className={`w-1 h-1 rounded-full ${itIsVeg ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                          </div>
                          <div className="min-w-0">
                            <span className="font-bold text-white text-xs block truncate">{itemName}</span>
                            <span className="text-[10px] text-stone-400 font-mono">
                              ₹{parseFloat(it.price_at_order || 0).toFixed(2)} each
                              {(activeOrder.orders?.length || 0) > 1 && it.order_id ? ` • #${String(it.order_id).slice(0, 6)}` : ''}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="font-black text-amber-400 text-xs font-mono">
                            ₹{parseFloat(it.line_total || it.price_at_order * it.quantity || 0).toFixed(2)}
                          </span>
                          {it.status === 'SERVED' ? (
                            <span className="text-[10px] text-emerald-300 bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 rounded-md font-bold flex items-center gap-1 shadow-2xs">
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                              <span>Served</span>
                            </span>
                          ) : it.status === 'READY' ? (
                            <span className="text-[10px] text-sky-300 bg-sky-500/20 border border-sky-500/40 px-2 py-0.5 rounded-md font-bold flex items-center gap-1 shadow-2xs">
                              <Sparkles className="w-3 h-3 text-sky-400" />
                              <span>Ready</span>
                            </span>
                          ) : it.status === 'PREPARING' ? (
                            <span className="text-[10px] text-amber-300 bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 rounded-md font-bold flex items-center gap-1 shadow-2xs">
                              <Lock className="w-3 h-3 text-amber-400" />
                              <span>Cooking</span>
                            </span>
                          ) : (
                            <button
                              type="button"
                              disabled={isRemovingItem}
                              onClick={() => handleRemoveActiveItem(it.id, it.order_id)}
                              className="px-2 py-1 text-rose-400 hover:text-white hover:bg-rose-600 border border-rose-500/30 hover:border-rose-600 rounded-lg transition flex items-center gap-1 text-[11px] font-bold cursor-pointer disabled:opacity-50"
                              title="Cancel / Remove dish"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Cancel</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Bill Math Breakdown */}
                <div className="pt-2 border-t border-white/10 space-y-1 text-xs font-mono">
                  <div className="flex justify-between text-stone-400">
                    <span>Placed Items Subtotal</span>
                    <span>₹{parseFloat(activeOrder.subtotal || 0).toFixed(2)}</span>
                  </div>
                  {(activeDietaryStats?.vegCount > 0 || activeDietaryStats?.nonVegCount > 0) && (
                    <div className="flex justify-between text-stone-400 text-[11px]">
                      <span>Dietary Split</span>
                      <span className="font-semibold text-stone-300">
                        {activeDietaryStats.vegCount > 0 ? `${activeDietaryStats.vegCount} Veg (₹${parseFloat(activeDietaryStats?.vegTotal || 0).toFixed(0)})` : ''}
                        {activeDietaryStats.vegCount > 0 && activeDietaryStats.nonVegCount > 0 ? ' • ' : ''}
                        {activeDietaryStats.nonVegCount > 0 ? `${activeDietaryStats.nonVegCount} Non-Veg (₹${parseFloat(activeDietaryStats?.nonVegTotal || 0).toFixed(0)})` : ''}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between font-black text-white text-sm pt-1 border-t border-white/10">
                    <span>Current Active Bill</span>
                    <span className="text-emerald-400">
                      ₹{parseFloat(activeOrder?.total || activeOrder?.total_amount || 0).toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Instant UPI Payment Button */}
                {onOpenUpiModal && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenUpiModal({
                        amount: parseFloat(activeOrder?.total || activeOrder?.total_amount || 0),
                        orderId: activeOrder?.id,
                        tableNumber
                      });
                    }}
                    className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:brightness-110 active:scale-98 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition shadow-[0_4px_16px_rgba(16,185,129,0.3)] flex items-center justify-center gap-2 cursor-pointer mt-1"
                  >
                    <Smartphone className="w-4 h-4" />
                    <span>Pay Bill via UPI (Dynamic QR / Apps)</span>
                  </button>
                )}
              </div>
            )}

            {/* Cart Items List - New additions */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-stone-400">
                  {hasActiveSession ? 'Add Extra Dishes to This Bill' : 'Selected Items'} ({itemsList.length})
                </span>
                {itemsList.length > 0 && (
                  <button
                    onClick={clearCart}
                    className="text-xs text-rose-600 hover:underline flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" /> Clear selection
                  </button>
                )}
              </div>

              {itemsList.length === 0 ? (
                <div className="py-6 px-4 text-center bg-stone-900/60 rounded-2xl border border-dashed border-white/10">
                  <p className="text-xs font-semibold text-stone-300">
                    {hasActiveSession ? 'Want to add extra items to your table?' : 'Your cart is empty'}
                  </p>
                  <p className="text-[11px] text-stone-400 mt-1">
                    {hasActiveSession
                      ? 'Browse the menu and tap "+ Add" on any mojito, briyani or fries to add it to your table bill.'
                      : 'Tap "+ Add" on any dish from the menu to start.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {itemsList.map((item) => {
                    const itemIsVeg = item.is_veg !== undefined
                      ? Boolean(item.is_veg)
                      : !(item.name?.toLowerCase().includes('chicken') ||
                          item.name?.toLowerCase().includes('mutton') ||
                          item.name?.toLowerCase().includes('fish') ||
                          item.name?.toLowerCase().includes('meat') ||
                          item.name?.toLowerCase().includes('egg') ||
                          item.name?.toLowerCase().includes('prawn'));

                    return (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-3 rounded-xl bg-stone-900/80 border border-white/10"
                      >
                        <div className="flex-1 pr-3 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <div className={`w-3 h-3 border flex items-center justify-center shrink-0 rounded-2xs ${itemIsVeg ? 'border-emerald-500' : 'border-rose-500'}`}>
                              <div className={`w-1 h-1 rounded-full ${itemIsVeg ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                            </div>
                            <p className="font-bold text-white text-sm leading-tight truncate">{item.name}</p>
                          </div>
                          <p className="text-xs text-stone-400 mt-1 pl-4.5 font-mono">
                            ₹{parseFloat(item.price).toFixed(2)} each &bull; <span className={itemIsVeg ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>{itemIsVeg ? 'Veg' : 'Non-Veg'}</span>
                          </p>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <div className="inline-flex items-center bg-stone-950 rounded-lg border border-white/15 shadow-2xs">
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.id, item.quantity - 1)}
                              className="w-7 h-7 flex items-center justify-center text-stone-300 hover:text-white hover:bg-stone-800 rounded-l-lg transition"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="w-6 text-center text-xs font-bold text-amber-300 font-mono">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.id, item.quantity + 1)}
                              className="w-7 h-7 flex items-center justify-center text-stone-300 hover:text-white hover:bg-stone-800 rounded-r-lg transition"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>

                          <span className="font-black text-sm text-amber-400 w-16 text-right font-mono">
                            ₹{(parseFloat(item.price) * item.quantity).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    );
                  })}

                  {/* Dietary Calculation Summary Box */}
                  {itemsList.length > 0 && (
                    <div className="p-3 bg-stone-900/90 rounded-2xl border border-white/10 shadow-2xs space-y-2.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-stone-200 uppercase tracking-wider text-[11px]">
                          Dietary Breakdown & Calculation
                        </span>
                        <span className="text-[10px] text-stone-400 font-semibold">
                          {(dietaryStats?.vegCount || 0) + (dietaryStats?.nonVegCount || 0)} items total
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        {/* Veg Calculation Card */}
                        <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                          <div className="flex items-center gap-1.5 mb-1">
                            <div className="w-3 h-3 border border-emerald-500 flex items-center justify-center rounded-2xs">
                              <div className="w-1 h-1 rounded-full bg-emerald-500"></div>
                            </div>
                            <span className="text-xs font-bold text-emerald-300">Pure Veg</span>
                          </div>
                          <p className="text-base font-black text-emerald-400 font-mono">
                            ₹{parseFloat(dietaryStats?.vegSubtotal || dietaryStats?.vegTotal || 0).toFixed(2)}
                          </p>
                          <p className="text-[10px] text-emerald-400/80 font-medium">
                            {dietaryStats?.vegCount || 0} {dietaryStats?.vegCount === 1 ? 'portion' : 'portions'}
                          </p>
                        </div>

                        {/* Non-Veg Calculation Card */}
                        <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30">
                          <div className="flex items-center gap-1.5 mb-1">
                            <div className="w-3 h-3 border border-rose-500 flex items-center justify-center rounded-2xs">
                              <div className="w-1 h-1 rounded-full bg-rose-500"></div>
                            </div>
                            <span className="text-xs font-bold text-rose-300">Non-Veg</span>
                          </div>
                          <p className="text-base font-black text-rose-400 font-mono">
                            ₹{parseFloat(dietaryStats?.nonVegSubtotal || dietaryStats?.nonVegTotal || 0).toFixed(2)}
                          </p>
                          <p className="text-[10px] text-rose-400/80 font-medium">
                            {dietaryStats?.nonVegCount || 0} {dietaryStats?.nonVegCount === 1 ? 'portion' : 'portions'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Special Instructions */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-amber-300/80 mb-1.5">
                Cooking Notes for Chef
              </label>
              <textarea
                value={cookingNotes}
                onChange={(e) => setCookingNotes(e.target.value)}
                placeholder="E.g. Less spicy, keep sauce on the side, allergies..."
                rows={2}
                className="w-full text-xs p-3 rounded-xl border border-white/15 bg-stone-900/90 text-white placeholder-stone-500 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 outline-none"
              />
            </div>

            {/* Diner Info & GDPR for New Sessions */}
            {!hasActiveSession && (
              <div className="p-4 rounded-xl krish-glass-gold space-y-3">
                <p className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                  Diner Details
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <input
                      type="text"
                      placeholder="Your Name"
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      className="w-full text-xs p-2.5 rounded-lg border border-white/15 bg-stone-900 text-white placeholder-stone-500 outline-none focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <input
                      type="tel"
                      placeholder="Mobile Phone"
                      value={phoneInput}
                      onChange={(e) => setPhoneInput(e.target.value)}
                      className="w-full text-xs p-2.5 rounded-lg border border-white/15 bg-stone-900 text-white placeholder-stone-500 outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                {/* GDPR Consent */}
                <label className="flex items-start gap-2 text-[11px] text-stone-300 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={consentCheck}
                    onChange={(e) => setConsentCheck(e.target.checked)}
                    className="mt-0.5 rounded text-amber-500 focus:ring-amber-400"
                  />
                  <span>
                    I consent to storing my phone number for table order updates & receipt (GDPR compliant).
                  </span>
                </label>
              </div>
            )}

            {/* Smart Bill Splitting Preview */}
            <div className="pt-2 border-t border-white/10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-stone-300 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-amber-400" />
                  Split Bill Calculator
                </span>
                <div className="flex gap-1">
                  {[2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => handleCalculateSplit(n)}
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-md transition ${
                        splitWays === n
                          ? 'krish-gradient-gold text-stone-950 font-black'
                          : 'bg-stone-900 text-stone-400 hover:text-white border border-white/10'
                      }`}
                    >
                      {n} Ways
                    </button>
                  ))}
                </div>
              </div>
              {splitResult && (
                <div className="bg-stone-900/90 rounded-lg p-2.5 text-xs flex justify-between items-center border border-white/10 font-mono">
                  <span className="text-stone-400 font-sans">Per person share ({splitWays} diners):</span>
                  <span className="font-black text-amber-400 text-sm">
                    ₹{splitResult.perPersonShare} each
                  </span>
                </div>
              )}
            </div>

            {/* Error message */}
            {errorMsg && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-2 text-xs text-rose-300">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{errorMsg}</span>
              </div>
            )}
          </div>

          {/* Footer & Checkout */}
          <div className="p-5 border-t border-white/10 bg-[#15120E]/95 backdrop-blur-md space-y-3 font-mono">
            {/* Price Breakdown */}
            {hasActiveSession && itemsList.length === 0 ? (
              <div className="space-y-1.5 text-xs text-stone-400">
                <div className="flex justify-between">
                  <span>Current Placed Subtotal</span>
                  <span className="font-semibold text-white">
                    ₹{parseFloat(activeOrder?.subtotal || 0).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-base font-black text-white pt-2 border-t border-white/10 font-mono">
                  <span>Current Active Bill Total</span>
                  <span className="text-emerald-400">
                    ₹{parseFloat(activeOrder?.total || activeOrder?.total_amount || 0).toFixed(2)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5 text-xs text-stone-400">
                {hasActiveSession && activeOrder && (
                  <div className="flex justify-between text-stone-500 pb-1 border-b border-white/5">
                    <span>Already Placed Bill</span>
                    <span className="font-medium text-stone-300 font-mono">
                      ₹{parseFloat(activeOrder?.total || activeOrder?.total_amount || 0).toFixed(2)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>{hasActiveSession ? 'New Additions Subtotal' : 'Food Subtotal'}</span>
                  <span className="font-semibold text-white font-mono">₹{parseFloat(subtotal || 0).toFixed(2)}</span>
                </div>
                {(dietaryStats?.vegCount > 0 || dietaryStats?.nonVegCount > 0) && (
                  <div className="flex justify-between text-[11px] text-stone-500">
                    <span>Dietary Calculation</span>
                    <span className="font-medium text-stone-300">
                      {dietaryStats.vegCount > 0 ? `${dietaryStats.vegCount} Veg (₹${parseFloat(dietaryStats?.vegSubtotal || dietaryStats?.vegTotal || 0).toFixed(0)})` : ''}
                      {dietaryStats.vegCount > 0 && dietaryStats.nonVegCount > 0 ? ' • ' : ''}
                      {dietaryStats.nonVegCount > 0 ? `${dietaryStats.nonVegCount} Non-Veg (₹${parseFloat(dietaryStats?.nonVegSubtotal || dietaryStats?.nonVegTotal || 0).toFixed(0)})` : ''}
                    </span>
                  </div>
                )}
                {discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-400 font-semibold font-mono">
                    <span>Coupon Discount</span>
                    <span>-₹{parseFloat(discountAmount || 0).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-black text-white pt-2 border-t border-white/10 font-mono">
                  <span>{hasActiveSession ? 'Combined Table Total' : 'Grand Total'}</span>
                  <span className="text-emerald-400">
                    ₹{(hasActiveSession && activeOrder ? parseFloat(activeOrder?.total || 0) + parseFloat(grandTotal || 0) : parseFloat(grandTotal || 0)).toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            {/* CTA Buttons */}
            {hasActiveSession && itemsList.length === 0 ? (
              <div className="space-y-2">
                {onOpenUpiModal && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenUpiModal({
                        amount: parseFloat(activeOrder?.total || activeOrder?.total_amount || 0),
                        orderId: activeOrder?.id,
                        tableNumber
                      });
                    }}
                    className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:brightness-110 active:scale-98 text-white font-black text-xs uppercase tracking-wider rounded-xl transition shadow-[0_4px_16px_rgba(16,185,129,0.3)] flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Smartphone className="w-4 h-4" />
                    <span>⚡ Pay Bill via Dynamic UPI (QR & Apps)</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full py-3 bg-stone-900 hover:bg-stone-800 text-white font-black text-xs uppercase tracking-wider rounded-xl transition border border-white/10 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>+ Browse Menu to Add More Dishes</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={isSubmitting || itemsList.length === 0}
                onClick={handlePlaceOrder}
                className="w-full py-3.5 krish-gradient-gold hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed text-stone-950 font-black text-sm rounded-xl transition-all shadow-[0_4px_20px_rgba(255,196,0,0.4)] flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                {isSubmitting ? (
                  <span>Sending to Kitchen...</span>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 stroke-[2.5]" />
                    <span>
                      {hasActiveSession
                        ? `Add ${itemsList.length} Item${itemsList.length > 1 ? 's' : ''} to ${isParcelTable(tableNumber) ? 'Parcel' : 'Table'} Order`
                        : (isParcelTable(tableNumber) ? 'Confirm & Place Parcel Order' : 'Confirm & Place Order')}
                    </span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
