import app from './src/index.js';
import { createMockD1 } from './src/d1_mock.js';

async function testAdminAnalyticsModule() {
  console.log('🧪 Running Module 9 Verification: Settlement, Feedback & Analytics on D1...\n');

  const d1 = createMockD1({ loadSeed: true });
  const env = { DB: d1, ADMIN_PASSWORD: 'supersecret' };

  const restaurantId = 'db4ed920-3d20-420a-9f54-99d3c0b48a08';
  const tableId = 'b6f869e1-d722-440a-8928-a65e1e76ced5';

  // 1. Place an order to settle
  const placeRes = await app.request(
    '/api/order',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        restaurantId,
        tableId,
        customerName: 'Pooja Hegde',
        customerPhone: '9845123456',
        items: [
          { menuItemId: 'b3a99aa3-4deb-43b7-864e-a2a92e162bbb', quantity: 2 }, // Paneer Butter Masala (290 x 2 = 580)
        ],
      }),
    },
    env
  );
  const placeJson = await placeRes.json();
  const orderId = placeJson.orderId;
  console.log('💵 Order placed for settlement test. Total:', placeJson.total);

  // 2. Cashier settles order ("Settle & Free Table")
  const settleRes = await app.request(
    `/api/admin/orders/${orderId}/settle`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentMethod: 'UPI' }),
    },
    env
  );
  const settleJson = await settleRes.json();
  console.log('🏁 Settle response:', settleJson);
  if (settleRes.status !== 200 || settleJson.status !== 'PAID') throw new Error('Order settlement failed');

  // 3. Customer submits 5-star feedback
  const fbRes = await app.request(
    `/api/order/${orderId}/feedback`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rating: 5,
        comments: 'Amazing food and lightning fast service!',
        restaurantId,
      }),
    },
    env
  );
  const fbJson = await fbRes.json();
  console.log('⭐ 5-Star Feedback recorded:', fbJson);
  if (fbRes.status !== 200 || !fbJson.success) throw new Error('Feedback submission failed');

  // 4. Admin queries Analytics Overview
  const analyticsRes = await app.request(`/api/admin/analytics/overview?restaurantId=${restaurantId}`, {}, env);
  const analyticsJson = await analyticsRes.json();
  console.log('📊 Admin Analytics Overview:', analyticsJson);
  if (analyticsRes.status !== 200 || analyticsJson.paidOrders < 1 || analyticsJson.totalRevenue <= 0) {
    throw new Error('Analytics overview calculation failed');
  }

  // 5. Admin queries feedback list
  const fbListRes = await app.request(`/api/admin/feedback?restaurantId=${restaurantId}`, {}, env);
  const fbList = await fbListRes.json();
  console.log('📝 Feedback reviews found:', fbList.length);
  if (fbListRes.status !== 200 || fbList.length === 0) throw new Error('Feedback list failed');

  // 6. 1-Click Menu Item Stock Toggle
  const dishId = 'b3a99aa3-4deb-43b7-864e-a2a92e162bbb'; // Paneer Butter Masala
  const toggleRes1 = await app.request(`/api/admin/menu/${dishId}/toggle-stock`, { method: 'PUT' }, env);
  const toggleJson1 = await toggleRes1.json();
  console.log('🔴 Marked dish OUT of stock:', toggleJson1.available === false);
  if (toggleJson1.available !== false) throw new Error('Toggle out of stock failed');

  const toggleRes2 = await app.request(`/api/admin/menu/${dishId}/toggle-stock`, { method: 'PUT' }, env);
  const toggleJson2 = await toggleRes2.json();
  console.log('🟢 Marked dish back IN stock:', toggleJson2.available === true);
  if (toggleJson2.available !== true) throw new Error('Toggle back in stock failed');

  console.log('\n🎉 Module 9 (90%) Verification PASSED: Settlement, Feedback & Analytics on D1 are 100% Operational!\n');
}

testAdminAnalyticsModule().catch((err) => {
  console.error('❌ Module 9 test failed:', err);
  process.exit(1);
});
