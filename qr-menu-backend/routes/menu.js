// routes/menu.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const Joi = require('joi');

// In-memory cache for ultra-fast menu delivery (<1ms) under peak diner loads
const menuCache = new Map();
const CACHE_TTL_MS = 60 * 1000; // 60 seconds

function getCached(key) {
  const entry = menuCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    menuCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCached(key, data) {
  if (menuCache.size > 200) menuCache.clear();
  menuCache.set(key, { data, timestamp: Date.now() });
}

function invalidateMenuCache(restaurantId) {
  if (!restaurantId) {
    menuCache.clear();
    return;
  }
  for (const key of menuCache.keys()) {
    if (key.startsWith(restaurantId)) {
      menuCache.delete(key);
    }
  }
}

// GET /api/menu/:restaurantId/categories
// Returns list of unique categories available in the restaurant
router.get('/:restaurantId/categories', async (req, res) => {
  const { restaurantId } = req.params;
  const schema = Joi.string().uuid().required();
  const { error } = schema.validate(restaurantId);
  if (error) return res.status(400).json({ error: 'Invalid restaurantId' });

  const cacheKey = `${restaurantId}_categories`;
  const cached = getCached(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  try {
    const result = await db.query(
      `SELECT DISTINCT COALESCE(category, 'General') AS category 
       FROM menu_items 
       WHERE restaurant_id = $1 
       ORDER BY category ASC`,
      [restaurantId]
    );
    const categories = result.rows.map(r => r.category);
    setCached(cacheKey, categories);
    res.json(categories);
  } catch (err) {
    console.error('Fetch categories error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// GET /api/menu/:restaurantId
// Supports query params: ?category=xxx & ?availableOnly=true & ?groupByCategory=true
router.get('/:restaurantId', async (req, res) => {
  const { restaurantId } = req.params;
  const { category, availableOnly, groupByCategory } = req.query;

  const schema = Joi.string().uuid().required();
  const { error } = schema.validate(restaurantId);
  if (error) return res.status(400).json({ error: 'Invalid restaurantId' });

  const cacheKey = `${restaurantId}_${category || ''}_${availableOnly || ''}_${groupByCategory || ''}`;
  const cached = getCached(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  try {
    let query = `
      SELECT id, name, description, price, original_price, offer_badge, photo_url, is_veg, COALESCE(category, 'General') AS category, available, created_at 
      FROM menu_items 
      WHERE restaurant_id = $1
    `;
    const params = [restaurantId];

    if (category) {
      params.push(category);
      query += ` AND category = $${params.length}`;
    }

    if (availableOnly === 'true') {
      query += ` AND available = true`;
    }

    query += ` ORDER BY category ASC, name ASC`;

    const result = await db.query(query, params);
    const items = result.rows.map(item => ({
      ...item,
      price: parseFloat(item.price),
      original_price: item.original_price ? parseFloat(item.original_price) : null,
      offer_badge: item.offer_badge || null,
      is_veg: item.is_veg !== false
    }));

    if (groupByCategory === 'true') {
      const grouped = {};
      const categories = [];

      items.forEach(item => {
        const cat = item.category || 'General';
        if (!grouped[cat]) {
          grouped[cat] = [];
          categories.push(cat);
        }
        grouped[cat].push(item);
      });

      const responsePayload = {
        categories,
        itemsByCategory: grouped,
        totalItems: items.length
      };
      setCached(cacheKey, responsePayload);
      res.setHeader('Cache-Control', 'public, max-age=15, s-maxage=60, stale-while-revalidate=120');
      return res.json(responsePayload);
    }

    setCached(cacheKey, items);
    res.setHeader('Cache-Control', 'public, max-age=15, s-maxage=60, stale-while-revalidate=120');
    res.json(items);
  } catch (err) {
    console.error('Menu fetch error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

router.invalidateMenuCache = invalidateMenuCache;
module.exports = router;
