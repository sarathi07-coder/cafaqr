// test_milestone_9.js - Verification of Admin Live Orders Grouped Table View
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
  console.log('--- Testing Milestone 9: Admin Live Orders Grouped Table View ---');

  // 1. Get default table
  const tableRes = await getJson('/api/order/tables/default');
  const table = tableRes.data.table;
  const tableId = table.id;
  const restaurantId = table.restaurant_id;

  // 2. Fetch menu items
  const menuRes = await getJson(`/api/menu/${restaurantId}`);
  const menu = menuRes.data.items || menuRes.data;
  const item1 = menu[0];
  const item2 = menu[1];
  const item3 = menu[2];

  // 3. Customer A session & order (Alice)
  const sessionA = await postJson('/api/order/session/init', { tableId, customerName: 'Alice' });
  const tokenA = sessionA.data.sessionToken;

  const orderA = await postJson('/api/order', {
    restaurantId,
    tableId,
    sessionToken: tokenA,
    customer: { name: 'Alice', phone: '+91-9999900001', consentGiven: true },
    items: [
      { menuItemId: item1.id, quantity: 2 },
      { menuItemId: item2.id, quantity: 1 }
    ]
  });
  console.log(`✅ Customer A Order Placed (Alice): ID ${orderA.data.orderId}, Total: ₹${orderA.data.total}`);

  // 4. Customer B session & order (Bob)
  const sessionB = await postJson('/api/order/session/init', { tableId, customerName: 'Bob' });
  const tokenB = sessionB.data.sessionToken;

  const orderB = await postJson('/api/order', {
    restaurantId,
    tableId,
    sessionToken: tokenB,
    customer: { name: 'Bob', phone: '+91-9999900002', consentGiven: true },
    items: [
      { menuItemId: item2.id, quantity: 2 }
    ]
  });
  console.log(`✅ Customer B Order Placed (Bob): ID ${orderB.data.orderId}, Total: ₹${orderB.data.total}`);

  // 5. Customer C session & order (Charlie)
  const sessionC = await postJson('/api/order/session/init', { tableId, customerName: 'Charlie' });
  const tokenC = sessionC.data.sessionToken;

  const orderC = await postJson('/api/order', {
    restaurantId,
    tableId,
    sessionToken: tokenC,
    customer: { name: 'Charlie', phone: '+91-9999900003', consentGiven: true },
    items: [
      { menuItemId: item3.id, quantity: 1 }
    ]
  });
  console.log(`✅ Customer C Order Placed (Charlie): ID ${orderC.data.orderId}, Total: ₹${orderC.data.total}`);

  // 6. Fetch Grouped Tables View from Admin API
  const groupedRes = await getJson(`/api/admin/tables/active-grouped?restaurantId=${restaurantId}`, true);
  if (groupedRes.status !== 200 || !Array.isArray(groupedRes.data)) {
    throw new Error(`Failed to fetch active grouped tables: ${JSON.stringify(groupedRes.data)}`);
  }

  const tableCard = groupedRes.data.find(t => t.tableId === tableId);
  if (!tableCard) {
    throw new Error(`Could not find Table ${table.number} in grouped tables response`);
  }

  console.log(`\n============================================================`);
  console.log(`🪑 TABLE T${String(tableCard.tableNumber).padStart(2, '0')} (${tableCard.activeCustomersCount} Active Customers)    Combined Bill: ₹${tableCard.combinedBill}`);
  console.log(`============================================================`);

  tableCard.sections.forEach(sec => {
    console.log(`👤 ${sec.sectionLabel} (${sec.customerName})      Subtotal: ₹${sec.total}`);
    sec.items.forEach(it => {
      console.log(`   • ${it.quantity}x ${it.name} [${it.status}]`);
    });
    console.log(`   Status: ${sec.status}`);
  });

  // Verify assertions
  if (tableCard.activeCustomersCount !== 3) {
    throw new Error(`Expected 3 active customer sessions under table, got ${tableCard.activeCustomersCount}`);
  }
  const expectedCombined = Math.round((orderA.data.total + orderB.data.total + orderC.data.total) * 100) / 100;
  if (tableCard.combinedBill !== expectedCombined) {
    throw new Error(`Combined bill mismatch. Expected ₹${expectedCombined}, got ₹${tableCard.combinedBill}`);
  }
  if (tableCard.sections.length !== 3) {
    throw new Error(`Expected 3 sections, got ${tableCard.sections.length}`);
  }
  if (tableCard.sections[0].customerName !== 'Alice' ||
      tableCard.sections[1].customerName !== 'Bob' ||
      tableCard.sections[2].customerName !== 'Charlie') {
    throw new Error('Sections do not match diner names in order');
  }

  console.log('\n✅ Grouped table calculations, customer sections, items and combined totals verified successfully!');

  // Clean up
  const db = require('./db');
  await db.query('DELETE FROM order_items WHERE order_id IN ($1, $2, $3)', [orderA.data.orderId, orderB.data.orderId, orderC.data.orderId]);
  await db.query('DELETE FROM orders WHERE id IN ($1, $2, $3)', [orderA.data.orderId, orderB.data.orderId, orderC.data.orderId]);
  await db.query('DELETE FROM customer_sessions WHERE session_token IN ($1, $2, $3)', [tokenA, tokenB, tokenC]);
  console.log('Test orders and customer sessions cleaned up.');

  console.log('🎉 Milestone 9 Verification PASSED!');
  process.exit(0);
}

run().catch(err => {
  console.error('❌ Milestone 9 Test Failed:', err);
  process.exit(1);
});

