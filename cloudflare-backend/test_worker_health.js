import app from './src/index.js';
import { createMockD1 } from './src/d1_mock.js';

async function testWorkerHealth() {
  console.log('🧪 Running Module 2 Verification: Cloudflare Worker Gateway & Health Check...\n');

  const d1 = createMockD1({ loadSeed: true });
  const env = { DB: d1 };

  // 1. Test GET /
  const rootRes = await app.request('/', {}, env);
  const rootJson = await rootRes.json();
  console.log('🌐 GET / response:', rootJson);
  if (rootRes.status !== 200 || !rootJson.name) throw new Error('Root route failed');

  // 2. Test GET /health
  const healthRes = await app.request('/health', {}, env);
  const healthJson = await healthRes.json();
  console.log('⚡ GET /health response:', healthJson);
  if (healthRes.status !== 200 || healthJson.status !== 'ok') throw new Error('Health check failed');

  // 3. Test GET /health/db with D1
  const dbHealthRes = await app.request('/health/db', {}, env);
  const dbHealthJson = await dbHealthRes.json();
  console.log('🗄️ GET /health/db response:', dbHealthJson);
  if (dbHealthRes.status !== 200 || dbHealthJson.status !== 'ok') throw new Error('DB Health check failed');
  if (dbHealthJson.restaurant.name !== 'Royal Spice Bistro') throw new Error('Restaurant name mismatch');

  console.log('\n🎉 Module 2 (20%) Verification PASSED: Cloudflare Worker Gateway & D1 Connectivity are 100% Operational!\n');
}

testWorkerHealth().catch((err) => {
  console.error('❌ Module 2 test failed:', err);
  process.exit(1);
});

