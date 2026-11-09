// test_milestone_2.js
const http = require('http');

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

async function runMilestone2Tests() {
  console.log('===============================================================');
  console.log('🚀 RESTAURANT QR ORDERING: MILESTONE 2 VERIFICATION (20%)');
  console.log('   Session-Scoped Table Discovery & Re-Scan Protection');
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
    console.log(` ✅ [PASS] Table #${table.number} (ID: ${table.id}) verified`);

    // STEP 2: Initialize Session for Customer A
    console.log('\n--- STEP 2: Initialize Session for Customer A ---');
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
      throw new Error(`Customer A init failed: ${JSON.stringify(c1Init.body)}`);
    }
    const tokenA = c1Init.body.sessionToken;
    const labelA = c1Init.body.sessionLabel;
    console.log(` ✅ [PASS] Customer A Token: ${tokenA}`);
    console.log(` ✅ [PASS] Customer A Label: ${labelA}`);

    // STEP 3: Initialize Independent Session for Customer B
    console.log('\n--- STEP 3: Initialize Independent Session for Customer B ---');
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
      throw new Error(`Customer B init failed: ${JSON.stringify(c2Init.body)}`);
    }
    const tokenB = c2Init.body.sessionToken;
    const labelB = c2Init.body.sessionLabel;
    console.log(` ✅ [PASS] Customer B Token: ${tokenB}`);
    console.log(` ✅ [PASS] Customer B Label: ${labelB}`);

    // STEP 4: Query Session A via /api/order/session/:tokenA
    console.log('\n--- STEP 4: Query Dedicated Session Endpoint for Customer A ---');
    const sessARes = await request({
      hostname: '127.0.0.1',
      port: 3000,
      path: `/api/order/session/${tokenA}`,
      method: 'GET'
    });
    if (sessARes.status !== 200 || sessARes.body?.sessionToken !== tokenA) {
      throw new Error(`Session A query failed: ${JSON.stringify(sessARes.body)}`);
    }
    console.log(` ✅ [PASS] Dedicated endpoint returned Customer A data (HTTP 200 OK)`);
    console.log(`    Session Label: ${sessARes.body.sessionLabel}`);
    console.log(`    Table Number: ${sessARes.body.table?.number}`);

    // STEP 5: Query Session B via /api/order/session/:tokenB
    console.log('\n--- STEP 5: Query Dedicated Session Endpoint for Customer B ---');
    const sessBRes = await request({
      hostname: '127.0.0.1',
      port: 3000,
      path: `/api/order/session/${tokenB}`,
      method: 'GET'
    });
    if (sessBRes.status !== 200 || sessBRes.body?.sessionToken !== tokenB) {
      throw new Error(`Session B query failed: ${JSON.stringify(sessBRes.body)}`);
    }
    console.log(` ✅ [PASS] Dedicated endpoint returned Customer B data (HTTP 200 OK)`);
    console.log(`    Session Label: ${sessBRes.body.sessionLabel}`);

    // STEP 6: Query /api/order/table/:id/session with Token A vs Token B
    console.log('\n--- STEP 6: Table-Session Resolution with Scoped Tokens ---');
    const tblARes = await request({
      hostname: '127.0.0.1',
      port: 3000,
      path: `/api/order/table/${table.id}/session?sessionToken=${tokenA}`,
      method: 'GET'
    });
    if (tblARes.body?.sessionLabel !== labelA) {
      throw new Error(`Expected label ${labelA}, got ${tblARes.body?.sessionLabel}`);
    }
    console.log(` ✅ [PASS] Table route with Token A resolved to '${tblARes.body.sessionLabel}'`);

    const tblBRes = await request({
      hostname: '127.0.0.1',
      port: 3000,
      path: `/api/order/table/${table.id}/session?sessionToken=${tokenB}`,
      method: 'GET'
    });
    if (tblBRes.body?.sessionLabel !== labelB) {
      throw new Error(`Expected label ${labelB}, got ${tblBRes.body?.sessionLabel}`);
    }
    console.log(` ✅ [PASS] Table route with Token B resolved to '${tblBRes.body.sessionLabel}'`);

    // STEP 7: Anonymous / New Scanner Protection
    console.log('\n--- STEP 7: Protection Against Cross-Session Leaks ---');
    const anonRes = await request({
      hostname: '127.0.0.1',
      port: 3000,
      path: `/api/order/table/${table.id}/session`,
      method: 'GET'
    });
    if (anonRes.body?.hasActiveSession !== false) {
      throw new Error(`Anonymous scan leaked active session!`);
    }
    console.log(' ✅ [PASS] Anonymous scan without sessionToken returns hasActiveSession: false');
    console.log('    (New phones never accidentally inherit other diners\' carts or bills)');

    // STEP 8: Security - Non-existent Session Token
    console.log('\n--- STEP 8: Security Check for Non-Existent Session Token ---');
    const fakeTokenRes = await request({
      hostname: '127.0.0.1',
      port: 3000,
      path: '/api/order/session/cs_fake_nonexistent_token_123',
      method: 'GET'
    });
    if (fakeTokenRes.status !== 404) {
      throw new Error(`Expected HTTP 404, received ${fakeTokenRes.status}`);
    }
    console.log(' ✅ [PASS] Forged session token cleanly rejected with HTTP 404');

    console.log('\n===============================================================');
    console.log('🎉 MILESTONE 2 (20%) VERIFICATION PASSED WITH 100% SUCCESS!');
    console.log('💯 Session-Scoped Table Discovery & Re-Scan Isolation Operational.');
    console.log('===============================================================\n');

    process.exit(0);
  } catch (err) {
    console.error('\n❌ Milestone 2 Verification Failed:', err.message);
    process.exit(1);
  }
}

runMilestone2Tests();

