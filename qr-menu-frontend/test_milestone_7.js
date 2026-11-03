// test_milestone_7.js - Automated Verification for Milestone 7 (70% Promo Coupons & Zero-Penny Bill Splitting)
process.env.NODE_ENV = 'test';

import http from 'http';

console.log('================================================================');
console.log('🚀 RESTAURANT QR ORDERING SYSTEM: MILESTONE 7 VERIFICATION (70%)');
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

async function runMilestone7() {
  const backendModule = await import('../qr-menu-backend/server.js');
  const server = backendModule.server || backendModule.default?.server;
  const db = (await import('../qr-menu-backend/db/index.js')).default || (await import('../qr-menu-backend/db/index.js'));
  const PORT = 3018;

  server.listen(PORT, async () => {
    try {
      console.log(`--- STEP 1: Provision Clean Dining Table & Place Test Order ---`);
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

      // Place initial order
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
            name: 'Meera Rao',
            phone: '+91-9876543210',
            consentGiven: true,
          },
          items: [
            { menuItemId: dishA.id, quantity: 2 },
            { menuItemId: dishB.id, quantity: 2 },
          ],
        }
      );
      assert('Initial order created (HTTP 201 Created)', orderRes.status === 201);
      const orderId = orderRes.body?.orderId;
      const originalSubtotal = orderRes.body?.subtotal;
      const originalTotal = orderRes.body?.total;
      console.log(`     Order ID: ${orderId}`);
      console.log(`     Original Subtotal: ₹${originalSubtotal.toFixed(2)}`);
      console.log(`     Original Total:    ₹${originalTotal.toFixed(2)} (with 5% GST)`);

      console.log(`\n--- STEP 2: Provision Active Promo Coupon in Database ---`);
      const couponCode = `SAVE10_${Math.floor(1000 + Math.random() * 9000)}`;
      await db.query(
        `INSERT INTO coupons (restaurant_id, code, discount_type, discount_value, min_order_amount, is_active)
         VALUES ($1, $2, 'PERCENTAGE', 10.0, 100.0, true)`,
        [restaurantId, couponCode]
      );
      console.log(`     Created Coupon: ${couponCode} (10% OFF, Min Spend: ₹100)`);

      console.log(`\n--- STEP 3: Apply Promo Coupon to Active Order ---`);
      const applyCouponRes = await request(
        {
          hostname: 'localhost',
          port: PORT,
          path: `/api/order/${orderId}/apply-coupon`,
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        },
        { code: couponCode }
      );

      assert('Apply coupon endpoint responds (HTTP 200 OK)', applyCouponRes.status === 200);
      assert('Response contains applied coupon code', applyCouponRes.body?.coupon?.code === couponCode);

      // Verify exact 10% discount math
      const expectedDiscount = parseFloat(((originalSubtotal * 10) / 100).toFixed(2));
      const expectedTaxable = originalSubtotal - expectedDiscount;
      const expectedNewTax = Math.round(expectedTaxable * 0.05 * 100) / 100;
      const expectedNewTotal = parseFloat((expectedTaxable + expectedNewTax).toFixed(2));

      console.log(`     Discount Applied: -₹${expectedDiscount.toFixed(2)} (10% OFF)`);
      console.log(`     New Taxable:      ₹${expectedTaxable.toFixed(2)}`);
      console.log(`     New 5% GST:       ₹${expectedNewTax.toFixed(2)}`);
      console.log(`     New Grand Total:  ₹${expectedNewTotal.toFixed(2)}`);

      const resDiscount = applyCouponRes.body?.bill?.discountAmount ?? applyCouponRes.body?.discountAmount;
      const resTotal = applyCouponRes.body?.bill?.grandTotal ?? applyCouponRes.body?.total;
      assert(`Discount amount matches 10%: ₹${expectedDiscount.toFixed(2)}`, resDiscount === expectedDiscount);
      assert(`New Grand Total matches: ₹${expectedNewTotal.toFixed(2)}`, resTotal === expectedNewTotal);

      // Verify PostgreSQL database order record
      const dbOrder = await db.query(
        'SELECT coupon_code, discount_amount, total FROM orders WHERE id = $1',
        [orderId]
      );
      assert('PostgreSQL orders table recorded coupon code', dbOrder.rows[0].coupon_code === couponCode);
      assert('PostgreSQL orders table recorded discount amount', 
        parseFloat(dbOrder.rows[0].discount_amount) === expectedDiscount);

      console.log(`\n--- STEP 4: Test Smart Bill Splitting (Zero-Penny Loss Equality) ---`);
      // Test 3-way split
      const split3Res = await request({
        hostname: 'localhost',
        port: PORT,
        path: `/api/order/${orderId}/split?ways=3`,
        method: 'GET',
      });

      assert('Split bill endpoint responds (HTTP 200 OK)', split3Res.status === 200);
      const shares3 = split3Res.body?.shares || [];
      assert('Generated exactly 3 person shares', shares3.length === 3);

      const sumShares3 = parseFloat(shares3.reduce((acc, s) => acc + parseFloat(s.amount), 0).toFixed(2));
      console.log(`     3-Way Split Breakdown:`);
      shares3.forEach((s) => console.log(`       - Person ${s.person}: ₹${s.amount}`));
      console.log(`     Sum of Shares: ₹${sumShares3.toFixed(2)} | Target Total: ₹${expectedNewTotal.toFixed(2)}`);
      assert('Sum of 3 shares exactly equals grand total (Zero-Penny Loss)', sumShares3 === expectedNewTotal);

      // Test 4-way split
      const split4Res = await request({
        hostname: 'localhost',
        port: PORT,
        path: `/api/order/${orderId}/split?ways=4`,
        method: 'GET',
      });
      const shares4 = split4Res.body?.shares || [];
      const sumShares4 = parseFloat(shares4.reduce((acc, s) => acc + parseFloat(s.amount), 0).toFixed(2));
      assert('Sum of 4 shares exactly equals grand total (Zero-Penny Loss)', sumShares4 === expectedNewTotal);

      console.log(`\n--- STEP 5: Test Coupon Removal & Financial Restoration ---`);
      const removeCouponRes = await request({
        hostname: 'localhost',
        port: PORT,
        path: `/api/order/${orderId}/remove-coupon`,
        method: 'DELETE',
      });
      assert('Remove coupon endpoint responds (HTTP 200 OK)', removeCouponRes.status === 200);
      const restoredTotal = removeCouponRes.body?.bill?.grandTotal ?? removeCouponRes.body?.total;
      const restoredDiscount = removeCouponRes.body?.bill?.discountAmount ?? removeCouponRes.body?.discountAmount;
      assert('Grand total restored to original undiscounted amount', restoredTotal === originalTotal);
      assert('Discount amount reset to 0', restoredDiscount === 0);

      // Verify PostgreSQL database reflects coupon removal
      const dbOrderAfterRemove = await db.query(
        'SELECT coupon_code, discount_amount, total FROM orders WHERE id = $1',
        [orderId]
      );
      assert('Database coupon code cleared to null', dbOrderAfterRemove.rows[0].coupon_code === null);
      assert('Database discount reset to 0', parseFloat(dbOrderAfterRemove.rows[0].discount_amount) === 0);
      assert('Database total restored to original', parseFloat(dbOrderAfterRemove.rows[0].total) === originalTotal);

      console.log('\n================================================================');
      if (!failed) {
        console.log('🎉 MILESTONE 7 (70%) VERIFICATION PASSED WITH 100% SUCCESS!');
        console.log('💯 Promo Coupon Engine & Zero-Penny Bill Splitting Validated.');
      } else {
        console.log('❌ MILESTONE 7 FAILED - Check errors above.');
      }
      console.log('================================================================\n');

    } catch (err) {
      console.error('Milestone 7 Test Runner Error:', err);
    } finally {
      server.close();
      process.exit(failed ? 1 : 0);
    }
  });
}

runMilestone7();
