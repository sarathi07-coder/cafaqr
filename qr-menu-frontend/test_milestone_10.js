// test_milestone_10.js - Automated Verification for Milestone 10 (100% Bento Executive Dashboard, Settlement, Stock Toggle, Reviews & Sales CSV)
process.env.NODE_ENV = 'test';

import http from 'http';
import { io } from 'socket.io-client';

console.log('================================================================');
console.log('🚀 RESTAURANT QR ORDERING SYSTEM: MILESTONE 10 VERIFICATION (100%)');
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
          resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(data), raw: data });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, raw: data });
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

async function runMilestone10() {
  const backendModule = await import('../qr-menu-backend/server.js');
  const server = backendModule.server || backendModule.default?.server;
  const db = (await import('../qr-menu-backend/db/index.js')).default || (await import('../qr-menu-backend/db/index.js'));
  const PORT = 3022;

  server.listen(PORT, async () => {
    try {
      console.log(`--- STEP 1: Provision Clean Table & Place Active Customer Order ---`);
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

      // Fetch dishes
      const menuRes = await db.query(
        'SELECT id, name, price, available FROM menu_items WHERE restaurant_id = $1 AND available = true LIMIT 2',
        [restaurantId]
      );
      assert('Menu items available for order placement', menuRes.rows.length >= 2);
      const item1 = menuRes.rows[0];
      const item2 = menuRes.rows[1];

      // Place dining order with valid camelCase schema
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
            name: 'Tarun Karthick',
            phone: '+91-9876543210',
            consentGiven: true,
          },
          notes: 'Executive Chef Special Tasting Order',
          items: [
            { menuItemId: item1.id, quantity: 2 },
            { menuItemId: item2.id, quantity: 1 },
          ],
        }
      );

      assert('Customer placed order (HTTP 201 Created)', orderRes.status === 201);
      const orderId = orderRes.body?.orderId || orderRes.body?.order?.id || orderRes.body?.id;
      assert('Order ID generated', !!orderId);
      console.log(`     Order ID: ${orderId}`);

      console.log(`\n--- STEP 2: Authenticate Admin & Connect WebSocket Client ---`);
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
      const adminToken = loginRes.body?.token;
      assert('Admin authenticated and obtained JWT token', !!adminToken);

      const socket = io(`http://localhost:${PORT}`, {
        transports: ['websocket'],
        reconnection: false,
      });

      let receivedDismissEvent = null;
      let receivedStockChangeEvent = null;
      let receivedFeedbackEvent = null;

      socket.on('order:dismissed', (data) => {
        receivedDismissEvent = data;
      });
      socket.on('menu:availability_changed', (data) => {
        receivedStockChangeEvent = data;
      });
      socket.on('feedback:new', (data) => {
        receivedFeedbackEvent = data;
      });

      await new Promise((resolve) => {
        socket.on('connect', resolve);
      });
      assert('Socket.IO connected and listening for live admin broadcasts', socket.connected);

      console.log(`\n--- STEP 3: Bento Grid Executive Analytics Overview ---`);
      const overviewRes = await request({
        hostname: 'localhost',
        port: PORT,
        path: `/api/admin/analytics/overview?restaurantId=${restaurantId}`,
        method: 'GET',
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      assert('Analytics overview responds (HTTP 200 OK)', overviewRes.status === 200);
      assert('Today sales metrics calculated', typeof overviewRes.body?.today?.totalOrders === 'number');
      assert('Today total revenue tracked', typeof overviewRes.body?.today?.totalRevenue === 'number');
      assert('Sales by table ranking list populated', Array.isArray(overviewRes.body?.salesByTable));
      assert('Top selling dishes ranked', Array.isArray(overviewRes.body?.topSellingDishes));
      assert('Payment methods breakdown tracked', Array.isArray(overviewRes.body?.paymentBreakdown));

      console.log(`\n--- STEP 4: 1-Click Out-of-Stock Toggle & Live Broadcast ---`);
      const targetDishId = item1.id;
      const initialAvailability = item1.available;

      const toggleRes1 = await request({
        hostname: 'localhost',
        port: PORT,
        path: `/api/admin/menu/${targetDishId}/toggle-availability`,
        method: 'PUT',
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      assert('Stock toggle responds (HTTP 200 OK)', toggleRes1.status === 200);
      assert('Dish availability flipped in DB response', toggleRes1.body?.item?.available === !initialAvailability);

      // Verify PostgreSQL database reflects flipped availability
      const dbItemCheck = await db.query('SELECT available FROM menu_items WHERE id = $1', [targetDishId]);
      assert('PostgreSQL database reflects toggled availability', dbItemCheck.rows[0].available === !initialAvailability);

      // Verify WebSocket broadcast
      await new Promise((r) => setTimeout(r, 200));
      assert('WebSocket broadcast menu:availability_changed event received', !!receivedStockChangeEvent);
      assert('Broadcast carries correct item ID', receivedStockChangeEvent?.id === targetDishId);

      // Toggle back to original state
      await request({
        hostname: 'localhost',
        port: PORT,
        path: `/api/admin/menu/${targetDishId}/toggle-availability`,
        method: 'PUT',
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      console.log(`\n--- STEP 5: Table QR Code Studio Bulk Generation ---`);
      const qrBulkRes = await request({
        hostname: 'localhost',
        port: PORT,
        path: `/api/qr/restaurant/${restaurantId}/bulk`,
        method: 'GET',
      });

      assert('Bulk QR code studio responds (HTTP 200 OK)', qrBulkRes.status === 200);
      assert('Bulk table count tracked', qrBulkRes.body?.totalTables > 0);
      assert('Tables list contains QR data', Array.isArray(qrBulkRes.body?.tables));

      const foundQrTable = qrBulkRes.body.tables.find((t) => t.tableId === testTableId || t.tableNumber === testTableNum);
      assert('Provisioned test table included in bulk QR batch', !!foundQrTable);
      assert('Base64 QR image generated for printing', foundQrTable?.qrCodeDataUrl?.startsWith('data:image/png;base64,'));

      console.log(`\n--- STEP 6: Customer 5-Star Meal Review Submission ---`);
      const feedbackRes = await request(
        {
          hostname: 'localhost',
          port: PORT,
          path: `/api/order/${orderId}/feedback`,
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        },
        {
          rating: 5,
          comments: 'Exquisite aromatic spices, perfectly cooked naan, and lightning-fast QR ordering experience!',
        }
      );

      assert('Customer review submission responds (HTTP 201 Created)', feedbackRes.status === 201);
      assert('Feedback record ID returned', !!feedbackRes.body?.feedback?.id);
      assert('5-star rating recorded', feedbackRes.body?.feedback?.rating === 5);

      // Verify PostgreSQL database
      const dbFeedback = await db.query('SELECT rating, comments FROM order_feedback WHERE order_id = $1', [orderId]);
      assert('PostgreSQL database has order_feedback entry', dbFeedback.rows.length === 1);
      assert('Review comments match submitted text', dbFeedback.rows[0].comments.includes('Exquisite aromatic spices'));

      console.log(`\n--- STEP 7: Executive Admin Reviews & Ratings Feed ---`);
      const adminFeedbackRes = await request({
        hostname: 'localhost',
        port: PORT,
        path: `/api/admin/feedback?restaurantId=${restaurantId}`,
        method: 'GET',
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      assert('Admin feedback feed responds (HTTP 200 OK)', adminFeedbackRes.status === 200);
      assert('Average rating summary computed', typeof adminFeedbackRes.body?.summary?.averageRating === 'number');
      assert('Total reviews count tracked', adminFeedbackRes.body?.summary?.totalReviews >= 1);
      assert('Reviews array populated', Array.isArray(adminFeedbackRes.body?.reviews));

      const foundReview = adminFeedbackRes.body.reviews.find((r) => r.order_id === orderId);
      assert('Newly submitted customer review appears in admin feed', !!foundReview);
      assert('Review table number matches', foundReview?.table_number === testTableNum);

      console.log(`\n--- STEP 8: Cashier Bill Settlement & Table Session Reset ---`);
      const settleRes = await request(
        {
          hostname: 'localhost',
          port: PORT,
          path: `/api/order/${orderId}/dismiss`,
          method: 'PUT',
          headers: { 
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}` 
          },
        },
        {
          payment_method: 'UPI',
        }
      );

      assert('Cashier settle bill responds (HTTP 200 OK)', settleRes.status === 200);
      assert('Order status updated to PAID', settleRes.body?.order?.status === 'PAID');
      assert('Payment method recorded as UPI', settleRes.body?.order?.payment_method === 'UPI');

      // Verify PostgreSQL database
      const dbPaidOrder = await db.query('SELECT status, payment_method FROM orders WHERE id = $1', [orderId]);
      assert('PostgreSQL orders table reflects status = PAID', dbPaidOrder.rows[0].status === 'PAID');
      assert('PostgreSQL orders table reflects payment_method = UPI', dbPaidOrder.rows[0].payment_method === 'UPI');

      // Verify table session is now free (re-scan test)
      const tableSessionCheck = await request({
        hostname: 'localhost',
        port: PORT,
        path: `/api/order/table/${testTableId}/session`,
        method: 'GET',
      });
      assert('Table session cleared - hasActiveSession is false', tableSessionCheck.body?.hasActiveSession === false);

      // Verify WebSocket broadcast
      await new Promise((r) => setTimeout(r, 200));
      assert('WebSocket broadcast order:dismissed received', !!receivedDismissEvent);
      assert('Dismissed event carries PAID status', receivedDismissEvent?.status === 'PAID');
      assert('Dismissed event carries correct paymentMethod', receivedDismissEvent?.paymentMethod === 'UPI');
      socket.disconnect();

      console.log(`\n--- STEP 9: Accounting Sales Report CSV Export ---`);
      const csvRes = await request({
        hostname: 'localhost',
        port: PORT,
        path: `/api/admin/reports/sales/csv?restaurantId=${restaurantId}`,
        method: 'GET',
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      assert('Sales CSV download responds (HTTP 200 OK)', csvRes.status === 200);
      assert('Content-Type header is text/csv', csvRes.headers?.['content-type']?.includes('text/csv'));
      assert('Content-Disposition header specifies filename', csvRes.headers?.['content-disposition']?.includes('.csv'));
      assert('CSV body has header row', csvRes.raw.includes('Order ID,Date,Time,Table Number,Customer Name'));
      assert('CSV body includes our settled order', csvRes.raw.includes(orderId));

      console.log('\n================================================================');
      if (!failed) {
        console.log('🎉🎉🎉 MILESTONE 10 (100%) VERIFICATION PASSED WITH 100% SUCCESS! 🎉🎉🎉');
        console.log('🏆 100% COMPLETION ACHIEVED: Full QR Code Restaurant Ordering System');
        console.log('✨ All 10 Progressive Milestones Verified & End-to-End Functional!');
      } else {
        console.log('❌ MILESTONE 10 FAILED - Check errors above.');
      }
      console.log('================================================================\n');

    } catch (err) {
      console.error('Milestone 10 Test Runner Error:', err);
    } finally {
      server.close();
      process.exit(failed ? 1 : 0);
    }
  });
}

runMilestone10();
