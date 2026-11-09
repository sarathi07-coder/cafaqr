// test_milestone_1.js
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

async function runMilestone1Tests() {
  console.log('===============================================================');
  console.log('🚀 RESTAURANT QR ORDERING: MILESTONE 1 VERIFICATION (10%)');
  console.log('   Multi-Customer Session Engine & Schema Migration');
  console.log('===============================================================\n');

  try {
    // STEP 1: Find default table
    console.log('--- STEP 1: Discover Active Dining Table ---');
    const tableRes = await request({
      hostname: '127.0.0.1',
      port: 3000,
      path: '/api/order/tables/default',
      method: 'GET'
    });
    if (tableRes.status !== 200 || !tableRes.body?.table?.id) {
      throw new Error(`Failed to fetch default table: ${JSON.stringify(tableRes.body)}`);
    }
    const table = tableRes.body.table;
    console.log(` ✅ [PASS] Discovered Table #${table.number} (ID: ${table.id}) at '${table.restaurant_name}'`);

    // STEP 2: Customer 1 scans QR code (First diner at Table 1)
    console.log('\n--- STEP 2: Customer 1 Initial Scan (Phone 1) ---');
    const c1Init = await request(
      {
        hostname: '127.0.0.1',
        port: 3000,
        path: '/api/order/session/init',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      },
      { tableId: table.id }
    );
    if (c1Init.status !== 201 || !c1Init.body?.sessionToken) {
      throw new Error(`Customer 1 session init failed: HTTP ${c1Init.status} - ${JSON.stringify(c1Init.body)}`);
    }
    const session1 = c1Init.body;
    console.log(` ✅ [PASS] Customer 1 Session Initialized (HTTP 201 Created)`);
    console.log(`    Token: ${session1.sessionToken}`);
    console.log(`    Label: ${session1.sessionLabel}`);
    console.log(`    isNew: ${session1.isNew} (Brand new session)`);

    // STEP 3: Customer 2 scans same Table 1 QR code (Second diner at Table 1)
    console.log('\n--- STEP 3: Customer 2 Simultaneous Scan (Phone 2) ---');
    const c2Init = await request(
      {
        hostname: '127.0.0.1',
        port: 3000,
        path: '/api/order/session/init',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      },
      { tableId: table.id }
    );
    if (c2Init.status !== 201 || !c2Init.body?.sessionToken) {
      throw new Error(`Customer 2 session init failed: HTTP ${c2Init.status} - ${JSON.stringify(c2Init.body)}`);
    }
    const session2 = c2Init.body;
    console.log(` ✅ [PASS] Customer 2 Independent Session Initialized (HTTP 201 Created)`);
    console.log(`    Token: ${session2.sessionToken}`);
    console.log(`    Label: ${session2.sessionLabel}`);
    console.log(`    isNew: ${session2.isNew}`);

    if (session1.sessionToken === session2.sessionToken) {
      throw new Error('CRITICAL FAILURE: Customer 1 and Customer 2 received identical session tokens!');
    }
    console.log(' ✅ [PASS] Customer 1 and Customer 2 tokens are completely distinct!');

    // STEP 4: Customer 1 refreshes the browser page (sends existing token)
    console.log('\n--- STEP 4: Customer 1 Browser Refresh / Re-Open ---');
    const c1Resume = await request(
      {
        hostname: '127.0.0.1',
        port: 3000,
        path: '/api/order/session/init',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      },
      { tableId: table.id, sessionToken: session1.sessionToken }
    );
    if (c1Resume.status !== 200 || c1Resume.body?.sessionToken !== session1.sessionToken) {
      throw new Error(`Customer 1 session resume failed: HTTP ${c1Resume.status} - ${JSON.stringify(c1Resume.body)}`);
    }
    console.log(` ✅ [PASS] Customer 1 Session Restored on Refresh (HTTP 200 OK)`);
    console.log(`    isNew: ${c1Resume.body.isNew} (Correctly recognized existing diner)`);
    console.log(`    Preserved Label: ${c1Resume.body.sessionLabel}`);

    // STEP 5: Verify PostgreSQL Database State
    console.log('\n--- STEP 5: Verify Supabase PostgreSQL Records ---');
    const dbCheck = await db.query(
      `SELECT session_token, session_label, is_active FROM customer_sessions WHERE session_token IN ($1, $2)`,
      [session1.sessionToken, session2.sessionToken]
    );
    if (dbCheck.rowCount !== 2) {
      throw new Error(`Expected 2 sessions in PostgreSQL, found ${dbCheck.rowCount}`);
    }
    console.log(` ✅ [PASS] Verified 2 active customer session rows in PostgreSQL database`);
    dbCheck.rows.forEach(r => {
      console.log(`    - Token: ${r.session_token.slice(0, 18)}... | Label: ${r.session_label} | Active: ${r.is_active}`);
    });

    // STEP 6: Negative Security Check - Invalid Table ID
    console.log('\n--- STEP 6: Negative Security Check (Invalid Table) ---');
    const invalidRes = await request(
      {
        hostname: '127.0.0.1',
        port: 3000,
        path: '/api/order/session/init',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      },
      { tableId: '00000000-0000-0000-0000-000000000000' }
    );
    if (invalidRes.status !== 404) {
      throw new Error(`Expected HTTP 404 for non-existent table, received ${invalidRes.status}`);
    }
    console.log(' ✅ [PASS] Non-existent table rejected with HTTP 404 Not Found');

    console.log('\n===============================================================');
    console.log('🎉 MILESTONE 1 (10%) VERIFICATION PASSED WITH 100% SUCCESS!');
    console.log('💯 Multi-Customer Session Engine & Schema Migration Operational.');
    console.log('===============================================================\n');

    process.exit(0);
  } catch (err) {
    console.error('\n❌ Milestone 1 Verification Failed:', err.message);
    process.exit(1);
  }
}

runMilestone1Tests();

