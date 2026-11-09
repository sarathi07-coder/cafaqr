// db/migrate_sessions.js
const db = require('./index');

async function migrateSessions() {
  console.log('🔄 Running Multi-Customer Table Session Migration on Supabase PostgreSQL...');

  try {
    // 1. Create customer_sessions table
    await db.query(`
      CREATE TABLE IF NOT EXISTS customer_sessions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          session_token TEXT UNIQUE NOT NULL,
          table_id UUID REFERENCES tables(id) ON DELETE CASCADE,
          restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
          customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
          session_label TEXT NOT NULL DEFAULT 'Customer 1',
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
          last_active TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);
    console.log('✅ Created table customer_sessions');

    // 2. Create indexes
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_customer_sessions_table ON customer_sessions(table_id, is_active);
      CREATE INDEX IF NOT EXISTS idx_customer_sessions_token ON customer_sessions(session_token);
    `);
    console.log('✅ Created indexes on customer_sessions');

    // 3. Add session columns to orders table
    await db.query(`
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES customer_sessions(id) ON DELETE SET NULL;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS session_token TEXT;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS session_label TEXT;
      CREATE INDEX IF NOT EXISTS idx_orders_session ON orders(session_token);
    `);
    console.log('✅ Added session_id, session_token, session_label columns to orders table');

    console.log('🎉 Migration completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
}

migrateSessions();

