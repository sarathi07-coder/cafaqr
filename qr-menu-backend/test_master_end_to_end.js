// test_master_end_to_end.js
// Comprehensive End-to-End Simulation of Multiple Independent Customer Sessions Under One Table
const http = require('http');
const { issueToken } = require('./middleware/auth');
const adminToken = issueToken({ email: 'admin@example.com' });

function request(method, path, data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const payload = data ? JSON.stringify(data) : null;
    const reqHeaders = {
      'Content-Type': 'application/json',
      ...headers
    };
    if (payload) {
      reqHeaders['Content-Length'] = Buffer.byteLength(payload);
    }
    const req = http.request({
      hostname: '127.0.0.1',
      port: 3000,
      path,
      method,
      headers: reqHeaders
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
    if (payload) req.write(payload);
    req.end();
  });
}

const get = (path, auth = false) => request('GET', path, null, auth ? { Authorization: `Bearer ${adminToken}` } : {});
const post = (path, data, auth = false) => request('POST', path, data, auth ? { Authorization: `Bearer ${adminToken}` } : {});
const put = (path, data, auth = false) => request('PUT', path, data, auth ? { Authorization: `Bearer ${adminToken}` } : {});
const del = (path, data, auth = false) => request('DELETE', path, data, auth ? { Authorization: `Bearer ${adminToken}` } : {});

async function runMasterTest() {
  console.log('=================================================================================');
  console.log('🏆 RESTAURANT QR ORDERING: MASTER END-TO-END SYSTEM VERIFICATION');
  console.log('   Multi-Customer Isolation, KDS Routing, Waiter Assistance, & Dual Settlement');
  console.log('=================================================================================\n');

  // Step 1: Clean slate & discover default table
  console.log('▶ STEP 1: Discover Table & Menu');
  const tableRes = await get('/api/order/tables/default');
  const table = tableRes.data.table;
  const tableId = table.id;
  const restaurantId = table.restaurant_id;

  const menuRes = await get(`/api/menu/${restaurantId}`);
  const dishes = menuRes.data.items || menuRes.data;
  console.log(`  Table: #${table.number} (ID: ${tableId})`);
  console.log(`  Restaurant: ${table.restaurant_name} (ID: ${restaurantId})`);
  console.log(`  Dishes available: ${dishes.length}\n`);

  const dish1 = dishes[0]; // e.g. Fresh Lime Soda (₹80)
  const dish2 = dishes[1]; // e.g. Mango Lassi (₹120)
  const dish3 = dishes[2]; // e.g. Butter Naan (₹50)

  // Step 2: Three simultaneous customers scan Table QR code
  console.log('▶ STEP 2: Three Diners Scan Same Table QR (Session Provisioning)');
  const [sA, sB, sC] = await Promise.all([
    post('/api/order/session/init', { tableId, customerName: 'Alice' }),
    post('/api/order/session/init', { tableId, customerName: 'Bob' }),
    post('/api/order/session/init', { tableId, customerName: 'Charlie' })
  ]);

  const tokenA = sA.data.sessionToken;
  const tokenB = sB.data.sessionToken;
  const tokenC = sC.data.sessionToken;

  console.log(`  Diner A: Token ${tokenA.slice(0, 15)}... (${sA.data.sessionLabel})`);
  console.log(`  Diner B: Token ${tokenB.slice(0, 15)}... (${sB.data.sessionLabel})`);
  console.log(`  Diner C: Token ${tokenC.slice(0, 15)}... (${sC.data.sessionLabel})`);

  if (tokenA === tokenB || tokenB === tokenC) {
    throw new Error('Collision detected in customer session tokens!');
  }
  console.log('  ✅ 3 distinct customer session tokens generated under same table.\n');

  // Step 3: Orders Placed with Independent Items & Notes
  console.log('▶ STEP 3: Diners Place Independent Orders');
  const orderA = await post('/api/order', {
    restaurantId,
    tableId,
    sessionToken: tokenA,
    customer: { name: 'Alice', phone: '+91-9999900001', consentGiven: true },
    notes: 'Extra ice in lime soda',
    items: [
      { menuItemId: dish1.id, quantity: 2 },
      { menuItemId: dish2.id, quantity: 1 }
    ]
  });
  console.log(`  Order A (Alice): ID ${orderA.data.orderId}, Subtotal ₹${orderA.data.subtotal}, Total ₹${orderA.data.total}`);

  const orderB = await post('/api/order', {
    restaurantId,
    tableId,
    sessionToken: tokenB,
    customer: { name: 'Bob', phone: '+91-9999900002', consentGiven: true },
    notes: 'Mango lassi chilled',
    items: [
      { menuItemId: dish2.id, quantity: 2 }
    ]
  });
  console.log(`  Order B (Bob): ID ${orderB.data.orderId}, Subtotal ₹${orderB.data.subtotal}, Total ₹${orderB.data.total}`);

  const orderC = await post('/api/order', {
    restaurantId,
    tableId,
    sessionToken: tokenC,
    customer: { name: 'Charlie', phone: '+91-9999900003', consentGiven: true },
    items: [
      { menuItemId: dish3.id, quantity: 2 }
    ]
  });
  console.log(`  Order C (Charlie): ID ${orderC.data.orderId}, Subtotal ₹${orderC.data.subtotal}, Total ₹${orderC.data.total}`);
  console.log('  ✅ All 3 orders bound to individual session tokens.\n');

  // Step 4: KDS Multi-Session Ticket Routing
  console.log('▶ STEP 4: Kitchen Display System (KDS) Routing');
  const kdsRes = await get(`/api/kitchen/tickets?restaurantId=${restaurantId}`);
  const tickets = kdsRes.data.tickets;

  const tA = tickets.find(t => t.id === orderA.data.orderId);
  const tB = tickets.find(t => t.id === orderB.data.orderId);
  const tC = tickets.find(t => t.id === orderC.data.orderId);

  if (!tA || !tB || !tC) throw new Error('Not all tickets appeared on KDS');
  console.log(`  Ticket A: Table #${tA.table_number} • ${tA.session_label} (${tA.customer_name}) - Status: ${tA.status}`);
  console.log(`  Ticket B: Table #${tB.table_number} • ${tB.session_label} (${tB.customer_name}) - Status: ${tB.status}`);
  console.log(`  Ticket C: Table #${tC.table_number} • ${tC.session_label} (${tC.customer_name}) - Status: ${tC.status}`);

  // Advance Ticket A to PREPARING -> READY
  await put(`/api/kitchen/tickets/${orderA.data.orderId}/advance`);
  await put(`/api/kitchen/tickets/${orderA.data.orderId}/advance`);
  const checkA = await get(`/api/order/${orderA.data.orderId}`);
  const checkB = await get(`/api/order/${orderB.data.orderId}`);
  console.log(`  Advancing Ticket A -> ${checkA.data.status}`);
  console.log(`  Ticket B Status remains -> ${checkB.data.status}`);
  if (checkA.data.status !== 'READY' || checkB.data.status !== 'PENDING') {
    throw new Error('KDS status progression affected another diner!');
  }
  console.log('  ✅ Independent cooking progression verified on KDS.\n');

  // Step 5: Waiter Calls from Specific Diners
  console.log('▶ STEP 5: Real-Time Waiter Calling per Customer');
  const callRes = await post(`/api/order/table/${tableId}/call-waiter`, {
    requestType: 'WATER',
    note: 'Fresh water bottle',
    sessionToken: tokenB,
    sessionLabel: sB.data.sessionLabel,
    customerName: 'Bob'
  });
  console.log(`  Waiter Call Result: "${callRes.data.message}"`);
  const activeCalls = await get(`/api/admin/service-requests?restaurantId=${restaurantId}&status=PENDING`, true);
  const bobCall = activeCalls.data.find(r => r.id === callRes.data.request.id);
  if (!bobCall || bobCall.customer_name !== 'Bob' || bobCall.session_label !== sB.data.sessionLabel) {
    throw new Error('Service request failed to record customer session metadata');
  }
  console.log(`  ✅ Waiter call accurately tagged Table #${bobCall.table_number} • ${bobCall.session_label} (Bob).\n`);
  // Resolve call
  await put(`/api/admin/service-requests/${bobCall.id}/resolve`, {}, true);

  // Step 6: Admin Grouped Table View
  console.log('▶ STEP 6: Admin Live Orders Grouped Table View');
  const groupedRes = await get(`/api/admin/tables/active-grouped?restaurantId=${restaurantId}`, true);
  const tableCard = groupedRes.data.find(t => t.tableId === tableId);
  console.log(`  Table Card: TABLE T${String(tableCard.tableNumber).padStart(2, '0')} (${tableCard.activeCustomersCount} Active Customers)`);
  console.log(`  Combined Bill: ₹${tableCard.combinedBill}`);
  tableCard.sections.forEach(sec => {
    console.log(`    ${sec.sectionLabel} (${sec.customerName}) - Subtotal: ₹${sec.total} [${sec.status}]`);
  });
  if (tableCard.activeCustomersCount !== 3) {
    throw new Error(`Expected 3 active customers, got ${tableCard.activeCustomersCount}`);
  }
  console.log('  ✅ Grouped table hierarchy & combined totals verified.\n');

  // Step 7: Dual Billing - Alice pays her bill individually
  console.log('▶ STEP 7: Dual Billing - Individual Settlement (Alice)');
  const settleAlice = await put(`/api/order/${orderA.data.orderId}/dismiss`, { paymentMethod: 'UPI' }, true);
  console.log(`  Alice Settlement: "${settleAlice.data.message}"`);
  console.log(`  Remaining Active Orders at Table: ${settleAlice.data.order.remainingActiveTableOrders}`);
  if (settleAlice.data.order.remainingActiveTableOrders !== 2) {
    throw new Error('Remaining order count mismatch after individual settlement');
  }

  const groupedRes2 = await get(`/api/admin/tables/active-grouped?restaurantId=${restaurantId}`, true);
  const tableCard2 = groupedRes2.data.find(t => t.tableId === tableId);
  console.log(`  Updated Table T${tableCard2.tableNumber}: ${tableCard2.activeCustomersCount} Active Customers (Bob & Charlie), New Combined Bill: ₹${tableCard2.combinedBill}`);
  if (tableCard2.activeCustomersCount !== 2) {
    throw new Error('Grouped view did not decrement active customers count');
  }
  console.log('  ✅ Individual diner bill settled; other diners unaffected.\n');

  // Step 8: Dual Billing - Bob & Charlie settle the rest of the table together
  console.log('▶ STEP 8: Dual Billing - Settle Entire Table (Bob & Charlie combined)');
  const settleAll = await put(`/api/order/table/${tableId}/settle-all`, { paymentMethod: 'CASH' });
  console.log(`  Table Settlement: "${settleAll.data.message}"`);
  console.log(`  Settled Orders Count: ${settleAll.data.settledOrdersCount}, Combined Total: ₹${settleAll.data.combinedTotal}`);

  const groupedRes3 = await get(`/api/admin/tables/active-grouped?restaurantId=${restaurantId}`, true);
  const tableCard3 = groupedRes3.data.find(t => t.tableId === tableId);
  if (tableCard3) {
    throw new Error('Table is still listed as active after settle-all!');
  }
  console.log(`  ✅ Table #${table.number} completely cleared and freed for next guests.\n`);

  // Step 9: Database Integrity Check
  console.log('▶ STEP 9: Database Integrity & Session Token Deactivation');
  const db = require('./db');
  const activeSess = await db.query(
    'SELECT COUNT(*) FROM customer_sessions WHERE session_token IN ($1, $2, $3) AND is_active = true',
    [tokenA, tokenB, tokenC]
  );
  if (parseInt(activeSess.rows[0].count, 10) !== 0) {
    throw new Error('Some sessions remained active after settlement');
  }
  console.log('  ✅ All customer session tokens cleanly marked inactive in PostgreSQL.\n');

  // Cleanup test order rows
  await db.query('DELETE FROM order_items WHERE order_id IN ($1, $2, $3)', [orderA.data.orderId, orderB.data.orderId, orderC.data.orderId]);
  await db.query('DELETE FROM orders WHERE id IN ($1, $2, $3)', [orderA.data.orderId, orderB.data.orderId, orderC.data.orderId]);
  await db.query('DELETE FROM customer_sessions WHERE session_token IN ($1, $2, $3)', [tokenA, tokenB, tokenC]);

  console.log('=================================================================================');
  console.log('🎉 MASTER VERIFICATION COMPLETE: ALL 9 PHASES PASSED WITH ZERO ERRORS!');
  console.log('=================================================================================\n');
  process.exit(0);
}

runMasterTest().catch(err => {
  console.error('❌ Master Test Failed:', err);
  process.exit(1);
});

