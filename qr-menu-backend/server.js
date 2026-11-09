const express = require('express');
const http = require('http');
const cors = require('cors');
const dotenv = require('dotenv');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { initSocket } = require('./socket');
const db = require('./db');

// Load environment variables
dotenv.config();

const app = express();

// Security HTTP headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false  // Disable CSP so the React SPA assets load properly
}));

// Gzip/Brotli compression — reduces transfer size by ~70%
app.use(compression());

app.use(cors());
app.use(express.json());

// Serve uploaded food photos statically
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// Rate Limiting: High capacity for restaurant Wi-Fi where dozens of diners share one public IP
if (process.env.NODE_ENV !== 'test') {
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10000, // Generous capacity for high-volume diner traffic on shared restaurant Wi-Fi
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please slow down.' },
    // Completely exempt public read-only menu queries from rate limiting
    skip: (req) => {
      return req.method === 'GET' && (
        req.path.startsWith('/menu') ||
        req.path.startsWith('/order/tables') ||
        req.path.startsWith('/order/session')
      );
    }
  });
  app.use('/api/', apiLimiter);

  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { error: 'Too many login attempts, please try again after 15 minutes.' }
  });
  app.use('/api/admin/login', loginLimiter);
}

// Import routes
const menuRoutes = require('./routes/menu');
const orderRoutes = require('./routes/order');
const adminRoutes = require('./routes/admin');
const qrRoutes = require('./routes/qr');
const kitchenRoutes = require('./routes/kitchen');
const { swaggerUi, swaggerDocument } = require('./docs/swagger');

app.use('/api/menu', menuRoutes);
app.use('/api/order', orderRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/qr', qrRoutes);
app.use('/api/kitchen', kitchenRoutes);

// Interactive OpenAPI / Swagger Documentation
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Health check endpoint
app.get(['/health', '/api/health'], (req, res) => {
  res.json({
    status: 'ok',
    security: 'helmet_enabled',
    timestamp: new Date().toISOString()
  });
});

// Diagnostic DB check
app.get('/health/db', async (req, res) => {
  try {
    const result = await db.query('SELECT current_database(), current_user, version()');
    res.json({ status: 'ok', db: result.rows[0], env: { host: process.env.DB_HOST, port: process.env.DB_PORT, user: process.env.DB_USER, db: process.env.DB_NAME } });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message, code: err.code, stack: err.stack, env: { host: process.env.DB_HOST, port: process.env.DB_PORT, user: process.env.DB_USER, hasPass: !!process.env.DB_PASSWORD } });
  }
});

// ── Production: Serve the built React frontend ──────────────────────
const frontendDist = path.join(__dirname, '..', 'qr-menu-frontend', 'dist');

// Hashed assets (JS/CSS) can be cached forever; HTML must not be cached
app.use('/assets', express.static(path.join(frontendDist, 'assets'), {
  maxAge: '1y',           // Browser caches hashed files for 1 year
  immutable: true,        // Never revalidate — hash in filename guarantees freshness
}));
app.use(express.static(frontendDist, {
  maxAge: '0',            // index.html is always revalidated
  etag: true,
}));

// SPA catch-all: any non-API route serves index.html so React Router works
app.get('*', (req, res, next) => {
  // Skip API routes and uploaded files
  if (req.path.startsWith('/api') || req.path.startsWith('/uploads') || req.path.startsWith('/socket.io')) {
    return next();
  }
  res.sendFile(path.join(frontendDist, 'index.html'));
});

// Create HTTP server & bind Socket.IO
const server = http.createServer(app);
const io = initSocket(server);

const PORT = process.env.PORT || 3000;

if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => {
    console.log(`🚀 Restaurant QR Backend listening on port ${PORT}`);
  });
}

// Graceful shutdown
const shutdown = (signal) => {
  console.log(`${signal} signal received: closing HTTP server and database pool...`);
  server.close(() => {
    db.pool.end(() => {
      console.log('Database connections terminated. Process terminated cleanly.');
      process.exit(0);
    });
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = app;
module.exports.app = app;
module.exports.server = server;
module.exports.io = io;
