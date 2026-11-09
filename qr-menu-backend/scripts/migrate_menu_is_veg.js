const db = require('../db');

async function migrate() {
  try {
    console.log('--- Migrating menu_items table: adding is_veg column ---');
    await db.query(`
      ALTER TABLE menu_items 
      ADD COLUMN IF NOT EXISTS is_veg BOOLEAN DEFAULT true;
    `);

    // Detect non-veg dishes by keyword in name or description
    const nonVegKeywords = ['chicken', 'mutton', 'fish', 'prawn', 'meat', 'egg', 'lamb', 'beef', 'pork', 'keema', 'seafood'];
    
    // Update non-veg items
    for (const kw of nonVegKeywords) {
      const res = await db.query(`
        UPDATE menu_items 
        SET is_veg = false 
        WHERE LOWER(name) LIKE $1 OR LOWER(description) LIKE $1
        RETURNING id, name
      `, [`%${kw}%`]);
      if (res.rowCount > 0) {
        console.log(`Updated dishes with keyword '${kw}' to Non-Veg:`, res.rows.map(r => r.name));
      }
    }

    const check = await db.query(`
      SELECT is_veg, COUNT(*) as count 
      FROM menu_items 
      GROUP BY is_veg
    `);
    console.log('Menu items diet distribution:', check.rows);
    console.log('--- Migration completed successfully ---');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate();

