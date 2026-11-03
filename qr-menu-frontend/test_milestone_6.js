// test_milestone_6.js - Automated Verification for Milestone 6 (60% Re-Scan Frictionless Add-to-Bill)
process.env.NODE_ENV = 'test';

import http from 'http';
import { io } from 'socket.io-client';

console.log('================================================================');
console.log('🚀 RESTAURANT QR ORDERING SYSTEM: MILESTONE 6 VERIFICATION (60%)');
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

async function runMilestone6() {
  const backendModule = await import('../qr-menu-backend/server.js');
  const server = backendModule.server || backendModule.default?.server;
  const db = (await import('../qr-menu-backend/db/index.js')).default || (await import('../qr-menu-backend/db/index.js'));
  const PORT = 3017;

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

      // Fetch dishes: starters and mains
      const dishesRes = await db.query(
        'SELECT id, name, price, category FROM menu_items WHERE restaurant_id = $1 AND available = true ORDER BY category ASC LIMIT 4',
        [restaurantId]
      );
      assert('Loaded dishes from database', dishesRes.rowCount >= 3);
      const starterDish = dishesRes.rows[0];
      const mainDish = dishesRes.rows[1];
      const breadDish = dishesRes.rows[2];
      console.log(`     Starter: ${starterDish.name} (₹${starterDish.price})`);
      console.log(`     Main:    ${mainDish.name} (₹${mainDish.price})`);
      console.log(`     Bread:   ${breadDish.name} (₹${breadDish.price})`);

      console.log(`\n--- STEP 2: Place Initial Order (Round 1: Starters) ---`);
      const round1Qty = 2;
      const initialSubtotal = parseFloat(starterDish.price) * round1Qty;
      const initialTax = Math.round(initialSubtotal * 0.05 * 100) / 100;
      const initialTotal = parseFloat((initialSubtotal + initialTax).toFixed(2));

      const initialOrderRes = await request(
        {
          hostname: 'localhost',
          port: PORT,
          path: '/api/order',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        },
        {
          restaurantId,
          tableId: testTableId,
          customer: {
            name: 'Vikram Seth',
            phone: '+91-9811223344',
            consentGiven: true,
          },
          items: [{ menuItemId: starterDish.id, quantity: round1Qty }],
        }
      );

      assert('Initial order placed successfully (HTTP 201 Created)', initialOrderRes.status === 201);
      const orderId = initialOrderRes.body?.orderId;
      assert('Order ID generated', !!orderId);
      assert(`Round 1 Subtotal: ₹${initialSubtotal.toFixed(2)}`, initialOrderRes.body?.subtotal === initialSubtotal);
      assert(`Round 1 Grand Total: ₹${initialTotal.toFixed(2)}`, initialOrderRes.body?.total === initialTotal);

      console.log(`\n--- STEP 3: Re-Scan Table QR Code 20 Minutes Later ---`);
      const sessionAfterRound1 = await request({
        hostname: 'localhost',
        port: PORT,
        path: `/api/order/table/${testTableId}/session`,
        method: 'GET',
      });
      assert('Re-scan table session responds (HTTP 200 OK)', sessionAfterRound1.status === 200);
      assert('Table recognized active dining session (hasActiveSession: true)', 
        sessionAfterRound1.body?.hasActiveSession === true);
      assert('Recognized customer Vikram Seth without re-login', 
        (sessionAfterRound1.body?.customer?.name || sessionAfterRound1.body?.order?.customer?.name) === 'Vikram Seth');
      console.log(`     Zero-friction prompt: Customer does NOT need to enter name or phone again.`);

      console.log(`\n--- STEP 4: Setup Socket Listener for Add-to-Bill Event ---`);
      const socket = io(`http://localhost:${PORT}`, {
        transports: ['websocket'],
        reconnection: false,
      });

      let itemsAddedEvent = null;
      socket.on('order:items_added', (data) => {
        itemsAddedEvent = data;
      });

      await new Promise((resolve) => {
        socket.on('connect', resolve);
      });
      assert('Socket.IO connected for live updates', socket.connected);

      console.log(`\n--- STEP 5: Customer Appends Main Course & Breads to Tab (Round 2) ---`);
      const round2MainQty = 2;
      const round2BreadQty = 3;
      const round2Subtotal = (parseFloat(mainDish.price) * round2MainQty) + 
                             (parseFloat(breadDish.price) * round2BreadQty);
      
      const combinedSubtotal = initialSubtotal + round2Subtotal;
      const combinedTax = Math.round(combinedSubtotal * 0.05 * 100) / 100;
      const combinedGrandTotal = parseFloat((combinedSubtotal + combinedTax).toFixed(2));

      console.log(`     Additions: 2x ${mainDish.name} (₹${parseFloat(mainDish.price) * round2MainQty}) + 3x ${breadDish.name} (₹${parseFloat(breadDish.price) * round2BreadQty})`);
      console.log(`     Round 2 Added Subtotal: ₹${round2Subtotal.toFixed(2)}`);
      console.log(`     Combined New Subtotal:  ₹${combinedSubtotal.toFixed(2)}`);
      console.log(`     Combined New 5% GST:    ₹${combinedTax.toFixed(2)}`);
      console.log(`     Combined Grand Total:   ₹${combinedGrandTotal.toFixed(2)}`);

      const addItemsRes = await request(
        {
          hostname: 'localhost',
          port: PORT,
          path: `/api/order/${orderId}/items`,
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        },
        {
          items: [
            { menuItemId: mainDish.id, quantity: round2MainQty },
            { menuItemId: breadDish.id, quantity: round2BreadQty },
          ],
        }
      );

      assert('Items appended to active order (HTTP 200 OK)', addItemsRes.status === 200);
      assert(`Updated Subtotal matches: ₹${combinedSubtotal.toFixed(2)}`, 
        addItemsRes.body?.subtotal === combinedSubtotal);
      assert(`Updated 5% GST matches: ₹${combinedTax.toFixed(2)}`, 
        addItemsRes.body?.taxAmount === combinedTax);
      assert(`Updated Grand Total matches: ₹${combinedGrandTotal.toFixed(2)}`, 
        addItemsRes.body?.total === combinedGrandTotal);

      console.log(`\n--- STEP 6: Verify Database Line Items & Cumulative Totals ---`);
      const orderDbRes = await db.query(
        'SELECT subtotal, tax_amount, total FROM orders WHERE id = $1',
        [orderId]
      );
      assert('PostgreSQL orders table updated subtotal matches', 
        parseFloat(orderDbRes.rows[0].subtotal) === combinedSubtotal);
      assert('PostgreSQL orders table updated tax matches', 
        parseFloat(orderDbRes.rows[0].tax_amount) === combinedTax);
      assert('PostgreSQL orders table updated grand total matches', 
        parseFloat(orderDbRes.rows[0].total) === combinedGrandTotal);

      const allItemsDbRes = await db.query(
        'SELECT count(*) FROM order_items WHERE order_id = $1',
        [orderId]
      );
      assert('Total line items in order_items table is now 3 rows', 
        parseInt(allItemsDbRes.rows[0].count, 10) === 3);

      console.log(`\n--- STEP 7: Verify Real-Time Socket Notification to Kitchen ---`);
      await new Promise((r) => setTimeout(r, 300));
      assert('Kitchen received order:items_added event via WebSockets', !!itemsAddedEvent);
      assert('Socket event contains updated combined total', itemsAddedEvent?.total === combinedGrandTotal);
      socket.disconnect();

      console.log(`\n--- STEP 8: Re-Query Table Session for Combined Bill ---`);
      const sessionFinal = await request({
        hostname: 'localhost',
        port: PORT,
        path: `/api/order/table/${testTableId}/session`,
        method: 'GET',
      });
      assert('Table session reflects updated combined bill', 
        parseFloat(sessionFinal.body?.total) === combinedGrandTotal);

      console.log('\n================================================================');
      if (!failed) {
        console.log('🎉 MILESTONE 6 (60%) VERIFICATION PASSED WITH 100% SUCCESS!');
        console.log('💯 Frictionless Re-Scan, Tab Appending & Real-time KDS Validated.');
      } else {
        console.log('❌ MILESTONE 6 FAILED - Check errors above.');
      }
      console.log('================================================================\n');

    } catch (err) {
      console.error('Milestone 6 Test Runner Error:', err);
    } finally {
      server.close();
      process.exit(failed ? 1 : 0);
    }
  });
}

runMilestone6();

