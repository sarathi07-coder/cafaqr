// Kitchen Display System (KDS) Router for Cloudflare Workers & D1
import { Hono } from 'hono';

const kitchen = new Hono();

// GET /api/kitchen/tickets/:restaurantId
kitchen.get('/tickets/:restaurantId', async (c) => {
  const restaurantId = c.req.param('restaurantId');
  if (!restaurantId) return c.json({ error: 'restaurantId is required' }, 400);

  try {
    const ordersRes = await c.env.DB.prepare(
      `SELECT o.id, o.restaurant_id, o.table_id, o.status, o.notes, o.created_at, o.updated_at,
              o.session_token, o.session_label, t.number as table_number
       FROM orders o
       JOIN tables t ON o.table_id = t.id
       WHERE o.restaurant_id = ? AND o.status IN ('PENDING', 'PREPARING', 'READY')
       ORDER BY o.created_at ASC`
    )
      .bind(restaurantId)
      .all();

    const orders = ordersRes.results || [];
    const tickets = [];

    for (const ord of orders) {
      const itemsRes = await c.env.DB.prepare(
        `SELECT oi.id, oi.menu_item_id, oi.quantity, oi.price_at_order, oi.status, oi.special_instructions,
                mi.name, mi.is_veg, mi.category
         FROM order_items oi
         JOIN menu_items mi ON oi.menu_item_id = mi.id
         WHERE oi.order_id = ? AND oi.status != 'CANCELLED'
         ORDER BY oi.created_at ASC`
      )
        .bind(ord.id)
        .all();

      const items = itemsRes.results || [];

      // Calculate elapsed minutes
      const createdAt = new Date(ord.created_at || Date.now());
      const elapsedMinutes = Math.floor((Date.now() - createdAt.getTime()) / 60000);

      tickets.push({
        ...ord,
        table_number: ord.table_number,
        session_label: ord.session_label || 'Customer',
        elapsed_minutes: Math.max(0, elapsedMinutes),
        items,
      });
    }

    return c.json(tickets);
  } catch (err) {
    console.error('Fetch kitchen tickets error:', err);
    return c.json({ error: 'Database error' }, 500);
  }
});

// PUT /api/kitchen/tickets/:id/advance
kitchen.put('/tickets/:id/advance', async (c) => {
  const orderId = c.req.param('id');
  try {
    const body = await c.req.json().catch(() => ({}));
    let targetStatus = body.status;

    const ord = await c.env.DB.prepare('SELECT id, status FROM orders WHERE id = ?').bind(orderId).first();
    if (!ord) return c.json({ error: 'Ticket not found' }, 404);

    if (!targetStatus) {
      if (ord.status === 'PENDING') targetStatus = 'PREPARING';
      else if (ord.status === 'PREPARING') targetStatus = 'READY';
      else if (ord.status === 'READY') targetStatus = 'SERVED';
      else targetStatus = 'SERVED';
    }

    const validStatuses = ['PENDING', 'PREPARING', 'READY', 'SERVED'];
    if (!validStatuses.includes(targetStatus)) {
      return c.json({ error: 'Invalid status' }, 400);
    }

    await c.env.DB.prepare(
      `UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?`
    )
      .bind(targetStatus, orderId)
      .run();

    // Advance all active items to match
    await c.env.DB.prepare(
      `UPDATE order_items SET status = ? WHERE order_id = ? AND status != 'CANCELLED'`
    )
      .bind(targetStatus, orderId)
      .run();

    return c.json({
      success: true,
      orderId,
      status: targetStatus,
      message: `Ticket advanced to ${targetStatus}`,
    });
  } catch (err) {
    console.error('Advance ticket error:', err);
    return c.json({ error: 'Database error' }, 500);
  }
});

export default kitchen;

