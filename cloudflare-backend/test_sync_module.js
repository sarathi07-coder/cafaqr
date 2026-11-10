import app from './src/index.js';
import { createMockD1 } from './src/d1_mock.js';

async function testSyncModule() {
  console.log('🧪 Running Module 8 Verification: Real-Time Synchronization & Service Calls on D1...\n');

  const d1 = createMockD1({ loadSeed: true });
  const env = { DB: d1 };

  const restaurantId = 'db4ed920-3d20-420a-9f54-99d3c0b48a08';
  const tableId = 'b6f869e1-d722-440a-8928-a65e1e76ced5';

  // 1. Customer calls waiter for extra cutlery
  const callRes = await app.request(
    `/api/order/table/${tableId}/call-waiter`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestType: 'Extra Cutlery',
        note: 'Please bring 2 forks and spoons',
        customerName: 'Rohit Sharma',
      }),
    },
    env
  );
  const callJson = await callRes.json();
  console.log('🛎️ Waiter Service Call placed:', callJson);
  if (callRes.status !== 200 || !callJson.requestId) throw new Error('Waiter call failed');

  // 2. Floor staff / Admin retrieves pending service calls
  const listRes = await app.request(`/api/admin/service-requests?restaurantId=${restaurantId}`, {}, env);
  const listJson = await listRes.json();
  console.log('📋 Pending Service Calls count:', listJson.length);
  if (listRes.status !== 200 || listJson.length === 0) throw new Error('Service list failed');
  const req = listJson.find((r) => r.id === callJson.requestId);
  if (!req || req.status !== 'PENDING') throw new Error('Call not found or not in PENDING state');

  // 3. Staff resolves service call
  const resolveRes = await app.request(
    `/api/admin/service-requests/${callJson.requestId}/resolve`,
    { method: 'PUT' },
    env
  );
  const resolveJson = await resolveRes.json();
  console.log('✅ Service Call resolved:', resolveJson);
  if (resolveRes.status !== 200 || !resolveJson.success) throw new Error('Resolve failed');

  // 4. Verify resolved call no longer appears in pending list
  const refreshedListRes = await app.request(`/api/admin/service-requests?restaurantId=${restaurantId}`, {}, env);
  const refreshedList = await refreshedListRes.json();
  const stillPending = refreshedList.some((r) => r.id === callJson.requestId);
  console.log('🧹 Call cleared from pending list:', !stillPending);
  if (stillPending) throw new Error('Resolved call should not appear in pending list');

  // 5. Test table sync endpoint
  const syncRes = await app.request(`/api/order/table/${tableId}/sync`, {}, env);
  const syncJson = await syncRes.json();
  console.log('⚡ Table Real-time Sync state:', syncJson);
  if (syncRes.status !== 200) throw new Error('Sync endpoint failed');

  console.log('\n🎉 Module 8 (80%) Verification PASSED: Real-Time Sync & Waiter Calls on D1 are 100% Operational!\n');
}

testSyncModule().catch((err) => {
  console.error('❌ Module 8 test failed:', err);
  process.exit(1);
});

