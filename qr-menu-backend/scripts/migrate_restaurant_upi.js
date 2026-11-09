const db = require('../db');

async function migrate() {
  try {
    console.log('--- Adding UPI columns to restaurants table ---');
    await db.query(`
      ALTER TABLE restaurants
      ADD COLUMN IF NOT EXISTS upi_id TEXT DEFAULT 'vallipriya1212-1@oksbi',
      ADD COLUMN IF NOT EXISTS upi_name TEXT DEFAULT 'Royal Spice Bistro';
    `);

    await db.query(`
      UPDATE restaurants
      SET upi_id = 'vallipriya1212-1@oksbi',
          upi_name = COALESCE(name, 'Royal Spice Bistro')
      WHERE upi_id IS NULL OR upi_id = '';
    `);

    const res = await db.query('SELECT id, name, upi_id, upi_name FROM restaurants');
    console.log('Restaurants UPI configuration:', res.rows);
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate();

