// test_milestone_10.js - Dual Billing System & Complete Lifecycle Verification (100%)
const http = require('http');
const { issueToken } = require('./middleware/auth');
const adminToken = issueToken({ email: 'admin@example.com' });

function postJson(path, data) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(data);
    const req = http.request({
      hostname: '127.0.0.1',
      port: 3000,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, text: body });
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function putJson(path, data) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(data || {});
    const req = http.request({
      hostname: '127.0.0.1',
      port: 3000,
      path,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`,
        'Content-Length': Buffer.byteLength(payload)
      }
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, text: body });
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function getJson(path, auth = false) {
  return new Promise((resolve, reject) => {
    const headers = {};
    if (auth) headers['Authorization'] = `Bearer ${adminToken}`;
    http.get(`http://127.0.0.1:3000${path}`, { headers }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, text: body });
        }
      });
    }).on('error', reject);
  });
}

async function run() {
  console.log('========================================================================');
  console.log('🚀 RESTAURANT QR ORDERING: MILESTONE 10 (100%) - DUAL BILLING SYSTEM');
  console.log('   Individual Customer Settlement vs Combined Table Settlement');
  console.log('========================================================================\n');

  // 1. Get Table
  const tableRes = await getJson('/api/order/tables/default');
  const table = tableRes.data.table;
  const tableId = table.id;
  const restaurantId = table.restaurant_id;

  // 2. Fetch menu
  const menuRes = await getJson(`/api/menu/${restaurantId}`);
  const menu = menuRes.data.items || menuRes.data;
  const item1 = menu[0]; // e.g. Fresh Lime Soda (₹80)
  const item2 = menu[1]; // e.g. Mango Lassi (₹120)
  const item3 = menu[2]; // e.g. Butter Naan (₹50)

  // 3. Customer A (Alice) orders
  const sA = await postJson('/api/order/session/init', { tableId, customerName: 'Alice' });
  const tokenA = sA.data.sessionToken;
  const orderA = await postJson('/api/order', {
    restaurantId,
    tableId,
    sessionToken: tokenA,
    customer: { name: 'Alice', phone: '+91-9999900001', consentGiven: true },
    items: [{ menuItemId: item1.id, quantity: 2 }, { menuItemId: item2.id, quantity: 1 }] // (160 + 120) * 1.05 = ₹294
  });
  console.log(`[1] Customer A (Alice) placed order: Total ₹${orderA.data.total}`);

  // 4. Customer B (Bob) orders
  const sB = await postJson('/api/order/session/init', { tableId, customerName: 'Bob' });
  const tokenB = sB.data.sessionToken;
  const orderB = await postJson('/api/order', {
    restaurantId,
    tableId,
    sessionToken: tokenB,
    customer: { name: 'Bob', phone: '+91-9999900002', consentGiven: true },
    items: [{ menuItemId: item2.id, quantity: 2 }] // (240) * 1.05 = ₹252
  });
  console.log(`[2] Customer B (Bob) placed order: Total ₹${orderB.data.total}`);

  // 5. Customer C (Charlie) orders
  const sC = await postJson('/api/order/session/init', { tableId, customerName: 'Charlie' });
  const tokenC = sC.data.sessionToken;
  const orderC = await postJson('/api/order', {
    restaurantId,
    tableId,
    sessionToken: tokenC,
    customer: { name: 'Charlie', phone: '+91-9999900003', consentGiven: true },
    items: [{ menuItemId: item3.id, quantity: 1 }] // (50) * 1.05 = ₹52.5
  });
  console.log(`[3] Customer C (Charlie) placed order: Total ₹${orderC.data.total}`);

  // Verify Grouped View with 3 Customers
  let groupedRes = await getJson(`/api/admin/tables/active-grouped?restaurantId=${restaurantId}`, true);
  let tableGroup = groupedRes.data.find(t => t.tableId === tableId);
  console.log(`\nInitial Table T${table.number}: ${tableGroup.activeCustomersCount} Active Customers, Combined Bill: ₹${tableGroup.combinedBill}`);
  if (tableGroup.activeCustomersCount !== 3) {
    throw new Error(`Expected 3 active customer sessions, got ${tableGroup.activeCustomersCount}`);
  }

  // 6. Test Scenario A: Alice settles her individual bill separately via UPI
  console.log('\n--- SCENARIO A: Individual Bill Settlement for Alice (₹' + orderA.data.total + ') ---');
  const settleAlice = await putJson(`/api/order/${orderA.data.orderId}/dismiss`, { paymentMethod: 'UPI' });
  if (settleAlice.status !== 200) {
    throw new Error(`Failed to settle Alice's bill: ${JSON.stringify(settleAlice.data)}`);
  }
  console.log(`✅ Alice's bill settled! API Response: "${settleAlice.data.message}"`);
  console.log(`   Remaining active orders at Table ${table.number}: ${settleAlice.data.order.remainingActiveTableOrders}`);

  if (settleAlice.data.order.remainingActiveTableOrders !== 2) {
    throw new Error(`Expected 2 remaining orders at table, got ${settleAlice.data.order.remainingActiveTableOrders}`);
  }

  // Verify Customer B and C's orders are still completely intact and active
  const checkB = await getJson(`/api/order/${orderB.data.orderId}`);
  const checkC = await getJson(`/api/order/${orderC.data.orderId}`);
  if (checkB.data.status === 'PAID' || checkC.data.status === 'PAID') {
    throw new Error('Customer B or C was erroneously settled when Alice settled');
  }
  console.log('✅ Customer B and Customer C orders are STILL ACTIVE and unsettled!');

  // Verify Grouped View now reflects 2 Active Customers (Bob & Charlie)
  groupedRes = await getJson(`/api/admin/tables/active-grouped?restaurantId=${restaurantId}`, true);
  tableGroup = groupedRes.data.find(t => t.tableId === tableId);
  const remainingExpectedBill = Math.round((orderB.data.total + orderC.data.total) * 100) / 100;
  console.log(`Updated Table T${table.number}: ${tableGroup.activeCustomersCount} Active Customers, New Combined Bill: ₹${tableGroup.combinedBill}`);

  if (tableGroup.activeCustomersCount !== 2) {
    throw new Error(`Expected 2 active customers, got ${tableGroup.activeCustomersCount}`);
  }
  if (tableGroup.combinedBill !== remainingExpectedBill) {
    throw new Error(`Expected combined bill ₹${remainingExpectedBill}, got ₹${tableGroup.combinedBill}`);
  }
  console.log('✅ Grouped Table View accurately updated after individual diner checkout!');

  // 7. Test Scenario B: Bob and Charlie decide to pay the rest of the table combined via CASH
  console.log('\n--- SCENARIO B: Combined Table Settlement for Bob & Charlie (₹' + remainingExpectedBill + ') ---');
  const settleAllRes = await putJson(`/api/order/table/${tableId}/settle-all`, { paymentMethod: 'CASH' });
  if (settleAllRes.status !== 200) {
    throw new Error(`Failed to settle entire table: ${JSON.stringify(settleAllRes.data)}`);
  }
  console.log(`✅ Table settled together! API Response: "${settleAllRes.data.message}"`);
  console.log(`   Settled orders count: ${settleAllRes.data.settledOrdersCount}, Combined Total: ₹${settleAllRes.data.combinedTotal}`);

  if (settleAllRes.data.settledOrdersCount !== 2) {
    throw new Error(`Expected 2 settled orders in combined transaction, got ${settleAllRes.data.settledOrdersCount}`);
  }
  if (settleAllRes.data.combinedTotal !== remainingExpectedBill) {
    throw new Error(`Expected combined total ₹${remainingExpectedBill}, got ₹${settleAllRes.data.combinedTotal}`);
  }

  // 8. Verify Table is now completely cleared in Grouped View
  groupedRes = await getJson(`/api/admin/tables/active-grouped?restaurantId=${restaurantId}`, true);
  const findClearedTable = groupedRes.data.find(t => t.tableId === tableId);
  if (findClearedTable) {
    throw new Error('Table is still listed as active in grouped tables!');
  }
  console.log(`✅ Table ${table.number} is completely cleared and freed for the next guests!`);

  // 9. Verify all 3 customer sessions are marked inactive
  const db = require('./db');
  const activeSessRes = await db.query(
    `SELECT COUNT(*) FROM customer_sessions WHERE session_token IN ($1, $2, $3) AND is_active = true`,
    [tokenA, tokenB, tokenC]
  );
  if (parseInt(activeSessRes.rows[0].count, 10) !== 0) {
    throw new Error('Some customer sessions remained active after settlement');
  }
  console.log('✅ All customer session tokens have been deactivated successfully.');

  // Clean up
  await db.query('DELETE FROM order_items WHERE order_id IN ($1, $2, $3)', [orderA.data.orderId, orderB.data.orderId, orderC.data.orderId]);
  await db.query('DELETE FROM orders WHERE id IN ($1, $2, $3)', [orderA.data.orderId, orderB.data.orderId, orderC.data.orderId]);
  await db.query('DELETE FROM customer_sessions WHERE session_token IN ($1, $2, $3)', [tokenA, tokenB, tokenC]);

  console.log('\n========================================================================');
  console.log('🎉 100% COMPLETE! ALL 10 MILESTONES FULLY IMPLEMENTED & VERIFIED!');
  console.log('========================================================================\n');
  process.exit(0);
}

run().catch(err => {
  console.error('❌ Milestone 10 Test Failed:', err);
  process.exit(1);
});

