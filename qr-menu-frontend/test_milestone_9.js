// test_milestone_9.js - Automated Verification for Milestone 9 (90% Kitchen Display System & Web Audio Chimes)
process.env.NODE_ENV = 'test';

import http from 'http';
import { io } from 'socket.io-client';

console.log('================================================================');
console.log('🚀 RESTAURANT QR ORDERING SYSTEM: MILESTONE 9 VERIFICATION (90%)');
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

async function runMilestone9() {
  const backendModule = await import('../qr-menu-backend/server.js');
  const server = backendModule.server || backendModule.default?.server;
  const db = (await import('../qr-menu-backend/db/index.js')).default || (await import('../qr-menu-backend/db/index.js'));
  const PORT = 3020;

  server.listen(PORT, async () => {
    try {
      console.log(`--- STEP 1: Provision Table & Place Customer Order with Chef Notes ---`);
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

      // Fetch sample dishes
      const dishesRes = await db.query(
        'SELECT id, name, price FROM menu_items WHERE restaurant_id = $1 AND available = true LIMIT 2',
        [restaurantId]
      );
      const dishA = dishesRes.rows[0];
      const dishB = dishesRes.rows[1];

      const chefNotes = 'Extra crispy naan, keep butter chicken sauce mild';
      const orderRes = await request(
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
            name: 'Kavita Menon',
            phone: '+91-9822334455',
            consentGiven: true,
          },
          notes: chefNotes,
          items: [
            { menuItemId: dishA.id, quantity: 2 },
            { menuItemId: dishB.id, quantity: 1 },
          ],
        }
      );
      assert('Customer placed order (HTTP 201 Created)', orderRes.status === 201);
      const orderId = orderRes.body?.orderId;
      assert('Order ID generated', !!orderId);
      console.log(`     Order ID: ${orderId}`);

      console.log(`\n--- STEP 2: Connect WebSocket Client for KDS Ticket Alerts ---`);
      const socket = io(`http://localhost:${PORT}`, {
        transports: ['websocket'],
        reconnection: false,
      });

      let receivedAdvanceEvent = null;

      socket.on('kitchen:ticket_advanced', (data) => {
        receivedAdvanceEvent = data;
      });
      socket.on('order:status_updated', (data) => {
        receivedAdvanceEvent = receivedAdvanceEvent || data;
      });

      await new Promise((resolve) => {
        socket.on('connect', resolve);
      });
      assert('Socket.IO connected and listening for kitchen dispatch', socket.connected);

      console.log(`\n--- STEP 3: Query Active Kitchen Tickets Feed ---`);
      const ticketsRes = await request({
        hostname: 'localhost',
        port: PORT,
        path: `/api/kitchen/tickets?restaurantId=${restaurantId}`,
        method: 'GET',
      });

      assert('KDS tickets endpoint responds (HTTP 200 OK)', ticketsRes.status === 200);
      const allTickets = Array.isArray(ticketsRes.body)
        ? ticketsRes.body
        : (ticketsRes.body?.tickets || [
            ...(ticketsRes.body?.pending || []),
            ...(ticketsRes.body?.preparing || []),
            ...(ticketsRes.body?.ready || []),
          ]);
      assert('KDS tickets payload contains tickets array', Array.isArray(allTickets));

      const foundTicket = allTickets.find((t) => t.order_id === orderId || t.id === orderId);
      assert('New order appears in kitchen tickets queue', !!foundTicket);
      assert('Initial ticket status is PENDING', foundTicket?.status === 'PENDING');
      assert('Chef special notes displayed prominently', foundTicket?.notes === chefNotes);
      assert('Table number attached to ticket', foundTicket?.table_number === testTableNum);
      assert('Itemized dishes list populated for chef', foundTicket?.items?.length === 2);
      assert('Elapsed wait timer is tracked', typeof foundTicket?.elapsed_minutes === 'number');

      console.log(`\n--- STEP 4: Chef Starts Cooking ➔ Advance PENDING to PREPARING ---`);
      receivedAdvanceEvent = null;
      const advance1Res = await request({
        hostname: 'localhost',
        port: PORT,
        path: `/api/kitchen/tickets/${orderId}/advance`,
        method: 'PUT',
      });

      assert('Advance ticket stage responds (HTTP 200 OK)', advance1Res.status === 200);
      assert('Ticket status updated to PREPARING', advance1Res.body?.order?.status === 'PREPARING');

      // Verify PostgreSQL database
      const dbOrderPrep = await db.query('SELECT status FROM orders WHERE id = $1', [orderId]);
      assert('PostgreSQL database reflects status = PREPARING', dbOrderPrep.rows[0].status === 'PREPARING');

      // Verify WebSocket broadcast
      await new Promise((r) => setTimeout(r, 300));
      assert('WebSocket broadcast ticket advance to PREPARING', !!receivedAdvanceEvent);
      assert('Broadcast carries orderId', receivedAdvanceEvent?.orderId === orderId);
      assert('Broadcast new status is PREPARING', (receivedAdvanceEvent?.newStatus || receivedAdvanceEvent?.status) === 'PREPARING');

      console.log(`\n--- STEP 5: Chef Finishes Plating ➔ Advance PREPARING to READY ---`);
      receivedAdvanceEvent = null;
      const advance2Res = await request({
        hostname: 'localhost',
        port: PORT,
        path: `/api/kitchen/tickets/${orderId}/advance`,
        method: 'PUT',
      });

      assert('Advance ticket stage responds (HTTP 200 OK)', advance2Res.status === 200);
      assert('Ticket status updated to READY', advance2Res.body?.order?.status === 'READY');

      // Verify PostgreSQL database
      const dbOrderReady = await db.query('SELECT status FROM orders WHERE id = $1', [orderId]);
      assert('PostgreSQL database reflects status = READY', dbOrderReady.rows[0].status === 'READY');

      // Verify WebSocket chime trigger
      await new Promise((r) => setTimeout(r, 300));
      assert('WebSocket broadcast ticket advance to READY', !!receivedAdvanceEvent);
      assert('playChime flag is TRUE (audio chime synthesization triggered)', receivedAdvanceEvent?.playChime === true);
      socket.disconnect();

      console.log(`\n--- STEP 6: Verify KDS Queue Reflects READY Column ---`);
      const ticketsResAfter = await request({
        hostname: 'localhost',
        port: PORT,
        path: `/api/kitchen/tickets?restaurantId=${restaurantId}`,
        method: 'GET',
      });
      const allAfterTickets = Array.isArray(ticketsResAfter.body)
        ? ticketsResAfter.body
        : (ticketsResAfter.body?.tickets || [
            ...(ticketsResAfter.body?.pending || []),
            ...(ticketsResAfter.body?.preparing || []),
            ...(ticketsResAfter.body?.ready || []),
          ]);
      const readyTicket = allAfterTickets.find((t) => t.order_id === orderId || t.id === orderId);
      assert('Ticket now categorized in READY column for food runner', readyTicket?.status === 'READY');

      console.log('\n================================================================');
      if (!failed) {
        console.log('🎉 MILESTONE 9 (90%) VERIFICATION PASSED WITH 100% SUCCESS!');
        console.log('💯 Kitchen Display System Kanban & Audio Chimes Validated.');
      } else {
        console.log('❌ MILESTONE 9 FAILED - Check errors above.');
      }
      console.log('================================================================\n');

    } catch (err) {
      console.error('Milestone 9 Test Runner Error:', err);
    } finally {
      server.close();
      process.exit(failed ? 1 : 0);
    }
  });
}

runMilestone9();
