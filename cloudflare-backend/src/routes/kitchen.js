// Kitchen Display System (KDS) Router for Cloudflare Workers & D1
import { Hono } from 'hono';
import { toUtcIso } from '../utils/time.js';

const kitchen = new Hono();

// Handler for fetching active kitchen tickets
const fetchActiveTicketsHandler = async (c) => {
  const restaurantId = c.req.param('restaurantId') || c.req.query('restaurantId') || 'db4ed920-3d20-420a-9f54-99d3c0b48a08';

  try {
    const ordersRes = await c.env.DB.prepare(
      `SELECT o.id, o.restaurant_id, o.table_id, o.status, o.notes, o.created_at, o.updated_at,
              o.session_token, o.session_label, t.number as table_number,
              COALESCE(c.name, cs_c.name) as customer_name,
              COALESCE(c.phone, cs_c.phone) as customer_phone
       FROM orders o
       JOIN tables t ON o.table_id = t.id
       LEFT JOIN customers c ON o.customer_id = c.id
       LEFT JOIN customer_sessions cs ON o.session_token = cs.session_token
       LEFT JOIN customers cs_c ON cs.customer_id = cs_c.id
       WHERE o.restaurant_id = ?
         AND o.status NOT IN ('PAID', 'CANCELLED')
         AND (
           o.status IN ('PENDING', 'PREPARING', 'READY')
           OR EXISTS (
             SELECT 1 FROM order_items oi
             WHERE oi.order_id = o.id AND oi.status IN ('PENDING', 'PREPARING')
           )
         )
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

      // Only show tickets that have cooking items
      if (items.length === 0) continue;

      // Normalize SQLite UTC timestamps to ISO-8601 Z so browsers in any timezone calculate elapsed time accurately
      const createdIso = toUtcIso(ord.created_at) || new Date().toISOString();
      const updatedIso = toUtcIso(ord.updated_at) || createdIso;
      const createdAt = new Date(createdIso);
      const elapsedMinutes = Math.max(0, Math.floor((Date.now() - createdAt.getTime()) / 60000));

      tickets.push({
        ...ord,
        id: ord.id,
        order_id: ord.id,
        table_number: ord.table_number,
        session_label: ord.session_label || 'Customer',
        customer_name: ord.customer_name || null,
        customer_phone: ord.customer_phone || null,
        created_at: createdIso,
        updated_at: updatedIso,
        elapsed_minutes: elapsedMinutes,
        items,
      });
    }

    return c.json(tickets);
  } catch (err) {
    console.error('Fetch kitchen tickets error:', err);
    return c.json({ error: 'Database error' }, 500);
  }
};

// Support both query param (/tickets?restaurantId=...) and path param (/tickets/:restaurantId)
kitchen.get('/tickets', fetchActiveTicketsHandler);
kitchen.get('/tickets/:restaurantId', fetchActiveTicketsHandler);

// Handler for advancing kitchen tickets (PENDING -> PREPARING -> READY -> SERVED)
const advanceTicketHandler = async (c) => {
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
      order: {
        id: orderId,
        orderId,
        status: targetStatus,
      },
      message: `Ticket advanced to ${targetStatus}`,
    });
  } catch (err) {
    console.error('Advance ticket error:', err);
    return c.json({ error: 'Database error' }, 500);
  }
};

// PUT & POST /api/kitchen/tickets/:id/advance
kitchen.put('/tickets/:id/advance', advanceTicketHandler);
kitchen.post('/tickets/:id/advance', advanceTicketHandler);

export default kitchen;
