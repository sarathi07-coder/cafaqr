// Automated verification of Cloudflare D1 (SQLite) Schema and Seed
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function runTest() {
  console.log('🧪 Running Module 1 Verification: Cloudflare D1 Schema & Seed Test...\n');

  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');

  // 1. Read and apply schema.sql
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schemaSql);
  console.log('✅ schema.sql executed successfully without syntax errors.');

  // 2. Read and apply d1_seed.sql
  const seedPath = path.join(__dirname, 'd1_seed.sql');
  const seedSql = fs.readFileSync(seedPath, 'utf8');
  db.exec(seedSql);
  console.log('✅ d1_seed.sql executed successfully.');

  // 3. Verify counts
  const restRow = db.prepare('SELECT id, name, upi_id, upi_name, upi_passkey FROM restaurants LIMIT 1').get();
  console.log('🏛️ Restaurant in D1:', restRow);
  if (!restRow || restRow.name !== 'Royal Spice Bistro') throw new Error('Restaurant verification failed');

  const tableCount = db.prepare('SELECT COUNT(*) as count FROM tables').get().count;
  console.log(`🪑 Seeded Tables count: ${tableCount} (Expected: 5)`);
  if (tableCount !== 5) throw new Error('Expected 5 tables');

  const menuCount = db.prepare('SELECT COUNT(*) as count FROM menu_items').get().count;
  console.log(`🍛 Seeded Menu Items count: ${menuCount} (Expected: 13)`);
  if (menuCount !== 13) throw new Error('Expected 13 menu items');

  const couponCount = db.prepare('SELECT COUNT(*) as count FROM coupons').get().count;
  console.log(`🎟️ Seeded Active Coupons count: ${couponCount} (Expected: 2)`);
  if (couponCount !== 2) throw new Error('Expected 2 coupons');

  // 4. Test transactional order insertion with foreign keys
  db.exec(`
    INSERT INTO customers (id, name, phone, consent_given) 
    VALUES ('cust_test_1', 'John Doe', '9876543210', 1);

    INSERT INTO customer_sessions (id, session_token, table_id, restaurant_id, customer_id, session_label)
    VALUES ('sess_test_1', 'cs_test_token_123', 'b6f869e1-d722-440a-8928-a65e1e76ced5', 'db4ed920-3d20-420a-9f54-99d3c0b48a08', 'cust_test_1', 'Customer 1');

    INSERT INTO orders (id, restaurant_id, table_id, customer_id, session_id, session_token, session_label, status, subtotal, tax_amount, total)
    VALUES ('ord_test_1', 'db4ed920-3d20-420a-9f54-99d3c0b48a08', 'b6f869e1-d722-440a-8928-a65e1e76ced5', 'cust_test_1', 'sess_test_1', 'cs_test_token_123', 'Customer 1', 'PENDING', 240, 12, 252);

    INSERT INTO order_items (id, order_id, menu_item_id, quantity, price_at_order, status)
    VALUES ('item_test_1', 'ord_test_1', '59eb2366-8c87-4990-9cbc-6bf2607ac15a', 1, 240, 'PENDING');
  `);

  const insertedOrder = db.prepare('SELECT id, status, total FROM orders WHERE id = ?').get('ord_test_1');
  console.log('📦 Sample Order created and verified in D1:', insertedOrder);
  if (!insertedOrder || insertedOrder.total !== 252) throw new Error('Order verification failed');

  const insertedItem = db.prepare('SELECT id, menu_item_id, price_at_order FROM order_items WHERE order_id = ?').get('ord_test_1');
  console.log('🍲 Sample Order Item created and verified in D1:', insertedItem);
  if (!insertedItem) throw new Error('Order item verification failed');

  console.log('\n🎉 Module 1 (10%) Verification PASSED: Cloudflare D1 SQLite Schema & Seed are 100% Validated!\n');
}

runTest();
