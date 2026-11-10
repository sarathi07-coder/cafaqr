import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import menu from './routes/menu.js';
import order from './routes/order.js';
import kitchen from './routes/kitchen.js';
import admin from './routes/admin.js';

const app = new Hono();

// Global Middleware
app.use('*', logger());
app.use(
  '*',
  cors({
    origin: '*',
    allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    exposeHeaders: ['Content-Length', 'X-Kuma-Revision'],
    maxAge: 600,
  })
);

// Global Error Handler
app.onError((err, c) => {
  console.error('Unhandled Worker Error:', err);
  return c.json(
    {
      error: err.message || 'Internal Server Error',
      timestamp: new Date().toISOString(),
    },
    500
  );
});

// Root & Diagnostics
app.get('/', (c) =>
  c.json({
    name: 'cafaqr API',
    engine: 'Cloudflare Workers (Edge V8)',
    status: 'online',
    docs: '/health',
  })
);

app.get('/health', (c) =>
  c.json({
    status: 'ok',
    engine: 'cloudflare_workers',
    timestamp: new Date().toISOString(),
  })
);

app.get('/health/db', async (c) => {
  try {
    const row = await c.env.DB.prepare('SELECT id, name FROM restaurants LIMIT 1').first();
    if (!row) {
      return c.json({ status: 'warning', database: 'connected_but_empty' }, 200);
    }
    return c.json({
      status: 'ok',
      database: 'cloudflare_d1_connected',
      restaurant: row,
    });
  } catch (err) {
    console.error('D1 Health Error:', err);
    return c.json(
      {
        status: 'error',
        database: 'disconnected',
        error: err.message,
      },
      500
    );
  }
});

// Sub-routers
app.route('/api/menu', menu);
app.route('/api/order', order);
app.route('/api/kitchen', kitchen);
app.route('/api/admin', admin);

export default app;
