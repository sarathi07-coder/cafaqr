// Menu & Catalog Router for Cloudflare Workers & D1
import { Hono } from 'hono';

const menu = new Hono();

// GET /api/menu/:restaurantId/categories
menu.get('/:restaurantId/categories', async (c) => {
  const restaurantId = c.req.param('restaurantId');
  if (!restaurantId) return c.json({ error: 'restaurantId is required' }, 400);

  try {
    const res = await c.env.DB.prepare(
      `SELECT DISTINCT COALESCE(category, 'General') AS category 
       FROM menu_items 
       WHERE restaurant_id = ? 
       ORDER BY 
         CASE 
           WHEN category = 'Briyani' THEN 1
           WHEN category = 'Fried Rice' THEN 2
           WHEN category = 'Noodles' THEN 3
           WHEN category = 'Parotta' THEN 4
           ELSE 10
         END ASC, category ASC`
    )
      .bind(restaurantId)
      .all();

    const categories = (res.results || []).map((r) => r.category);
    c.header('Cache-Control', 'public, max-age=30, s-maxage=60, stale-while-revalidate=180');
    return c.json(categories);
  } catch (err) {
    console.error('Fetch categories error:', err);
    return c.json({ error: 'Database error' }, 500);
  }
});

// GET /api/menu/:restaurantId
menu.get('/:restaurantId', async (c) => {
  const restaurantId = c.req.param('restaurantId');
  if (!restaurantId) return c.json({ error: 'restaurantId is required' }, 400);

  const category = c.req.query('category');
  const availableOnly = c.req.query('availableOnly') === 'true';
  const groupByCategory = c.req.query('groupByCategory') === 'true';

  try {
    let query = `
      SELECT id, name, description, price, original_price, offer_badge, photo_url, is_veg, COALESCE(category, 'General') AS category, available, created_at
      FROM menu_items
      WHERE restaurant_id = ?
    `;
    const params = [restaurantId];

    if (category) {
      query += ` AND category = ?`;
      params.push(category);
    }

    if (availableOnly) {
      query += ` AND available = 1`;
    }

    query += ` ORDER BY 
      CASE 
        WHEN category = 'Briyani' THEN 1
        WHEN category = 'Fried Rice' THEN 2
        WHEN category = 'Noodles' THEN 3
        WHEN category = 'Parotta' THEN 4
        ELSE 10
      END ASC, category ASC, name ASC`;

    const res = await c.env.DB.prepare(query).bind(...params).all();
    const items = (res.results || []).map((item) => ({
      ...item,
      price: Number(item.price),
      original_price: item.original_price != null ? Number(item.original_price) : null,
      offer_badge: item.offer_badge || null,
      is_veg: Boolean(item.is_veg),
      available: Boolean(item.available),
    }));

    c.header('Cache-Control', 'public, max-age=15, s-maxage=60, stale-while-revalidate=120');

    if (groupByCategory) {
      const grouped = {};
      const categories = [];

      items.forEach((item) => {
        const cat = item.category || 'General';
        if (!grouped[cat]) {
          grouped[cat] = [];
          categories.push(cat);
        }
        grouped[cat].push(item);
      });

      return c.json({
        categories,
        itemsByCategory: grouped,
        totalItems: items.length,
      });
    }

    return c.json(items);
  } catch (err) {
    console.error('Menu fetch error:', err);
    return c.json({ error: 'Database error' }, 500);
  }
});

export default menu;

