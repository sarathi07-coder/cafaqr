import app from './src/index.js';
import { createMockD1 } from './src/d1_mock.js';

async function testOrderPlacementModule() {
  console.log('🧪 Running Module 5 Verification: Order Placement & Multi-Round Cart Engine on D1...\n');

  const d1 = createMockD1({ loadSeed: true });
  const env = { DB: d1 };

  const restaurantId = 'db4ed920-3d20-420a-9f54-99d3c0b48a08';
  const tableId = 'b6f869e1-d722-440a-8928-a65e1e76ced5'; // Table 1

  // 1. Initialize session
  const initRes = await app.request(
    '/api/order/session/init',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tableId }),
    },
    env
  );
  const session = await initRes.json();
  const sessionToken = session.sessionToken;

  // 2. Place Initial Order: 1x Paneer Tikka (240) + 1x Mango Lassi (150)
  const placeRes = await app.request(
    '/api/order',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        restaurantId,
        tableId,
        sessionToken,
        customerName: 'Aarav Patel',
        customerPhone: '9812345678',
        items: [
          { menuItemId: '59eb2366-8c87-4990-9cbc-6bf2607ac15a', quantity: 1 }, // Paneer Tikka (240)
          { menuItemId: '2e3d9e19-123a-470c-99c0-38ef7af54b15', quantity: 1 }, // Mango Lassi (150)
        ],
        notes: 'Less spicy please',
      }),
    },
    env
  );

  const placeJson = await placeRes.json();
  console.log('📦 Round 1 Order Placed:', placeJson);
  if (placeRes.status !== 201) throw new Error('Order placement failed');
  if (placeJson.subtotal !== 390) throw new Error(`Subtotal mismatch. Expected 390, got ${placeJson.subtotal}`);
  if (placeJson.total !== 409.5) throw new Error(`Total mismatch. Expected 409.5, got ${placeJson.total}`);

  const orderId = placeJson.orderId;

  // 3. Multi-Round Ordering: Add 2x Butter Naan (50 each = 100)
  const addRes = await app.request(
    `/api/order/${orderId}/items`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [
          { menuItemId: 'b72fd47b-923a-48fa-a68d-e7d95de6e2b3', quantity: 2 }, // Butter Naan
        ],
      }),
    },
    env
  );

  const addJson = await addRes.json();
  console.log('🥖 Round 2 Extra Items Added:', addJson);
  if (addRes.status !== 200) throw new Error('Add items failed');
  if (addJson.newTotal !== 514.5) throw new Error(`New total mismatch. Expected 514.5, got ${addJson.newTotal}`);

  // 4. Apply Coupon WELCOME10 (10% off 490 = 49 discount)
  const couponRes = await app.request(
    `/api/order/${orderId}/apply-coupon`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'WELCOME10' }),
    },
    env
  );

  const couponJson = await couponRes.json();
  console.log('🎟️ Coupon WELCOME10 Applied:', couponJson);
  if (couponRes.status !== 200) throw new Error('Coupon apply failed');
  if (couponJson.discountAmount !== 49) throw new Error(`Discount mismatch. Expected 49, got ${couponJson.discountAmount}`);
  if (couponJson.total !== 463.05) throw new Error(`Discounted total mismatch. Expected 463.05, got ${couponJson.total}`);

  console.log('\n🎉 Module 5 (50%) Verification PASSED: Order Placement & Multi-Round Cart Engine on D1 are 100% Operational!\n');
}

testOrderPlacementModule().catch((err) => {
  console.error('❌ Module 5 test failed:', err);
  process.exit(1);
});
