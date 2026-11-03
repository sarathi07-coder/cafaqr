const API_BASE = '/api';

export const api = {
  // --- Public / Customer Endpoints ---
  async getMenu(restaurantId) {
    const res = await fetch(`${API_BASE}/menu/${restaurantId}`);
    if (!res.ok) throw new Error('Failed to load menu');
    return res.json();
  },

  async getTableSession(tableId) {
    const res = await fetch(`${API_BASE}/order/table/${tableId}/session`);
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

  async callWaiter(tableId, requestType, note = '') {
    const res = await fetch(`${API_BASE}/order/table/${tableId}/call-waiter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestType, request_type: requestType, note }),
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

  async submitFeedback(orderId, rating, comments = '') {
    const res = await fetch(`${API_BASE}/order/${orderId}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating, comments }),
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

  getSalesCSVUrl(restaurantId) {
    const token = localStorage.getItem('qr_admin_token') || '';
    const params = new URLSearchParams();
    if (restaurantId) params.append('restaurantId', restaurantId);
    if (token) params.append('token', token);
    const query = params.toString();
    return `${API_BASE}/admin/reports/sales/csv${query ? `?${query}` : ''}`;
  }
};
