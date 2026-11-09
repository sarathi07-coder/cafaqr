import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { api } from '../api';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [tableId, setTableId] = useState('');
  const [tableNumber, setTableNumber] = useState('');
  const [restaurantId, setRestaurantId] = useState('');
  
  // Customer & Session state
  const [sessionToken, setSessionToken] = useState('');
  const [sessionLabel, setSessionLabel] = useState('Customer 1');
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

  // Check and initialize active customer session for this table
  const checkSession = async (tblId, isSilent = false) => {
    if (!tblId) return;
    if (!isSilent) setIsLoadingSession(true);
    try {
      const storedToken = localStorage.getItem(`qr_session_token_${tblId}`);
      // Initialize or resume customer session for this table
      const sessionData = await api.initSession(tblId, storedToken);

      const sToken = sessionData.sessionToken;
      const sLabel = sessionData.sessionLabel || 'Customer 1';
      setSessionToken(sToken);
      setSessionLabel(sLabel);
      localStorage.setItem(`qr_session_token_${tblId}`, sToken);
      localStorage.setItem(`qr_session_label_${tblId}`, sLabel);

      if (sessionData.customer?.name) {
        setCustomerName(sessionData.customer.name);
        setCustomerPhone(sessionData.customer.phone || '');
        setConsentGiven(Boolean(sessionData.customer.consentGiven));
      }

      // Check if this specific customer session has an active order
      const hasOrder = Boolean(sessionData.hasActiveOrder && sessionData.order);
      setHasActiveSession(hasOrder);
      if (hasOrder && sessionData.order) {
        const orderData = sessionData.order;
        setActiveOrder({
          id: orderData.id || orderData.orderId,
          orderId: orderData.id || orderData.orderId,
          status: orderData.status,
          total: orderData.total,
          total_amount: orderData.total,
          subtotal: orderData.subtotal,
          taxAmount: orderData.taxAmount,
          currency: orderData.currency || '₹',
          notes: orderData.notes,
          customer_name: orderData.customer?.name || sessionData.customer?.name || customerName,
          customer_phone: orderData.customer?.phone || sessionData.customer?.phone || customerPhone,
          items: orderData.items || [],
        });
      } else {
        setActiveOrder(null);
      }

      // Restore isolated draft cart & cooking notes only on initial non-silent load
      if (!isSilent) {
        try {
          const savedCart = localStorage.getItem(`qr_cart_${sToken}`);
          if (savedCart) {
            setCartItems(JSON.parse(savedCart));
          } else {
            setCartItems({});
          }
          const savedNotes = localStorage.getItem(`qr_notes_${sToken}`);
          if (savedNotes) {
            setCookingNotes(savedNotes);
          } else {
            setCookingNotes('');
          }
        } catch (e) {}
      }
      if (sessionData.table?.restaurant_id) {
        setRestaurantId(sessionData.table.restaurant_id);
      }
      if (sessionData.table?.number) {
        setTableNumber(sessionData.table.number);
      }

      return sessionData;
    } catch (err) {
      console.warn('Session check warning:', err.message);
      return null;
    } finally {
      if (!isSilent) setIsLoadingSession(false);
    }
  };

  // Sync isolated draft cart per session
  useEffect(() => {
    if (sessionToken) {
      if (Object.keys(cartItems).length > 0) {
        localStorage.setItem(`qr_cart_${sessionToken}`, JSON.stringify(cartItems));
      } else {
        localStorage.removeItem(`qr_cart_${sessionToken}`);
      }
    }
  }, [cartItems, sessionToken]);

  // Sync isolated cooking notes per session
  useEffect(() => {
    if (sessionToken) {
      if (cookingNotes) {
        localStorage.setItem(`qr_notes_${sessionToken}`, cookingNotes);
      } else {
        localStorage.removeItem(`qr_notes_${sessionToken}`);
      }
    }
  }, [cookingNotes, sessionToken]);

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
    if (sessionToken) {
      localStorage.removeItem(`qr_cart_${sessionToken}`);
      localStorage.removeItem(`qr_notes_${sessionToken}`);
    }
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

  // Dietary calculations for Veg vs Non-Veg in active cart
  const dietaryStats = useMemo(() => {
    let vegCount = 0;
    let nonVegCount = 0;
    let vegSubtotal = 0;
    let nonVegSubtotal = 0;

    Object.values(cartItems).forEach((it) => {
      const isVeg = it.is_veg !== undefined 
        ? Boolean(it.is_veg) 
        : !(it.name?.toLowerCase().includes('chicken') ||
            it.name?.toLowerCase().includes('mutton') ||
            it.name?.toLowerCase().includes('fish') ||
            it.name?.toLowerCase().includes('meat') ||
            it.name?.toLowerCase().includes('egg') ||
            it.name?.toLowerCase().includes('prawn'));
      
      const itemTotal = parseFloat(it.price || 0) * it.quantity;
      if (isVeg) {
        vegCount += it.quantity;
        vegSubtotal += itemTotal;
      } else {
        nonVegCount += it.quantity;
        nonVegSubtotal += itemTotal;
      }
    });

    return {
      vegCount,
      nonVegCount,
      vegSubtotal,
      nonVegSubtotal,
    };
  }, [cartItems]);

  return (
    <CartContext.Provider
      value={{
        tableId,
        setTableId,
        tableNumber,
        setTableNumber,
        restaurantId,
        setRestaurantId,
        sessionToken,
        setSessionToken,
        sessionLabel,
        setSessionLabel,
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
        dietaryStats,
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

