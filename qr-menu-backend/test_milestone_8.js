// test_milestone_8.js - Verification of Real-Time Waiter Calling per Customer Session
const http = require('http');

function postJson(path, data) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(data);
    const req = http.request({
      hostname: '127.0.0.1',
      port: 3000,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, text: body });
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

const { issueToken } = require('./middleware/auth');
const adminToken = issueToken({ email: 'admin@example.com' });

function putJson(path, data) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(data || {});
    const req = http.request({
      hostname: '127.0.0.1',
      port: 3000,
      path,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`,
        'Content-Length': Buffer.byteLength(payload)
      }
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, text: body });
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function getJson(path, auth = false) {
  return new Promise((resolve, reject) => {
    const headers = {};
    if (auth) headers['Authorization'] = `Bearer ${adminToken}`;
    http.get(`http://127.0.0.1:3000${path}`, { headers }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, text: body });
        }
      });
    }).on('error', reject);
  });
}

async function run() {
  console.log('--- Testing Milestone 8: Real-Time Waiter Calling per Customer Session ---');

  // 1. Get default table
  const tableRes = await getJson('/api/order/tables/default');
  const table = tableRes.data.table;
  const tableId = table.id;
  const restaurantId = table.restaurant_id;

  // 2. Initialize customer sessions
  const sA = await postJson('/api/order/session/init', { tableId, customerName: 'Alice' });
  const tokenA = sA.data.sessionToken;
  const labelA = sA.data.sessionLabel;

  const sB = await postJson('/api/order/session/init', { tableId, customerName: 'Bob' });
  const tokenB = sB.data.sessionToken;
  const labelB = sB.data.sessionLabel;

  console.log(`Initialized sessions: Alice (${labelA}), Bob (${labelB}) at Table #${table.number}`);

  // 3. Alice calls waiter for Water
  console.log('Alice calls for warm water...');
  const callA = await postJson(`/api/order/table/${tableId}/call-waiter`, {
    requestType: 'WATER',
    note: 'Warm water please',
    sessionToken: tokenA,
    sessionLabel: labelA,
    customerName: 'Alice'
  });
  if (callA.status !== 201) {
    throw new Error(`Alice call waiter failed: ${JSON.stringify(callA.data)}`);
  }
  const reqIdA = callA.data.request.id;
  console.log(`✅ Alice request created: ID ${reqIdA}`);

  // 4. Bob calls waiter for Cutlery at SAME table
  console.log('Bob calls for extra forks...');
  const callB = await postJson(`/api/order/table/${tableId}/call-waiter`, {
    requestType: 'CUTLERY',
    note: '2 extra forks',
    sessionToken: tokenB,
    sessionLabel: labelB,
    customerName: 'Bob'
  });
  if (callB.status !== 201) {
    throw new Error(`Bob call waiter failed: ${JSON.stringify(callB.data)}`);
  }
  const reqIdB = callB.data.request.id;
  console.log(`✅ Bob request created: ID ${reqIdB}`);

  // 5. Query active service requests via Admin API
  const adminRes = await getJson(`/api/admin/service-requests?restaurantId=${restaurantId}&status=PENDING`, true);
  const requests = adminRes.data;

  const findA = requests.find(r => r.id === reqIdA);
  const findB = requests.find(r => r.id === reqIdB);

  if (!findA || !findB) {
    throw new Error('Could not find both requests in admin service requests');
  }

  console.log(`Found Admin Request A: Table #${findA.table_number}, Session: ${findA.session_label}, Customer: ${findA.customer_name}, Type: ${findA.request_type}`);
  console.log(`Found Admin Request B: Table #${findB.table_number}, Session: ${findB.session_label}, Customer: ${findB.customer_name}, Type: ${findB.request_type}`);

  if (findA.customer_name !== 'Alice' || findA.session_label !== labelA) {
    throw new Error('Request A customer / session mismatch');
  }
  if (findB.customer_name !== 'Bob' || findB.session_label !== labelB) {
    throw new Error('Request B customer / session mismatch');
  }
  console.log('✅ Service requests correctly capture independent session identifiers & customer names!');

  // 6. Staff resolves Alice's call
  console.log('Staff resolving Alice\'s call...');
  const resolveA = await putJson(`/api/admin/service-requests/${reqIdA}/resolve`);
  const resolvedStatus = resolveA.data.status || resolveA.data.request?.status;
  if (resolveA.status !== 200 || resolvedStatus !== 'RESOLVED') {
    throw new Error(`Failed to resolve request A: ${JSON.stringify(resolveA.data)}`);
  }

  // 7. Verify Bob's call is STILL PENDING
  const adminRes2 = await getJson(`/api/admin/service-requests?restaurantId=${restaurantId}&status=PENDING`, true);
  const findBRemaining = adminRes2.data.find(r => r.id === reqIdB);
  if (!findBRemaining) {
    throw new Error('Bob request was accidentally resolved!');
  }
  console.log('✅ Bob\'s request remained PENDING while Alice\'s request was resolved!');

  // Clean up
  const db = require('./db');
  await db.query('DELETE FROM service_requests WHERE id IN ($1, $2)', [reqIdA, reqIdB]);
  await db.query('DELETE FROM customer_sessions WHERE session_token IN ($1, $2)', [tokenA, tokenB]);
  console.log('Test requests and sessions cleaned up.');

  console.log('🎉 Milestone 8 Verification PASSED! All Waiter Calling Multi-Session requirements verified.');
  process.exit(0);
}

run().catch(err => {
  console.error('❌ Milestone 8 Test Failed:', err);
  process.exit(1);
});
