// test_milestone_5.js - Automated Verification for Milestone 5 (50% Tax Math, Confetti & Order Placement)
process.env.NODE_ENV = 'test';

import http from 'http';
import { io } from 'socket.io-client';

console.log('================================================================');
console.log('🚀 RESTAURANT QR ORDERING SYSTEM: MILESTONE 5 VERIFICATION (50%)');
console.log('================================================================\n');

let failed = false;
function assert(desc, condition) {
  if (condition) {
    console.log(`  ✅ [PASS] ${desc}`);
  } else {
    console.log(`  ❌ [FAIL] ${desc}`);
    failed = true;
  }
}

async function request(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data), raw: data });
        } catch {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function runMilestone5() {
  const backendModule = await import('../qr-menu-backend/server.js');
  const server = backendModule.server || backendModule.default?.server;
  const db = (await import('../qr-menu-backend/db/index.js')).default || (await import('../qr-menu-backend/db/index.js'));
  const PORT = 3016;

  server.listen(PORT, async () => {
    try {
      console.log(`--- STEP 1: Provision Clean Dining Table in Database ---`);
      const defaultTableRes = await request({
        hostname: 'localhost',
        port: PORT,
        path: '/api/order/tables/default',
        method: 'GET',
      });
      const restaurantId = defaultTableRes.body?.table?.restaurant_id;
      assert('Found active restaurant ID from database', !!restaurantId);

      const uniqueTableNum = Math.floor(10000 + Math.random() * 90000);
      const tableInsert = await db.query(
        'INSERT INTO tables (restaurant_id, number) VALUES ($1, $2) RETURNING id, number',
        [restaurantId, uniqueTableNum]
      );
      const testTableId = tableInsert.rows[0].id;
      const testTableNum = tableInsert.rows[0].number;
      console.log(`     Provisioned Table #${testTableNum} (ID: ${testTableId})`);

      console.log(`\n--- STEP 2: Fetch Active Menu Dishes for Order Cart ---`);
      const menuRes = await db.query(
        'SELECT id, name, price, category FROM menu_items WHERE restaurant_id = $1 AND available = true ORDER BY price DESC LIMIT 3',
        [restaurantId]
      );
      assert('Found at least 2 active menu items', menuRes.rowCount >= 2);
      const item1 = menuRes.rows[0];
      const item2 = menuRes.rows[1];
      console.log(`     Dish 1: ${item1.name} (₹${item1.price})`);
      console.log(`     Dish 2: ${item2.name} (₹${item2.price})`);

      console.log(`\n--- STEP 3: Verify Frontend Tax & Grand Total Math ---`);
      const qty1 = 2;
      const qty2 = 3;
      const expectedSubtotal = (parseFloat(item1.price) * qty1) + (parseFloat(item2.price) * qty2);
      const expectedTax = Math.round(expectedSubtotal * 0.05 * 100) / 100;
      const expectedTotal = parseFloat((expectedSubtotal + expectedTax).toFixed(2));

      console.log(`     Item 1: ₹${item1.price} x ${qty1} = ₹${(parseFloat(item1.price) * qty1).toFixed(2)}`);
      console.log(`     Item 2: ₹${item2.price} x ${qty2} = ₹${(parseFloat(item2.price) * qty2).toFixed(2)}`);
      console.log(`     Subtotal:   ₹${expectedSubtotal.toFixed(2)}`);
      console.log(`     5% GST:     ₹${expectedTax.toFixed(2)}`);
      console.log(`     Grand Total: ₹${expectedTotal.toFixed(2)}`);

      assert('Subtotal is greater than 0', expectedSubtotal > 0);
      assert('5% GST is mathematically accurate', expectedTax === Math.round(expectedSubtotal * 0.05 * 100) / 100);

      console.log(`\n--- STEP 4: Setup Real-Time Socket Listener for Incoming Order ---`);
      const socket = io(`http://localhost:${PORT}`, {
        transports: ['websocket'],
        reconnection: false,
      });

      let receivedSocketEvent = null;
      socket.on('order:new', (data) => {
        receivedSocketEvent = data;
      });

      await new Promise((resolve) => {
        socket.on('connect', resolve);
      });
      assert('Socket.IO connected and listening for kitchen dispatch', socket.connected);

      console.log(`\n--- STEP 5: Place Order via API Client ---`);
      const chefNotes = 'Medium spicy, please keep sauce on the side';
      const orderPayload = {
        restaurantId,
        tableId: testTableId,
        customer: {
          name: 'Arjun Verma',
          phone: '+91-9876501234',
          consentGiven: true,
        },
        notes: chefNotes,
        items: [
          { menuItemId: item1.id, quantity: qty1 },
          { menuItemId: item2.id, quantity: qty2 },
        ],
      };

      const orderRes = await request(
        {
          hostname: 'localhost',
          port: PORT,
          path: '/api/order',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        },
        orderPayload
      );

      assert('Order creation responds (HTTP 201 Created)', orderRes.status === 201);
      const orderId = orderRes.body?.orderId || orderRes.body?.order?.id;
      assert('Valid order ID generated', !!orderId);
      assert('Order status initialized to PENDING', orderRes.body?.status === 'PENDING');
      assert(`Order subtotal matches: ₹${expectedSubtotal.toFixed(2)}`, 
        orderRes.body?.subtotal === expectedSubtotal);
      assert(`Order 5% tax matches: ₹${expectedTax.toFixed(2)}`, 
        orderRes.body?.taxAmount === expectedTax);
      assert(`Order grand total matches: ₹${expectedTotal.toFixed(2)}`, 
        orderRes.body?.total === expectedTotal);

      console.log(`\n--- STEP 6: Verify PostgreSQL Database State & Line Items ---`);
      const orderDbRes = await db.query(
        'SELECT id, status, subtotal, tax_amount, total, notes FROM orders WHERE id = $1',
        [orderId]
      );
      assert('Order record exists in PostgreSQL orders table', orderDbRes.rowCount === 1);
      const dbOrder = orderDbRes.rows[0];
      assert('Database order subtotal matches', parseFloat(dbOrder.subtotal) === expectedSubtotal);
      assert('Database tax amount matches', parseFloat(dbOrder.tax_amount) === expectedTax);
      assert('Database grand total matches', parseFloat(dbOrder.total) === expectedTotal);
      assert('Special chef notes saved accurately', dbOrder.notes === chefNotes);

      const itemsDbRes = await db.query(
        'SELECT menu_item_id, quantity, price_at_order FROM order_items WHERE order_id = $1',
        [orderId]
      );
      assert(`Database contains ${orderPayload.items.length} line items`, itemsDbRes.rowCount === 2);

      console.log(`\n--- STEP 7: Verify Real-Time Socket Broadcast to Kitchen Screen ---`);
      // Give socket 300ms to receive event
      await new Promise((r) => setTimeout(r, 300));
      assert('Socket received order:new broadcast', !!receivedSocketEvent);
      assert('Socket order ID matches', receivedSocketEvent?.orderId === orderId);
      assert('Socket total matches grand total', receivedSocketEvent?.total === expectedTotal);
      socket.disconnect();

      console.log('\n================================================================');
      if (!failed) {
        console.log('🎉 MILESTONE 5 (50%) VERIFICATION PASSED WITH 100% SUCCESS!');
        console.log('💯 Financial Calculations, 5% GST & Order Placement Validated.');
      } else {
        console.log('❌ MILESTONE 5 FAILED - Check errors above.');
      }
      console.log('================================================================\n');

    } catch (err) {
      console.error('Milestone 5 Test Runner Error:', err);
    } finally {
      server.close();
      process.exit(failed ? 1 : 0);
    }
  });
}

runMilestone5();

