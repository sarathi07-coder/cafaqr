// test_milestone_2.js - Automated Verification for Milestone 2 (20% Table Session & GDPR)
process.env.NODE_ENV = 'test';

import http from 'http';

console.log('================================================================');
console.log('🚀 RESTAURANT QR ORDERING SYSTEM: MILESTONE 2 VERIFICATION (20%)');
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

async function runMilestone2() {
  const backendModule = await import('../qr-menu-backend/server.js');
  const server = backendModule.server || backendModule.default?.server;
  const db = (await import('../qr-menu-backend/db/index.js')).default || (await import('../qr-menu-backend/db/index.js'));
  const PORT = 3013;

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
      assert('Discovered active restaurant ID', !!restaurantId);

      // Create unique test table
      const uniqueTableNum = Math.floor(10000 + Math.random() * 90000);
      const tableInsert = await db.query(
        'INSERT INTO tables (restaurant_id, number) VALUES ($1, $2) RETURNING id, number',
        [restaurantId, uniqueTableNum]
      );
      const testTableId = tableInsert.rows[0].id;
      const testTableNum = tableInsert.rows[0].number;
      console.log(`     Provisioned Table #${testTableNum} (ID: ${testTableId})`);

      // Get sample menu item to order
      const menuRes = await db.query(
        'SELECT id, name, price FROM menu_items WHERE restaurant_id = $1 AND available = true LIMIT 1',
        [restaurantId]
      );
      assert('Found available menu item for order test', menuRes.rowCount > 0);
      const sampleItem = menuRes.rows[0];

      console.log(`\n--- STEP 2: Initial Scan Session Check (Expect False) ---`);
      const session1 = await request({
        hostname: 'localhost',
        port: PORT,
        path: `/api/order/table/${testTableId}/session`,
        method: 'GET',
      });
      assert('Initial session check responds (HTTP 200 OK)', session1.status === 200);
      assert('hasActiveSession is false on brand new table', session1.body?.hasActiveSession === false);

      console.log(`\n--- STEP 3: Strict GDPR Consent Enforcement Check ---`);
      const gdprRejectRes = await request(
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
            name: 'Priya Patel',
            phone: '+91-9988776655',
            consentGiven: false, // Refused consent!
          },
          items: [{ menuItemId: sampleItem.id, quantity: 1 }],
        }
      );
      assert('Order without GDPR consent rejected (HTTP 400 Bad Request)', gdprRejectRes.status === 400);
      assert('Error explicitly cites GDPR consent requirement', 
        (gdprRejectRes.body?.error || '').toLowerCase().includes('gdpr'));

      console.log(`\n--- STEP 4: Valid Order Placement with GDPR Consent ---`);
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
            name: 'Priya Patel',
            phone: '+91-9988776655',
            consentGiven: true, // Consented
          },
          items: [{ menuItemId: sampleItem.id, quantity: 2 }],
          notes: 'Customer consents to digital SMS receipt',
        }
      );
      assert('Order with GDPR consent created successfully (HTTP 201 Created)', orderRes.status === 201);
      const orderId = orderRes.body?.orderId || orderRes.body?.order?.id;
      assert('Valid order ID generated', !!orderId);

      // Verify PostgreSQL database customer record
      const customerDbRes = await db.query(
        'SELECT name, phone, consent_given FROM customers WHERE phone = $1',
        ['+91-9988776655']
      );
      assert('Customer record saved in PostgreSQL database', customerDbRes.rowCount > 0);
      assert('consent_given flag in PostgreSQL is true', customerDbRes.rows[0]?.consent_given === true);

      console.log(`\n--- STEP 5: Re-Scan Frictionless Session Recognition ---`);
      const session2 = await request({
        hostname: 'localhost',
        port: PORT,
        path: `/api/order/table/${testTableId}/session`,
        method: 'GET',
      });
      assert('Re-scan table session responds (HTTP 200 OK)', session2.status === 200);
      assert('hasActiveSession is now true', session2.body?.hasActiveSession === true);
      const recognizedCustomer = session2.body?.customer || session2.body?.order?.customer;
      assert('Customer name recognized without re-login', recognizedCustomer?.name === 'Priya Patel');
      assert('Customer phone recognized', recognizedCustomer?.phone === '+91-9988776655');
      const activeOrderId = session2.body?.orderId || session2.body?.order?.id;
      assert('Active Order ID matches current table ticket', activeOrderId === orderId);

      console.log(`\n--- STEP 6: Table Reset & Bill Settlement ---`);
      // Dismiss order to free up table
      const dismissRes = await request(
        {
          hostname: 'localhost',
          port: PORT,
          path: `/api/order/${orderId}/dismiss`,
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
        },
        { payment_method: 'UPI' }
      );
      assert('Order dismissed / settled (HTTP 200 OK)', dismissRes.status === 200);

      // Verify table session is reset for next party
      const session3 = await request({
        hostname: 'localhost',
        port: PORT,
        path: `/api/order/table/${testTableId}/session`,
        method: 'GET',
      });
      assert('Table session clean reset for next customer (hasActiveSession: false)', 
        session3.body?.hasActiveSession === false);

      console.log('\n================================================================');
      if (!failed) {
        console.log('🎉 MILESTONE 2 (20%) VERIFICATION PASSED WITH 100% SUCCESS!');
        console.log('💯 Table Session Detection, Re-Scan Memory & GDPR Validated.');
      } else {
        console.log('❌ MILESTONE 2 FAILED - Check errors above.');
      }
      console.log('================================================================\n');

    } catch (err) {
      console.error('Milestone 2 Test Runner Error:', err);
    } finally {
      server.close();
      process.exit(failed ? 1 : 0);
    }
  });
}

runMilestone2();
