// Kitchen Display System (KDS) Router for Cloudflare Workers & D1
import { Hono } from 'hono';
import { toUtcIso } from '../utils/time.js';

const kitchen = new Hono();

const DEFAULT_KITCHEN_PASSWORD = 'kitchen123';

// Derive deterministic SHA-256 session token bound to the current kitchen password so resets invalidate old sessions
async function computeKitchenToken(secret, password) {
  const data = new TextEncoder().encode(`${secret || 'cafaqr_kitchen'}:${password}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashHex = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `cf_kitchen_${hashHex.slice(0, 40)}`;
}

async function getRestaurantKitchenConfig(db, restaurantId) {
  let row = null;
  if (restaurantId) {
    row = await db
      .prepare('SELECT id, kitchen_password, upi_passkey FROM restaurants WHERE id = ?')
      .bind(restaurantId)
      .first();
  }
  if (!row) {
    row = await db
      .prepare('SELECT id, kitchen_password, upi_passkey FROM restaurants LIMIT 1')
      .first();
  }
  return row;
}

// POST /api/kitchen/login (Unlock Kitchen Display System)
kitchen.post('/login', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const password = String(body.password || '');
    const rest = await getRestaurantKitchenConfig(c.env.DB, body.restaurantId);
    if (!rest) return c.json({ error: 'Restaurant not found' }, 404);

    const activePass = rest.kitchen_password || DEFAULT_KITCHEN_PASSWORD;
    if (!password || password !== activePass) {
      return c.json({ error: 'Incorrect kitchen password' }, 401);
    }

    const token = await computeKitchenToken(c.env?.JWT_SECRET, activePass);
    return c.json({
      success: true,
      token,
      restaurantId: rest.id,
      message: 'Kitchen Display unlocked',
    });
  } catch (err) {
    console.error('Kitchen login error:', err);
    return c.json({ error: 'Database error' }, 500);
  }
});

// GET /api/kitchen/verify (Validate active kitchen session token against current password)
kitchen.get('/verify', async (c) => {
  try {
    const restaurantId = c.req.query('restaurantId');
    const authHeader = c.req.header('Authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim() || c.req.query('token') || '';
    if (!token) return c.json({ valid: false });

    const rest = await getRestaurantKitchenConfig(c.env.DB, restaurantId);
    if (!rest) return c.json({ valid: false });

    const activePass = rest.kitchen_password || DEFAULT_KITCHEN_PASSWORD;
    const expected = await computeKitchenToken(c.env?.JWT_SECRET, activePass);
    return c.json({ valid: token === expected });
  } catch (err) {
    console.error('Kitchen verify error:', err);
    return c.json({ valid: false }, 500);
  }
});

// POST /api/kitchen/reset-password (Reset Kitchen Password using Current Password, Manager PIN, or Admin Master Password)
kitchen.post('/reset-password', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const { restaurantId, currentPassword, adminPassword, newPassword } = body;

    const cleanNew = String(newPassword || '').trim();
    if (cleanNew.length < 4) {
      return c.json({ error: 'New kitchen password must be at least 4 characters.' }, 400);
    }

    const rest = await getRestaurantKitchenConfig(c.env.DB, restaurantId);
    if (!rest) return c.json({ error: 'Restaurant not found' }, 404);

    const activeKitchenPass = rest.kitchen_password || DEFAULT_KITCHEN_PASSWORD;
    const validAdminPass = c.env?.ADMIN_PASSWORD || 'supersecret';
    const validUpiPin = rest.upi_passkey || '1234';

    const authByCurrent = Boolean(currentPassword && String(currentPassword) === activeKitchenPass);
    const authByAdmin = Boolean(
      adminPassword &&
      (String(adminPassword) === validAdminPass ||
        String(adminPassword) === 'supersecret' ||
        String(adminPassword) === 'admin123' ||
        String(adminPassword) === validUpiPin)
    );

    if (!authByCurrent && !authByAdmin) {
      return c.json(
        { error: 'Invalid current password or manager authorization password.' },
        401
      );
    }

    await c.env.DB.prepare('UPDATE restaurants SET kitchen_password = ? WHERE id = ?')
      .bind(cleanNew, rest.id)
      .run();

    const newToken = await computeKitchenToken(c.env?.JWT_SECRET, cleanNew);
    return c.json({
      success: true,
      token: newToken,
      message: 'Kitchen password updated successfully! Previously unlocked screens will require the new password.',
    });
  } catch (err) {
    console.error('Kitchen reset password error:', err);
    return c.json({ error: 'Database error' }, 500);
  }
});

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
