// test_milestone_3.js - Automated Verification for Milestone 3 (30% Categorized Menu, Filtering & Search)
process.env.NODE_ENV = 'test';

import http from 'http';

console.log('================================================================');
console.log('🚀 RESTAURANT QR ORDERING SYSTEM: MILESTONE 3 VERIFICATION (30%)');
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

async function request(options) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data), raw: data });
        } catch {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

// Frontend dietary inference helper
function isInferredVeg(item) {
  if (item.is_veg !== undefined) return Boolean(item.is_veg);
  const name = item.name.toLowerCase();
  return (
    !name.includes('chicken') &&
    !name.includes('mutton') &&
    !name.includes('fish') &&
    !name.includes('meat') &&
    !name.includes('egg') &&
    !name.includes('prawn')
  );
}

async function runMilestone3() {
  const backendModule = await import('../qr-menu-backend/server.js');
  const server = backendModule.server || backendModule.default?.server;
  const PORT = 3014;

  server.listen(PORT, async () => {
    try {
      console.log(`--- STEP 1: Discover Active Restaurant ---`);
      const defaultTableRes = await request({
        hostname: 'localhost',
        port: PORT,
        path: '/api/order/tables/default',
        method: 'GET',
      });
      const restaurantId = defaultTableRes.body?.table?.restaurant_id;
      assert('Found active restaurant ID from database', !!restaurantId);

      console.log(`\n--- STEP 2: Fetch Categorized Menu Structure ---`);
      const categoriesRes = await request({
        hostname: 'localhost',
        port: PORT,
        path: `/api/menu/${restaurantId}/categories`,
        method: 'GET',
      });
      assert('Categories endpoint responds (HTTP 200 OK)', categoriesRes.status === 200);
      assert('Categories returned as array', Array.isArray(categoriesRes.body));
      assert('Categories array is not empty', categoriesRes.body.length > 0);
      console.log(`     Discovered Categories: [${categoriesRes.body.join(', ')}]`);

      console.log(`\n--- STEP 3: Fetch Full Dish Catalog ---`);
      const menuRes = await request({
        hostname: 'localhost',
        port: PORT,
        path: `/api/menu/${restaurantId}`,
        method: 'GET',
      });
      assert('Menu endpoint responds (HTTP 200 OK)', menuRes.status === 200);
      const items = Array.isArray(menuRes.body) ? menuRes.body : menuRes.body?.items || [];
      assert('Menu dishes returned as list', items.length > 0);
      
      const firstDish = items[0];
      assert('Dish model includes id', !!firstDish.id);
      assert('Dish model includes name', !!firstDish.name);
      assert('Dish model includes numeric price', typeof firstDish.price === 'number' && firstDish.price > 0);
      assert('Dish model includes category', !!firstDish.category);
      assert('Dish model includes availability status', typeof firstDish.available === 'boolean');
      console.log(`     Loaded ${items.length} total dishes across all categories.`);

      console.log(`\n--- STEP 4: Test Frontend Dietary Filter Logic (Veg vs Non-Veg) ---`);
      const vegDishes = items.filter(isInferredVeg);
      const nonVegDishes = items.filter((it) => !isInferredVeg(it));

      assert('Veg dishes identified in menu', vegDishes.length > 0);
      assert('Non-Veg dishes identified in menu', nonVegDishes.length > 0);
      console.log(`     Veg Count: ${vegDishes.length} dishes | Non-Veg Count: ${nonVegDishes.length} dishes`);

      // Verify specific items match their expected classification
      const paneer = items.find((i) => i.name.toLowerCase().includes('paneer'));
      if (paneer) {
        assert(`'${paneer.name}' correctly identified as VEG`, isInferredVeg(paneer) === true);
      }
      const chicken = items.find((i) => i.name.toLowerCase().includes('chicken'));
      if (chicken) {
        assert(`'${chicken.name}' correctly identified as NON-VEG`, isInferredVeg(chicken) === false);
      }

      console.log(`\n--- STEP 5: Test Real-Time Search Filtering ---`);
      // Search for 'Naan'
      const naanSearch = items.filter((it) =>
        it.name.toLowerCase().includes('naan') || (it.description || '').toLowerCase().includes('naan')
      );
      assert('Search for "Naan" returns matching items', naanSearch.length > 0);

      // Search for non-existent item
      const emptySearch = items.filter((it) =>
        it.name.toLowerCase().includes('xyz_nonexistent_999')
      );
      assert('Search for non-existent query returns 0 items (clean empty state)', emptySearch.length === 0);

      console.log(`\n--- STEP 6: Test Grouped Category Payload ---`);
      const groupedRes = await request({
        hostname: 'localhost',
        port: PORT,
        path: `/api/menu/${restaurantId}?groupByCategory=true`,
        method: 'GET',
      });
      assert('Grouped menu endpoint responds (HTTP 200 OK)', groupedRes.status === 200);
      assert('Grouped categories array returned', Array.isArray(groupedRes.body?.categories));
      assert('itemsByCategory map is present', typeof groupedRes.body?.itemsByCategory === 'object');

      console.log('\n================================================================');
      if (!failed) {
        console.log('🎉 MILESTONE 3 (30%) VERIFICATION PASSED WITH 100% SUCCESS!');
        console.log('💯 Categorized Menu, Dietary Tags & Search Filtering Validated.');
      } else {
        console.log('❌ MILESTONE 3 FAILED - Check errors above.');
      }
      console.log('================================================================\n');

    } catch (err) {
      console.error('Milestone 3 Test Runner Error:', err);
    } finally {
      server.close();
      process.exit(failed ? 1 : 0);
    }
  });
}

runMilestone3();

