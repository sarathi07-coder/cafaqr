import app from './src/index.js';
import { createMockD1 } from './src/d1_mock.js';

async function testMenuModule() {
  console.log('🧪 Running Module 3 Verification: Cloudflare Menu & Catalog on D1...\n');

  const d1 = createMockD1({ loadSeed: true });
  const env = { DB: d1 };
  const restaurantId = 'db4ed920-3d20-420a-9f54-99d3c0b48a08';

  // 1. Fetch categories
  const catRes = await app.request(`/api/menu/${restaurantId}/categories`, {}, env);
  const categories = await catRes.json();
  console.log('📑 Categories returned:', categories);
  if (catRes.status !== 200 || !Array.isArray(categories) || categories.length === 0) {
    throw new Error('Categories test failed');
  }

  // 2. Fetch full flat menu
  const menuRes = await app.request(`/api/menu/${restaurantId}`, {}, env);
  const menuItems = await menuRes.json();
  console.log(`🍽️ Full menu items count: ${menuItems.length} (Expected: 13)`);
  if (menuRes.status !== 200 || menuItems.length !== 13) {
    throw new Error('Full menu items count mismatch');
  }

  // 3. Verify Edge Cache headers
  const cacheHeader = menuRes.headers.get('Cache-Control');
  console.log('⚡ Edge Cache-Control header:', cacheHeader);
  if (!cacheHeader || !cacheHeader.includes('s-maxage=')) {
    throw new Error('Missing Edge Cache headers');
  }

  // 4. Fetch menu grouped by category
  const groupedRes = await app.request(`/api/menu/${restaurantId}?groupByCategory=true`, {}, env);
  const groupedJson = await groupedRes.json();
  console.log('🍱 Grouped categories found:', groupedJson.categories);
  if (!groupedJson.itemsByCategory || !groupedJson.itemsByCategory['Main Course']) {
    throw new Error('Grouped menu test failed');
  }

  // 5. Test category filter ?category=Beverages
  const bevRes = await app.request(`/api/menu/${restaurantId}?category=Beverages`, {}, env);
  const bevItems = await bevRes.json();
  console.log(`🥤 Beverages items count: ${bevItems.length} (Expected: 2)`);
  if (bevItems.length !== 2) throw new Error('Category filter test failed');

  console.log('\n🎉 Module 3 (30%) Verification PASSED: Cloudflare Menu & Catalog on D1 are 100% Operational!\n');
}

testMenuModule().catch((err) => {
  console.error('❌ Module 3 test failed:', err);
  process.exit(1);
});

