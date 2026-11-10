import app from './src/index.js';
import { createMockD1 } from './src/d1_mock.js';

async function testSessionModule() {
  console.log('🧪 Running Module 4 Verification: Customer Session & Table Handshake on D1...\n');

  const d1 = createMockD1({ loadSeed: true });
  const env = { DB: d1 };

  // 1. Fetch default table
  const defaultRes = await app.request('/api/order/tables/default', {}, env);
  const defaultJson = await defaultRes.json();
  console.log('🪑 Default Table response:', defaultJson);
  if (defaultRes.status !== 200 || !defaultJson.table || defaultJson.table.number !== 1) {
    throw new Error('Default table lookup failed');
  }
  const tableId = defaultJson.table.id;

  // 2. Initialize first customer session
  const initRes1 = await app.request(
    '/api/order/session/init',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tableId }),
    },
    env
  );
  const initJson1 = await initRes1.json();
  console.log('👤 First Customer Session initialized:', initJson1);
  if (initRes1.status !== 201 || initJson1.sessionLabel !== 'Customer 1' || !initJson1.sessionToken) {
    throw new Error('First customer session init failed');
  }

  // 3. Initialize second customer session at same table
  const initRes2 = await app.request(
    '/api/order/session/init',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tableId }),
    },
    env
  );
  const initJson2 = await initRes2.json();
  console.log('👥 Second Customer Session initialized:', initJson2);
  if (initRes2.status !== 201 || initJson2.sessionLabel !== 'Customer 2') {
    throw new Error('Second customer session init failed');
  }

  // 4. Recover session 1 with existing session token
  const recoverRes = await app.request(
    '/api/order/session/init',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tableId, sessionToken: initJson1.sessionToken }),
    },
    env
  );
  const recoverJson = await recoverRes.json();
  console.log('🔄 Recovered Existing Session:', recoverJson);
  if (recoverRes.status !== 200 || recoverJson.isNew !== false || recoverJson.sessionLabel !== 'Customer 1') {
    throw new Error('Session recovery failed');
  }

  // 5. Lookup table session
  const tableSessRes = await app.request(`/api/order/table/${tableId}/session`, {}, env);
  const tableSessJson = await tableSessRes.json();
  console.log('📊 Table Session lookup:', tableSessJson);
  if (tableSessRes.status !== 200 || !tableSessJson.table) {
    throw new Error('Table session lookup failed');
  }

  console.log('\n🎉 Module 4 (40%) Verification PASSED: Customer Session & Table Handshake are 100% Operational!\n');
}

testSessionModule().catch((err) => {
  console.error('❌ Module 4 test failed:', err);
  process.exit(1);
});

