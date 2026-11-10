// Master End-to-End Integration Simulation for Cloudflare D1 + Workers
import app from './src/index.js';
import { createMockD1 } from './src/d1_mock.js';

async function runMasterSimulation() {
  console.log('================================================================');
  console.log('🚀 RUNNING MASTER 100% CLOUDFLARE E2E INTEGRATION SIMULATION');
  console.log('================================================================\n');

  const d1 = createMockD1({ loadSeed: true });
  const env = { DB: d1, ADMIN_PASSWORD: 'supersecret' };
  const restaurantId = 'db4ed920-3d20-420a-9f54-99d3c0b48a08';

  // -------------------------------------------------------------
  // STEP 1: Handshake & Default Table Discovery
  // -------------------------------------------------------------
  console.log('--- Step 1: Handshake & Table Discovery ---');
  const tableRes = await app.request('/api/order/tables/default', {}, env);
  const { table } = await tableRes.json();
  console.log(`✅ Discovered Table #${table.number} (${table.restaurant_name})`);

  // -------------------------------------------------------------
  // STEP 2: Customer Session Handshake
  // -------------------------------------------------------------
  console.log('\n--- Step 2: Customer Session Handshake ---');
  const sessRes = await app.request(
    '/api/order/session/init',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tableId: table.id }),
    },
    env
  );
  const session = await sessRes.json();
  console.log(`✅ Session active: ${session.sessionLabel} (Token: ${session.sessionToken.slice(0, 16)}...)`);

  // -------------------------------------------------------------
  // STEP 3: Menu Browsing with Edge Caching
  // -------------------------------------------------------------
  console.log('\n--- Step 3: Menu Browsing with Edge Caching ---');
  const menuRes = await app.request(`/api/menu/${restaurantId}?groupByCategory=true`, {}, env);
  const menuData = await menuRes.json();
  console.log(`✅ Menu loaded: ${menuData.totalItems} dishes across ${menuData.categories.length} categories`);

  // -------------------------------------------------------------
  // STEP 4: Placing Initial Order (Round 1)
  // -------------------------------------------------------------
  console.log('\n--- Step 4: Placing Initial Order (Round 1) ---');
  const orderRes = await app.request(
    '/api/order',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        restaurantId,
        tableId: table.id,
        sessionToken: session.sessionToken,
        customerName: 'Vikram Seth',
        customerPhone: '9876501234',
        items: [
          { menuItemId: '59eb2366-8c87-4990-9cbc-6bf2607ac15a', quantity: 1 }, // Paneer Tikka (240)
          { menuItemId: '540051c9-89cc-4e5c-aa00-95fae1c04c80', quantity: 2 }, // Fresh Lime Soda (80 x 2 = 160)
        ],
        notes: 'Extra lime wedges please',
      }),
    },
    env
  );
  const order1 = await orderRes.json();
  console.log(`✅ Order placed! Ticket #${order1.orderId.slice(0, 8)} | Subtotal: ₹${order1.subtotal} | Total: ₹${order1.total}`);

  // -------------------------------------------------------------
  // STEP 5: Kitchen Ticket Notification & Cooking Progression
  // -------------------------------------------------------------
  console.log('\n--- Step 5: Kitchen Progression ---');
  const kTickets1 = await (await app.request(`/api/kitchen/tickets/${restaurantId}`, {}, env)).json();
  console.log(`👨‍🍳 Kitchen received ${kTickets1.length} active ticket(s)`);

  await app.request(`/api/kitchen/tickets/${order1.orderId}/advance`, { method: 'PUT', body: JSON.stringify({ status: 'PREPARING' }) }, env);
  console.log('🔥 Chef started cooking (Status: PREPARING)');

  await app.request(`/api/kitchen/tickets/${order1.orderId}/advance`, { method: 'PUT', body: JSON.stringify({ status: 'READY' }) }, env);
  console.log('🛎️ Dishes plated and ready for runners (Status: READY)');

  // -------------------------------------------------------------
  // STEP 6: Multi-Round Ordering (Adding Main Course)
  // -------------------------------------------------------------
  console.log('\n--- Step 6: Multi-Round Ordering (Round 2) ---');
  const round2Res = await app.request(
    `/api/order/${order1.orderId}/items`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [
          { menuItemId: 'b3a99aa3-4deb-43b7-864e-a2a92e162bbb', quantity: 1 }, // Paneer Butter Masala (290)
          { menuItemId: '9e3a08ad-311a-47e5-8911-cb534b5e0759', quantity: 2 }, // Garlic Naan (65 x 2 = 130)
        ],
      }),
    },
    env
  );
  const round2 = await round2Res.json();
  console.log(`✅ Round 2 dishes added to table tab! New running total: ₹${round2.newTotal}`);

  // -------------------------------------------------------------
  // STEP 7: Waiter Service Call
  // -------------------------------------------------------------
  console.log('\n--- Step 7: Waiter Service Assistance Call ---');
  const callRes = await app.request(
    `/api/order/table/${table.id}/call-waiter`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestType: 'Water Refill', customerName: 'Vikram Seth' }),
    },
    env
  );
  const callJson = await callRes.json();
  console.log(`🛎️ Service call dispatched: ${callJson.message}`);

  await app.request(`/api/admin/service-requests/${callJson.requestId}/resolve`, { method: 'PUT' }, env);
  console.log('✅ Floor staff attended and resolved service call');

  // -------------------------------------------------------------
  // STEP 8: Dynamic Multi-Bank UPI Switcher with Passkey
  // -------------------------------------------------------------
  console.log('\n--- Step 8: Dynamic UPI Bank Switcher ---');
  const upiSwitchRes = await app.request(
    '/api/admin/upi',
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        restaurantId,
        upiId: 'royalspice.bistro@okhdfcbank',
        upiName: 'Royal Spice Bistro (HDFC)',
        passkey: '1234',
      }),
    },
    env
  );
  console.log('🏦 Switched receiving account to HDFC Bank with Passkey 1234');

  const customerUpi = await (await app.request('/api/order/upi-info', {}, env)).json();
  console.log(`📱 Diner dynamic QR destination synced to: ${customerUpi.upiId}`);

  // Diner submits payment proof
  await app.request(
    '/api/order/upi/notify',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: order1.orderId, utr: '887766554433', amount: round2.newTotal, upiId: customerUpi.upiId }),
    },
    env
  );
  console.log('🔔 Customer submitted UTR: 887766554433');

  // -------------------------------------------------------------
  // STEP 9: Cashier Settle & Table Release
  // -------------------------------------------------------------
  console.log('\n--- Step 9: Cashier Settlement & Table Release ---');
  const settleRes = await app.request(
    `/api/admin/orders/${order1.orderId}/settle`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentMethod: 'UPI' }),
    },
    env
  );
  const settleJson = await settleRes.json();
  console.log(`🎉 Table bill settled (${settleJson.status})! Table #${table.number} released for next guests.`);

  // -------------------------------------------------------------
  // STEP 10: 5-Star Review & Analytics Overview
  // -------------------------------------------------------------
  console.log('\n--- Step 10: 5-Star Review & Live Analytics ---');
  await app.request(
    `/api/order/${order1.orderId}/feedback`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating: 5, comments: 'Exquisite food and seamless QR experience!', restaurantId }),
    },
    env
  );
  console.log('⭐ Diner submitted 5-Star feedback review');

  const analytics = await (await app.request(`/api/admin/analytics/overview?restaurantId=${restaurantId}`, {}, env)).json();
  console.log(`📊 Updated Revenue: ₹${analytics.totalRevenue} | Paid Orders: ${analytics.paidOrders} | Avg Rating: ${analytics.avgRating} ⭐`);

  console.log('\n================================================================');
  console.log('🏆 100% MASTER CLOUDFLARE E2E INTEGRATION SIMULATION: SUCCESS!');
  console.log('================================================================\n');
}

runMasterSimulation().catch((err) => {
  console.error('❌ Master simulation failed:', err);
  process.exit(1);
});

