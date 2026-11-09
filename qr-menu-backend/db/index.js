// db/index.js
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const isProductionOrCloud = process.env.DB_HOST && !process.env.DB_HOST.includes('localhost');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '6543', 10),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 30000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 5000,
  ssl: isProductionOrCloud ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => {
  console.warn('[DB Pool] Idle client warning (will reconnect on next query):', err.message);
});

// Periodic heartbeat keep-alive ping to ensure connections remain warm and responsive
let heartbeatTimer = null;
function startHeartbeat() {
  if (heartbeatTimer) return;
  heartbeatTimer = setInterval(async () => {
    try {
      await pool.query('SELECT 1');
    } catch (e) {
      // Quietly allow pool to re-establish on next request
    }
  }, 20000);
  if (heartbeatTimer.unref) heartbeatTimer.unref();
}
startHeartbeat();

// Resilient query wrapper that automatically retries if PgBouncer recycled an idle connection
async function queryWithRetry(text, params, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await pool.query(text, params);
    } catch (err) {
      const msg = err.message || '';
      const code = err.code || '';
      const isConnectionIssue = 
        msg.includes('Connection terminated') ||
        msg.includes('connection timeout') ||
        msg.includes('closed') ||
        msg.includes('ECONNRESET') ||
        msg.includes('socket hang up') ||
        msg.includes('ETIMEDOUT') ||
        code === '57P01' ||
        code === '08006' ||
        code === '08001';

      if (isConnectionIssue && attempt < maxRetries) {
        const delay = attempt * 400;
        console.warn(`[DB Pool] Connection dropped on attempt ${attempt} (${msg}). Retrying in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
}

module.exports = {
  query: queryWithRetry,
  pool,
};
