import app from './src/index.js';
import { createMockD1 } from './src/d1_mock.js';

async function testUpiModule() {
  console.log('🧪 Running Module 7 Verification: Dynamic UPI Multi-Bank Switcher & Security on D1...\n');

  const d1 = createMockD1({ loadSeed: true });
  const env = { DB: d1, ADMIN_PASSWORD: 'supersecret' };
  const restaurantId = 'db4ed920-3d20-420a-9f54-99d3c0b48a08';

  // 1. Check initial customer UPI info
  const initialUpiRes = await app.request('/api/order/upi-info', {}, env);
  const initialUpi = await initialUpiRes.json();
  console.log('💳 Initial Public Customer UPI VPA:', initialUpi.upiId);
  if (initialUpi.upiId !== 'vallipriya1212-1@oksbi') throw new Error('Initial UPI VPA mismatch');

  // 2. Customer submits UTR payment proof
  const notifyRes = await app.request(
    '/api/order/upi/notify',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tableNumber: 1,
        utr: '412345678901',
        amount: 450,
        upiId: 'vallipriya1212-1@oksbi',
      }),
    },
    env
  );
  const notifyJson = await notifyRes.json();
  console.log('🔔 UTR Payment Notification recorded:', notifyJson);
  if (notifyRes.status !== 200 || !notifyJson.success) throw new Error('UTR notify failed');

  // 3. Admin queries UPI settings
  const adminUpiRes = await app.request(`/api/admin/upi?restaurantId=${restaurantId}`, {}, env);
  const adminUpi = await adminUpiRes.json();
  console.log('🏦 Admin UPI Accounts found:', adminUpi.upiAccounts.length);
  if (adminUpi.upiAccounts.length < 3) throw new Error('Expected at least 3 bank presets');

  // 4. Unauthorized Bank Switch attempt with wrong PIN '9999'
  const failSwitchRes = await app.request(
    '/api/admin/upi',
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        restaurantId,
        upiId: 'royalspice.bistro@okhdfcbank',
        upiName: 'Royal Spice Bistro (HDFC)',
        passkey: '9999',
      }),
    },
    env
  );
  console.log('🛑 Wrong PIN switch response status:', failSwitchRes.status);
  if (failSwitchRes.status !== 403) throw new Error('Expected 403 Forbidden on wrong passkey');

  // 5. Authorized Bank Switch with valid PIN '1234'
  const successSwitchRes = await app.request(
    '/api/admin/upi',
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        restaurantId,
        upiId: 'royalspice.bistro@okhdfcbank',
        upiName: 'Royal Spice Bistro (HDFC)',
        passkey: '1234',
      }),
    },
    env
  );
  const switchJson = await successSwitchRes.json();
  console.log('✅ Authorized Switch response:', switchJson);
  if (successSwitchRes.status !== 200 || switchJson.upiId !== 'royalspice.bistro@okhdfcbank') {
    throw new Error('Authorized bank switch failed');
  }

  // 6. Verify Customer UPI Info now returns HDFC Bank VPA
  const updatedUpiRes = await app.request('/api/order/upi-info', {}, env);
  const updatedUpi = await updatedUpiRes.json();
  console.log('🔄 Public Customer UPI VPA after switch:', updatedUpi.upiId);
  if (updatedUpi.upiId !== 'royalspice.bistro@okhdfcbank') {
    throw new Error('Customer UPI did not synchronize with switched account');
  }

  // 7. Reset Manager Passkey using Admin Master Password
  const resetRes = await app.request(
    '/api/admin/upi/reset-passkey',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        restaurantId,
        adminPassword: 'supersecret',
        newPasskey: '9876',
      }),
    },
    env
  );
  const resetJson = await resetRes.json();
  console.log('🔐 Passkey Reset response:', resetJson);
  if (resetRes.status !== 200 || !resetJson.success) throw new Error('Passkey reset failed');

  // 8. Test Bank Switch using the NEW PIN '9876' to ICICI Bank
  const newPinSwitchRes = await app.request(
    '/api/admin/upi',
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        restaurantId,
        upiId: 'royalspice@icici',
        upiName: 'Royal Spice Bistro (ICICI)',
        passkey: '9876',
      }),
    },
    env
  );
  const newPinJson = await newPinSwitchRes.json();
  console.log('🎉 New PIN switch response:', newPinJson);
  if (newPinSwitchRes.status !== 200 || newPinJson.upiId !== 'royalspice@icici') {
    throw new Error('Switch with new PIN failed');
  }

  console.log('\n🎉 Module 7 (70%) Verification PASSED: Dynamic UPI Multi-Bank Switcher & Security on D1 are 100% Operational!\n');
}

testUpiModule().catch((err) => {
  console.error('❌ Module 7 test failed:', err);
  process.exit(1);
});

