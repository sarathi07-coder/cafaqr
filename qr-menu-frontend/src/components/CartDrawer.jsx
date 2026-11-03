import React, { useState } from 'react';
import { X, Trash2, Plus, Minus, Tag, Users, CheckCircle2, AlertCircle, Sparkles, Lock, Unlock, Receipt, ChefHat } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { api } from '../api';
import confetti from 'canvas-confetti';

export default function CartDrawer({ isOpen, onClose, onOrderSuccess }) {
  const {
    tableId,
    tableNumber,
    restaurantId,
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
    appliedCoupon,
    setAppliedCoupon,
    subtotal,
    discountAmount,
    taxAmount,
    grandTotal,
    hasActiveSession,
    activeOrder,
    checkSession,
  } = useCart();

  const [nameInput, setNameInput] = useState(customerName);
  const [phoneInput, setPhoneInput] = useState(customerPhone);
  const [consentCheck, setConsentCheck] = useState(consentGiven);
  
  // Coupon input
  const [couponCode, setCouponCode] = useState('');
  const [couponError, setCouponError] = useState('');
  const [couponSuccess, setCouponSuccess] = useState('');
  
  // Bill split
  const [splitWays, setSplitWays] = useState(2);
  const [splitResult, setSplitResult] = useState(null);

  // Submitting state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRemovingItem, setIsRemovingItem] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const isOrderEditable = Boolean(hasActiveSession && activeOrder && activeOrder.status === 'PENDING');

  // Remove dish from active order (allowed ONLY before preparation starts for that dish)
  const handleRemoveActiveItem = async (itemId) => {
    if (!activeOrder?.id) return;
    const targetItem = (activeOrder.items || []).find((i) => i.id === itemId);
    if (targetItem && targetItem.status && targetItem.status !== 'PENDING') {
      alert(`Cannot remove dish because it is already ${targetItem.status.toLowerCase()}.`);
      return;
    }
    if (!window.confirm('Are you sure you want to remove this dish from your order?')) return;
    setIsRemovingItem(true);
    try {
      await api.removeOrderItem(activeOrder.id, itemId);
      await checkSession(tableId);
    } catch (err) {
      alert(err.message || 'Failed to remove dish');
    } finally {
      setIsRemovingItem(false);
    }
  };

  if (!isOpen) return null;

  const itemsList = Object.values(cartItems);

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
        perPersonShare: baseShare.toFixed(2),
      });
    }
  };

  // Apply Coupon
  const handleApplyCoupon = async (e) => {
    e.preventDefault();
    if (!couponCode.trim()) return;
    setCouponError('');
    setCouponSuccess('');

    // If active order exists, call backend coupon endpoint
    if (activeOrder?.id) {
      try {
        const res = await api.applyCoupon(activeOrder.id, couponCode.trim());
        setAppliedCoupon(res.coupon || { code: couponCode, discount_percentage: 10 });
        setCouponSuccess(`Coupon applied! Saved ₹${res.discount_amount || 0}`);
        checkSession(tableId);
      } catch (err) {
        setCouponError(err.message || 'Invalid or expired coupon');
      }
    } else {
      // Pre-order coupon calculation
      if (couponCode.toUpperCase().includes('10')) {
        setAppliedCoupon({ code: couponCode.toUpperCase(), discount_percentage: 10 });
        setCouponSuccess('10% discount applied to your cart!');
      } else {
        setCouponError('Invalid coupon code. Try FESTIVE10 or DISCOUNT10');
      }
    }
  };

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

    setIsSubmitting(true);
    try {
      if (hasActiveSession && activeOrder?.id) {
        // Add items to existing running bill
        const itemsPayload = itemsList.map((it) => ({
          menu_item_id: it.id,
          quantity: it.quantity,
          unit_price: parseFloat(it.price),
        }));

        await api.addItemsToOrder(activeOrder.id, itemsPayload);
        
        confetti({
          particleCount: 80,
          spread: 60,
          origin: { y: 0.8 },
        });

        clearCart();
        await checkSession(tableId);
        if (onOrderSuccess) onOrderSuccess('Added to your table bill!');
        onClose();
      } else {
        // Create initial table order
        const orderPayload = {
          restaurantId,
          tableId,
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
        
        confetti({
          particleCount: 120,
          spread: 80,
          origin: { y: 0.7 },
        });

        clearCart();
        await checkSession(tableId);
        if (onOrderSuccess) onOrderSuccess(`Order placed! Ticket #${res.order?.id?.slice(0, 8)}`);
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
        className="absolute inset-0 bg-stone-950/60 backdrop-blur-xs transition-opacity animate-fade-in"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col justify-between">
          
          {/* Header */}
          <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between bg-stone-50/80">
            <div>
              <h2 className="font-serif font-bold text-lg text-stone-900 leading-tight">
                {hasActiveSession ? 'Table Bill & Order Summary' : 'Your Table Cart'}
              </h2>
              <p className="text-xs text-stone-500">
                Table #{tableNumber || '1'} &bull; Royal Spice Bistro
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 rounded-full transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            
            {/* Active Table Order Bill Section */}
            {hasActiveSession && activeOrder && (
              <div className="bg-stone-50 rounded-2xl border border-stone-200 p-4 space-y-3 shadow-xs">
                <div className="flex items-center justify-between pb-2 border-b border-stone-200">
                  <div className="flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-emerald-700" />
                    <span className="font-serif font-black text-stone-900 text-sm">
                      Current Active Bill #{activeOrder.id?.slice(0, 8)}
                    </span>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                      activeOrder.status === 'PENDING'
                        ? 'bg-amber-100 text-amber-900 border border-amber-300'
                        : activeOrder.status === 'PREPARING'
                        ? 'bg-blue-100 text-blue-900 border border-blue-300'
                        : activeOrder.status === 'READY'
                        ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                        : 'bg-purple-100 text-purple-900 border border-purple-300'
                    }`}
                  >
                    {activeOrder.status === 'PENDING' ? 'Forwarded to Kitchen' : activeOrder.status}
                  </span>
                </div>

                {/* Editability status banner */}
                <div
                  className={`p-3 rounded-xl text-xs flex items-center justify-between gap-2 ${
                    isOrderEditable
                      ? 'bg-emerald-50 text-emerald-950 border border-emerald-200'
                      : 'bg-stone-100 text-stone-600 border border-stone-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {isOrderEditable ? (
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                    ) : (
                      <Lock className="w-4 h-4 text-stone-500 shrink-0" />
                    )}
                    <span className="font-bold text-xs">
                      {isOrderEditable
                        ? '🟢 Editable (Cooking hasn\'t started): You can cancel or remove dishes before chef begins preparation.'
                        : '🔒 Locked (Cooking in progress): Preparation has begun. Dishes cannot be removed.'}
                    </span>
                  </div>
                </div>

                {/* Dishes currently placed on this bill */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
                      Dishes on Your Active Bill ({activeOrder.items?.length || 0})
                    </p>
                    <span className="text-[10px] text-stone-400 font-medium">
                      {isOrderEditable ? 'Tap Cancel to remove' : 'Locked for cooking'}
                    </span>
                  </div>
                  {(activeOrder.items || []).map((it) => (
                    <div
                      key={it.id}
                      className="flex items-center justify-between text-xs py-2 border-b border-stone-200/60 last:border-0"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="font-black text-stone-900 bg-stone-200 px-2 py-0.5 rounded-md text-xs">
                          {it.quantity}x
                        </span>
                        <div>
                          <span className="font-bold text-stone-900 text-xs block">{it.name || it.item_name}</span>
                          <span className="text-[10px] text-stone-500">₹{parseFloat(it.price_at_order || 0).toFixed(2)} each</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-black text-stone-900 text-xs">
                          ₹{parseFloat(it.line_total || it.price_at_order * it.quantity || 0).toFixed(2)}
                        </span>
                        {it.status === 'SERVED' ? (
                          <span className="text-[10px] text-emerald-800 bg-emerald-50 border border-emerald-300 px-2 py-0.5 rounded-md font-bold flex items-center gap-1 shadow-2xs">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Served</span>
                          </span>
                        ) : it.status === 'READY' ? (
                          <span className="text-[10px] text-sky-800 bg-sky-50 border border-sky-300 px-2 py-0.5 rounded-md font-bold flex items-center gap-1 shadow-2xs">
                            <Sparkles className="w-3 h-3 text-sky-600" />
                            <span>Ready</span>
                          </span>
                        ) : it.status === 'PREPARING' ? (
                          <span className="text-[10px] text-amber-800 bg-amber-50 border border-amber-300 px-2 py-0.5 rounded-md font-bold flex items-center gap-1 shadow-2xs">
                            <Lock className="w-3 h-3 text-amber-600" />
                            <span>Cooking</span>
                          </span>
                        ) : (
                          <button
                            disabled={isRemovingItem}
                            onClick={() => handleRemoveActiveItem(it.id)}
                            className="px-2 py-1 text-rose-600 hover:text-white hover:bg-rose-600 border border-rose-200 hover:border-rose-600 rounded-lg transition flex items-center gap-1 text-[11px] font-bold cursor-pointer disabled:opacity-50"
                            title="Cancel / Remove dish"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Cancel</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Bill Math Breakdown */}
                <div className="pt-2 border-t border-stone-200 space-y-1 text-xs">
                  <div className="flex justify-between text-stone-500">
                    <span>Placed Items Subtotal</span>
                    <span>₹{parseFloat(activeOrder.subtotal || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-stone-500">
                    <span>GST (5%)</span>
                    <span>₹{parseFloat(activeOrder.taxAmount || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-black text-stone-950 text-sm pt-1 border-t border-stone-200/60">
                    <span>Current Active Bill</span>
                    <span className="text-emerald-700">
                      ₹{parseFloat(activeOrder.total || activeOrder.total_amount || 0).toFixed(2)}
                    </span>
                  </div>
                </div>
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
                <div className="py-6 px-4 text-center bg-stone-50 rounded-2xl border border-dashed border-stone-200">
                  <p className="text-xs font-semibold text-stone-700">
                    {hasActiveSession ? 'Want to add extra items to your table?' : 'Your cart is empty'}
                  </p>
                  <p className="text-[11px] text-stone-400 mt-1">
                    {hasActiveSession
                      ? 'Browse the menu and tap "+ Add" on any bread, curry or beverage to add it to your table bill.'
                      : 'Tap "+ Add" on any dish from the menu to start.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {itemsList.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-stone-50 border border-stone-200/60"
                    >
                      <div className="flex-1 pr-3">
                        <p className="font-bold text-stone-900 text-sm leading-tight">{item.name}</p>
                        <p className="text-xs text-stone-500 mt-0.5">
                          ₹{parseFloat(item.price).toFixed(2)} each
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="inline-flex items-center bg-white rounded-lg border border-stone-200 shadow-2xs">
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            className="w-7 h-7 flex items-center justify-center text-stone-700 hover:bg-stone-100"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-6 text-center text-xs font-bold text-stone-900">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            className="w-7 h-7 flex items-center justify-center text-stone-700 hover:bg-stone-100"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        <span className="font-bold text-sm text-stone-900 w-16 text-right">
                          ₹{(parseFloat(item.price) * item.quantity).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Special Instructions */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-400 mb-1.5">
                Cooking Notes for Chef
              </label>
              <textarea
                value={cookingNotes}
                onChange={(e) => setCookingNotes(e.target.value)}
                placeholder="E.g. Less spicy, keep sauce on the side, allergies..."
                rows={2}
                className="w-full text-xs p-3 rounded-xl border border-stone-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none"
              />
            </div>

            {/* Diner Info & GDPR for New Sessions */}
            {!hasActiveSession && (
              <div className="p-4 rounded-xl bg-amber-50/50 border border-amber-200/60 space-y-3">
                <p className="text-xs font-bold text-amber-950 uppercase tracking-wider">
                  Diner Details
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <input
                      type="text"
                      placeholder="Your Name"
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      className="w-full text-xs p-2.5 rounded-lg border border-stone-200 bg-white outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <input
                      type="tel"
                      placeholder="Mobile Phone"
                      value={phoneInput}
                      onChange={(e) => setPhoneInput(e.target.value)}
                      className="w-full text-xs p-2.5 rounded-lg border border-stone-200 bg-white outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                {/* GDPR Consent */}
                <label className="flex items-start gap-2 text-[11px] text-stone-600 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={consentCheck}
                    onChange={(e) => setConsentCheck(e.target.checked)}
                    className="mt-0.5 rounded text-amber-600 focus:ring-amber-500"
                  />
                  <span>
                    I consent to storing my phone number for table order updates & receipt (GDPR compliant).
                  </span>
                </label>
              </div>
            )}

            {/* Promo Coupon */}
            <div>
              <form onSubmit={handleApplyCoupon} className="flex gap-2">
                <div className="relative flex-1">
                  <Tag className="w-4 h-4 absolute left-3 top-2.5 text-stone-400" />
                  <input
                    type="text"
                    placeholder="Enter Coupon (e.g. FESTIVE10)"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    className="w-full text-xs pl-9 pr-3 py-2 rounded-xl border border-stone-200 uppercase font-semibold focus:border-amber-500 outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold rounded-xl transition"
                >
                  Apply
                </button>
              </form>
              {couponError && <p className="text-[11px] text-rose-600 mt-1">{couponError}</p>}
              {couponSuccess && <p className="text-[11px] text-emerald-600 mt-1 font-semibold">{couponSuccess}</p>}
            </div>

            {/* Smart Bill Splitting Preview */}
            <div className="pt-2 border-t border-stone-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-stone-700 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-amber-600" />
                  Split Bill Calculator
                </span>
                <div className="flex gap-1">
                  {[2, 3, 4].map((n) => (
                    <button
                      key={n}
                      onClick={() => handleCalculateSplit(n)}
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-md transition ${
                        splitWays === n
                          ? 'bg-amber-600 text-white'
                          : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                      }`}
                    >
                      {n} Ways
                    </button>
                  ))}
                </div>
              </div>
              {splitResult && (
                <div className="bg-stone-50 rounded-lg p-2.5 text-xs flex justify-between items-center border border-stone-200">
                  <span className="text-stone-600">Per person share ({splitWays} diners):</span>
                  <span className="font-bold text-stone-900 text-sm">
                    ₹{splitResult.perPersonShare} each
                  </span>
                </div>
              )}
            </div>

            {/* Error message */}
            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs text-rose-700">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{errorMsg}</span>
              </div>
            )}
          </div>

          {/* Footer & Checkout */}
          <div className="p-5 border-t border-stone-200 bg-stone-50 space-y-3">
            {/* Price Breakdown */}
            {hasActiveSession && itemsList.length === 0 ? (
              <div className="space-y-1.5 text-xs text-stone-600">
                <div className="flex justify-between">
                  <span>Current Placed Subtotal</span>
                  <span className="font-semibold text-stone-900">
                    ₹{parseFloat(activeOrder?.subtotal || 0).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>5% GST Tax</span>
                  <span className="font-semibold text-stone-900">
                    ₹{parseFloat(activeOrder?.taxAmount || 0).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-base font-black text-stone-950 pt-2 border-t border-stone-200">
                  <span>Current Active Bill Total</span>
                  <span className="text-emerald-700">
                    ₹{parseFloat(activeOrder?.total || activeOrder?.total_amount || 0).toFixed(2)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5 text-xs text-stone-600">
                {hasActiveSession && activeOrder && (
                  <div className="flex justify-between text-stone-500 pb-1 border-b border-stone-200/50">
                    <span>Already Placed Bill</span>
                    <span className="font-medium text-stone-800">
                      ₹{parseFloat(activeOrder.total || 0).toFixed(2)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>{hasActiveSession ? 'New Additions Subtotal' : 'Food Subtotal'}</span>
                  <span className="font-semibold text-stone-900">₹{subtotal.toFixed(2)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-600 font-semibold">
                    <span>Coupon Discount</span>
                    <span>-₹{discountAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>GST Tax (5%)</span>
                  <span className="font-semibold text-stone-900">₹{taxAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-base font-black text-stone-950 pt-2 border-t border-stone-200">
                  <span>{hasActiveSession ? 'Combined Table Total' : 'Grand Total'}</span>
                  <span className="text-emerald-700">
                    ₹{(hasActiveSession && activeOrder ? parseFloat(activeOrder.total || 0) + grandTotal : grandTotal).toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            {/* CTA Buttons */}
            {hasActiveSession && itemsList.length === 0 ? (
              <button
                onClick={onClose}
                className="w-full py-3.5 bg-stone-900 hover:bg-stone-800 text-white font-black text-xs uppercase tracking-wider rounded-xl transition shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>+ Browse Menu to Add More Dishes</span>
              </button>
            ) : (
              <button
                disabled={isSubmitting || itemsList.length === 0}
                onClick={handlePlaceOrder}
                className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 disabled:bg-stone-300 disabled:cursor-not-allowed text-stone-950 font-black text-sm rounded-xl transition-all shadow-md shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                {isSubmitting ? (
                  <span>Sending to Kitchen...</span>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>
                      {hasActiveSession
                        ? `Add ${itemsList.length} Item${itemsList.length > 1 ? 's' : ''} to Table Order`
                        : 'Confirm & Place Order'}
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
