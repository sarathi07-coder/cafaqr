import app from './src/index.js';
import { createMockD1 } from './src/d1_mock.js';

async function testKitchenModule() {
  console.log('🧪 Running Module 6 Verification: Kitchen Display System (KDS) & Progression on D1...\n');

  const d1 = createMockD1({ loadSeed: true });
  const env = { DB: d1 };

  const restaurantId = 'db4ed920-3d20-420a-9f54-99d3c0b48a08';
  const tableId = 'b6f869e1-d722-440a-8928-a65e1e76ced5';

  // 1. Place a fresh order to cook
  const placeRes = await app.request(
    '/api/order',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        restaurantId,
        tableId,
        customerName: 'Chef Reviewer',
        items: [
          { menuItemId: '0923b978-957c-4fc1-9536-fbfa5a01730f', quantity: 1 }, // Butter Chicken
        ],
      }),
    },
    env
  );
  const placeJson = await placeRes.json();
  const orderId = placeJson.orderId;
  console.log('🍳 Order created for kitchen test:', orderId);

  // 2. Fetch kitchen tickets (Must find 1 pending ticket)
  const ticketsRes1 = await app.request(`/api/kitchen/tickets/${restaurantId}`, {}, env);
  const tickets1 = await ticketsRes1.json();
  console.log('📋 Initial Kitchen Tickets count:', tickets1.length);
  if (ticketsRes1.status !== 200 || tickets1.length === 0) throw new Error('Kitchen tickets fetch failed');
  const ticket = tickets1.find((t) => t.id === orderId);
  if (!ticket || ticket.status !== 'PENDING') throw new Error('Ticket not in PENDING state');

  // 3. Advance to PREPARING
  const advRes1 = await app.request(`/api/kitchen/tickets/${orderId}/advance`, { method: 'PUT' }, env);
  const advJson1 = await advRes1.json();
  console.log('🔥 Advanced to status:', advJson1.status);
  if (advJson1.status !== 'PREPARING') throw new Error('Failed to advance to PREPARING');

  // 4. Advance to READY
  const advRes2 = await app.request(`/api/kitchen/tickets/${orderId}/advance`, { method: 'PUT' }, env);
  const advJson2 = await advRes2.json();
  console.log('🛎️ Advanced to status:', advJson2.status);
  if (advJson2.status !== 'READY') throw new Error('Failed to advance to READY');

  // 5. Advance to SERVED
  const advRes3 = await app.request(`/api/kitchen/tickets/${orderId}/advance`, { method: 'PUT' }, env);
  const advJson3 = await advRes3.json();
  console.log('🍽️ Advanced to status:', advJson3.status);
  if (advJson3.status !== 'SERVED') throw new Error('Failed to advance to SERVED');

  // 6. Verify ticket is cleared from active board
  const ticketsRes2 = await app.request(`/api/kitchen/tickets/${restaurantId}`, {}, env);
  const tickets2 = await ticketsRes2.json();
  const stillPresent = tickets2.some((t) => t.id === orderId);
  console.log('🧹 Ticket cleared from active board:', !stillPresent);
  if (stillPresent) throw new Error('Served ticket should not appear on active kitchen board');

  console.log('\n🎉 Module 6 (60%) Verification PASSED: Kitchen Display System (KDS) on D1 is 100% Operational!\n');
}

testKitchenModule().catch((err) => {
  console.error('❌ Module 6 test failed:', err);
  process.exit(1);
});
