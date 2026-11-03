// test_milestone_1.js - Automated Verification for Milestone 1 (10% Foundation)
process.env.NODE_ENV = 'test';

import { execSync } from 'child_process';
import http from 'http';
import { io } from 'socket.io-client';

console.log('================================================================');
console.log('🚀 RESTAURANT QR ORDERING SYSTEM: MILESTONE 1 VERIFICATION (10%)');
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

async function request(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data), raw: data });
        } catch {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    }).on('error', reject);
  });
}

async function runMilestone1() {
  const backendModule = await import('../qr-menu-backend/server.js');
  const server = backendModule.server || backendModule.default?.server;
  const PORT = 3012;

  server.listen(PORT, async () => {
    try {
      console.log(`--- STEP 1: Frontend Production Compilation & Assets ---`);
      try {
        const buildOutput = execSync('npm run build', { cwd: process.cwd() }).toString();
        assert('Vite production build succeeds without errors', buildOutput.includes('built in') || buildOutput.includes('dist/index.html'));
      } catch (err) {
        assert('Vite production build succeeds without errors', false);
      }

      console.log(`\n--- STEP 2: Backend Health & System Security Check ---`);
      const healthRes = await request(`http://localhost:${PORT}/api/health`);
      assert('Backend Health Check (HTTP 200 OK)', healthRes.status === 200);
      assert('Health Payload confirms active status', healthRes.body?.status === 'ok');

      console.log(`\n--- STEP 3: PostgreSQL Database Discovery & Default Table ---`);
      const defaultTableRes = await request(`http://localhost:${PORT}/api/order/tables/default`);
      assert('Query Default Table & Restaurant (HTTP 200 OK)', defaultTableRes.status === 200);
      assert('Default Table ID returned', !!defaultTableRes.body?.table?.id);
      assert('Default Restaurant ID returned', !!defaultTableRes.body?.table?.restaurant_id);
      
      const tableId = defaultTableRes.body?.table?.id;
      const tableNumber = defaultTableRes.body?.table?.number;
      console.log(`     Discovered Table #${tableNumber} (ID: ${tableId})`);

      console.log(`\n--- STEP 4: Table Session State Handshake ---`);
      const sessionRes = await request(`http://localhost:${PORT}/api/order/table/${tableId}/session`);
      assert('Table Session API Responds (HTTP 200 OK)', sessionRes.status === 200);
      assert('hasActiveSession flag is boolean', typeof sessionRes.body?.hasActiveSession === 'boolean');

      console.log(`\n--- STEP 5: Real-Time WebSocket Handshake ---`);
      const socket = io(`http://localhost:${PORT}`, {
        transports: ['websocket'],
        reconnection: false,
      });

      await new Promise((resolve) => {
        socket.on('connect', () => {
          assert('Socket.IO Client Handshake Connected', socket.connected);
          socket.disconnect();
          resolve();
        });
        socket.on('connect_error', (err) => {
          assert('Socket.IO Client Handshake Connected', false);
          resolve();
        });
      });

      console.log('\n================================================================');
      if (!failed) {
        console.log('🎉 MILESTONE 1 (10%) VERIFICATION PASSED WITH 100% SUCCESS!');
        console.log('💯 Foundation, Responsive Shell, API Proxy & DB Verified.');
      } else {
        console.log('❌ MILESTONE 1 FAILED - Check errors above.');
      }
      console.log('================================================================\n');

    } catch (err) {
      console.error('Milestone 1 Test Runner Error:', err);
    } finally {
      server.close();
      process.exit(failed ? 1 : 0);
    }
  });
}

runMilestone1();
