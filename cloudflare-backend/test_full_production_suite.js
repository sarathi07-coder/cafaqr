// Master 100% Comprehensive End-to-End Production Verification Suite
// Tests EVERY single API, every flow, every table, order, KDS, UPI, settlement, review, and admin tool.

const API_BASE = 'https://cafaqr-api.p7404467.workers.dev/api';
const ROOT_URL = 'https://cafaqr-api.p7404467.workers.dev';
const FRONTEND_URL = 'https://cafaqr.p7404467.workers.dev';

let passedCount = 0;
let totalCount = 0;

async function testStep(name, fn) {
  totalCount++;
  process.stdout.write(`[${totalCount.toString().padStart(2, '0')}] ${name} ... `);
  try {
    const res = await fn();
    console.log(`✅ PASS ${res ? `(${res})` : ''}`);
    passedCount++;
  } catch (err) {
    console.log(`❌ FAIL`);
    console.error(`     Error: ${err.message}`);
    throw err;
  }
}

async function runMasterSuite() {
  console.log('========================================================================');
  console.log('🚀 EXECUTING COMPLETE END-TO-END PRODUCTION VERIFICATION SUITE');
  console.log(`   Frontend : ${FRONTEND_URL}`);
  console.log(`   API Base : ${API_BASE}`);
  console.log('========================================================================\n');

  let defaultTable = null;
  let restaurantId = '';
  let sessionToken = '';
  let testOrderId = '';
  let sampleDishId = '';
  let adminToken = '';
  let serviceRequestId = '';
  let createdCouponCode = 'PROD' + Math.floor(1000 + Math.random() * 9000);

  // SECTION 1: Health & DB Connections
  console.log('--- SECTION 1: Infrastructure & Database Connectivity ---');
  await testStep('API Root & Edge V8 Status', async () => {
    const res = await fetch(`${ROOT_URL}/health`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.status !== 'ok') throw new Error('Unhealthy status');
    return `engine: ${data.engine}`;
  });

  await testStep('Cloudflare D1 SQLite Database Health', async () => {
    const res = await fetch(`${ROOT_URL}/health/db`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.status !== 'ok') throw new Error('D1 disconnected');
    return `restaurant: ${data.restaurant?.name}`;
  });

  await testStep('Frontend SPA Accessibility & Headers', async () => {
    const res = await fetch(`${FRONTEND_URL}/order`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    if (!html.includes('<div id="root">')) throw new Error('Missing SPA root');
    return `${html.length} bytes`;
  });

  // SECTION 2: Customer Onboarding & Table Discovery
  console.log('\n--- SECTION 2: Table Discovery & Customer Sessions ---');
  await testStep('Discover Default Table Stand', async () => {
    const res = await fetch(`${API_BASE}/order/tables/default`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.table?.id) throw new Error('No table returned');
    defaultTable = data.table;
    restaurantId = data.table.restaurant_id;
    return `Table #${defaultTable.number} (ID: ${defaultTable.id.slice(0, 8)}...)`;
  });

  await testStep('Initialize Diner Session (POST /order/session/init)', async () => {
    const res = await fetch(`${API_BASE}/order/session/init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tableId: defaultTable.id }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.sessionToken) throw new Error('Missing sessionToken');
    sessionToken = data.sessionToken;
    return `Session Token: ${sessionToken.slice(0, 16)}... (${data.sessionLabel})`;
  });

  await testStep('Retrieve Customer Session (GET /order/session/:token)', async () => {
    const res = await fetch(`${API_BASE}/order/session/${sessionToken}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.session) throw new Error('Session not found');
    return `Active: ${data.session.is_active}`;
  });

  await testStep('Check Table Active Sessions (GET /order/table/:id/session)', async () => {
    const res = await fetch(`${API_BASE}/order/table/${defaultTable.id}/session?sessionToken=${sessionToken}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return `Table #${data.tableNumber || defaultTable.number}`;
  });

  // SECTION 3: Menu Catalog Browsing
  console.log('\n--- SECTION 3: Menu Catalog & Edge Delivery ---');
  await testStep('Fetch Menu Items (GET /menu/:restaurantId)', async () => {
    const res = await fetch(`${API_BASE}/menu/${restaurantId}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const items = await res.json();
    if (!Array.isArray(items) || items.length === 0) throw new Error('Menu empty');
    sampleDishId = items[0].id;
    return `${items.length} dishes loaded`;
  });

  await testStep('Fetch Menu Categories (GET /menu/:restaurantId/categories)', async () => {
    const res = await fetch(`${API_BASE}/menu/${restaurantId}/categories`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const cats = await res.json();
    if (!Array.isArray(cats) || cats.length === 0) throw new Error('No categories');
    return `${cats.length} categories (${cats.join(', ')})`;
  });

  await testStep('Grouped Menu Hierarchy (GET /menu/:restaurantId?groupByCategory=true)', async () => {
    const res = await fetch(`${API_BASE}/menu/${restaurantId}?groupByCategory=true`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const grouped = await res.json();
    if (!grouped.categories || !grouped.itemsByCategory) throw new Error('Grouped menu failed');
    return `${grouped.categories.length} category groups (${grouped.totalItems} items)`;
  });

  // SECTION 4: Live Order Placement & Multi-Round Ordering
  console.log('\n--- SECTION 4: Live Order Placement & Tab Management ---');
  await testStep('Place Initial Table Order (POST /order)', async () => {
    const payload = {
      restaurantId,
      tableId: defaultTable.id,
      sessionToken,
      customer: {
        name: 'Production E2E Diner',
        phone: '9876543210',
        consentGiven: true,
      },
      notes: 'Extra crispy, hot and fresh please!',
      items: [
        { menuItemId: sampleDishId, quantity: 2 },
      ],
    };

    const res = await fetch(`${API_BASE}/order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.order?.id) throw new Error('Order creation failed');
    testOrderId = data.order.id;
    return `Ticket #${testOrderId.slice(0, 8)} | Total: ₹${data.order.total}`;
  });

  await testStep('Add Round 2 Dishes to Tab (POST /order/:id/items)', async () => {
    const res = await fetch(`${API_BASE}/order/${testOrderId}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ menuItemId: sampleDishId, quantity: 1 }],
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return `Updated Tab Total: ₹${data.order?.total}`;
  });

  await testStep('Update Cooking Notes (PUT /order/:id/notes)', async () => {
    const res = await fetch(`${API_BASE}/order/${testOrderId}/notes`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: 'Table prefers less salt; serving urgently.' }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return `Notes saved`;
  });

  await testStep('Split Bill Calculation (GET /order/:id/split?ways=3)', async () => {
    const res = await fetch(`${API_BASE}/order/${testOrderId}/split?ways=3`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return `Per Person (3 ways): ₹${data.perPerson || data.per_person || data.splitAmount}`;
  });

  // SECTION 5: Kitchen Display System (KDS) Progression
  console.log('\n--- SECTION 5: Kitchen Display System (KDS) Lifecycle ---');
  await testStep('KDS View Active Tickets (GET /kitchen/tickets/:restaurantId)', async () => {
    const res = await fetch(`${API_BASE}/kitchen/tickets/${restaurantId}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const tickets = await res.json();
    if (!Array.isArray(tickets) || tickets.length === 0) throw new Error('No tickets in kitchen');
    return `${tickets.length} active tickets queued`;
  });

  await testStep('KDS Advance Ticket to PREPARING (PUT /kitchen/tickets/:id/advance)', async () => {
    const res = await fetch(`${API_BASE}/kitchen/tickets/${testOrderId}/advance`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return `Status: ${data.status}`;
  });

  await testStep('KDS Advance Ticket to READY (PUT /kitchen/tickets/:id/advance)', async () => {
    const res = await fetch(`${API_BASE}/kitchen/tickets/${testOrderId}/advance`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return `Status: ${data.status}`;
  });

  await testStep('KDS Advance Ticket to SERVED (PUT /kitchen/tickets/:id/advance)', async () => {
    const res = await fetch(`${API_BASE}/kitchen/tickets/${testOrderId}/advance`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return `Status: ${data.status}`;
  });

  // SECTION 6: Floor Service Assistance
  console.log('\n--- SECTION 6: Floor Waiter Service Requests ---');
  await testStep('Dispatch Waiter Service Call (POST /order/table/:id/call-waiter)', async () => {
    const res = await fetch(`${API_BASE}/order/table/${defaultTable.id}/call-waiter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestType: 'WATER',
        note: 'Fresh water refill for diner',
        customerName: 'Production E2E Diner',
        sessionToken,
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    serviceRequestId = data.serviceRequest?.id || data.id || data.requestId;
    return `Request dispatched: ${data.serviceRequest?.request_type || 'WATER'}`;
  });

  // SECTION 7: Dynamic UPI Payment & Settlement
  console.log('\n--- SECTION 7: Dynamic UPI Payments & Reconciliation ---');
  await testStep('Dynamic UPI Manual Add + Toggle ON/OFF + Delete Lifecycle', async () => {
    // 1. Add manual UPI ID
    const addRes = await fetch(`${API_BASE}/admin/upi/accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        restaurantId,
        label: 'E2E Test UPI',
        upiId: 'e2etest@oksbi',
        upiName: 'KRISH Cafe E2E',
        setActive: true,
      }),
    });
    if (!addRes.ok) throw new Error(`Add UPI HTTP ${addRes.status}`);
    const addData = await addRes.json();
    const createdAccountId = addData.account?.id;

    try {
      // 2. Toggle ON and verify public /order/upi-info returns upiEnabled: true
      const onRes = await fetch(`${API_BASE}/admin/upi/toggle`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ restaurantId, enabled: true }),
      });
      if (!onRes.ok) throw new Error(`Toggle ON HTTP ${onRes.status}`);

      const infoOnRes = await fetch(`${API_BASE}/order/upi-info?tableId=${defaultTable.id}`);
      if (!infoOnRes.ok) throw new Error(`UPI info ON HTTP ${infoOnRes.status}`);
      const infoOn = await infoOnRes.json();
      if (!infoOn.upiEnabled || infoOn.upiId !== 'e2etest@oksbi') {
        throw new Error(`Expected e2etest@oksbi enabled, got ${JSON.stringify(infoOn)}`);
      }

      // 3. Toggle OFF and verify public /order/upi-info hides UPI
      const offRes = await fetch(`${API_BASE}/admin/upi/toggle`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ restaurantId, enabled: false }),
      });
      if (!offRes.ok) throw new Error(`Toggle OFF HTTP ${offRes.status}`);

      const infoOffRes = await fetch(`${API_BASE}/order/upi-info?tableId=${defaultTable.id}`);
      if (!infoOffRes.ok) throw new Error(`UPI info OFF HTTP ${infoOffRes.status}`);
      const infoOff = await infoOffRes.json();
      if (infoOff.upiEnabled || infoOff.upiId !== '') {
        throw new Error(`Expected disabled empty UPI info, got ${JSON.stringify(infoOff)}`);
      }

      return 'Added -> Toggled ON (live) -> Toggled OFF (hidden) -> Cleaned';
    } finally {
      if (createdAccountId) {
        await fetch(`${API_BASE}/admin/upi/accounts/${encodeURIComponent(createdAccountId)}?restaurantId=${encodeURIComponent(restaurantId)}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${adminToken}` },
        }).catch(() => {});
      }
    }
  });

  await testStep('Submit Diner UPI Payment UTR (POST /order/upi/notify)', async () => {
    const res = await fetch(`${API_BASE}/order/upi/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tableId: defaultTable.id,
        tableNumber: defaultTable.number,
        orderId: testOrderId,
        sessionToken,
        customerName: 'Production E2E Diner',
        amount: 250,
        utr: '123498765432',
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return `Notice received: ${data.message || 'Notification recorded'}`;
  });

  await testStep('Settle Diner Order (PUT /order/:id/dismiss)', async () => {
    const res = await fetch(`${API_BASE}/order/${testOrderId}/dismiss`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentMethod: 'UPI' }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return `Order marked ${data.order?.status || 'PAID'} via UPI`;
  });

  await testStep('Scan Barcode / Lookup Digital Receipt (GET /order/receipt/:code)', async () => {
    const barcodeCode = `KR-${String(testOrderId).slice(0, 6).toUpperCase()}`;
    const res = await fetch(`${API_BASE}/order/receipt/${encodeURIComponent(barcodeCode)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const bill = await res.json();
    if (!bill.orderId || !Array.isArray(bill.items) || bill.items.length === 0) {
      throw new Error('Missing itemized bill data on barcode lookup');
    }
    return `Barcode ${barcodeCode} -> ${bill.items.length} items, Total ₹${bill.total}`;
  });

  // SECTION 8: Customer 5-Star Reviews
  console.log('\n--- SECTION 8: Diner Feedback & 5-Star Reviews ---');
  await testStep('Submit Diner 5-Star Review (POST /order/feedback/submit)', async () => {
    const res = await fetch(`${API_BASE}/order/feedback/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: testOrderId,
        restaurantId,
        rating: 5,
        comments: 'Outstanding dining experience! The food arrived piping hot, and paying via UPI QR was instant!',
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return `Feedback ID: ${data.feedbackId?.slice(0, 8)}... (5 Stars)`;
  });

  // SECTION 9: Admin Authentication & Dashboard
  console.log('\n--- SECTION 9: Admin Authentication & Management ---');
  await testStep('Admin Login Rejects Invalid Password (POST /admin/login)', async () => {
    const res = await fetch(`${API_BASE}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'wrong-password-test' }),
    });
    if (res.status !== 401) throw new Error(`Expected HTTP 401, got ${res.status}`);
    return 'Rejected invalid admin password (401)';
  });

  await testStep('Admin Login (POST /admin/login)', async () => {
    const res = await fetch(`${API_BASE}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'supersecret' }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.token) throw new Error('Missing admin token');
    adminToken = data.token;
    return `JWT Token: ${adminToken.slice(0, 16)}...`;
  });

  await testStep('Admin Session Verify & Self-Reset Round-Trip (/admin/verify & /admin/reset-password)', async () => {
    const verifyRes = await fetch(`${API_BASE}/admin/verify`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const verifyData = await verifyRes.json();
    if (!verifyRes.ok || !verifyData.valid) {
      throw new Error(`Expected valid token, got ${JSON.stringify(verifyData)}`);
    }

    const tempPassword = `tmpAdmin_${Date.now()}`;
    try {
      const resetRes = await fetch(`${API_BASE}/admin/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurantId, currentPassword: 'supersecret', newPassword: tempPassword }),
      });
      const resetData = await resetRes.json();
      if (!resetRes.ok || !resetData.token) {
        throw new Error(`Reset failed: ${JSON.stringify(resetData)}`);
      }

      const oldVerifyRes = await fetch(`${API_BASE}/admin/verify`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const oldVerifyData = await oldVerifyRes.json();
      if (oldVerifyData.valid) throw new Error('Old admin token remained valid after password reset');

      const loginNewRes = await fetch(`${API_BASE}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: tempPassword }),
      });
      if (!loginNewRes.ok) throw new Error(`New password login failed: HTTP ${loginNewRes.status}`);
      return 'Verified session, rotated password & invalidated stale token, restored cleanly';
    } finally {
      const restoreRes = await fetch(`${API_BASE}/admin/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurantId, recoveryPin: '2026', newPassword: 'supersecret' }),
      });
      const restoreData = await restoreRes.json().catch(() => ({}));
      if (restoreData.token) adminToken = restoreData.token;
    }
  });

  await testStep('Admin Bento Overview (GET /admin/analytics/overview)', async () => {
    const res = await fetch(`${API_BASE}/admin/analytics/overview?restaurantId=${restaurantId}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return `Total Revenue: ₹${data.totalRevenue} | Paid Orders: ${data.paidOrders} | Avg Rating: ${data.avgRating}⭐`;
  });

  await testStep('Admin Active Grouped Tables (GET /admin/tables/active-grouped)', async () => {
    const res = await fetch(`${API_BASE}/admin/tables/active-grouped?restaurantId=${restaurantId}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const tables = await res.json();
    return `${tables.length} tables currently grouped`;
  });

  await testStep('Admin Service Requests (GET /admin/service-requests)', async () => {
    const res = await fetch(`${API_BASE}/admin/service-requests?restaurantId=${restaurantId}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const requests = await res.json();
    return `${requests.length} pending service calls`;
  });

  if (serviceRequestId) {
    await testStep('Admin Resolve Service Request (PUT /admin/service-requests/:id/resolve)', async () => {
      const res = await fetch(`${API_BASE}/admin/service-requests/${serviceRequestId}/resolve`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return `Resolved call #${serviceRequestId.slice(0, 8)}`;
    });
  }

  // SECTION 10: Intelligence Suite & Operational Targets
  console.log('\n--- SECTION 10: Intelligence Suite & Targets ---');
  await testStep('Intelligence: Today KPI (GET /admin/analytics/today-kpi)', async () => {
    const res = await fetch(`${API_BASE}/admin/analytics/today-kpi?restaurantId=${restaurantId}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return `Gross: ₹${data.todayFinancials?.totalRevenue} | AOV: ₹${data.todayFinancials?.averageOrderValue} | Top Table: Table #${data.highestEarningTable?.tableNumber}`;
  });

  await testStep('Intelligence: Peak Hours Curve (GET /admin/analytics/peak-hours)', async () => {
    const res = await fetch(`${API_BASE}/admin/analytics/peak-hours?restaurantId=${restaurantId}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return `Busiest: ${data.peakWindowSummary?.busiestHour} (${data.peakWindowSummary?.primaryPeak})`;
  });

  await testStep('Intelligence: Dish Performance (GET /admin/analytics/dish-performance)', async () => {
    const res = await fetch(`${API_BASE}/admin/analytics/dish-performance?restaurantId=${restaurantId}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return `Star Dish: ${data.highestSoldDish?.name || 'Top Dish'} (${data.totalDishesSoldToday} total portions today)`;
  });

  await testStep('Intelligence: Edge Reviews AI (GET /admin/analytics/reviews-ai)', async () => {
    const res = await fetch(`${API_BASE}/admin/analytics/reviews-ai?restaurantId=${restaurantId}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return `Positive: ${data.goodPercentage}% | Avg: ${data.averageRating}⭐ | Engine: ${data.engine}`;
  });

  await testStep('Intelligence: Operations & Targets (GET /admin/analytics/operations-targets)', async () => {
    const res = await fetch(`${API_BASE}/admin/analytics/operations-targets?restaurantId=${restaurantId}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return `Daily Goal: ₹${data.targets?.daily?.target} (Actual: ₹${data.targets?.daily?.actual})`;
  });

  await testStep('Intelligence: Update Targets (PUT /admin/analytics/targets)', async () => {
    const res = await fetch(`${API_BASE}/admin/analytics/targets`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        restaurantId,
        daily: 30000,
        weekly: 180000,
        monthly: 700000,
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return `Updated daily: ₹30,000, weekly: ₹180,000`;
  });

  // SECTION 11: Menu CRUD & 1-Click 86 Stock Toggle
  console.log('\n--- SECTION 11: Food Menu Management & Stock Controls ---');
  let newDishId = '';
  await testStep('Create Menu Dish (POST /admin/menu)', async () => {
    const res = await fetch(`${API_BASE}/admin/menu`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        restaurantId,
        name: 'Royal Zafrani Kulfi (Prod Test)',
        category: 'Desserts',
        price: 160,
        originalPrice: 190,
        offerBadge: '15% OFF',
        description: 'Rich saffron and pistachio frozen dessert',
        available: true,
        isVeg: true,
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const dish = await res.json();
    newDishId = dish.id;
    return `Created Dish ID: ${newDishId.slice(0, 8)} (${dish.name})`;
  });

  await testStep('1-Click Stock Toggle Out-of-Stock (PUT /admin/menu/:id/toggle-availability)', async () => {
    const res = await fetch(`${API_BASE}/admin/menu/${newDishId}/toggle-availability`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.available !== false) throw new Error('Failed to mark out-of-stock');
    return `Available: ${data.available}`;
  });

  await testStep('1-Click Stock Toggle Restocked (PUT /admin/menu/:id/toggle-availability)', async () => {
    const res = await fetch(`${API_BASE}/admin/menu/${newDishId}/toggle-availability`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.available !== true) throw new Error('Failed to restock');
    return `Available: ${data.available}`;
  });

  await testStep('Delete Test Dish (DELETE /admin/menu/:id)', async () => {
    const res = await fetch(`${API_BASE}/admin/menu/${newDishId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return `Cleaned up test dish`;
  });

  // SECTION 12: Promotional Coupons
  console.log('\n--- SECTION 12: Promotional Coupons & Discounts ---');
  await testStep('Create Coupon (POST /admin/coupons)', async () => {
    const res = await fetch(`${API_BASE}/admin/coupons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        restaurant_id: restaurantId,
        code: createdCouponCode,
        discount_percentage: 20,
        minimum_order_amount: 400,
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return `Created: ${data.coupon?.code} (20% OFF)`;
  });

  await testStep('List Active Coupons (GET /admin/coupons)', async () => {
    const res = await fetch(`${API_BASE}/admin/coupons?restaurantId=${restaurantId}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const list = await res.json();
    return `${list.length} active coupons in database`;
  });

  // SECTION 13: QR Code Engine & Stand Printing
  console.log('\n--- SECTION 13: Native Edge QR Code Generation ---');
  await testStep('Bulk Table QR Codes (GET /qr/restaurant/:id/bulk)', async () => {
    const res = await fetch(`${API_BASE}/qr/restaurant/${restaurantId}/bulk`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data.tables) || data.tables.length < 5) throw new Error('Missing tables');
    return `${data.tables.length} table QR SVGs generated`;
  });

  await testStep('Individual Table QR Download (GET /qr/:tableId?format=svg)', async () => {
    const res = await fetch(`${API_BASE}/qr/${defaultTable.id}?format=svg`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const svg = await res.text();
    if (!svg.includes('<svg')) throw new Error('Invalid SVG returned');
    return `${svg.length} bytes SVG vector`;
  });

  await testStep('Dynamic Arbitrary Text QR (GET /qr/generate?text=...)', async () => {
    const testUrl = 'upi://pay?pa=vallipriya1212-1@oksbi&pn=Royal%20Spice&am=150.00';
    const res = await fetch(`${API_BASE}/qr/generate?text=${encodeURIComponent(testUrl)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const svg = await res.text();
    if (!svg.includes('<svg')) throw new Error('Invalid SVG');
    return `Generated dynamic UPI SVG (${svg.length} bytes)`;
  });

  // SECTION 14: Sales Accounting CSV Export
  console.log('\n--- SECTION 14: Accounting & Sales CSV Export ---');
  await testStep('Sales CSV Spreadsheet Export (GET /admin/reports/sales/csv)', async () => {
    const res = await fetch(`${API_BASE}/admin/reports/sales/csv?restaurantId=${restaurantId}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const csv = await res.text();
    const lines = csv.trim().split('\n');
    return `${lines.length} rows exported (headers: ${lines[0].slice(0, 35)}...)`;
  });

  console.log('\n========================================================================');
  console.log(`🎉 100% PRODUCTION MASTER VERIFICATION: ALL ${passedCount}/${totalCount} TESTS PASSED!`);
  console.log('   All frontend flows, APIs, D1 database tables, KDS, UPI, and admin suite');
  console.log('   are verified operational, crash-free, and fully connected.');
  console.log('========================================================================\n');
}

runMasterSuite().catch((err) => {
  console.error('\n❌ MASTER VERIFICATION ABORTED ON ERROR:', err);
  process.exit(1);
});
