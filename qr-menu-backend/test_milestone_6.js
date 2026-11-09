// test_milestone_6.js - Verification of Item Cancellation & Cooking Lock Isolation
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

function deleteJson(path, data) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(data || {});
    const sessionToken = data?.sessionToken || '';
    const fullPath = sessionToken ? `${path}?sessionToken=${encodeURIComponent(sessionToken)}` : path;
    const req = http.request({
      hostname: '127.0.0.1',
      port: 3000,
      path: fullPath,
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'x-session-token': sessionToken,
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
  console.log('--- Testing Milestone 6: Item Cancellation & Cooking Lock Isolation ---');

  // 1. Get default table
  const tableRes = await getJson('/api/order/tables/default');
  const table = tableRes.data.table;
  const tableId = table.id;

  // 2. Fetch menu items
  const menuRes = await getJson(`/api/menu/${table.restaurant_id}`);
  const menu = menuRes.data.items || menuRes.data;
  const item1 = menu[0];
  const item2 = menu[1];

  // 3. Customer A session & order with item1 and item2
  const sessionA = await postJson('/api/order/session/init', { tableId, customerName: 'Alice' });
  const tokenA = sessionA.data.sessionToken;

  const orderA = await postJson('/api/order', {
    restaurantId: table.restaurant_id,
    tableId,
    sessionToken: tokenA,
    customer: { name: 'Alice', phone: '+91-9999900001', consentGiven: true },
    items: [
      { menuItemId: item1.id, quantity: 2 },
      { menuItemId: item2.id, quantity: 1 }
    ]
  });
  if (orderA.status !== 201) {
    console.error('Order A failed:', orderA);
  }
  console.log(`Customer A Order Created: ID ${orderA.data.orderId}, Subtotal: ${orderA.data.subtotal}`);

  // 4. Customer B session & order with item1
  const sessionB = await postJson('/api/order/session/init', { tableId, customerName: 'Bob' });
  const tokenB = sessionB.data.sessionToken;

  const orderB = await postJson('/api/order', {
    restaurantId: table.restaurant_id,
    tableId,
    sessionToken: tokenB,
    customer: { name: 'Bob', phone: '+91-9999900002', consentGiven: true },
    items: [
      { menuItemId: item1.id, quantity: 1 }
    ]
  });
  if (orderB.status !== 201) {
    console.error('Order B failed:', orderB);
  }
  console.log(`Customer B Order Created: ID ${orderB.data.orderId}, Subtotal: ${orderB.data.subtotal}`);

  // Retrieve Customer A's order details to get order_items IDs
  const orderADetails = await getJson(`/api/order/${orderA.data.orderId}`);
  const itemToCancel = orderADetails.data.items.find(i => i.menu_item_id === item2.id);
  const remainingItem = orderADetails.data.items.find(i => i.menu_item_id === item1.id);

  // 5. Test Cross-Session Cancellation Prevention: Customer B tries to delete Customer A's item
  console.log('Testing Cross-Session Cancellation Protection (Bob trying to delete Alice item)...');
  const crossCancelRes = await deleteJson(`/api/order/${orderA.data.orderId}/items/${itemToCancel.id}`, {
    sessionToken: tokenB
  });
  if (crossCancelRes.status === 403) {
    console.log('✅ Cross-session cancellation blocked with 403 Forbidden!');
  } else {
    throw new Error(`Expected 403, got ${crossCancelRes.status}: ${JSON.stringify(crossCancelRes.data)}`);
  }

  // 6. Test Valid Item Cancellation: Customer A cancels item2
  console.log('Testing Valid Item Cancellation by Alice...');
  const validCancelRes = await deleteJson(`/api/order/${orderA.data.orderId}/items/${itemToCancel.id}`, {
    sessionToken: tokenA
  });
  if (validCancelRes.status === 200) {
    console.log(`✅ Item cancelled successfully. New total: ${validCancelRes.data.total}`);
  } else {
    throw new Error(`Expected 200, got ${validCancelRes.status}: ${JSON.stringify(validCancelRes.data)}`);
  }

  // 7. Verify Customer B's order is completely untouched
  const orderBCheck = await getJson(`/api/order/${orderB.data.orderId}`);
  if (orderBCheck.data.items.length === 1 && orderBCheck.data.subtotal === orderB.data.subtotal) {
    console.log('✅ Customer B order remained completely intact and isolated!');
  } else {
    throw new Error('Customer B order was affected by Customer A cancellation');
  }

  // 8. Test Cooking Lock: Set Customer A's order to 'PREPARING' in database
  const db = require('./db');
  await db.query("UPDATE orders SET status = 'PREPARING' WHERE id = $1", [orderA.data.orderId]);
  console.log('Order status updated to PREPARING. Attempting to delete remaining item...');

  const lockedCancelRes = await deleteJson(`/api/order/${orderA.data.orderId}/items/${remainingItem.id}`, {
    sessionToken: tokenA
  });
  if (lockedCancelRes.status === 400 && lockedCancelRes.data.error.includes('preparing')) {
    console.log('✅ Cooking lock prevented cancellation of item while preparing (400 Bad Request)!');
  } else {
    throw new Error(`Expected 400 with preparing message, got ${lockedCancelRes.status}: ${JSON.stringify(lockedCancelRes.data)}`);
  }

  // Clean up
  await db.query('DELETE FROM order_items WHERE order_id IN ($1, $2)', [orderA.data.orderId, orderB.data.orderId]);
  await db.query('DELETE FROM orders WHERE id IN ($1, $2)', [orderA.data.orderId, orderB.data.orderId]);
  await db.query('DELETE FROM customer_sessions WHERE session_token IN ($1, $2)', [tokenA, tokenB]);
  console.log('Test orders and sessions cleaned up.');

  console.log('🎉 Milestone 6 Verification PASSED! All 4 core assertions verified.');
  process.exit(0);
}

run().catch(err => {
  console.error('❌ Milestone 6 Test Failed:', err);
  process.exit(1);
});
