import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { api } from '../api';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [tableId, setTableId] = useState('');
  const [tableNumber, setTableNumber] = useState('');
  const [restaurantId, setRestaurantId] = useState('');
  
  // Customer & Session state
  const [customerName, setCustomerName] = useState(localStorage.getItem('qr_customer_name') || '');
  const [customerPhone, setCustomerPhone] = useState(localStorage.getItem('qr_customer_phone') || '');
  const [consentGiven, setConsentGiven] = useState(localStorage.getItem('qr_consent_given') === 'true');
  const [hasActiveSession, setHasActiveSession] = useState(false);
  const [activeOrder, setActiveOrder] = useState(null);

  // Cart state
  const [cartItems, setCartItems] = useState({});
  const [cookingNotes, setCookingNotes] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [isLoadingSession, setIsLoadingSession] = useState(false);

  // Save customer info in localStorage for repeat convenience
  const updateCustomerInfo = (name, phone, consent) => {
    setCustomerName(name);
    setCustomerPhone(phone);
    setConsentGiven(consent);
    if (name) localStorage.setItem('qr_customer_name', name);
    if (phone) localStorage.setItem('qr_customer_phone', phone);
    localStorage.setItem('qr_consent_given', String(consent));
  };

  // Check active table session
  const checkSession = async (tblId) => {
    if (!tblId) return;
    setIsLoadingSession(true);
    try {
      const data = await api.getTableSession(tblId);
      setHasActiveSession(Boolean(data.hasActiveSession));
      if (data.hasActiveSession) {
        const orderData = data.order || {
          id: data.orderId || data.id,
          orderId: data.orderId || data.id,
          status: data.status,
          total: data.total || data.total_amount,
          total_amount: data.total || data.total_amount,
          subtotal: data.subtotal,
          taxAmount: data.taxAmount,
          currency: data.currency || '₹',
          notes: data.notes,
          customer_name: data.customer?.name || data.customer_name,
          customer_phone: data.customer?.phone || data.customer_phone,
          customer: data.customer || {
            name: data.customer_name,
            phone: data.customer_phone,
          },
          items: data.items || [],
        };
        setActiveOrder(orderData);
        const custName = orderData.customer?.name || orderData.customer_name;
        const custPhone = orderData.customer?.phone || orderData.customer_phone;
        if (custName) {
          updateCustomerInfo(custName, custPhone || customerPhone, true);
        }
      } else {
        setActiveOrder(null);
      }
    } catch (err) {
      console.warn('Session check warning:', err.message);
    } finally {
      setIsLoadingSession(false);
    }
  };

  // Add Item
  const addItem = (item) => {
    setCartItems((prev) => {
      const existing = prev[item.id];
      const newQty = existing ? existing.quantity + 1 : 1;
      return {
        ...prev,
        [item.id]: {
          ...item,
          quantity: newQty,
        },
      };
    });
  };

  // Remove Item
  const removeItem = (itemId) => {
    setCartItems((prev) => {
      const copy = { ...prev };
      delete copy[itemId];
      return copy;
    });
  };

  // Update Quantity
  const updateQuantity = (itemId, quantity) => {
    if (quantity <= 0) {
      removeItem(itemId);
      return;
    }
    setCartItems((prev) => {
      if (!prev[itemId]) return prev;
      return {
        ...prev,
        [itemId]: {
          ...prev[itemId],
          quantity,
        },
      };
    });
  };

  // Clear Cart
  const clearCart = () => {
    setCartItems({});
    setCookingNotes('');
    setAppliedCoupon(null);
  };

  // Totals calculation
  const totalItemCount = useMemo(() => {
    return Object.values(cartItems).reduce((sum, it) => sum + it.quantity, 0);
  }, [cartItems]);

  const subtotal = useMemo(() => {
    return Object.values(cartItems).reduce((sum, it) => sum + (parseFloat(it.price) * it.quantity), 0);
  }, [cartItems]);

  const discountAmount = useMemo(() => {
    if (!appliedCoupon) return 0;
    const pct = parseFloat(appliedCoupon.discount_percentage || appliedCoupon.discount_percent || 0);
    return (subtotal * pct) / 100;
  }, [subtotal, appliedCoupon]);

  const taxableAmount = Math.max(0, subtotal - discountAmount);
  const taxRate = 0.05; // 5% GST
  const taxAmount = parseFloat((taxableAmount * taxRate).toFixed(2));
  const grandTotal = parseFloat((taxableAmount + taxAmount).toFixed(2));

  return (
    <CartContext.Provider
      value={{
        tableId,
        setTableId,
        tableNumber,
        setTableNumber,
        restaurantId,
        setRestaurantId,
        customerName,
        customerPhone,
        consentGiven,
        updateCustomerInfo,
        hasActiveSession,
        activeOrder,
        checkSession,
        isLoadingSession,
        cartItems,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        cookingNotes,
        setCookingNotes,
        appliedCoupon,
        setAppliedCoupon,
        totalItemCount,
        subtotal,
        discountAmount,
        taxRate,
        taxAmount,
        grandTotal,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within a CartProvider');
  return context;
}

