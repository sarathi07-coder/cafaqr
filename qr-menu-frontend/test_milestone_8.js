// test_milestone_8.js - Automated Verification for Milestone 8 (80% Waiter Calling & Staff Service Queue)
process.env.NODE_ENV = 'test';

import http from 'http';
import { io } from 'socket.io-client';

console.log('================================================================');
console.log('🚀 RESTAURANT QR ORDERING SYSTEM: MILESTONE 8 VERIFICATION (80%)');
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

async function runMilestone8() {
  const backendModule = await import('../qr-menu-backend/server.js');
  const server = backendModule.server || backendModule.default?.server;
  const db = (await import('../qr-menu-backend/db/index.js')).default || (await import('../qr-menu-backend/db/index.js'));
  const PORT = 3019;

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

      console.log(`\n--- STEP 2: Connect WebSocket Client for Real-Time Call Alerts ---`);
      const socket = io(`http://localhost:${PORT}`, {
        transports: ['websocket'],
        reconnection: false,
      });

      let receivedCallEvent = null;
      let receivedResolvedEvent = null;

      socket.on('waiter:call', (data) => {
        receivedCallEvent = data;
      });
      socket.on('service:requested', (data) => {
        receivedCallEvent = receivedCallEvent || data;
      });
      socket.on('service:resolved', (data) => {
        receivedResolvedEvent = data;
      });

      await new Promise((resolve) => {
        socket.on('connect', resolve);
      });
      assert('Socket.IO connected for live service alerts', socket.connected);

      console.log(`\n--- STEP 3: Customer Calls Waiter for WATER from Table Screen ---`);
      const waterNote = 'Please bring 2 glasses of cold sparkling water';
      const callWaterRes = await request(
        {
          hostname: 'localhost',
          port: PORT,
          path: `/api/order/table/${testTableId}/call-waiter`,
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        },
        {
          requestType: 'WATER',
          note: waterNote,
        }
      );

      assert('Call waiter endpoint responds (HTTP 201 Created)', callWaterRes.status === 201);
      const requestId1 = callWaterRes.body?.request?.id;
      assert('Valid service request ID generated', !!requestId1);
      console.log(`     Service Request #1 ID: ${requestId1}`);

      console.log(`\n--- STEP 4: Verify PostgreSQL Record in service_requests Table ---`);
      const dbRequest1 = await db.query(
        'SELECT id, table_id, request_type, status, created_at, resolved_at FROM service_requests WHERE id = $1',
        [requestId1]
      );
      assert('Service request exists in database', dbRequest1.rowCount === 1);
      assert('Status is initialized to PENDING', dbRequest1.rows[0].status === 'PENDING');
      assert('Request type preserves request and custom note', 
        dbRequest1.rows[0].request_type.includes('WATER') && dbRequest1.rows[0].request_type.includes(waterNote));
      assert('resolved_at is initially NULL', dbRequest1.rows[0].resolved_at === null);

      console.log(`\n--- STEP 5: Verify Real-Time Socket Broadcast to Staff Dashboard ---`);
      await new Promise((r) => setTimeout(r, 300));
      assert('Staff screen received waiter call via WebSockets', !!receivedCallEvent);
      assert('Broadcast carries correct Table Number', receivedCallEvent?.tableNumber === testTableNum || receivedCallEvent?.table_number === testTableNum);
      assert('Broadcast includes playChime flag', receivedCallEvent?.playChime === true);

      console.log(`\n--- STEP 6: Staff Authenticates & Queries Service Queue ---`);
      const loginRes = await request(
        {
          hostname: 'localhost',
          port: PORT,
          path: '/api/admin/login',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        },
        { email: 'admin@example.com', password: 'supersecret' }
      );
      const token = loginRes.body?.token;
      assert('Admin login successful and JWT token obtained', !!token);

      const queueRes = await request({
        hostname: 'localhost',
        port: PORT,
        path: `/api/admin/service-requests?restaurantId=${restaurantId}`,
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });
      assert('Staff service queue responds (HTTP 200 OK)', queueRes.status === 200);
      assert('Service queue is an array', Array.isArray(queueRes.body));
      const foundCall = queueRes.body.find((r) => r.id === requestId1);
      assert('Service request #1 appears in staff active queue', !!foundCall);
      assert('Queue record calculates elapsed wait minutes', typeof foundCall?.elapsed_minutes === 'number');

      console.log(`\n--- STEP 7: Customer Submits Second Request for CUTLERY ---`);
      const cutleryNote = 'Need 2 extra dessert spoons';
      const callCutleryRes = await request(
        {
          hostname: 'localhost',
          port: PORT,
          path: `/api/order/table/${testTableId}/call-waiter`,
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        },
        {
          requestType: 'CUTLERY',
          note: cutleryNote,
        }
      );
      assert('Second service call created (HTTP 201 Created)', callCutleryRes.status === 201);
      const requestId2 = callCutleryRes.body?.request?.id;
      assert('Valid service request #2 generated', !!requestId2);

      console.log(`\n--- STEP 8: Staff Resolves Request #1 ---`);
      const resolveRes = await request({
        hostname: 'localhost',
        port: PORT,
        path: `/api/admin/service-requests/${requestId1}/resolve`,
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      });
      assert('Resolve request responds (HTTP 200 OK)', resolveRes.status === 200);
      assert('Response confirms status RESOLVED', resolveRes.body?.request?.status === 'RESOLVED');

      // Verify PostgreSQL database update
      const dbRequestResolved = await db.query(
        'SELECT status, resolved_at FROM service_requests WHERE id = $1',
        [requestId1]
      );
      assert('Database reflects status = RESOLVED', dbRequestResolved.rows[0].status === 'RESOLVED');
      assert('Database recorded timestamp in resolved_at', dbRequestResolved.rows[0].resolved_at !== null);

      console.log(`\n--- STEP 9: Verify Real-Time Socket Resolution Broadcast ---`);
      await new Promise((r) => setTimeout(r, 300));
      assert('Staff screens received service:resolved event via WebSockets', !!receivedResolvedEvent);
      assert('Resolved event carries correct requestId', (receivedResolvedEvent?.requestId || receivedResolvedEvent?.id) === requestId1);
      socket.disconnect();

      console.log('\n================================================================');
      if (!failed) {
        console.log('🎉 MILESTONE 8 (80%) VERIFICATION PASSED WITH 100% SUCCESS!');
        console.log('💯 Real-Time Waiter Calling & Staff Service Queue Validated.');
      } else {
        console.log('❌ MILESTONE 8 FAILED - Check errors above.');
      }
      console.log('================================================================\n');

    } catch (err) {
      console.error('Milestone 8 Test Runner Error:', err);
    } finally {
      server.close();
      process.exit(failed ? 1 : 0);
    }
  });
}

runMilestone8();
