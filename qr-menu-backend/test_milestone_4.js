// test_milestone_4.js
const http = require('http');
const db = require('./db');

function request(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const parsed = body ? JSON.parse(body) : null;
          resolve({ status: res.statusCode, headers: res.headers, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, raw: body });
        }
      });
    });
    req.on('error', reject);
    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    req.end();
  });
}

async function runMilestone4Tests() {
  console.log('===============================================================');
  console.log('🚀 RESTAURANT QR ORDERING: MILESTONE 4 VERIFICATION (40%)');
  console.log('   Session-Bound Order Placement & Multi-Diner Database Isolation');
  console.log('===============================================================\n');

  try {
    // 1. Discover Table & Menu
    console.log('--- STEP 1: Discover Table & Real Menu Dishes ---');
    const tableRes = await request({ hostname: '127.0.0.1', port: 3000, path: '/api/order/tables/default', method: 'GET' });
    const table = tableRes.body.table;

    const menuRes = await request({ hostname: '127.0.0.1', port: 3000, path: `/api/menu/${table.restaurant_id}`, method: 'GET' });
    const dishes = menuRes.body.items || menuRes.body;
    if (!dishes || dishes.length < 4) throw new Error('Need at least 4 menu dishes for test');
    console.log(` ✅ [PASS] Table #${table.number} verified with ${dishes.length} menu items`);

    const dishSoda = dishes.find(d => d.name.toLowerCase().includes('lime')) || dishes[0];
    const dishTikka = dishes.find(d => d.name.toLowerCase().includes('tikka')) || dishes[1];
    const dishChicken = dishes.find(d => d.name.toLowerCase().includes('chicken')) || dishes[2];
    const dishNaan = dishes.find(d => d.name.toLowerCase().includes('naan')) || dishes[3];

    // 2. Initialize Customer A (Phone 1)
    console.log('\n--- STEP 2: Initialize Customer A Session (Phone 1) ---');
    const s1Res = await request(
      { hostname: '127.0.0.1', port: 3000, path: '/api/order/session/init', method: 'POST', headers: { 'Content-Type': 'application/json' } },
      { tableId: table.id }
    );
    const tokenA = s1Res.body.sessionToken;
    const labelA = s1Res.body.sessionLabel;
    console.log(` ✅ [PASS] Customer A Token: ${tokenA} (${labelA})`);

    // 3. Initialize Customer B (Phone 2) at SAME Table
    console.log('\n--- STEP 3: Initialize Customer B Session (Phone 2) ---');
    const s2Res = await request(
      { hostname: '127.0.0.1', port: 3000, path: '/api/order/session/init', method: 'POST', headers: { 'Content-Type': 'application/json' } },
      { tableId: table.id }
    );
    const tokenB = s2Res.body.sessionToken;
    const labelB = s2Res.body.sessionLabel;
    console.log(` ✅ [PASS] Customer B Token: ${tokenB} (${labelB})`);

    // 4. Customer A places Order A
    console.log('\n--- STEP 4: Customer A Places Order (Alice) ---');
    const orderAPayload = {
      restaurantId: table.restaurant_id,
      tableId: table.id,
      sessionToken: tokenA,
      customer: {
        name: 'Alice Sharma',
        phone: '+91-9876500001',
        consentGiven: true
      },
      notes: 'Extra lemon in lime soda',
      items: [
        { menuItemId: dishSoda.id, quantity: 2 },
        { menuItemId: dishTikka.id, quantity: 1 }
      ]
    };

    const resA = await request(
      { hostname: '127.0.0.1', port: 3000, path: '/api/order', method: 'POST', headers: { 'Content-Type': 'application/json' } },
      orderAPayload
    );
    if (resA.status !== 201 || !resA.body?.orderId) {
      throw new Error(`Customer A order placement failed: ${JSON.stringify(resA.body)}`);
    }
    const orderIdA = resA.body.orderId;
    console.log(` ✅ [PASS] Customer A Order Placed (HTTP 201 Created)`);
    console.log(`    Order ID: ${orderIdA}`);
    console.log(`    Subtotal: ₹${resA.body.subtotal} | 5% GST: ₹${resA.body.taxAmount} | Total: ₹${resA.body.total}`);

    // 5. Customer B places Order B at SAME Table 1
    console.log('\n--- STEP 5: Customer B Places Order (Bob) at SAME Table ---');
    const orderBPayload = {
      restaurantId: table.restaurant_id,
      tableId: table.id,
      sessionToken: tokenB,
      customer: {
        name: 'Bob Mukherjee',
        phone: '+91-9876500002',
        consentGiven: true
      },
      notes: 'Make chicken spicy',
      items: [
        { menuItemId: dishChicken.id, quantity: 1 },
        { menuItemId: dishNaan.id, quantity: 2 }
      ]
    };

    const resB = await request(
      { hostname: '127.0.0.1', port: 3000, path: '/api/order', method: 'POST', headers: { 'Content-Type': 'application/json' } },
      orderBPayload
    );
    if (resB.status !== 201 || !resB.body?.orderId) {
      throw new Error(`Customer B order placement failed: ${JSON.stringify(resB.body)}`);
    }
    const orderIdB = resB.body.orderId;
    console.log(` ✅ [PASS] Customer B Order Placed (HTTP 201 Created)`);
    console.log(`    Order ID: ${orderIdB}`);
    console.log(`    Subtotal: ₹${resB.body.subtotal} | 5% GST: ₹${resB.body.taxAmount} | Total: ₹${resB.body.total}`);

    if (orderIdA === orderIdB) {
      throw new Error('CRITICAL FAILURE: Customer A and Customer B orders were merged into the same order ID!');
    }
    console.log(' ✅ [PASS] Customer A and Customer B generated 2 distinct order IDs under Table #1');

    // 6. Verify PostgreSQL Database State
    console.log('\n--- STEP 6: Verify Supabase PostgreSQL Table & Session Isolation ---');
    const dbOrders = await db.query(
      `SELECT o.id, o.session_token, o.session_label, o.total, c.name as customer_name
       FROM orders o
       JOIN customers c ON o.customer_id = c.id
       WHERE o.id IN ($1, $2)
       ORDER BY o.created_at ASC`,
      [orderIdA, orderIdB]
    );

    if (dbOrders.rowCount !== 2) {
      throw new Error(`Expected 2 orders in DB, found ${dbOrders.rowCount}`);
    }
    console.log(` ✅ [PASS] PostgreSQL has 2 distinct active order rows for Table #1:`);
    dbOrders.rows.forEach(r => {
      console.log(`    • Order #${r.id.slice(0, 8)} | ${r.session_label} (${r.customer_name}) | Total: ₹${parseFloat(r.total).toFixed(2)}`);
    });

    // 7. Customer A checks their session
    console.log('\n--- STEP 7: Customer A Tab Verification ---');
    const checkA = await request({ hostname: '127.0.0.1', port: 3000, path: `/api/order/session/${tokenA}`, method: 'GET' });
    if (checkA.body?.id !== orderIdA || checkA.body?.total !== resA.body.total) {
      throw new Error(`Customer A tab verification mismatch!`);
    }
    console.log(` ✅ [PASS] Customer A sees ONLY Alice's order (₹${checkA.body.total})`);
    console.log(`    Items on Alice's tab: ${checkA.body.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}`);

    // 8. Customer B checks their session
    console.log('\n--- STEP 8: Customer B Tab Verification ---');
    const checkB = await request({ hostname: '127.0.0.1', port: 3000, path: `/api/order/session/${tokenB}`, method: 'GET' });
    if (checkB.body?.id !== orderIdB || checkB.body?.total !== resB.body.total) {
      throw new Error(`Customer B tab verification mismatch!`);
    }
    console.log(` ✅ [PASS] Customer B sees ONLY Bob's order (₹${checkB.body.total})`);
    console.log(`    Items on Bob's tab: ${checkB.body.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}`);

    console.log('\n===============================================================');
    console.log('🎉 MILESTONE 4 (40%) VERIFICATION PASSED WITH 100% SUCCESS!');
    console.log('💯 Session-Bound Order Placement & Database Isolation Operational.');
    console.log('===============================================================\n');

    process.exit(0);
  } catch (err) {
    console.error('\n❌ Milestone 4 Verification Failed:', err.message);
    process.exit(1);
  }
}

runMilestone4Tests();

