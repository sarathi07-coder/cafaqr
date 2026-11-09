const BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
const API_BASE = `${BASE_URL}/api`;

export const api = {
  // --- Public / Customer Endpoints ---
  async getMenu(restaurantId) {
    const res = await fetch(`${API_BASE}/menu/${restaurantId}`);
    if (!res.ok) throw new Error('Failed to load menu');
    return res.json();
  },

  async initSession(tableId, sessionToken) {
    const res = await fetch(`${API_BASE}/order/session/init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tableId, sessionToken: sessionToken || null }),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to initialize session');
    return result;
  },

  async getCustomerSession(sessionToken) {
    const res = await fetch(`${API_BASE}/order/session/${sessionToken}`);
    if (!res.ok) throw new Error('Failed to fetch customer session');
    return res.json();
  },

  async getTableSession(tableId, sessionToken) {
    const url = sessionToken
      ? `${API_BASE}/order/table/${tableId}/session?sessionToken=${encodeURIComponent(sessionToken)}`
      : `${API_BASE}/order/table/${tableId}/session`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to check table session');
    return res.json();
  },

  async createOrder(data) {
    const res = await fetch(`${API_BASE}/order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to place order');
    return result;
  },

  async addItemsToOrder(orderId, items) {
    // Backend expects items as [{ menuItemId, quantity }]
    const formatted = items.map((it) => ({
      menuItemId: it.menu_item_id || it.menuItemId || it.id,
      quantity: it.quantity,
    }));
    const res = await fetch(`${API_BASE}/order/${orderId}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: formatted }),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to add items to order');
    return result;
  },

  async removeOrderItem(orderId, itemId) {
    const res = await fetch(`${API_BASE}/order/${orderId}/items/${itemId}`, {
      method: 'DELETE',
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to remove dish');
    return result;
  },

  async updateOrderNotes(orderId, notes) {
    const res = await fetch(`${API_BASE}/order/${orderId}/notes`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes }),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to update cooking notes');
    return result;
  },

  async callWaiter(tableId, requestType, note = '', sessionToken = null, sessionLabel = null, customerName = null) {
    const res = await fetch(`${API_BASE}/order/table/${tableId}/call-waiter`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(sessionToken ? { 'x-session-token': sessionToken } : {})
      },
      body: JSON.stringify({
        requestType,
        request_type: requestType,
        note,
        sessionToken,
        sessionLabel,
        customerName
      }),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to summon waiter');
    return result;
  },

  async applyCoupon(orderId, code) {
    const res = await fetch(`${API_BASE}/order/${orderId}/apply-coupon`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to apply coupon');
    return result;
  },

  async getBillSplit(orderId, ways = 2) {
    const res = await fetch(`${API_BASE}/order/${orderId}/split?ways=${ways}`);
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to calculate bill split');
    return result;
  },

  async submitFeedback(orderId, rating, comments = '', extra = {}) {
    let url = orderId ? `${API_BASE}/order/${orderId}/feedback` : `${API_BASE}/order/feedback/submit`;
    const payload = {
      orderId: orderId || null,
      rating,
      comments,
      tags: extra.tags || [],
      tableId: extra.tableId || null,
      restaurantId: extra.restaurantId || null
    };
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to submit feedback');
    return result;
  },

  // --- Kitchen Display System (KDS) ---
  async getKitchenTickets(restaurantId) {
    const url = restaurantId
      ? `${API_BASE}/kitchen/tickets?restaurantId=${restaurantId}`
      : `${API_BASE}/kitchen/tickets`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch kitchen tickets');
    return res.json();
  },

  async advanceKitchenTicket(orderId) {
    const res = await fetch(`${API_BASE}/kitchen/tickets/${orderId}/advance`, {
      method: 'PUT',
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to advance ticket');
    return result;
  },

  // --- Admin / Management Endpoints ---
  async adminLogin(username, password) {
    const res = await fetch(`${API_BASE}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Invalid credentials');
    return result;
  },

  async getAdminOverview(restaurantId, token) {
    const url = restaurantId
      ? `${API_BASE}/admin/analytics/overview?restaurantId=${restaurantId}`
      : `${API_BASE}/admin/analytics/overview`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Failed to fetch analytics');
    return res.json();
  },

  async getAdminOrders(restaurantId, token, status = '') {
    const params = new URLSearchParams();
    if (restaurantId) params.append('restaurantId', restaurantId);
    if (status) params.append('status', status);
    const query = params.toString();
    const res = await fetch(`${API_BASE}/admin/orders${query ? `?${query}` : ''}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Failed to fetch admin orders');
    return res.json();
  },

  async getServiceRequests(restaurantId, token) {
    const url = restaurantId
      ? `${API_BASE}/admin/service-requests?restaurantId=${restaurantId}`
      : `${API_BASE}/admin/service-requests`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Failed to fetch service requests');
    return res.json();
  },

  async resolveServiceRequest(requestId, token) {
    const res = await fetch(`${API_BASE}/admin/service-requests/${requestId}/resolve`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Failed to resolve request');
    return res.json();
  },

  async toggleDishAvailability(menuItemId, token) {
    const res = await fetch(`${API_BASE}/admin/menu/${menuItemId}/toggle-availability`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to toggle availability');
    return result;
  },

  async createMenuItem(itemData, token) {
    const res = await fetch(`${API_BASE}/admin/menu`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(itemData),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to add food item');
    return result;
  },

  async updateMenuItem(menuItemId, itemData, token) {
    const res = await fetch(`${API_BASE}/admin/menu/${menuItemId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(itemData),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to update food item');
    return result;
  },

  async uploadImage(file, token) {
    const formData = new FormData();
    formData.append('image', file);
    const res = await fetch(`${API_BASE}/admin/upload-image`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: formData
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to upload photo');
    return result;
  },

  async deleteMenuItem(menuItemId, token) {
    const res = await fetch(`${API_BASE}/admin/menu/${menuItemId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to delete food item');
    return result;
  },

  async dismissAndSettleOrder(orderId, paymentMethod = 'UPI', token) {
    const res = await fetch(`${API_BASE}/order/${orderId}/dismiss`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}` 
      },
      body: JSON.stringify({ payment_method: paymentMethod }),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to settle order');
    return result;
  },

  async getFeedbackList(restaurantId, token) {
    const url = restaurantId
      ? `${API_BASE}/admin/feedback?restaurantId=${restaurantId}`
      : `${API_BASE}/admin/feedback`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Failed to fetch feedback');
    return res.json();
  },

  async getCoupons(restaurantId, token) {
    const url = restaurantId
      ? `${API_BASE}/admin/coupons?restaurantId=${restaurantId}`
      : `${API_BASE}/admin/coupons`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Failed to fetch coupons');
    return res.json();
  },

  async createCoupon(data, token) {
    const res = await fetch(`${API_BASE}/admin/coupons`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}` 
      },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to create coupon');
    return result;
  },

  async getBulkQRCodes(restaurantId) {
    const res = await fetch(`${API_BASE}/qr/restaurant/${restaurantId}/bulk`);
    if (!res.ok) throw new Error('Failed to generate bulk QR codes');
    return res.json();
  },

  async getActiveGroupedTables(restaurantId, token) {
    const url = restaurantId
      ? `${API_BASE}/admin/tables/active-grouped?restaurantId=${restaurantId}`
      : `${API_BASE}/admin/tables/active-grouped`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Failed to fetch active grouped tables');
    return res.json();
  },

  async settleEntireTable(tableId, paymentMethod = 'CASH') {
    const res = await fetch(`${API_BASE}/order/table/${tableId}/settle-all`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentMethod }),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to settle table');
    return result;
  },

  getSalesCSVUrl(restaurantId) {
    const token = localStorage.getItem('qr_admin_token') || '';
    const params = new URLSearchParams();
    if (restaurantId) params.append('restaurantId', restaurantId);
    if (token) params.append('token', token);
    const query = params.toString();
    return `${API_BASE}/admin/reports/sales/csv${query ? `?${query}` : ''}`;
  },

  // ===== INTELLIGENCE & ANALYTICS SUITE =====
  async getTodayKPI(restaurantId, token) {
    const url = restaurantId
      ? `${API_BASE}/admin/analytics/today-kpi?restaurantId=${restaurantId}`
      : `${API_BASE}/admin/analytics/today-kpi`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to fetch today KPI');
    return res.json();
  },

  async getPeakHours(restaurantId, token) {
    const url = restaurantId
      ? `${API_BASE}/admin/analytics/peak-hours?restaurantId=${restaurantId}`
      : `${API_BASE}/admin/analytics/peak-hours`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to fetch peak hours');
    return res.json();
  },

  async getDishPerformance(restaurantId, token) {
    const url = restaurantId
      ? `${API_BASE}/admin/analytics/dish-performance?restaurantId=${restaurantId}`
      : `${API_BASE}/admin/analytics/dish-performance`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to fetch dish performance');
    return res.json();
  },

  async getReviewsAI(restaurantId, token) {
    const url = restaurantId
      ? `${API_BASE}/admin/analytics/reviews-ai?restaurantId=${restaurantId}`
      : `${API_BASE}/admin/analytics/reviews-ai`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to fetch AI reviews');
    return res.json();
  },

  async getOperationsTargets(restaurantId, token) {
    const url = restaurantId
      ? `${API_BASE}/admin/analytics/operations-targets?restaurantId=${restaurantId}`
      : `${API_BASE}/admin/analytics/operations-targets`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to fetch operations and targets');
    return res.json();
  },

  async updateTargets(restaurantId, token, targetData) {
    const res = await fetch(`${API_BASE}/admin/analytics/targets`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ restaurantId, ...targetData })
    });
    if (!res.ok) throw new Error('Failed to update targets');
    return res.json();
  },

  // Dynamic UPI Payment methods
  async getUpiInfo(tableId, restaurantId) {
    const params = new URLSearchParams();
    if (tableId) params.append('tableId', tableId);
    if (restaurantId) params.append('restaurantId', restaurantId);
    const res = await fetch(`${API_BASE}/order/upi-info?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch UPI payment information');
    return res.json();
  },

  async submitUpiPayment(payload) {
    const res = await fetch(`${API_BASE}/order/upi/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to submit UPI payment notification');
    return data;
  },

  async getAdminUpi(restaurantId, token) {
    const params = new URLSearchParams();
    if (restaurantId) params.append('restaurantId', restaurantId);
    const res = await fetch(`${API_BASE}/admin/upi?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to fetch UPI settings');
    return res.json();
  },

  async updateAdminUpi(restaurantId, token, upiId, upiName) {
    const res = await fetch(`${API_BASE}/admin/upi`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ restaurantId, upiId, upiName })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update UPI settings');
    return data;
  }
};
