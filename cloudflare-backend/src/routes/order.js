// Order & Session Router for Cloudflare Workers & D1
import { Hono } from 'hono';

const order = new Hono();

// Helper to generate UUID
function generateUUID() {
  return crypto.randomUUID();
}

// GET /api/order/tables/default
order.get('/tables/default', async (c) => {
  try {
    const table = await c.env.DB.prepare(
      `SELECT t.id, t.number, t.restaurant_id, r.name as restaurant_name, r.currency, r.upi_id, r.upi_name
       FROM tables t
       JOIN restaurants r ON t.restaurant_id = r.id
       ORDER BY t.number ASC LIMIT 1`
    ).first();

    if (!table) {
      return c.json({ error: 'No tables found' }, 404);
    }

    return c.json({
      table: {
        id: table.id,
        number: table.number,
        restaurant_id: table.restaurant_id,
        restaurant_name: table.restaurant_name,
        currency: table.currency || '₹',
        upi_id: table.upi_id,
        upi_name: table.upi_name,
      },
    });
  } catch (err) {
    console.error('Get default table error:', err);
    return c.json({ error: 'Database error' }, 500);
  }
});

// POST /api/order/session/init
order.post('/session/init', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const { tableId, sessionToken } = body;

    if (!tableId) {
      return c.json({ error: 'tableId is required' }, 400);
    }

    const table = await c.env.DB.prepare(
      `SELECT t.id, t.number, t.restaurant_id, r.name as restaurant_name, r.currency, r.upi_id, r.upi_name
       FROM tables t
       JOIN restaurants r ON t.restaurant_id = r.id
       WHERE t.id = ?`
    )
      .bind(tableId)
      .first();

    if (!table) {
      return c.json({ error: 'Table not found' }, 404);
    }

    let existingSession = null;
    if (sessionToken) {
      existingSession = await c.env.DB.prepare(
        `SELECT id, session_token, session_label, is_active
         FROM customer_sessions
         WHERE session_token = ? AND table_id = ? AND is_active = 1`
      )
        .bind(sessionToken, tableId)
        .first();
    }

    if (existingSession) {
      // Find any active order for this session
      const activeOrder = await c.env.DB.prepare(
        `SELECT id, status, subtotal, tax_percentage, tax_amount, total, created_at, notes
         FROM orders
         WHERE (session_token = ? OR session_id = ?) AND status NOT IN ('PAID', 'CANCELLED')
         ORDER BY created_at DESC LIMIT 1`
      )
        .bind(existingSession.session_token, existingSession.id)
        .first();

      let items = [];
      if (activeOrder) {
        const itemsRes = await c.env.DB.prepare(
          `SELECT oi.*, mi.name, mi.photo_url, mi.is_veg, mi.category
           FROM order_items oi
           JOIN menu_items mi ON oi.menu_item_id = mi.id
           WHERE oi.order_id = ?
           ORDER BY oi.created_at ASC`
        )
          .bind(activeOrder.id)
          .all();
        items = itemsRes.results || [];
      }

      return c.json({
        sessionToken: existingSession.session_token,
        sessionLabel: existingSession.session_label,
        sessionId: existingSession.id,
        isNew: false,
        hasActiveOrder: Boolean(activeOrder),
        order: activeOrder ? { ...activeOrder, items } : null,
        table,
      });
    }

    // Create a new session
    const activeCountRow = await c.env.DB.prepare(
      `SELECT COUNT(*) as count FROM customer_sessions WHERE table_id = ? AND is_active = 1`
    )
      .bind(tableId)
      .first();

    const activeCount = Number(activeCountRow?.count || 0);
    const sessionLabel = `Customer ${activeCount + 1}`;
    const newSessionToken = `cs_${generateUUID()}`;
    const newSessionId = generateUUID();

    await c.env.DB.prepare(
      `INSERT INTO customer_sessions (id, session_token, table_id, restaurant_id, session_label, is_active)
       VALUES (?, ?, ?, ?, ?, 1)`
    )
      .bind(newSessionId, newSessionToken, tableId, table.restaurant_id, sessionLabel)
      .run();

    return c.json(
      {
        sessionToken: newSessionToken,
        sessionLabel,
        sessionId: newSessionId,
        isNew: true,
        hasActiveOrder: false,
        order: null,
        table,
      },
      201
    );
  } catch (err) {
    console.error('Session init error:', err);
    return c.json({ error: 'Failed to initialize session' }, 500);
  }
});

// GET /api/order/session/:token
order.get('/session/:token', async (c) => {
  const token = c.req.param('token');
  try {
    const session = await c.env.DB.prepare(
      `SELECT cs.*, t.number as table_number, r.name as restaurant_name
       FROM customer_sessions cs
       JOIN tables t ON cs.table_id = t.id
       JOIN restaurants r ON cs.restaurant_id = r.id
       WHERE cs.session_token = ? AND cs.is_active = 1`
    )
      .bind(token)
      .first();

    if (!session) {
      return c.json({ error: 'Session not found' }, 404);
    }

    const activeOrder = await c.env.DB.prepare(
      `SELECT id, status, subtotal, tax_amount, total
       FROM orders
       WHERE session_token = ? AND status NOT IN ('PAID', 'CANCELLED')
       ORDER BY created_at DESC LIMIT 1`
    )
      .bind(token)
      .first();

    return c.json({
      session,
      hasActiveOrder: Boolean(activeOrder),
      order: activeOrder || null,
    });
  } catch (err) {
    console.error('Fetch session error:', err);
    return c.json({ error: 'Database error' }, 500);
  }
});

// GET /api/order/table/:tableId/session
order.get('/table/:tableId/session', async (c) => {
  const tableId = c.req.param('tableId');
  const sessionToken = c.req.query('sessionToken');

  try {
    const table = await c.env.DB.prepare(
      `SELECT t.id, t.number, t.restaurant_id, r.name as restaurant_name
       FROM tables t
       JOIN restaurants r ON t.restaurant_id = r.id
       WHERE t.id = ?`
    )
      .bind(tableId)
      .first();

    if (!table) return c.json({ error: 'Table not found' }, 404);

    let activeOrder = null;
    if (sessionToken) {
      activeOrder = await c.env.DB.prepare(
        `SELECT o.*, c.name as customer_name, c.phone as customer_phone
         FROM orders o
         LEFT JOIN customers c ON o.customer_id = c.id
         WHERE o.table_id = ? AND o.session_token = ? AND o.status NOT IN ('PAID', 'CANCELLED')
         ORDER BY o.created_at DESC LIMIT 1`
      )
        .bind(tableId, sessionToken)
        .first();
    } else {
      activeOrder = await c.env.DB.prepare(
        `SELECT o.*, c.name as customer_name, c.phone as customer_phone
         FROM orders o
         LEFT JOIN customers c ON o.customer_id = c.id
         WHERE o.table_id = ? AND o.status NOT IN ('PAID', 'CANCELLED')
         ORDER BY o.created_at DESC LIMIT 1`
      )
        .bind(tableId)
        .first();
    }

    let items = [];
    if (activeOrder) {
      const itemsRes = await c.env.DB.prepare(
        `SELECT oi.*, mi.name, mi.photo_url, mi.is_veg, mi.category
         FROM order_items oi
         JOIN menu_items mi ON oi.menu_item_id = mi.id
         WHERE oi.order_id = ?
         ORDER BY oi.created_at ASC`
      )
        .bind(activeOrder.id)
        .all();
      items = itemsRes.results || [];
    }

    return c.json({
      table,
      hasActiveOrder: Boolean(activeOrder),
      order: activeOrder ? { ...activeOrder, items } : null,
    });
  } catch (err) {
    console.error('Table session lookup error:', err);
    return c.json({ error: 'Database error' }, 500);
  }
});

// Helper: Recalculate order totals (subtotal, tax, coupon discount, grand total)
async function recalculateOrderTotals(db, orderId, restaurantId) {
  const [rest, ord, sumRes] = await Promise.all([
    db.prepare('SELECT tax_percentage FROM restaurants WHERE id = ?').bind(restaurantId).first(),
    db.prepare('SELECT coupon_code FROM orders WHERE id = ?').bind(orderId).first(),
    db.prepare(
      `SELECT COALESCE(SUM(price_at_order * quantity), 0) AS subtotal
       FROM order_items
       WHERE order_id = ? AND status != 'CANCELLED'`
    ).bind(orderId).first()
  ]);

  const taxPercentage = rest?.tax_percentage != null ? Number(rest.tax_percentage) : 5.0;
  const rawSubtotal = Number(sumRes?.subtotal || 0);

  let discountAmount = 0;
  let activeCoupon = null;

  if (ord?.coupon_code) {
    activeCoupon = await db.prepare(
      `SELECT code, discount_type, discount_value, min_order_amount, max_discount_amount, is_active
       FROM coupons
       WHERE restaurant_id = ? AND code = ? AND is_active = 1`
    ).bind(restaurantId, ord.coupon_code).first();

    if (activeCoupon && rawSubtotal >= Number(activeCoupon.min_order_amount || 0)) {
      if (activeCoupon.discount_type === 'PERCENTAGE') {
        discountAmount = (rawSubtotal * Number(activeCoupon.discount_value)) / 100;
        if (activeCoupon.max_discount_amount != null) {
          discountAmount = Math.min(discountAmount, Number(activeCoupon.max_discount_amount));
        }
      } else if (activeCoupon.discount_type === 'FLAT') {
        discountAmount = Math.min(Number(activeCoupon.discount_value), rawSubtotal);
      }
    }
  }

  const taxableSubtotal = Math.max(0, rawSubtotal - discountAmount);
  const taxAmount = (taxableSubtotal * taxPercentage) / 100;
  const finalTotal = Math.round((taxableSubtotal + taxAmount) * 100) / 100;

  await db.prepare(
    `UPDATE orders
     SET subtotal = ?, discount_amount = ?, tax_percentage = ?, tax_amount = ?, total = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).bind(rawSubtotal, discountAmount, taxPercentage, taxAmount, finalTotal, orderId).run();

  return {
    subtotal: rawSubtotal,
    discountAmount,
    taxPercentage,
    taxAmount,
    total: finalTotal
  };
}

// POST /api/order (Create Initial Table Order)
order.post('/', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const { restaurantId, tableId, sessionToken, customer, customerName, customerPhone, notes, items } = body;

    if (!restaurantId || !tableId) {
      return c.json({ error: 'restaurantId and tableId are required' }, 400);
    }

    const table = await c.env.DB.prepare(
      'SELECT t.id, t.number, t.restaurant_id, r.name as restaurant_name, r.tax_percentage, r.currency FROM tables t JOIN restaurants r ON t.restaurant_id = r.id WHERE t.id = ?'
    ).bind(tableId).first();

    if (!table) return c.json({ error: 'Table not found' }, 404);

    // Upsert customer
    const cName = customer?.name || customerName || 'Diner';
    const cPhone = customer?.phone || customerPhone || '9876543210';
    let customerId = generateUUID();

    const existingCust = await c.env.DB.prepare('SELECT id FROM customers WHERE phone = ?').bind(cPhone).first();
    if (existingCust) {
      customerId = existingCust.id;
      await c.env.DB.prepare('UPDATE customers SET name = ? WHERE id = ?').bind(cName, customerId).run();
    } else {
      await c.env.DB.prepare('INSERT INTO customers (id, name, phone, consent_given) VALUES (?, ?, ?, 1)').bind(customerId, cName, cPhone).run();
    }

    // Session resolution
    let sToken = sessionToken;
    let sId = generateUUID();
    let sLabel = 'Customer 1';

    if (sToken) {
      const sess = await c.env.DB.prepare('SELECT id, session_label FROM customer_sessions WHERE session_token = ? AND table_id = ? AND is_active = 1').bind(sToken, tableId).first();
      if (sess) {
        sId = sess.id;
        sLabel = sess.session_label;
      }
    } else {
      sToken = `cs_${generateUUID()}`;
      const countRow = await c.env.DB.prepare('SELECT COUNT(*) as count FROM customer_sessions WHERE table_id = ? AND is_active = 1').bind(tableId).first();
      sLabel = `Customer ${Number(countRow?.count || 0) + 1}`;
      await c.env.DB.prepare('INSERT INTO customer_sessions (id, session_token, table_id, restaurant_id, customer_id, session_label, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)').bind(sId, sToken, tableId, restaurantId, customerId, sLabel).run();
    }

    // Check if active order already exists for this session
    let existingOrder = await c.env.DB.prepare("SELECT id, status FROM orders WHERE session_token = ? AND status NOT IN ('PAID', 'CANCELLED') LIMIT 1").bind(sToken).first();
    let orderId = existingOrder ? existingOrder.id : generateUUID();
    let isExistingSession = Boolean(existingOrder);

    if (!existingOrder) {
      await c.env.DB.prepare(
        `INSERT INTO orders (id, restaurant_id, table_id, customer_id, session_id, session_token, session_label, status, notes, subtotal, tax_percentage, tax_amount, total)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, 0, ?, 0, 0)`
      ).bind(orderId, restaurantId, tableId, customerId, sId, sToken, sLabel, notes || null, Number(table.tax_percentage || 5.0)).run();
    } else if (notes) {
      await c.env.DB.prepare("UPDATE orders SET notes = COALESCE(notes || '; ', '') || ? WHERE id = ?").bind(notes, orderId).run();
    }

    // Insert items
    if (Array.isArray(items) && items.length > 0) {
      for (const it of items) {
        const mItem = await c.env.DB.prepare('SELECT id, price FROM menu_items WHERE id = ?').bind(it.menuItemId || it.id).first();
        if (mItem) {
          const price = Number(mItem.price);
          const qty = Number(it.quantity || 1);
          await c.env.DB.prepare(
            `INSERT INTO order_items (id, order_id, menu_item_id, quantity, price_at_order, status, special_instructions)
             VALUES (?, ?, ?, ?, ?, 'PENDING', ?)`
          ).bind(generateUUID(), orderId, mItem.id, qty, price, it.specialInstructions || null).run();
        }
      }
    }

    const totals = await recalculateOrderTotals(c.env.DB, orderId, restaurantId);

    const orderPayload = {
      id: orderId,
      orderId,
      sessionToken: sToken,
      sessionLabel: sLabel,
      tableNumber: table.number,
      status: 'PENDING',
      subtotal: totals.subtotal,
      taxPercentage: totals.taxPercentage,
      taxAmount: totals.taxAmount,
      total: totals.total,
      currency: table.currency || '₹',
      isExistingSession,
    };

    return c.json(
      {
        ...orderPayload,
        order: orderPayload,
      },
      201
    );
  } catch (err) {
    console.error('Order placement error:', err);
    return c.json({ error: 'Failed to place order: ' + err.message }, 500);
  }
});

// POST /api/order/:id/items (Add Extra Dishes to Running Bill)
order.post('/:id/items', async (c) => {
  const orderId = c.req.param('id');
  try {
    const body = await c.req.json().catch(() => ({}));
    const items = body.items || [];

    const ord = await c.env.DB.prepare('SELECT id, restaurant_id, status FROM orders WHERE id = ?').bind(orderId).first();
    if (!ord) return c.json({ error: 'Order not found' }, 404);
    if (['PAID', 'CANCELLED'].includes(ord.status)) {
      return c.json({ error: 'Cannot add items to a settled or cancelled order' }, 400);
    }

    let addedCount = 0;
    for (const it of items) {
      const mId = it.menu_item_id || it.menuItemId || it.id;
      const mItem = await c.env.DB.prepare('SELECT id, price FROM menu_items WHERE id = ?').bind(mId).first();
      if (mItem) {
        const price = Number(mItem.price);
        const qty = Number(it.quantity || 1);
        await c.env.DB.prepare(
          `INSERT INTO order_items (id, order_id, menu_item_id, quantity, price_at_order, status, special_instructions)
           VALUES (?, ?, ?, ?, ?, 'PENDING', ?)`
        ).bind(generateUUID(), orderId, mItem.id, qty, price, it.special_instructions || null).run();
        addedCount += qty;
      }
    }

    // Set order back to PENDING so chefs are alerted
    await c.env.DB.prepare("UPDATE orders SET status = 'PENDING', updated_at = datetime('now') WHERE id = ?").bind(orderId).run();

    const totals = await recalculateOrderTotals(c.env.DB, orderId, ord.restaurant_id);

    return c.json({
      success: true,
      orderId,
      itemsAdded: addedCount,
      newTotal: totals.total,
      total: totals.total,
      totals,
      order: {
        id: orderId,
        total: totals.total,
        subtotal: totals.subtotal,
      },
    });
  } catch (err) {
    console.error('Add items error:', err);
    return c.json({ error: 'Failed to add items' }, 500);
  }
});

// PUT /api/order/:id/notes (Update Cooking Notes)
order.put('/:id/notes', async (c) => {
  const orderId = c.req.param('id');
  try {
    const { notes } = await c.req.json().catch(() => ({}));
    const ord = await c.env.DB.prepare('SELECT id, status FROM orders WHERE id = ?').bind(orderId).first();
    if (!ord) return c.json({ error: 'Order not found' }, 404);

    if (['SERVED', 'PAID', 'CANCELLED'].includes(ord.status)) {
      return c.json({ error: `Cannot modify notes when order is ${ord.status}` }, 400);
    }

    await c.env.DB.prepare("UPDATE orders SET notes = ?, updated_at = datetime('now') WHERE id = ?")
      .bind(notes || '', orderId)
      .run();

    return c.json({
      success: true,
      message: 'Cooking notes updated successfully',
      notes,
    });
  } catch (err) {
    console.error('Update notes error:', err);
    return c.json({ error: 'Database error' }, 500);
  }
});

// POST /api/order/:id/apply-coupon
order.post('/:id/apply-coupon', async (c) => {
  const orderId = c.req.param('id');
  try {
    const { code } = await c.req.json().catch(() => ({}));
    if (!code) return c.json({ error: 'Coupon code is required' }, 400);

    const ord = await c.env.DB.prepare('SELECT id, restaurant_id, subtotal FROM orders WHERE id = ?').bind(orderId).first();
    if (!ord) return c.json({ error: 'Order not found' }, 404);

    const coupon = await c.env.DB.prepare(
      'SELECT * FROM coupons WHERE restaurant_id = ? AND code = ? AND is_active = 1'
    ).bind(ord.restaurant_id, code.trim().toUpperCase()).first();

    if (!coupon) return c.json({ error: 'Invalid or expired coupon' }, 400);

    await c.env.DB.prepare('UPDATE orders SET coupon_code = ? WHERE id = ?').bind(coupon.code, orderId).run();
    const totals = await recalculateOrderTotals(c.env.DB, orderId, ord.restaurant_id);

    return c.json({
      success: true,
      message: `Coupon ${coupon.code} applied!`,
      discountAmount: totals.discountAmount,
      total: totals.total,
    });
  } catch (err) {
    console.error('Apply coupon error:', err);
    return c.json({ error: 'Failed to apply coupon' }, 500);
  }
});

// GET /api/order/upi-info
order.get('/upi-info', async (c) => {
  const restaurantId = c.req.query('restaurantId');
  const tableNumber = c.req.query('tableNumber');

  try {
    let restaurant = null;
    if (restaurantId) {
      restaurant = await c.env.DB.prepare('SELECT id, name, upi_id, upi_name FROM restaurants WHERE id = ?').bind(restaurantId).first();
    } else {
      restaurant = await c.env.DB.prepare('SELECT id, name, upi_id, upi_name FROM restaurants LIMIT 1').first();
    }

    if (!restaurant) {
      return c.json({
        upiId: 'vallipriya1212-1@oksbi',
        upiName: 'Royal Spice Bistro',
        restaurantName: 'Royal Spice Bistro',
        tableNumber: tableNumber ? Number(tableNumber) : null,
      });
    }

    return c.json({
      upiId: restaurant.upi_id || 'vallipriya1212-1@oksbi',
      upiName: restaurant.upi_name || 'Royal Spice Bistro',
      restaurantName: restaurant.name || 'Royal Spice Bistro',
      tableNumber: tableNumber ? Number(tableNumber) : null,
      restaurantId: restaurant.id,
    });
  } catch (err) {
    console.error('Fetch UPI info error:', err);
    return c.json({ error: 'Database error' }, 500);
  }
});

// POST /api/order/upi/notify (Customer submits UTR transaction proof)
order.post('/upi/notify', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const { orderId, tableId, tableNumber, utr, amount, upiId } = body;

    if (!utr) return c.json({ error: 'UTR transaction number is required' }, 400);

    if (orderId) {
      await c.env.DB.prepare(
        `UPDATE orders
         SET payment_method = 'UPI',
             notes = COALESCE(notes || '; ', '') || ?
         WHERE id = ?`
      ).bind(`Paid via UPI (UTR: ${utr}, VPA: ${upiId || 'N/A'})`, orderId).run();
    }

    return c.json({
      success: true,
      message: 'Payment notification submitted to cashier!',
      utr,
      orderId: orderId || null,
      tableNumber: tableNumber || null,
    });
  } catch (err) {
    console.error('UPI notify error:', err);
    return c.json({ error: 'Failed to record payment' }, 500);
  }
});

// POST /api/order/table/:tableId/call-waiter
order.post('/table/:tableId/call-waiter', async (c) => {
  const tableId = c.req.param('tableId');
  try {
    const body = await c.req.json().catch(() => ({}));
    const { requestType, note, sessionToken, customerName } = body;

    const table = await c.env.DB.prepare('SELECT id, restaurant_id, number FROM tables WHERE id = ?').bind(tableId).first();
    if (!table) return c.json({ error: 'Table not found' }, 404);

    let sLabel = 'Customer';
    let cName = customerName || 'Diner';

    if (sessionToken) {
      const sess = await c.env.DB.prepare('SELECT session_label FROM customer_sessions WHERE session_token = ?').bind(sessionToken).first();
      if (sess?.session_label) sLabel = sess.session_label;
    }

    const reqId = generateUUID();
    await c.env.DB.prepare(
      `INSERT INTO service_requests (id, restaurant_id, table_id, session_token, session_label, customer_name, request_type, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING')`
    ).bind(reqId, table.restaurant_id, tableId, sessionToken || null, sLabel, cName, note ? `${requestType || 'Assistance'}: ${note}` : (requestType || 'Assistance')).run();

    return c.json({
      success: true,
      message: 'Service request dispatched to floor staff!',
      requestId: reqId,
      tableNumber: table.number,
    });
  } catch (err) {
    console.error('Call waiter error:', err);
    return c.json({ error: 'Failed to dispatch service request' }, 500);
  }
});

// GET /api/order/table/:tableId/sync (Ultra-fast sync endpoint for diners)
order.get('/table/:tableId/sync', async (c) => {
  const tableId = c.req.param('tableId');
  const sessionToken = c.req.query('sessionToken');

  try {
    let orderRow = null;
    if (sessionToken) {
      orderRow = await c.env.DB.prepare(
        `SELECT id, status, total, updated_at FROM orders WHERE table_id = ? AND session_token = ? AND status NOT IN ('PAID', 'CANCELLED') LIMIT 1`
      ).bind(tableId, sessionToken).first();
    } else {
      orderRow = await c.env.DB.prepare(
        `SELECT id, status, total, updated_at FROM orders WHERE table_id = ? AND status NOT IN ('PAID', 'CANCELLED') LIMIT 1`
      ).bind(tableId).first();
    }

    return c.json({
      hasActiveOrder: Boolean(orderRow),
      orderId: orderRow?.id || null,
      status: orderRow?.status || 'NONE',
      total: orderRow?.total || 0,
      timestamp: orderRow?.updated_at || new Date().toISOString(),
    });
  } catch (err) {
    return c.json({ error: 'Sync error' }, 500);
  }
});

// POST /api/order/:id/feedback (Submit 5-Star Post-Meal Review)
order.post('/:id/feedback', async (c) => {
  const orderId = c.req.param('id');
  try {
    const body = await c.req.json().catch(() => ({}));
    const { rating, comments, restaurantId } = body;

    const rNum = Number(rating || 5);
    if (rNum < 1 || rNum > 5) return c.json({ error: 'Rating must be between 1 and 5' }, 400);

    let restId = restaurantId;
    let ord = await c.env.DB.prepare('SELECT id, restaurant_id FROM orders WHERE id = ?').bind(orderId).first();
    if (ord?.restaurant_id) {
      restId = ord.restaurant_id;
    } else if (!restId) {
      const defaultRest = await c.env.DB.prepare('SELECT id FROM restaurants LIMIT 1').first();
      restId = defaultRest?.id;
    }

    const fbId = generateUUID();
    await c.env.DB.prepare(
      `INSERT INTO order_feedback (id, order_id, restaurant_id, rating, comments)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(fbId, ord ? ord.id : null, restId, rNum, comments || null).run();

    return c.json({
      success: true,
      message: 'Thank you for your valuable feedback!',
      feedbackId: fbId,
      rating: rNum,
    });
  } catch (err) {
    console.error('Feedback submission error:', err);
    return c.json({ error: 'Failed to submit feedback' }, 500);
  }
});

// POST /api/order/feedback/submit (Direct feedback alias)
order.post('/feedback/submit', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const { orderId, restaurantId, rating, comments } = body;

    const rNum = Number(rating || 5);
    const fbId = generateUUID();

    let restId = restaurantId;
    if (!restId) {
      const defaultRest = await c.env.DB.prepare('SELECT id FROM restaurants LIMIT 1').first();
      restId = defaultRest?.id;
    }

    await c.env.DB.prepare(
      `INSERT INTO order_feedback (id, order_id, restaurant_id, rating, comments)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(fbId, orderId || null, restId, rNum, comments || null).run();

    return c.json({
      success: true,
      message: 'Feedback received!',
      feedbackId: fbId,
    });
  } catch (err) {
    return c.json({ error: 'Failed to submit feedback' }, 500);
  }
});

// PUT /api/order/:id/dismiss (Cashier / Admin settle individual diner order)
order.put('/:id/dismiss', async (c) => {
  const orderId = c.req.param('id');
  try {
    const body = await c.req.json().catch(() => ({}));
    const paymentMethod = body.paymentMethod || body.payment_method || 'CASH';

    const ord = await c.env.DB.prepare(
      'SELECT id, table_id, session_token, session_label, subtotal, tax_amount, total FROM orders WHERE id = ?'
    )
      .bind(orderId)
      .first();

    if (!ord) return c.json({ error: 'Order not found' }, 404);

    await c.env.DB.prepare(
      `UPDATE orders SET status = 'PAID', payment_method = ?, updated_at = datetime('now') WHERE id = ?`
    )
      .bind(paymentMethod, orderId)
      .run();

    if (ord.session_token) {
      await c.env.DB.prepare(
        `UPDATE customer_sessions SET is_active = 0, last_active = datetime('now') WHERE session_token = ?`
      )
        .bind(ord.session_token)
        .run();
    }

    const remainingRes = await c.env.DB.prepare(
      `SELECT COUNT(*) as count FROM orders WHERE table_id = ? AND status NOT IN ('PAID', 'CANCELLED')`
    )
      .bind(ord.table_id)
      .first();

    const remainingCount = Number(remainingRes?.count || 0);

    return c.json({
      message: `Order for ${ord.session_label || 'Customer'} marked as PAID.`,
      order: {
        ...ord,
        status: 'PAID',
        paymentMethod,
        remainingActiveTableOrders: remainingCount,
      },
    });
  } catch (err) {
    console.error('Dismiss order error:', err);
    return c.json({ error: 'Database error' }, 500);
  }
});

// PUT /api/order/table/:tableId/settle-all (Settle entire table combined bill)
order.put('/table/:tableId/settle-all', async (c) => {
  const tableId = c.req.param('tableId');
  try {
    const body = await c.req.json().catch(() => ({}));
    const paymentMethod = body.paymentMethod || body.payment_method || 'CASH';

    const activeOrdersRes = await c.env.DB.prepare(
      `SELECT o.id, o.session_token, o.session_label, o.subtotal, o.tax_amount, o.total, t.number AS table_number
       FROM orders o
       JOIN tables t ON o.table_id = t.id
       WHERE o.table_id = ? AND o.status NOT IN ('PAID', 'CANCELLED')`
    )
      .bind(tableId)
      .all();

    const activeOrders = activeOrdersRes.results || [];
    if (activeOrders.length === 0) {
      return c.json({ error: 'No active unsettled orders found for this table' }, 400);
    }

    let combinedSubtotal = 0;
    let combinedTax = 0;
    let combinedTotal = 0;

    for (const ord of activeOrders) {
      combinedSubtotal += Number(ord.subtotal || 0);
      combinedTax += Number(ord.tax_amount || 0);
      combinedTotal += Number(ord.total || 0);

      await c.env.DB.prepare(
        `UPDATE orders SET status = 'PAID', payment_method = ?, updated_at = datetime('now') WHERE id = ?`
      )
        .bind(paymentMethod, ord.id)
        .run();
    }

    await c.env.DB.prepare(
      `UPDATE customer_sessions SET is_active = 0, last_active = datetime('now') WHERE table_id = ?`
    )
      .bind(tableId)
      .run();

    return c.json({
      message: `Table #${activeOrders[0]?.table_number || ''} fully settled and released.`,
      ordersSettledCount: activeOrders.length,
      combinedSubtotal,
      combinedTax,
      combinedTotal,
      tableId,
      status: 'PAID',
    });
  } catch (err) {
    console.error('Settle all error:', err);
    return c.json({ error: 'Database error' }, 500);
  }
});

// GET /api/order/:id/split (Equal Bill Split)
order.get('/:id/split', async (c) => {
  const orderId = c.req.param('id');
  const ways = parseInt(c.req.query('ways') || '2', 10);

  if (ways < 2 || ways > 20) {
    return c.json({ error: 'Bill can be split between 2 and 20 ways' }, 400);
  }

  try {
    const ord = await c.env.DB.prepare(
      `SELECT o.id, o.table_id, o.subtotal, o.discount_amount, o.coupon_code, o.tax_percentage, o.tax_amount, o.total,
              r.currency, t.number AS table_number
       FROM orders o
       JOIN restaurants r ON o.restaurant_id = r.id
       LEFT JOIN tables t ON o.table_id = t.id
       WHERE o.id = ?`
    ).bind(orderId).first();

    if (!ord) return c.json({ error: 'Order not found' }, 404);

    const totalAmount = Number(ord.total || 0);
    const currency = ord.currency || '₹';

    const totalPaise = Math.round(totalAmount * 100);
    const baseSharePaise = Math.floor(totalPaise / ways);
    const remainderPaise = totalPaise % ways;

    const shares = [];
    for (let i = 0; i < ways; i++) {
      const sharePaise = baseSharePaise + (i < remainderPaise ? 1 : 0);
      shares.push({
        person: i + 1,
        amount: parseFloat((sharePaise / 100).toFixed(2)),
      });
    }

    return c.json({
      orderId,
      tableNumber: ord.table_number,
      currency,
      totalAmount,
      subtotal: Number(ord.subtotal || 0),
      discountAmount: Number(ord.discount_amount || 0),
      taxAmount: Number(ord.tax_amount || 0),
      splitWays: ways,
      perPerson: shares[0].amount,
      perPersonAmount: shares[0].amount,
      shares,
    });
  } catch (err) {
    console.error('Split bill error:', err);
    return c.json({ error: 'Database error' }, 500);
  }
});

export default order;
