// Automated verification of Admin Dashboard & Management Suite
const API_BASE = 'https://cafaqr-api.p7404467.workers.dev/api';
const RESTAURANT_ID = 'db4ed920-3d20-420a-9f54-99d3c0b48a08';

async function runAdminVerification() {
  console.log('====================================================');
  console.log('🧪 VERIFYING ADMIN SUITE ON LIVE CLOUDFLARE WORKERS');
  console.log(`Target: ${API_BASE}`);
  console.log('====================================================\n');

  let passed = 0;
  let total = 0;

  async function check(name, fn) {
    total++;
    try {
      await fn();
      console.log(`✅ [${total}] ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ [${total}] ${name}: ${err.message}`);
    }
  }

  let authToken = '';
  let testDishId = '';
  let testCouponCode = 'TEST' + Math.floor(1000 + Math.random() * 9000);

  // 1. Admin Login
  await check('Admin Login (POST /admin/login)', async () => {
    const res = await fetch(`${API_BASE}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'supersecret' }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.token) throw new Error('Missing token');
    authToken = data.token;
  });

  // 2. Bulk QR Codes
  await check('Bulk QR Codes (GET /qr/restaurant/:restaurantId/bulk)', async () => {
    const res = await fetch(`${API_BASE}/qr/restaurant/${RESTAURANT_ID}/bulk`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data.tables) || data.tables.length < 5) {
      throw new Error(`Expected at least 5 tables, got ${data.tables?.length}`);
    }
    if (!data.tables[0].qrCodeDataUrl.startsWith('data:image/svg+xml')) {
      throw new Error('Invalid QR Code data URL format');
    }
  });

  // 3. Tables List
  await check('List Dining Tables (GET /admin/tables)', async () => {
    const res = await fetch(`${API_BASE}/admin/tables?restaurantId=${RESTAURANT_ID}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const tables = await res.json();
    if (!Array.isArray(tables) || tables.length < 5) throw new Error('Failed to list tables');
  });

  // 4. Today KPI Analytics
  await check('Today KPI (GET /admin/analytics/today-kpi)', async () => {
    const res = await fetch(`${API_BASE}/admin/analytics/today-kpi?restaurantId=${RESTAURANT_ID}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.todayFinancials || data.todayFinancials.totalRevenue == null) {
      throw new Error('Missing todayFinancials');
    }
    if (!data.highestEarningTable) throw new Error('Missing highestEarningTable');
  });

  // 5. Peak Hours
  await check('Peak Hours (GET /admin/analytics/peak-hours)', async () => {
    const res = await fetch(`${API_BASE}/admin/analytics/peak-hours?restaurantId=${RESTAURANT_ID}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data.hourlyCurve) || !data.peakWindowSummary) {
      throw new Error('Invalid peak hours structure');
    }
  });

  // 6. Dish Performance
  await check('Dish Performance (GET /admin/analytics/dish-performance)', async () => {
    const res = await fetch(`${API_BASE}/admin/analytics/dish-performance?restaurantId=${RESTAURANT_ID}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data.topPerformers) || !Array.isArray(data.categoryBreakdown)) {
      throw new Error('Invalid dish performance structure');
    }
  });

  // 7. Reviews AI
  await check('Reviews AI Sentiment (GET /admin/analytics/reviews-ai)', async () => {
    const res = await fetch(`${API_BASE}/admin/analytics/reviews-ai?restaurantId=${RESTAURANT_ID}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.engine || !Array.isArray(data.topPraises)) {
      throw new Error('Invalid reviews AI structure');
    }
  });

  // 8. Operations & Targets
  await check('Operations & Targets (GET /admin/analytics/operations-targets)', async () => {
    const res = await fetch(`${API_BASE}/admin/analytics/operations-targets?restaurantId=${RESTAURANT_ID}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.targets?.daily || !data.operations) {
      throw new Error('Invalid operations targets structure');
    }
  });

  // 9. Update Targets
  await check('Update Targets (PUT /admin/analytics/targets)', async () => {
    const res = await fetch(`${API_BASE}/admin/analytics/targets`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ restaurantId: RESTAURANT_ID, daily: 25000, weekly: 150000, monthly: 600000 }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.success) throw new Error('Update failed');
  });

  // 10. Menu Create Dish
  await check('Create Dish (POST /admin/menu)', async () => {
    const res = await fetch(`${API_BASE}/admin/menu`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({
        restaurantId: RESTAURANT_ID,
        name: 'Royal Kashmiri Rogan Josh (Test)',
        category: 'Main Course',
        price: 380,
        originalPrice: 420,
        description: 'Slow-cooked aromatic curry',
        available: true,
        isVeg: false,
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const dish = await res.json();
    if (!dish.id) throw new Error('Missing dish ID');
    testDishId = dish.id;
  });

  // 11. Toggle Dish Stock
  await check('Toggle Availability (PUT /admin/menu/:id/toggle-availability)', async () => {
    const res = await fetch(`${API_BASE}/admin/menu/${testDishId}/toggle-availability`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.available !== false) throw new Error('Availability was not toggled off');
  });

  // 12. Delete Test Dish
  await check('Delete Dish (DELETE /admin/menu/:id)', async () => {
    const res = await fetch(`${API_BASE}/admin/menu/${testDishId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.success) throw new Error('Delete failed');
  });

  // 13. Create & Get Coupon
  await check('Create Coupon (POST /admin/coupons)', async () => {
    const res = await fetch(`${API_BASE}/admin/coupons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({
        restaurant_id: RESTAURANT_ID,
        code: testCouponCode,
        discount_percentage: 15,
        minimum_order_amount: 350,
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.coupon || data.coupon.code !== testCouponCode) throw new Error('Coupon not created');
  });

  // 14. Sales CSV Report
  await check('Sales CSV Report (GET /admin/reports/sales/csv)', async () => {
    const res = await fetch(`${API_BASE}/admin/reports/sales/csv?restaurantId=${RESTAURANT_ID}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const csv = await res.text();
    if (!csv.includes('Order ID') || !csv.includes('Grand Total')) {
      throw new Error('Invalid CSV headers');
    }
  });

  // 15. Upload Image
  await check('Edge Image Upload (POST /admin/upload-image)', async () => {
    const res = await fetch(`${API_BASE}/admin/upload-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==' }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.url) throw new Error('Missing uploaded URL');
  });

  console.log(`\n====================================================`);
  console.log(`🎉 ADMIN SUITE LIVE VERIFICATION: ${passed}/${total} PASSED!`);
  console.log(`====================================================`);

  if (passed !== total) process.exit(1);
}

runAdminVerification();
