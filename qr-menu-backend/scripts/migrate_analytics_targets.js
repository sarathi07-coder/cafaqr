// scripts/migrate_analytics_targets.js
const db = require('../db');

async function migrateAnalyticsTargets() {
  console.log('🔄 Running Milestone 1 Migration: Analytics Targets Schema...');
  try {
    await db.query(`
      ALTER TABLE restaurants 
      ADD COLUMN IF NOT EXISTS daily_target NUMERIC(12,2) DEFAULT 20000.00,
      ADD COLUMN IF NOT EXISTS weekly_target NUMERIC(12,2) DEFAULT 120000.00,
      ADD COLUMN IF NOT EXISTS monthly_target NUMERIC(12,2) DEFAULT 500000.00;
    `);

    // Ensure all existing restaurants have default target values if null
    await db.query(`
      UPDATE restaurants 
      SET 
        daily_target = COALESCE(daily_target, 20000.00),
        weekly_target = COALESCE(weekly_target, 120000.00),
        monthly_target = COALESCE(monthly_target, 500000.00)
    `);

    const res = await db.query(`
      SELECT id, name, daily_target, weekly_target, monthly_target 
      FROM restaurants 
      LIMIT 1
    `);

    console.log('✅ Milestone 1 Schema Migration Verified Successfully!');
    console.log('Sample Restaurant Targets:', res.rows[0]);
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration Error:', err);
    process.exit(1);
  }
}

migrateAnalyticsTargets();

