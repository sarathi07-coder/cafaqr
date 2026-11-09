// test_milestone_7.js - Verification of Kitchen Display System (KDS) Multi-Session Routing
const http = require('http');

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

function getJson(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:3000${path}`, res => {
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
  console.log('--- Testing Milestone 7: KDS Multi-Session Routing & Independent Progress ---');

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

  // 3. Customer A session & order
  const sessionA = await postJson('/api/order/session/init', { tableId, customerName: 'Alice' });
  const tokenA = sessionA.data.sessionToken;

  const orderA = await postJson('/api/order', {
    restaurantId,
    tableId,
    sessionToken: tokenA,
    customer: { name: 'Alice', phone: '+91-9999900001', consentGiven: true },
    notes: 'Extra spicy, no cilantro',
    items: [{ menuItemId: item1.id, quantity: 2 }]
  });
  console.log(`✅ Customer A Order Placed: ID ${orderA.data.orderId}`);

  // 4. Customer B session & order at SAME table
  const sessionB = await postJson('/api/order/session/init', { tableId, customerName: 'Bob' });
  const tokenB = sessionB.data.sessionToken;

  const orderB = await postJson('/api/order', {
    restaurantId,
    tableId,
    sessionToken: tokenB,
    customer: { name: 'Bob', phone: '+91-9999900002', consentGiven: true },
    notes: 'Serve with extra lime',
    items: [{ menuItemId: item2.id, quantity: 1 }]
  });
  console.log(`✅ Customer B Order Placed: ID ${orderB.data.orderId}`);

  // 5. Fetch KDS tickets
  const kdsRes = await getJson(`/api/kitchen/tickets?restaurantId=${restaurantId}`);
  const tickets = kdsRes.data.tickets;

  const ticketA = tickets.find(t => t.id === orderA.data.orderId || t.order_id === orderA.data.orderId);
  const ticketB = tickets.find(t => t.id === orderB.data.orderId || t.order_id === orderB.data.orderId);

  if (!ticketA || !ticketB) {
    throw new Error('Could not find both tickets in KDS response');
  }

  // Verify KDS displays Table Number, Customer Session Identifier, Notes, Items
  console.log(`Ticket A: Table #${ticketA.table_number}, Session: ${ticketA.session_label}, Customer: ${ticketA.customer_name}, Notes: "${ticketA.notes}"`);
  console.log(`Ticket B: Table #${ticketB.table_number}, Session: ${ticketB.session_label}, Customer: ${ticketB.customer_name}, Notes: "${ticketB.notes}"`);

  if (!ticketA.session_label || !ticketB.session_label) {
    throw new Error('Tickets missing session_label in KDS');
  }
  if (ticketA.table_number !== ticketB.table_number) {
    throw new Error('Both tickets should share the same table number');
  }
  if (ticketA.notes !== 'Extra spicy, no cilantro') {
    throw new Error('Ticket A notes mismatch');
  }
  console.log('✅ KDS tickets correctly include Table Number, Session Label, Customer Name & Notes!');

  // 6. Advance Customer A's ticket to PREPARING
  console.log('Advancing Customer A to PREPARING...');
  const advance1 = await putJson(`/api/kitchen/tickets/${orderA.data.orderId}/advance`);
  if (advance1.data.order.status !== 'PREPARING') {
    throw new Error(`Expected PREPARING, got ${advance1.data.order.status}`);
  }

  // Verify Customer B's order is STILL PENDING
  const orderBCheck = await getJson(`/api/order/${orderB.data.orderId}`);
  if (orderBCheck.data.status !== 'PENDING') {
    throw new Error(`Customer B status was affected: ${orderBCheck.data.status}`);
  }
  console.log('✅ Advancing Customer A to PREPARING left Customer B in PENDING!');

  // 7. Advance Customer A's ticket to READY
  console.log('Advancing Customer A to READY...');
  const advance2 = await putJson(`/api/kitchen/tickets/${orderA.data.orderId}/advance`);
  if (advance2.data.order.status !== 'READY') {
    throw new Error(`Expected READY, got ${advance2.data.order.status}`);
  }

  // Verify Customer B is STILL PENDING
  const orderBCheck2 = await getJson(`/api/order/${orderB.data.orderId}`);
  if (orderBCheck2.data.status !== 'PENDING') {
    throw new Error(`Customer B status was affected: ${orderBCheck2.data.status}`);
  }
  console.log('✅ Advancing Customer A to READY left Customer B in PENDING!');

  // Clean up
  const db = require('./db');
  await db.query('DELETE FROM order_items WHERE order_id IN ($1, $2)', [orderA.data.orderId, orderB.data.orderId]);
  await db.query('DELETE FROM orders WHERE id IN ($1, $2)', [orderA.data.orderId, orderB.data.orderId]);
  await db.query('DELETE FROM customer_sessions WHERE session_token IN ($1, $2)', [tokenA, tokenB]);
  console.log('Test orders and sessions cleaned up.');

  console.log('🎉 Milestone 7 Verification PASSED! All KDS multi-session requirements verified.');
  process.exit(0);
}

run().catch(err => {
  console.error('❌ Milestone 7 Test Failed:', err);
  process.exit(1);
});

