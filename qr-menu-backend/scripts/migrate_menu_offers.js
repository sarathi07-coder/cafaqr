// scripts/migrate_menu_offers.js
const db = require('../db');

async function migrateMenuOffers() {
  console.log('🔄 Running Menu Offers & Customization Migration...');
  try {
    await db.query(`
      ALTER TABLE menu_items 
      ADD COLUMN IF NOT EXISTS original_price NUMERIC(10,2) DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS offer_badge TEXT DEFAULT NULL;
    `);

    // Let's seed a couple of high-profile offers on existing dishes to showcase the feature!
    await db.query(`
      UPDATE menu_items 
      SET original_price = 380.00, offer_badge = '12% OFF'
      WHERE name ILIKE '%Butter Chicken%' AND (original_price IS NULL OR original_price = 0);
    `);

    await db.query(`
      UPDATE menu_items 
      SET original_price = 320.00, offer_badge = 'CHEF SPECIAL'
      WHERE name ILIKE '%Paneer Butter Masala%' AND (original_price IS NULL OR original_price = 0);
    `);

    await db.query(`
      UPDATE menu_items 
      SET original_price = 100.00, offer_badge = '20% OFF'
      WHERE name ILIKE '%Fresh Lime Soda%' AND (original_price IS NULL OR original_price = 0);
    `);

    const res = await db.query(`
      SELECT id, name, price, original_price, offer_badge, available 
      FROM menu_items 
      WHERE original_price IS NOT NULL 
      LIMIT 3
    `);

    console.log('✅ Menu Offers Migration Completed Successfully!');
    console.log('Sample Dishes with Offers:', res.rows);
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration Error:', err);
    process.exit(1);
  }
}

migrateMenuOffers();

