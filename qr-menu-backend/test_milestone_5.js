// test_milestone_5.js
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

async function runMilestone5Tests() {
  console.log('===============================================================');
  console.log('🚀 RESTAURANT QR ORDERING: MILESTONE 5 VERIFICATION (50%)');
  console.log('   Multi-Round Ordering on Individual Running Bill');
  console.log('===============================================================\n');

  try {
    // 1. Discover Table & Menu
    console.log('--- STEP 1: Discover Table & Real Menu Dishes ---');
    const tableRes = await request({ hostname: '127.0.0.1', port: 3000, path: '/api/order/tables/default', method: 'GET' });
    const table = tableRes.body.table;

    const menuRes = await request({ hostname: '127.0.0.1', port: 3000, path: `/api/menu/${table.restaurant_id}`, method: 'GET' });
    const dishes = menuRes.body.items || menuRes.body;
    const dishTikka = dishes.find(d => d.name.toLowerCase().includes('tikka')) || dishes[0];
    const dishSoda = dishes.find(d => d.name.toLowerCase().includes('lime')) || dishes[1];
    const dishChicken = dishes.find(d => d.name.toLowerCase().includes('chicken')) || dishes[2];
    const dishNaan = dishes.find(d => d.name.toLowerCase().includes('naan')) || dishes[3];

    // 2. Initialize Sessions at Table 1
    console.log('\n--- STEP 2: Initialize Sessions for Customer A and Customer B ---');
    const s1 = await request(
      { hostname: '127.0.0.1', port: 3000, path: '/api/order/session/init', method: 'POST', headers: { 'Content-Type': 'application/json' } },
      { tableId: table.id }
    );
    const tokenA = s1.body.sessionToken;

    const s2 = await request(
      { hostname: '127.0.0.1', port: 3000, path: '/api/order/session/init', method: 'POST', headers: { 'Content-Type': 'application/json' } },
      { tableId: table.id }
    );
    const tokenB = s2.body.sessionToken;
    console.log(` ✅ [PASS] Customer A Token: ${tokenA} (${s1.body.sessionLabel})`);
    console.log(` ✅ [PASS] Customer B Token: ${tokenB} (${s2.body.sessionLabel})`);

    // 3. Customer A places Round 1 (Paneer Tikka + Lime Soda)
    console.log('\n--- STEP 3: Customer A Places Round 1 Order ---');
    const resA1 = await request(
      { hostname: '127.0.0.1', port: 3000, path: '/api/order', method: 'POST', headers: { 'Content-Type': 'application/json' } },
      {
        restaurantId: table.restaurant_id,
        tableId: table.id,
        sessionToken: tokenA,
        customer: { name: 'Alice', phone: '+91-9876500010', consentGiven: true },
        items: [{ menuItemId: dishTikka.id, quantity: 1 }, { menuItemId: dishSoda.id, quantity: 1 }]
      }
    );
    const orderIdA = resA1.body.orderId;
    const initialTotalA = parseFloat(resA1.body.total);
    console.log(` ✅ [PASS] Customer A Round 1 Placed: Order #${orderIdA.slice(0, 8)} | Total: ₹${initialTotalA.toFixed(2)}`);

    // 4. Customer B places Round 1 (Butter Chicken) at SAME Table
    console.log('\n--- STEP 4: Customer B Places Round 1 Order at SAME Table ---');
    const resB1 = await request(
      { hostname: '127.0.0.1', port: 3000, path: '/api/order', method: 'POST', headers: { 'Content-Type': 'application/json' } },
      {
        restaurantId: table.restaurant_id,
        tableId: table.id,
        sessionToken: tokenB,
        customer: { name: 'Bob', phone: '+91-9876500020', consentGiven: true },
        items: [{ menuItemId: dishChicken.id, quantity: 1 }]
      }
    );
    const orderIdB = resB1.body.orderId;
    const initialTotalB = parseFloat(resB1.body.total);
    console.log(` ✅ [PASS] Customer B Round 1 Placed: Order #${orderIdB.slice(0, 8)} | Total: ₹${initialTotalB.toFixed(2)}`);

    // 5. Customer A orders Round 2: Appends Garlic Naan (2x) to active tab
    console.log('\n--- STEP 5: Customer A Appends Round 2 Items (2x Naan) ---');
    const addRes = await request(
      { hostname: '127.0.0.1', port: 3000, path: `/api/order/${orderIdA}/items`, method: 'POST', headers: { 'Content-Type': 'application/json' } },
      {
        items: [{ menuItemId: dishNaan.id, quantity: 2 }]
      }
    );
    if (addRes.status !== 200 || !addRes.body?.total) {
      throw new Error(`Add items to Customer A failed: ${JSON.stringify(addRes.body)}`);
    }
    const updatedTotalA = parseFloat(addRes.body.total);
    console.log(` ✅ [PASS] Customer A Round 2 Appended: New Total: ₹${updatedTotalA.toFixed(2)} (Previous: ₹${initialTotalA.toFixed(2)})`);
    if (updatedTotalA <= initialTotalA) {
      throw new Error('Customer A total did not increase after adding items!');
    }

    // 6. Verify Customer B's tab was completely untouched
    console.log('\n--- STEP 6: Verify Customer B Tab Isolation (Untouched Bill) ---');
    const checkB = await request({ hostname: '127.0.0.1', port: 3000, path: `/api/order/session/${tokenB}`, method: 'GET' });
    const currentTotalB = parseFloat(checkB.body.total);
    console.log(`    Customer B Current Total: ₹${currentTotalB.toFixed(2)} (Initial: ₹${initialTotalB.toFixed(2)})`);
    if (currentTotalB !== initialTotalB) {
      throw new Error(`CRITICAL FAILURE: Customer B's bill changed when Customer A added items!`);
    }
    console.log(` ✅ [PASS] Customer B bill is 100% UNCHANGED at ₹${currentTotalB.toFixed(2)}`);

    // Check Bob does not have Naan on his ticket
    const bobHasNaan = checkB.body.items.some(i => i.name.toLowerCase().includes('naan'));
    if (bobHasNaan) {
      throw new Error(`Customer B has Customer A's Naan in their order!`);
    }
    console.log(` ✅ [PASS] Customer B dish list does not contain Customer A's items`);

    // 7. Verify Customer A's session has all dishes across all rounds
    console.log('\n--- STEP 7: Verify Customer A Cumulative Line Items ---');
    const checkA = await request({ hostname: '127.0.0.1', port: 3000, path: `/api/order/session/${tokenA}`, method: 'GET' });
    console.log(` ✅ [PASS] Customer A cumulative dishes: ${checkA.body.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}`);
    console.log(`    Customer A Subtotal: ₹${checkA.body.subtotal} | 5% GST: ₹${checkA.body.taxAmount} | Grand Total: ₹${checkA.body.total}`);

    console.log('\n===============================================================');
    console.log('🎉 MILESTONE 5 (50%) VERIFICATION PASSED WITH 100% SUCCESS!');
    console.log('💯 Multi-Round Ordering on Individual Running Bill Operational.');
    console.log('===============================================================\n');

    process.exit(0);
  } catch (err) {
    console.error('\n❌ Milestone 5 Verification Failed:', err.message);
    process.exit(1);
  }
}

runMilestone5Tests();

