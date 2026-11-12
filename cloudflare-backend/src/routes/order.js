// Order & Session Router for Cloudflare Workers & D1
import { Hono } from 'hono';
import { toUtcIso } from '../utils/time.js';

const order = new Hono();

// Helper to generate UUID
function generateUUID() {
  return crypto.randomUUID();
}

// Aggregate all active unsettled orders for a customer session without mutating earlier preparing/ready tickets
async function buildAggregatedSessionOrder(db, ordersList) {
  if (!Array.isArray(ordersList) || ordersList.length === 0) return null;

  const populatedOrders = [];
  const allItems = [];
  let combinedSubtotal = 0;
  let combinedDiscount = 0;
  let combinedTax = 0;
  let combinedTotal = 0;
  const combinedNotes = [];

  for (const ord of ordersList) {
    const itemsRes = await db.prepare(
      `SELECT oi.*, mi.name, mi.photo_url, mi.is_veg, mi.category
       FROM order_items oi
       JOIN menu_items mi ON oi.menu_item_id = mi.id
       WHERE oi.order_id = ?
       ORDER BY oi.created_at ASC`
    )
      .bind(ord.id)
      .all();

    const ordItems = (itemsRes.results || []).map((it) => ({
      ...it,
      order_id: ord.id,
      order_status: ord.status,
      created_at: toUtcIso(it.created_at),
    }));

    populatedOrders.push({
      ...ord,
      created_at: toUtcIso(ord.created_at),
      updated_at: toUtcIso(ord.updated_at),
      items: ordItems,
    });

    allItems.push(...ordItems);
    combinedSubtotal += Number(ord.subtotal || 0);
    combinedDiscount += Number(ord.discount_amount || 0);
    combinedTax += Number(ord.tax_amount || 0);
    combinedTotal += Number(ord.total || 0);
    if (ord.notes) combinedNotes.push(ord.notes);
  }

  const pendingOrder = [...populatedOrders].reverse().find((o) => o.status === 'PENDING');
  const latestOrder = populatedOrders[populatedOrders.length - 1];
  const primaryOrder = pendingOrder || latestOrder;

  return {
    ...primaryOrder,
    id: primaryOrder.id,
    orderId: primaryOrder.id,
    status: latestOrder.status,
    subtotal: Math.round(combinedSubtotal * 100) / 100,
    discount_amount: Math.round(combinedDiscount * 100) / 100,
    tax_amount: Math.round(combinedTax * 100) / 100,
    total: Math.round(combinedTotal * 100) / 100,
    notes: combinedNotes.join(' • '),
    created_at: populatedOrders[0].created_at,
    updated_at: latestOrder.updated_at || latestOrder.created_at,
    items: allItems,
    orders: populatedOrders,
    allOrderIds: populatedOrders.map((o) => o.id),
  };
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
        `SELECT cs.id, cs.session_token, cs.session_label, cs.is_active, cs.customer_id,
                c.name as customer_name, c.phone as customer_phone, c.consent_given
         FROM customer_sessions cs
         LEFT JOIN customers c ON cs.customer_id = c.id
         WHERE cs.session_token = ? AND cs.table_id = ? AND cs.is_active = 1`
      )
        .bind(sessionToken, tableId)
        .first();
    }

    if (existingSession) {
      // Find all active unsettled orders for this session in chronological order
      const activeOrdersRes = await c.env.DB.prepare(
        `SELECT o.id, o.status, o.subtotal, o.discount_amount, o.tax_percentage, o.tax_amount, o.total, o.created_at, o.updated_at, o.notes,
                c.name as customer_name, c.phone as customer_phone
         FROM orders o
         LEFT JOIN customers c ON o.customer_id = c.id
         WHERE (o.session_token = ? OR o.session_id = ?) AND o.status NOT IN ('PAID', 'CANCELLED')
         ORDER BY o.created_at ASC`
      )
        .bind(existingSession.session_token, existingSession.id)
        .all();

      const activeOrder = await buildAggregatedSessionOrder(c.env.DB, activeOrdersRes.results || []);

      const resolvedCustName = activeOrder?.customer_name || existingSession.customer_name || null;
      const resolvedCustPhone = activeOrder?.customer_phone || existingSession.customer_phone || null;

      return c.json({
        sessionToken: existingSession.session_token,
        sessionLabel: existingSession.session_label,
        sessionId: existingSession.id,
        customer: resolvedCustName ? {
          name: resolvedCustName,
          phone: resolvedCustPhone,
          consentGiven: Boolean(existingSession.consent_given ?? 1),
        } : null,
        isNew: false,
        hasActiveOrder: Boolean(activeOrder),
        order: activeOrder ? {
          ...activeOrder,
          customer_name: resolvedCustName,
          customer: resolvedCustName ? { name: resolvedCustName, phone: resolvedCustPhone } : null,
        } : null,
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

    const activeOrdersRes = await c.env.DB.prepare(
      `SELECT id, status, subtotal, discount_amount, tax_amount, total, created_at, updated_at, notes
       FROM orders
       WHERE session_token = ? AND status NOT IN ('PAID', 'CANCELLED')
       ORDER BY created_at ASC`
    )
      .bind(token)
      .all();

    const activeOrder = await buildAggregatedSessionOrder(c.env.DB, activeOrdersRes.results || []);

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

    let activeOrders = [];
    if (sessionToken) {
      const ordersRes = await c.env.DB.prepare(
        `SELECT o.*, c.name as customer_name, c.phone as customer_phone
         FROM orders o
         LEFT JOIN customers c ON o.customer_id = c.id
         WHERE o.table_id = ? AND o.session_token = ? AND o.status NOT IN ('PAID', 'CANCELLED')
         ORDER BY o.created_at ASC`
      )
        .bind(tableId, sessionToken)
        .all();
      activeOrders = ordersRes.results || [];
    } else {
      const ordersRes = await c.env.DB.prepare(
        `SELECT o.*, c.name as customer_name, c.phone as customer_phone
         FROM orders o
         LEFT JOIN customers c ON o.customer_id = c.id
         WHERE o.table_id = ? AND o.status NOT IN ('PAID', 'CANCELLED')
         ORDER BY o.created_at ASC`
      )
        .bind(tableId)
        .all();
      activeOrders = ordersRes.results || [];
    }

    const activeOrder = await buildAggregatedSessionOrder(c.env.DB, activeOrders);

    return c.json({
      table,
      hasActiveOrder: Boolean(activeOrder),
      order: activeOrder || null,
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
        await c.env.DB.prepare("UPDATE customer_sessions SET customer_id = ?, last_active = datetime('now') WHERE id = ?").bind(customerId, sId).run();
      } else {
        sToken = `cs_${generateUUID()}`;
        const countRow = await c.env.DB.prepare('SELECT COUNT(*) as count FROM customer_sessions WHERE table_id = ? AND is_active = 1').bind(tableId).first();
        sLabel = `Customer ${Number(countRow?.count || 0) + 1}`;
        await c.env.DB.prepare('INSERT INTO customer_sessions (id, session_token, table_id, restaurant_id, customer_id, session_label, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)').bind(sId, sToken, tableId, restaurantId, customerId, sLabel).run();
      }
    } else {
      sToken = `cs_${generateUUID()}`;
      const countRow = await c.env.DB.prepare('SELECT COUNT(*) as count FROM customer_sessions WHERE table_id = ? AND is_active = 1').bind(tableId).first();
      sLabel = `Customer ${Number(countRow?.count || 0) + 1}`;
      await c.env.DB.prepare('INSERT INTO customer_sessions (id, session_token, table_id, restaurant_id, customer_id, session_label, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)').bind(sId, sToken, tableId, restaurantId, customerId, sLabel).run();
    }

    // Reuse an order ONLY if it is still unstarted ('PENDING'); once PREPARING/READY/SERVED, create a brand-new order ticket
    let existingOrder = await c.env.DB.prepare(
      "SELECT id, status FROM orders WHERE session_token = ? AND status = 'PENDING' ORDER BY created_at DESC LIMIT 1"
    ).bind(sToken).first();
    let orderId = existingOrder ? existingOrder.id : generateUUID();
    let isExistingSession = Boolean(existingOrder);

    if (!existingOrder) {
      await c.env.DB.prepare(
        `INSERT INTO orders (id, restaurant_id, table_id, customer_id, session_id, session_token, session_label, status, notes, subtotal, tax_percentage, tax_amount, total)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, 0, ?, 0, 0)`
      ).bind(orderId, restaurantId, tableId, customerId, sId, sToken, sLabel, notes || null, Number(table.tax_percentage || 5.0)).run();
    } else {
      if (notes) {
        await c.env.DB.prepare("UPDATE orders SET notes = COALESCE(notes || '; ', '') || ? WHERE id = ?").bind(notes, orderId).run();
      }
      await c.env.DB.prepare("UPDATE orders SET customer_id = COALESCE(customer_id, ?), updated_at = datetime('now') WHERE id = ?").bind(customerId, orderId).run();
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

// POST /api/order/:id/items (Add Extra Dishes — spawns a brand-new PENDING ticket if kitchen already started preparing)
order.post('/:id/items', async (c) => {
  const orderId = c.req.param('id');
  try {
    const body = await c.req.json().catch(() => ({}));
    const items = body.items || [];

    const ord = await c.env.DB.prepare(
      `SELECT id, restaurant_id, table_id, customer_id, session_id, session_token, session_label, tax_percentage, status
       FROM orders WHERE id = ?`
    ).bind(orderId).first();
    if (!ord) return c.json({ error: 'Order not found' }, 404);
    if (['PAID', 'CANCELLED'].includes(ord.status)) {
      return c.json({ error: 'Cannot add items to a settled or cancelled order' }, 400);
    }

    // Once kitchen starts preparing (PREPARING / READY / SERVED), the existing order is locked:
    // never pull it back to PENDING or combine new items into it; create a fresh PENDING ticket instead.
    let targetOrderId = orderId;
    let isNewTicket = false;

    if (ord.status !== 'PENDING') {
      const openPending = ord.session_token
        ? await c.env.DB.prepare(
            "SELECT id FROM orders WHERE session_token = ? AND status = 'PENDING' ORDER BY created_at DESC LIMIT 1"
          ).bind(ord.session_token).first()
        : null;

      if (openPending?.id) {
        targetOrderId = openPending.id;
      } else {
        targetOrderId = generateUUID();
        isNewTicket = true;
        await c.env.DB.prepare(
          `INSERT INTO orders (id, restaurant_id, table_id, customer_id, session_id, session_token, session_label, status, subtotal, tax_percentage, tax_amount, total)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', 0, ?, 0, 0)`
        ).bind(
          targetOrderId,
          ord.restaurant_id,
          ord.table_id,
          ord.customer_id || null,
          ord.session_id || null,
          ord.session_token || null,
          ord.session_label || 'Customer',
          Number(ord.tax_percentage ?? 5.0)
        ).run();
      }
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
        ).bind(generateUUID(), targetOrderId, mItem.id, qty, price, it.special_instructions || null).run();
        addedCount += qty;
      }
    }

    await c.env.DB.prepare("UPDATE orders SET updated_at = datetime('now') WHERE id = ?").bind(targetOrderId).run();

    const totals = await recalculateOrderTotals(c.env.DB, targetOrderId, ord.restaurant_id);

    return c.json({
      success: true,
      orderId: targetOrderId,
      isNewTicket,
      itemsAdded: addedCount,
      newTotal: totals.total,
      total: totals.total,
      totals,
      order: {
        id: targetOrderId,
        status: 'PENDING',
        total: totals.total,
        subtotal: totals.subtotal,
      },
    });
  } catch (err) {
    console.error('Add items error:', err);
    return c.json({ error: 'Failed to add items' }, 500);
  }
});

// DELETE /api/order/:id/items/:itemId (Cancel a PENDING item ONLY before chef starts preparing)
order.delete('/:id/items/:itemId', async (c) => {
  const orderId = c.req.param('id');
  const itemId = c.req.param('itemId');
  try {
    const ord = await c.env.DB.prepare('SELECT id, restaurant_id, status FROM orders WHERE id = ?').bind(orderId).first();
    if (!ord) return c.json({ error: 'Order not found' }, 404);
    if (ord.status !== 'PENDING') {
      return c.json({ error: `Cannot modify order once kitchen is ${ord.status.toLowerCase()}.` }, 400);
    }

    const targetItem = await c.env.DB.prepare('SELECT id, status FROM order_items WHERE id = ? AND order_id = ?')
      .bind(itemId, orderId)
      .first();
    if (!targetItem) return c.json({ error: 'Dish not found on this order' }, 404);
    if (targetItem.status !== 'PENDING') {
      return c.json({ error: `Cannot remove dish because it is already ${targetItem.status.toLowerCase()}.` }, 400);
    }

    await c.env.DB.prepare('DELETE FROM order_items WHERE id = ? AND order_id = ?').bind(itemId, orderId).run();

    const remainingRes = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM order_items WHERE order_id = ?'
    ).bind(orderId).first();
    const remainingCount = Number(remainingRes?.count || 0);
    const nextOrderStatus = remainingCount === 0 ? 'CANCELLED' : 'PENDING';

    await c.env.DB.prepare("UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?")
      .bind(nextOrderStatus, orderId)
      .run();

    const totals = await recalculateOrderTotals(c.env.DB, orderId, ord.restaurant_id);

    return c.json({
      success: true,
      orderId,
      removedItemId: itemId,
      status: nextOrderStatus,
      total: totals.total,
      totals,
    });
  } catch (err) {
    console.error('Remove order item error:', err);
    return c.json({ error: 'Failed to remove dish' }, 500);
  }
});

// PUT /api/order/:id/notes (Update Cooking Notes — locked once kitchen starts preparing)
order.put('/:id/notes', async (c) => {
  const orderId = c.req.param('id');
  try {
    const { notes } = await c.req.json().catch(() => ({}));
    const ord = await c.env.DB.prepare('SELECT id, status FROM orders WHERE id = ?').bind(orderId).first();
    if (!ord) return c.json({ error: 'Order not found' }, 404);

    if (ord.status !== 'PENDING') {
      return c.json({ error: `Cannot modify notes once kitchen has started (${ord.status})` }, 400);
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
      restaurant = await c.env.DB.prepare('SELECT id, name, upi_id, upi_name, upi_enabled FROM restaurants WHERE id = ?').bind(restaurantId).first();
    } else {
      restaurant = await c.env.DB.prepare('SELECT id, name, upi_id, upi_name, upi_enabled FROM restaurants LIMIT 1').first();
    }

    if (!restaurant) {
      return c.json({
        upiEnabled: false,
        upiId: '',
        upiName: 'KRISH Cafe & Restaurant',
        restaurantName: 'KRISH Cafe & Restaurant',
        tableNumber: tableNumber ? Number(tableNumber) : null,
      });
    }

    const cleanUpiId = (restaurant.upi_id || '').trim();
    const isEnabled = Boolean(restaurant.upi_enabled) && Boolean(cleanUpiId);

    return c.json({
      upiEnabled: isEnabled,
      upiId: isEnabled ? cleanUpiId : '',
      upiName: restaurant.upi_name || restaurant.name || 'KRISH Cafe & Restaurant',
      restaurantName: restaurant.name || 'KRISH Cafe & Restaurant',
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
      const utrNote = `Paid via UPI (UTR: ${utr}, VPA: ${upiId || 'N/A'})`;
      const targetOrd = await c.env.DB.prepare('SELECT session_token FROM orders WHERE id = ?').bind(orderId).first();
      if (targetOrd?.session_token) {
        await c.env.DB.prepare(
          `UPDATE orders
           SET payment_method = 'UPI',
               notes = COALESCE(notes || '; ', '') || ?
           WHERE session_token = ? AND status NOT IN ('PAID', 'CANCELLED')`
        ).bind(utrNote, targetOrd.session_token).run();
      } else {
        await c.env.DB.prepare(
          `UPDATE orders
           SET payment_method = 'UPI',
               notes = COALESCE(notes || '; ', '') || ?
           WHERE id = ?`
        ).bind(utrNote, orderId).run();
      }
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
      const sess = await c.env.DB.prepare(
        `SELECT cs.session_label, c.name as customer_name
         FROM customer_sessions cs
         LEFT JOIN customers c ON cs.customer_id = c.id
         WHERE cs.session_token = ?`
      ).bind(sessionToken).first();
      if (sess?.session_label) sLabel = sess.session_label;
      if (!customerName && sess?.customer_name) cName = sess.customer_name;
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
      timestamp: toUtcIso(orderRow?.updated_at) || new Date().toISOString(),
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
      const remSess = await c.env.DB.prepare(
        `SELECT COUNT(*) as count FROM orders WHERE session_token = ? AND status NOT IN ('PAID', 'CANCELLED')`
      )
        .bind(ord.session_token)
        .first();
      if (Number(remSess?.count || 0) === 0) {
        await c.env.DB.prepare(
          `UPDATE customer_sessions SET is_active = 0, last_active = datetime('now') WHERE session_token = ?`
        )
          .bind(ord.session_token)
          .run();
      }
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
      `SELECT o.id, o.table_id, o.session_token, o.subtotal, o.discount_amount, o.coupon_code, o.tax_percentage, o.tax_amount, o.total,
              r.currency, t.number AS table_number
       FROM orders o
       JOIN restaurants r ON o.restaurant_id = r.id
       LEFT JOIN tables t ON o.table_id = t.id
       WHERE o.id = ?`
    ).bind(orderId).first();

    if (!ord) return c.json({ error: 'Order not found' }, 404);

    let splitSubtotal = Number(ord.subtotal || 0);
    let splitDiscount = Number(ord.discount_amount || 0);
    let splitTax = Number(ord.tax_amount || 0);
    let totalAmount = Number(ord.total || 0);

    if (ord.session_token) {
      const sessAgg = await c.env.DB.prepare(
        `SELECT COALESCE(SUM(subtotal), 0) AS subtotal,
                COALESCE(SUM(discount_amount), 0) AS discount_amount,
                COALESCE(SUM(tax_amount), 0) AS tax_amount,
                COALESCE(SUM(total), 0) AS total
         FROM orders
         WHERE session_token = ? AND status NOT IN ('PAID', 'CANCELLED')`
      ).bind(ord.session_token).first();
      if (sessAgg && Number(sessAgg.total || 0) > 0) {
        splitSubtotal = Number(sessAgg.subtotal || 0);
        splitDiscount = Number(sessAgg.discount_amount || 0);
        splitTax = Number(sessAgg.tax_amount || 0);
        totalAmount = Number(sessAgg.total || 0);
      }
    }

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
      totalAmount: parseFloat(totalAmount.toFixed(2)),
      subtotal: parseFloat(splitSubtotal.toFixed(2)),
      discountAmount: parseFloat(splitDiscount.toFixed(2)),
      taxAmount: parseFloat(splitTax.toFixed(2)),
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

// GET /api/order/receipt/:code (Public Digital Bill Lookup by Barcode / Receipt Code / Order UUID)
order.get('/receipt/:code', async (c) => {
  const rawCode = decodeURIComponent(c.req.param('code') || '').trim();
  if (!rawCode) {
    return c.json({ error: 'Receipt code is required' }, 400);
  }

  try {
    const cleaned = rawCode.replace(/^#/, '').trim();
    const isCombinedTableCode = /^KT[-_]?/i.test(cleaned);
    const idPrefix = cleaned
      .replace(/^(KR|KT)[-_]?/i, '')
      .toLowerCase();

    if (!idPrefix || idPrefix.length < 4) {
      return c.json({ error: 'Invalid receipt code format' }, 400);
    }

    const anchor = await c.env.DB.prepare(
      `SELECT o.*, t.number AS table_number, r.name AS restaurant_name, r.address AS restaurant_address, r.phone AS restaurant_phone,
              c.name AS customer_name, c.phone AS customer_phone
       FROM orders o
       LEFT JOIN tables t ON o.table_id = t.id
       LEFT JOIN restaurants r ON o.restaurant_id = r.id
       LEFT JOIN customers c ON o.customer_id = c.id
       WHERE LOWER(o.id) = ? OR LOWER(o.id) LIKE ?
       ORDER BY o.created_at DESC
       LIMIT 1`
    ).bind(cleaned.toLowerCase(), `${idPrefix}%`).first();

    if (!anchor) {
      return c.json({ error: 'Receipt / Bill not found' }, 404);
    }

    let targetOrders = [anchor];

    // If combined table receipt (KT-<id6>) or explicit table scope, gather companion orders from the same table batch
    if (isCombinedTableCode && anchor.table_id) {
      const companions = await c.env.DB.prepare(
        `SELECT o.*, c.name AS customer_name
         FROM orders o
         LEFT JOIN customers c ON o.customer_id = c.id
         WHERE o.table_id = ?
           AND o.status = ?
           AND ABS(strftime('%s', COALESCE(o.updated_at, o.created_at)) - strftime('%s', COALESCE(?, o.created_at))) <= 300
         ORDER BY o.created_at ASC`
      ).bind(anchor.table_id, anchor.status, anchor.updated_at || anchor.created_at).all();

      if (companions.results && companions.results.length > 0) {
        targetOrders = companions.results;
      }
    }

    const items = [];
    let subtotal = 0;
    let discountAmount = 0;
    let taxAmount = 0;
    let total = 0;
    const guestNames = [];

    for (const ord of targetOrders) {
      if (ord.customer_name && !guestNames.includes(ord.customer_name)) {
        guestNames.push(ord.customer_name);
      }
      subtotal += Number(ord.subtotal || 0);
      discountAmount += Number(ord.discount_amount || 0);
      taxAmount += Number(ord.tax_amount || 0);
      total += Number(ord.total || 0);

      const itemsRes = await c.env.DB.prepare(
        `SELECT oi.id, oi.quantity, oi.price_at_order, mi.name AS item_name, mi.name, mi.category
         FROM order_items oi
         JOIN menu_items mi ON oi.menu_item_id = mi.id
         WHERE oi.order_id = ?`
      ).bind(ord.id).all();

      for (const it of (itemsRes.results || [])) {
        const qty = Number(it.quantity || 1);
        const unitPrice = Number(it.price_at_order || 0);
        items.push({
          name: it.item_name || it.name || 'Item',
          quantity: qty,
          price: unitPrice,
          line_total: Number((unitPrice * qty).toFixed(2)),
        });
      }
    }

    const barcodePrefix = isCombinedTableCode ? 'KT' : 'KR';
    const barcodeCode = `${barcodePrefix}-${String(anchor.id).slice(0, 6).toUpperCase()}`;

    return c.json({
      orderId: anchor.id,
      receiptNumber: `#${barcodeCode}`,
      barcodeCode,
      restaurantName: anchor.restaurant_name || 'KRISH Cafe & Restaurant',
      address: anchor.restaurant_address || 'Rathinam College Front Gate, Eachanari, Coimbatore - 641021',
      phone: anchor.restaurant_phone || '8760633322',
      tableNumber: anchor.table_number || 1,
      customerName: guestNames.join(', ') || anchor.customer_name || 'Guest',
      guestsCount: targetOrders.length || 1,
      paymentMethod: anchor.payment_method || (anchor.status === 'PAID' ? 'CASH' : 'UNPAID'),
      status: anchor.status || 'PENDING',
      paidAt: toUtcIso(anchor.updated_at || anchor.created_at),
      subtotal: Number(subtotal.toFixed(2)),
      discountAmount: Number(discountAmount.toFixed(2)),
      taxAmount: Number(taxAmount.toFixed(2)),
      total: Number(total.toFixed(2)),
      items,
    });
  } catch (err) {
    console.error('Receipt lookup error:', err);
    return c.json({ error: 'Database error' }, 500);
  }
});

export default order;
