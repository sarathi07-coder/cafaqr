// routes/order.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const Joi = require('joi');
const crypto = require('crypto');
const { getIO } = require('../socket'); // emit realtime events

// Helper to upsert a customer (by phone) and optionally enforce consent
async function upsertCustomer({ name, phone, consentGiven }) {
  if (!consentGiven) {
    throw new Error('GDPR consent not given');
  }
  const existing = await db.query('SELECT id FROM customers WHERE phone = $1', [phone]);
  if (existing.rowCount > 0) {
    await db.query('UPDATE customers SET name = $1, consent_given = $2 WHERE id = $3', [name, consentGiven, existing.rows[0].id]);
    return existing.rows[0].id;
  } else {
    const result = await db.query(
      'INSERT INTO customers (name, phone, consent_given) VALUES ($1, $2, $3) RETURNING id',
      [name, phone, consentGiven]
    );
    return result.rows[0].id;
  }
}

// Helper to compute subtotal, coupon discounts, restaurant tax percentage, tax amount, and grand total
async function recalculateOrderTotals(orderId, restaurantId) {
  // 1. Fetch restaurant settings, order coupon, and items sum concurrently in 1 roundtrip
  const [restRes, orderRes, sumRes] = await Promise.all([
    db.query('SELECT tax_percentage, currency FROM restaurants WHERE id = $1', [restaurantId]),
    db.query('SELECT coupon_code FROM orders WHERE id = $1', [orderId]),
    db.query(
      `SELECT COALESCE(SUM(quantity * price_at_order), 0) AS subtotal 
       FROM order_items WHERE order_id = $1`,
      [orderId]
    )
  ]);

  const taxPercentage = restRes.rowCount > 0 && restRes.rows[0].tax_percentage != null
    ? parseFloat(restRes.rows[0].tax_percentage)
    : 5.0;
  const currency = restRes.rowCount > 0 && restRes.rows[0].currency ? restRes.rows[0].currency : '₹';
  const couponCode = orderRes.rowCount > 0 ? orderRes.rows[0].coupon_code : null;
  const subtotal = parseFloat(sumRes.rows[0].subtotal);

  // 4. Calculate discount if couponCode is active
  let discountAmount = 0;
  if (couponCode) {
    const couponRes = await db.query(
      `SELECT * FROM coupons 
       WHERE restaurant_id = $1 AND code = $2 AND is_active = true 
       AND (valid_until IS NULL OR valid_until >= now())`,
      [restaurantId, couponCode]
    );

    if (couponRes.rowCount > 0) {
      const coupon = couponRes.rows[0];
      const minOrder = parseFloat(coupon.min_order_amount || 0);

      if (subtotal >= minOrder) {
        if (coupon.discount_type === 'PERCENTAGE') {
          const rawDiscount = (subtotal * parseFloat(coupon.discount_value)) / 100;
          const maxCap = coupon.max_discount_amount ? parseFloat(coupon.max_discount_amount) : Infinity;
          discountAmount = Math.min(rawDiscount, maxCap);
        } else if (coupon.discount_type === 'FLAT') {
          discountAmount = Math.min(parseFloat(coupon.discount_value), subtotal);
        }
      } else {
        discountAmount = 0;
      }
    }
  }

  discountAmount = Math.round(discountAmount * 100) / 100;
  const taxableAmount = Math.max(0, subtotal - discountAmount);
  const taxAmount = Math.round((taxableAmount * (taxPercentage / 100)) * 100) / 100;
  const grandTotal = Math.round((taxableAmount + taxAmount) * 100) / 100;

  // 5. Update orders record
  await db.query(
    `UPDATE orders 
     SET subtotal = $1, discount_amount = $2, tax_percentage = $3, tax_amount = $4, total = $5, updated_at = now() 
     WHERE id = $6`,
    [subtotal, discountAmount, taxPercentage, taxAmount, grandTotal, orderId]
  );

  return { subtotal, discountAmount, couponCode, taxPercentage, taxAmount, grandTotal, currency };
}

// GET /api/order/tables/default
// Returns default table and restaurant for direct browser preview
let cachedDefaultTable = null;
let cachedDefaultTableExpires = 0;

router.get('/tables/default', async (req, res) => {
  const now = Date.now();
  if (cachedDefaultTable && now < cachedDefaultTableExpires) {
    return res.json({ table: cachedDefaultTable });
  }

  try {
    const tableRes = await db.query(
      `SELECT t.id, t.number, t.restaurant_id, r.name as restaurant_name 
       FROM tables t 
       JOIN restaurants r ON t.restaurant_id = r.id 
       ORDER BY (SELECT COUNT(*) FROM menu_items WHERE restaurant_id = r.id) DESC, t.number ASC 
       LIMIT 1`
    );
    if (tableRes.rowCount === 0) {
      return res.status(404).json({ error: 'No tables configured yet' });
    }
    cachedDefaultTable = tableRes.rows[0];
    cachedDefaultTableExpires = now + 5 * 60 * 1000; // cache for 5 minutes
    res.json({ table: cachedDefaultTable });
  } catch (err) {
    console.error('Default table error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// POST /api/order/session/init
// Initializes or resumes an independent customer session for a table
router.post('/session/init', async (req, res) => {
  const schema = Joi.object({
    tableId: Joi.string().uuid().required(),
    sessionToken: Joi.string().optional().allow(null, ''),
    customerName: Joi.string().optional().allow(null, '')
  });
  const { error, value } = schema.validate(req.body);
  if (error) return res.status(400).json({ error: error.details[0].message });

  const { tableId, sessionToken, customerName } = value;

  try {
    const tableRes = await db.query(
      `SELECT t.id, t.number, t.restaurant_id, r.name AS restaurant_name, r.currency, r.upi_id, r.upi_name
       FROM tables t
       JOIN restaurants r ON t.restaurant_id = r.id
       WHERE t.id = $1`,
      [tableId]
    );

    if (tableRes.rowCount === 0) {
      return res.status(404).json({ error: 'Table not found' });
    }

    const table = tableRes.rows[0];

    // If an existing sessionToken was sent by this device, check if it is active
    if (sessionToken) {
      const existingSessionRes = await db.query(
        `SELECT cs.id, cs.session_token, cs.session_label, cs.table_id, cs.is_active,
                c.id AS customer_id, c.name AS customer_name, c.phone AS customer_phone, c.consent_given
         FROM customer_sessions cs
         LEFT JOIN customers c ON cs.customer_id = c.id
         WHERE cs.session_token = $1 AND cs.table_id = $2 AND cs.is_active = true`,
        [sessionToken, tableId]
      );

      if (existingSessionRes.rowCount > 0) {
        const session = existingSessionRes.rows[0];
        // update last active timestamp asynchronously without blocking response
        db.query('UPDATE customer_sessions SET last_active = now() WHERE id = $1', [session.id]).catch(err => {
          console.warn('Error updating session last_active:', err.message);
        });

        // check if this specific session has an active order
        const activeOrderRes = await db.query(
          `SELECT o.id, o.status, o.subtotal, o.tax_percentage, o.tax_amount, o.total, o.notes, o.payment_method,
                  o.coupon_code, o.discount_amount, o.created_at
           FROM orders o
           WHERE o.session_id = $1 AND o.status NOT IN ('PAID', 'CANCELLED')
           ORDER BY o.created_at DESC LIMIT 1`,
          [session.id]
        );

        let orderData = null;
        if (activeOrderRes.rowCount > 0) {
          const ord = activeOrderRes.rows[0];
          const itemsRes = await db.query(
            `SELECT oi.id, oi.quantity, oi.price_at_order, oi.status, mi.name AS item_name, mi.category
             FROM order_items oi
             JOIN menu_items mi ON oi.menu_item_id = mi.id
             WHERE oi.order_id = $1
             ORDER BY oi.created_at ASC`,
            [ord.id]
          );
          orderData = {
            id: ord.id,
            orderId: ord.id,
            status: ord.status,
            subtotal: parseFloat(ord.subtotal),
            taxAmount: parseFloat(ord.tax_amount),
            total: parseFloat(ord.total),
            notes: ord.notes,
            items: itemsRes.rows.map(it => ({
              ...it,
              name: it.item_name,
              price: parseFloat(it.price_at_order),
              price_at_order: parseFloat(it.price_at_order),
              line_total: parseFloat(it.price_at_order) * it.quantity
            }))
          };
        }

        return res.json({
          sessionToken: session.session_token,
          sessionLabel: session.session_label,
          sessionId: session.id,
          isNew: false,
          hasActiveOrder: !!orderData,
          order: orderData,
          customer: session.customer_name ? {
            id: session.customer_id,
            name: session.customer_name,
            phone: session.customer_phone,
            consentGiven: session.consent_given
          } : null,
          table: {
            id: table.id,
            number: table.number,
            restaurant_id: table.restaurant_id,
            restaurant_name: table.restaurant_name,
            currency: table.currency,
            upi_id: table.upi_id || 'vallipriya1212-1@oksbi',
            upi_name: table.upi_name || 'Royal Spice Bistro'
          }
        });
      }
    }

    // Otherwise, create a new independent customer session for this table
    // Calculate customer session label (e.g. Customer 1 / Section A, Customer 2 / Section B)
    const countRes = await db.query(
      `SELECT COUNT(*) FROM customer_sessions WHERE table_id = $1 AND is_active = true`,
      [tableId]
    );
    const activeCount = parseInt(countRes.rows[0].count, 10);
    const sessionLabel = `Customer ${activeCount + 1}`;

    const newSessionToken = `cs_${crypto.randomUUID()}`;

    const newSessionRes = await db.query(
      `INSERT INTO customer_sessions (session_token, table_id, restaurant_id, session_label, is_active)
       VALUES ($1, $2, $3, $4, true)
       RETURNING id, session_token, session_label`,
      [newSessionToken, tableId, table.restaurant_id, sessionLabel]
    );

    const newSession = newSessionRes.rows[0];

    res.status(201).json({
      sessionToken: newSession.session_token,
      sessionLabel: newSession.session_label,
      sessionId: newSession.id,
      isNew: true,
      hasActiveOrder: false,
      order: null,
      customer: null,
      table: {
        id: table.id,
        number: table.number,
        restaurant_id: table.restaurant_id,
        restaurant_name: table.restaurant_name,
        currency: table.currency,
        upi_id: table.upi_id || 'vallipriya1212-1@oksbi',
        upi_name: table.upi_name || 'Royal Spice Bistro'
      }
    });
  } catch (err) {
    console.error('Session init error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});


// GET /api/order/session/:sessionToken
// Fetches state, active order, and metadata for a specific customer session
router.get('/session/:sessionToken', async (req, res) => {
  const { sessionToken } = req.params;

  try {
    const sessionRes = await db.query(
      `SELECT cs.id, cs.session_token, cs.session_label, cs.table_id, cs.is_active,
              t.number AS table_number, t.restaurant_id,
              r.name AS restaurant_name, r.currency,
              c.id AS customer_id, c.name AS customer_name, c.phone AS customer_phone
       FROM customer_sessions cs
       JOIN tables t ON cs.table_id = t.id
       JOIN restaurants r ON cs.restaurant_id = r.id
       LEFT JOIN customers c ON cs.customer_id = c.id
       WHERE cs.session_token = $1`,
      [sessionToken]
    );

    if (sessionRes.rowCount === 0) {
      return res.status(404).json({ error: 'Customer session not found' });
    }

    const session = sessionRes.rows[0];

    // Find active order for this specific customer session
    const activeOrderRes = await db.query(
      `SELECT o.id, o.restaurant_id, o.status, o.subtotal, o.discount_amount, o.coupon_code,
              o.tax_percentage, o.tax_amount, o.total, o.payment_method, o.notes, o.created_at, o.updated_at,
              c.name AS customer_name, c.phone AS customer_phone, r.currency
       FROM orders o
       LEFT JOIN customers c ON o.customer_id = c.id
       LEFT JOIN restaurants r ON o.restaurant_id = r.id
       WHERE (o.session_token = $1 OR o.session_id = $2) AND o.status NOT IN ('PAID', 'CANCELLED')
       ORDER BY o.created_at DESC LIMIT 1`,
      [session.session_token, session.id]
    );

    let orderPayload = null;
    if (activeOrderRes.rowCount > 0) {
      const order = activeOrderRes.rows[0];
      const itemsRes = await db.query(
        `SELECT oi.id, oi.quantity, oi.price_at_order, oi.status, mi.name AS item_name, mi.category, mi.description
         FROM order_items oi
         JOIN menu_items mi ON oi.menu_item_id = mi.id
         WHERE oi.order_id = $1
         ORDER BY oi.created_at ASC`,
        [order.id]
      );

      orderPayload = {
        id: order.id,
        orderId: order.id,
        restaurantId: order.restaurant_id,
        status: order.status,
        notes: order.notes,
        currency: order.currency || '₹',
        subtotal: parseFloat(order.subtotal || order.total),
        couponCode: order.coupon_code,
        discountAmount: parseFloat(order.discount_amount || 0),
        taxPercentage: parseFloat(order.tax_percentage || 5.0),
        taxAmount: parseFloat(order.tax_amount || 0),
        total: parseFloat(order.total),
        total_amount: parseFloat(order.total),
        paymentMethod: order.payment_method,
        createdAt: order.created_at,
        customer: {
          name: order.customer_name || session.customer_name,
          phone: order.customer_phone || session.customer_phone
        },
        customer_name: order.customer_name || session.customer_name,
        customer_phone: order.customer_phone || session.customer_phone,
        items: itemsRes.rows.map(it => ({
          ...it,
          name: it.item_name,
          status: it.status || 'PENDING',
          price_at_order: parseFloat(it.price_at_order),
          line_total: parseFloat(it.price_at_order) * it.quantity
        }))
      };
    }

    res.json({
      sessionToken: session.session_token,
      sessionLabel: session.session_label,
      sessionId: session.id,
      isActive: session.is_active,
      hasActiveSession: !!orderPayload,
      hasActiveOrder: !!orderPayload,
      table: {
        id: session.table_id,
        number: session.table_number,
        restaurant_id: session.restaurant_id,
        restaurant_name: session.restaurant_name,
        currency: session.currency
      },
      order: orderPayload,
      ...(orderPayload || {})
    });
  } catch (err) {
    console.error('Get customer session error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// GET /api/order/table/:tableId/session or /api/order/tables/:tableId/session
// Checks session state for a table. If sessionToken provided, checks that customer's tab.
router.get(['/table/:tableId/session', '/tables/:tableId/session'], async (req, res) => {
  const { tableId } = req.params;
  const sessionToken = req.body?.sessionToken || req.query.sessionToken || req.headers['x-session-token'];

  try {
    const tableRes = await db.query('SELECT id, number, restaurant_id FROM tables WHERE id = $1', [tableId]);
    if (tableRes.rowCount === 0) {
      return res.status(404).json({ error: 'Table not found' });
    }

    const table = tableRes.rows[0];

    // If sessionToken is provided, fetch specifically for that diner's session
    if (sessionToken) {
      const sessionRes = await db.query(
        `SELECT id, session_token, session_label, is_active FROM customer_sessions 
         WHERE session_token = $1 AND table_id = $2 AND is_active = true`,
        [sessionToken, tableId]
      );

      if (sessionRes.rowCount > 0) {
        const session = sessionRes.rows[0];

        const activeOrderRes = await db.query(
          `SELECT o.id, o.restaurant_id, o.status, o.subtotal, o.discount_amount, o.coupon_code, o.tax_percentage, o.tax_amount, o.total, o.payment_method, o.notes, o.created_at, o.updated_at,
                  c.name AS customer_name, c.phone AS customer_phone,
                  r.currency
           FROM orders o
           LEFT JOIN customers c ON o.customer_id = c.id
           LEFT JOIN restaurants r ON o.restaurant_id = r.id
           WHERE (o.session_token = $1 OR o.session_id = $2) AND o.status NOT IN ('PAID', 'CANCELLED')
           ORDER BY o.created_at DESC
           LIMIT 1`,
          [sessionToken, session.id]
        );

        if (activeOrderRes.rowCount === 0) {
          return res.json({
            hasActiveSession: false,
            sessionToken: session.session_token,
            sessionLabel: session.session_label,
            table: { id: table.id, number: table.number }
          });
        }

        const order = activeOrderRes.rows[0];
        const itemsRes = await db.query(
          `SELECT oi.id, oi.quantity, oi.price_at_order, oi.status, mi.name AS item_name, mi.category, mi.description
           FROM order_items oi
           JOIN menu_items mi ON oi.menu_item_id = mi.id
           WHERE oi.order_id = $1
           ORDER BY oi.created_at ASC`,
          [order.id]
        );

        const orderPayload = {
          id: order.id,
          orderId: order.id,
          restaurantId: order.restaurant_id,
          status: order.status,
          notes: order.notes,
          currency: order.currency || '₹',
          subtotal: parseFloat(order.subtotal || order.total),
          couponCode: order.coupon_code,
          discountAmount: parseFloat(order.discount_amount || 0),
          taxPercentage: parseFloat(order.tax_percentage || 5.0),
          taxAmount: parseFloat(order.tax_amount || 0),
          total: parseFloat(order.total),
          total_amount: parseFloat(order.total),
          paymentMethod: order.payment_method,
          createdAt: order.created_at,
          customer: {
            name: order.customer_name,
            phone: order.customer_phone
          },
          customer_name: order.customer_name,
          customer_phone: order.customer_phone,
          items: itemsRes.rows.map(it => ({
            ...it,
            name: it.item_name,
            status: it.status || 'PENDING',
            price_at_order: parseFloat(it.price_at_order),
            line_total: parseFloat(it.price_at_order) * it.quantity
          }))
        };

        return res.json({
          hasActiveSession: true,
          sessionToken: session.session_token,
          sessionLabel: session.session_label,
          table: { id: table.id, number: table.number },
          ...orderPayload,
          order: orderPayload
        });
      }
    }

    // Default if no sessionToken provided or session expired:
    // Do NOT return other customers' active orders! Return hasActiveSession: false.
    return res.json({
      hasActiveSession: false,
      table: { id: table.id, number: table.number }
    });
  } catch (err) {
    console.error('Check table session error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// POST /api/order – create a new order (or append to active session if exists)
router.post('/', async (req, res) => {
  const schema = Joi.object({
    restaurantId: Joi.string().uuid().required(),
    tableId: Joi.string().uuid().required(),
    sessionToken: Joi.string().optional().allow(null, ''),
    customer: Joi.object({
      name: Joi.string().required(),
      phone: Joi.string().required(),
      consentGiven: Joi.boolean().required(),
    }).optional(),
    notes: Joi.string().allow('', null).optional(),
    items: Joi.array()
      .items(
        Joi.object({
          menuItemId: Joi.string().uuid().required(),
          quantity: Joi.number().integer().min(1).required(),
        })
      )
      .default([]),
  });
  const { error, value } = schema.validate(req.body);
  if (error) return res.status(400).json({ error: error.details[0].message });

  const { restaurantId, tableId, sessionToken, customer, items, notes } = value;

  try {
    const [restRes, tableRes] = await Promise.all([
      db.query('SELECT id, tax_percentage FROM restaurants WHERE id = $1', [restaurantId]),
      db.query('SELECT id, number FROM tables WHERE id = $1', [tableId]),
    ]);
    if (restRes.rowCount === 0) return res.status(404).json({ error: 'Restaurant not found' });
    if (tableRes.rowCount === 0) return res.status(404).json({ error: 'Table not found' });

    const taxPercentage = restRes.rows[0].tax_percentage != null ? parseFloat(restRes.rows[0].tax_percentage) : 5.0;

    let sessionId = null;
    let sessionTokenVal = sessionToken || null;
    let sessionLabelVal = 'Customer 1';

    if (sessionTokenVal) {
      const sessRes = await db.query(
        `SELECT id, session_token, session_label, is_active FROM customer_sessions 
         WHERE session_token = $1 AND table_id = $2 AND is_active = true`,
        [sessionTokenVal, tableId]
      );
      if (sessRes.rowCount > 0) {
        sessionId = sessRes.rows[0].id;
        sessionLabelVal = sessRes.rows[0].session_label;
      } else {
        const countRes = await db.query(
          `SELECT COUNT(*) FROM customer_sessions WHERE table_id = $1 AND is_active = true`,
          [tableId]
        );
        const activeCount = parseInt(countRes.rows[0].count, 10);
        sessionLabelVal = `Customer ${activeCount + 1}`;
        const newSess = await db.query(
          `INSERT INTO customer_sessions (session_token, table_id, restaurant_id, session_label, is_active)
           VALUES ($1, $2, $3, $4, true) RETURNING id, session_token, session_label`,
          [sessionTokenVal, tableId, restaurantId, sessionLabelVal]
        );
        sessionId = newSess.rows[0].id;
      }
    } else {
      const countRes = await db.query(
        `SELECT COUNT(*) FROM customer_sessions WHERE table_id = $1 AND is_active = true`,
        [tableId]
      );
      const activeCount = parseInt(countRes.rows[0].count, 10);
      sessionLabelVal = `Customer ${activeCount + 1}`;
      sessionTokenVal = `cs_${crypto.randomUUID()}`;
      const newSess = await db.query(
        `INSERT INTO customer_sessions (session_token, table_id, restaurant_id, session_label, is_active)
         VALUES ($1, $2, $3, $4, true) RETURNING id, session_token, session_label`,
        [sessionTokenVal, tableId, restaurantId, sessionLabelVal]
      );
      sessionId = newSess.rows[0].id;
    }

    // Check if there is already an active session order for THIS customer session
    const existingOrderRes = await db.query(
      `SELECT id, status, total FROM orders 
       WHERE (session_token = $1 OR session_id = $2) AND status NOT IN ('PAID', 'CANCELLED')
       ORDER BY created_at DESC LIMIT 1`,
      [sessionTokenVal, sessionId]
    );

    let orderId;
    let isExistingSession = false;

    if (existingOrderRes.rowCount > 0) {
      orderId = existingOrderRes.rows[0].id;
      isExistingSession = true;
      if (notes) {
        await db.query(`UPDATE orders SET notes = COALESCE(notes || '; ', '') || $1 WHERE id = $2`, [notes, orderId]);
      }
      if (items.length > 0) {
        await db.query(
          `UPDATE orders SET status = 'PENDING', updated_at = now() WHERE id = $1`,
          [orderId]
        );
      }
    } else {
      if (!customer) {
        return res.status(400).json({ error: 'Customer details (name, phone, consentGiven) are required for new table order' });
      }
      const customerId = await upsertCustomer(customer);
      await db.query(`UPDATE customer_sessions SET customer_id = $1 WHERE id = $2`, [customerId, sessionId]);

      const orderRes = await db.query(
        `INSERT INTO orders (restaurant_id, table_id, customer_id, session_id, session_token, session_label, status, notes, subtotal, tax_percentage, tax_amount, total)
         VALUES ($1, $2, $3, $4, $5, $6, 'PENDING', $7, 0, $8, 0, 0) RETURNING id, status, created_at`,
        [restaurantId, tableId, customerId, sessionId, sessionTokenVal, sessionLabelVal, notes || null, taxPercentage]
      );
      orderId = orderRes.rows[0].id;
    }

    // Insert items in batch (single roundtrip for prices, concurrent inserts)
    const itemIds = items.map(it => it.menuItemId);
    const menuRes = await db.query(
      'SELECT id, price FROM menu_items WHERE id = ANY($1::uuid[]) AND restaurant_id = $2',
      [itemIds, restaurantId]
    );
    const priceMap = new Map();
    for (const row of menuRes.rows) {
      priceMap.set(row.id, parseFloat(row.price));
    }

    const insertPromises = [];
    for (const it of items) {
      const price = priceMap.get(it.menuItemId);
      if (price === undefined) continue;
      insertPromises.push(
        db.query(
          `INSERT INTO order_items (order_id, menu_item_id, quantity, price_at_order, status)
           VALUES ($1, $2, $3, $4, 'PENDING')`,
          [orderId, it.menuItemId, it.quantity, price]
        )
      );
    }
    await Promise.all(insertPromises);

    // Recalculate subtotal, tax, and total
    const totals = await recalculateOrderTotals(orderId, restaurantId);

    // Emit realtime event to kitchen & table rooms
    try {
      const io = getIO();
      const eventName = isExistingSession ? 'order:items_added' : 'order:new';
      const eventPayload = {
        orderId,
        id: orderId,
        order_id: orderId,
        tableId,
        table_id: tableId,
        table_number: tableRes.rows[0].number,
        session_token: sessionTokenVal,
        session_label: sessionLabelVal,
        customer_name: customer?.name || 'Diner',
        status: 'PENDING',
        subtotal: totals.subtotal,
        taxPercentage: totals.taxPercentage,
        taxAmount: totals.taxAmount,
        total: totals.grandTotal,
        notes: notes || null,
        isExistingSession,
        playChime: true
      };
      io.emit(eventName, eventPayload);
      io.emit('kitchen:ticket_updated', eventPayload);
      io.emit('order:new', eventPayload);
      io.emit('order:status_updated', { orderId, tableId, status: 'PENDING', sessionLabel: sessionLabelVal });
      io.to(`table_${tableId}`).emit('order:update', { orderId, status: 'PENDING', total: totals.grandTotal, sessionLabel: sessionLabelVal });
      io.to(`session_${sessionTokenVal}`).emit('order:update', { orderId, status: 'PENDING', total: totals.grandTotal, sessionLabel: sessionLabelVal });
    } catch (e) {
      console.warn('Socket.IO emit warning:', e.message);
    }

    res.status(201).json({
      orderId,
      sessionToken: sessionTokenVal,
      sessionLabel: sessionLabelVal,
      tableNumber: tableRes.rows[0].number,
      status: 'PENDING',
      subtotal: totals.subtotal,
      taxPercentage: totals.taxPercentage,
      taxAmount: totals.taxAmount,
      total: totals.grandTotal,
      currency: totals.currency,
      isExistingSession
    });
  } catch (err) {
    console.error('Create order error:', err);
    if (err.message === 'GDPR consent not given') {
      return res.status(400).json({ error: 'GDPR consent required before storing phone number' });
    }
    res.status(500).json({ error: 'Database error' });
  }
});

// POST /api/order/:id/items – add more items to an existing order (re-scan flow)
router.post('/:id/items', async (req, res) => {
  const { id: orderId } = req.params;
  const schema = Joi.object({
    items: Joi.array()
      .items(
        Joi.object({
          menuItemId: Joi.string().uuid().required(),
          quantity: Joi.number().integer().min(1).required(),
        })
      )
      .min(1)
      .required(),
  });

  const { error, value } = schema.validate(req.body);
  if (error) return res.status(400).json({ error: error.details[0].message });

  try {
    const orderRes = await db.query('SELECT * FROM orders WHERE id = $1', [orderId]);
    if (orderRes.rowCount === 0) return res.status(404).json({ error: 'Order not found' });

    const order = orderRes.rows[0];
    if (['PAID', 'CANCELLED'].includes(order.status)) {
      return res.status(400).json({ error: `Cannot add items to an order with status: ${order.status}` });
    }

    const { items } = value;
    const addedItems = [];

    // Batch query all item names and prices in 1 roundtrip
    const itemIds = items.map(it => it.menuItemId);
    const menuRes = await db.query(
      'SELECT id, name, price FROM menu_items WHERE id = ANY($1::uuid[]) AND restaurant_id = $2',
      [itemIds, order.restaurant_id]
    );
    const menuMap = new Map();
    for (const row of menuRes.rows) {
      menuMap.set(row.id, { name: row.name, price: parseFloat(row.price) });
    }

    const insertPromises = [];
    for (const it of items) {
      const itemInfo = menuMap.get(it.menuItemId);
      if (!itemInfo) continue;
      insertPromises.push(
        db.query(
          `INSERT INTO order_items (order_id, menu_item_id, quantity, price_at_order, status)
           VALUES ($1, $2, $3, $4, 'PENDING')`,
          [orderId, it.menuItemId, it.quantity, itemInfo.price]
        )
      );
      addedItems.push({
        menuItemId: it.menuItemId,
        name: itemInfo.name,
        quantity: it.quantity,
        price: itemInfo.price
      });
    }
    await Promise.all(insertPromises);

    // When new items are appended, set status to PENDING so the kitchen knows new dishes need cooking!
    await db.query(
      `UPDATE orders SET status = 'PENDING', updated_at = now() WHERE id = $1`,
      [orderId]
    );

    // Recompute subtotal, tax and total
    const totals = await recalculateOrderTotals(orderId, order.restaurant_id);

    // Emit realtime event
    try {
      const io = getIO();
      const payload = {
        orderId,
        tableId: order.table_id,
        session_token: order.session_token,
        session_label: order.session_label,
        status: 'PENDING',
        addedItems,
        total: totals.grandTotal,
        subtotal: totals.subtotal,
        taxAmount: totals.taxAmount,
        playChime: true
      };
      io.emit('order:items_added', payload);
      io.emit('kitchen:ticket_updated', payload);
      io.emit('order:new', {
        id: orderId,
        order_id: orderId,
        table_id: order.table_id,
        session_token: order.session_token,
        session_label: order.session_label,
        restaurant_id: order.restaurant_id,
        status: 'PENDING',
        total: totals.grandTotal,
        items: addedItems
      });
      io.emit('order:status_updated', { orderId, tableId: order.table_id, status: 'PENDING', sessionLabel: order.session_label });
      io.to(`table_${order.table_id}`).emit('order:update', { orderId, status: 'PENDING', total: totals.grandTotal, sessionLabel: order.session_label });
      if (order.session_token) {
        io.to(`session_${order.session_token}`).emit('order:update', { orderId, status: 'PENDING', total: totals.grandTotal, sessionLabel: order.session_label });
      }
    } catch (e) {
      console.warn('Socket.IO emit warning:', e.message);
    }

    res.json({
      message: 'Items added successfully',
      orderId,
      tableId: order.table_id,
      sessionToken: order.session_token,
      sessionLabel: order.session_label,
      status: 'PENDING',
      subtotal: totals.subtotal,
      taxPercentage: totals.taxPercentage,
      taxAmount: totals.taxAmount,
      total: totals.grandTotal,
      currency: totals.currency,
      addedItems
    });
  } catch (err) {
    console.error('Add items error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// DELETE /api/order/:id/items/:itemId – remove/cancel dish before cooking starts
router.delete('/:id/items/:itemId', async (req, res) => {
  const { id: orderId, itemId } = req.params;
  const sessionToken = req.body?.sessionToken || req.query.sessionToken || req.headers['x-session-token'];

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(orderId) || !uuidRegex.test(itemId)) {
    return res.status(400).json({ error: 'Invalid order or item identifier' });
  }

  try {
    const orderRes = await db.query('SELECT * FROM orders WHERE id = $1', [orderId]);
    if (orderRes.rowCount === 0) return res.status(404).json({ error: 'Order not found' });

    const order = orderRes.rows[0];

    // Session authorization check: ensure caller owns this order
    if (order.session_token) {
      if (!sessionToken || order.session_token !== sessionToken) {
        return res.status(403).json({ error: 'Forbidden: You cannot modify another customer\'s order items.' });
      }
    }

    // Check if entire order or dish is already cooking/preparing
    const cookingStatuses = ['preparing', 'PREPARING', 'ready', 'READY', 'completed', 'COMPLETED', 'delivered', 'DELIVERED', 'served', 'SERVED'];
    if (order.status && cookingStatuses.includes(order.status)) {
      return res.status(400).json({
        error: `Cannot cancel items while order is ${order.status.toLowerCase()}. Only items in pending orders can be cancelled.`
      });
    }

    // Check specific dish status
    const itemRes = await db.query('SELECT * FROM order_items WHERE id = $1 AND order_id = $2', [itemId, orderId]);
    if (itemRes.rowCount === 0) return res.status(404).json({ error: 'Item not found in this order' });

    const item = itemRes.rows[0];

    // Only dishes awaiting cooking (PENDING) can be cancelled/removed!
    if (item.status && item.status !== 'PENDING') {
      return res.status(400).json({
        error: `Cannot remove this dish because it is already ${item.status.toLowerCase()}. Only items awaiting cooking can be cancelled.`
      });
    }

    // Delete the order item
    const deleteRes = await db.query(
      'DELETE FROM order_items WHERE id = $1 AND order_id = $2 RETURNING *',
      [itemId, orderId]
    );

    if (deleteRes.rowCount === 0) {
      return res.status(404).json({ error: 'Item not found in this order' });
    }

    // Check if any items remain in order
    const remainingRes = await db.query('SELECT COUNT(*) FROM order_items WHERE order_id = $1', [orderId]);
    const remainingCount = parseInt(remainingRes.rows[0].count, 10);

    if (remainingCount === 0) {
      // If all items removed, mark THIS customer's order CANCELLED
      await db.query(`UPDATE orders SET status = 'CANCELLED', updated_at = now() WHERE id = $1`, [orderId]);
      if (order.session_token) {
        await db.query(`UPDATE customer_sessions SET is_active = false WHERE session_token = $1`, [order.session_token]);
      }

      // Check if table has other active customer sessions
      const tableActiveRes = await db.query(
        `SELECT COUNT(*) FROM orders WHERE table_id = $1 AND status NOT IN ('PAID', 'CANCELLED')`,
        [order.table_id]
      );
      const otherActiveOrders = parseInt(tableActiveRes.rows[0].count, 10);

      try {
        const io = getIO();
        io.emit('order:cancelled', { orderId, tableId: order.table_id, sessionToken: order.session_token });
        if (order.session_token) {
          io.to(`session_${order.session_token}`).emit('session:ended', { orderId, message: 'Your order was cancelled' });
        }
        if (otherActiveOrders === 0) {
          io.to(`table_${order.table_id}`).emit('table:all_sessions_cleared', { tableId: order.table_id });
        }
      } catch (e) {}

      return res.json({
        message: 'Order cancelled as all items were removed',
        cancelled: true,
        orderId,
        tableId: order.table_id,
        sessionToken: order.session_token
      });
    }

    // Recompute subtotal, tax and total
    const totals = await recalculateOrderTotals(orderId, order.restaurant_id);

    try {
      const io = getIO();
      const updatePayload = {
        orderId,
        tableId: order.table_id,
        session_token: order.session_token,
        session_label: order.session_label,
        total: totals.grandTotal,
        subtotal: totals.subtotal,
        taxAmount: totals.taxAmount
      };
      io.emit('order:items_added', updatePayload);
      io.emit('kitchen:ticket_updated', updatePayload);
      io.to(`table_${order.table_id}`).emit('order:update', updatePayload);
      if (order.session_token) {
        io.to(`session_${order.session_token}`).emit('order:update', updatePayload);
      }
    } catch (e) {}

    res.json({
      message: 'Item removed successfully',
      orderId,
      sessionToken: order.session_token,
      sessionLabel: order.session_label,
      subtotal: totals.subtotal,
      taxAmount: totals.taxAmount,
      total: totals.grandTotal,
      currency: totals.currency
    });
  } catch (err) {
    console.error('Delete order item error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// PUT /api/order/:id/notes – update chef notes before preparation starts
router.put('/:id/notes', async (req, res) => {
  const { id: orderId } = req.params;
  const { notes } = req.body;

  try {
    const orderRes = await db.query('SELECT * FROM orders WHERE id = $1', [orderId]);
    if (orderRes.rowCount === 0) return res.status(404).json({ error: 'Order not found' });

    const order = orderRes.rows[0];

    // Editable ONLY before preparation starts!
    if (order.status !== 'PENDING') {
      return res.status(400).json({
        error: `Cannot modify chef notes after preparation has started (current status: ${order.status}).`
      });
    }

    await db.query('UPDATE orders SET notes = $1, updated_at = now() WHERE id = $2', [notes || '', orderId]);

    try {
      const io = getIO();
      io.emit('kitchen:ticket_updated', { orderId, tableId: order.table_id, notes });
    } catch (e) {}

    res.json({ message: 'Chef notes updated successfully', notes });
  } catch (err) {
    console.error('Update notes error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// PUT /api/order/:id/dismiss – dismiss/settle single customer's order (individual diner bill)
router.put('/:id/dismiss', async (req, res) => {
  const { id: orderId } = req.params;
  const schema = Joi.object({
    paymentMethod: Joi.string().valid('CASH', 'UPI', 'CARD', 'ONLINE'),
    payment_method: Joi.string().valid('CASH', 'UPI', 'CARD', 'ONLINE')
  });
  const { value } = schema.validate(req.body || {});
  const paymentMethod = (value && (value.paymentMethod || value.payment_method)) || 'CASH';

  try {
    const result = await db.query(
      `UPDATE orders 
       SET status = 'PAID', payment_method = $1, updated_at = now() 
       WHERE id = $2 
       RETURNING id, table_id, session_token, session_label, subtotal, tax_percentage, tax_amount, total, payment_method, status`,
      [paymentMethod, orderId]
    );

    if (result.rowCount === 0) return res.status(404).json({ error: 'Order not found' });

    const order = result.rows[0];

    // Deactivate THIS customer's session
    if (order.session_token) {
      await db.query(
        `UPDATE customer_sessions SET is_active = false, last_active = now() WHERE session_token = $1`,
        [order.session_token]
      );
    }

    // Check if other diners at this table still have active orders
    const remainingRes = await db.query(
      `SELECT COUNT(*) FROM orders WHERE table_id = $1 AND status NOT IN ('PAID', 'CANCELLED')`,
      [order.table_id]
    );
    const remainingCount = parseInt(remainingRes.rows[0].count, 10);

    // Emit realtime event to notify table and cashier
    try {
      const io = getIO();
      io.emit('order:dismissed', {
        orderId,
        tableId: order.table_id,
        sessionToken: order.session_token,
        sessionLabel: order.session_label,
        paymentMethod,
        status: 'PAID'
      });

      if (order.session_token) {
        io.to(`session_${order.session_token}`).emit('session:ended', {
          orderId,
          message: 'Your individual bill has been settled. Thank you!'
        });
      }

      if (remainingCount === 0) {
        io.to(`table_${order.table_id}`).emit('table:all_sessions_cleared', { tableId: order.table_id });
      }
    } catch (e) {
      console.warn('Socket.IO emit warning:', e.message);
    }

    res.json({
      message: `Order for ${order.session_label || 'Customer'} marked as PAID.`,
      order: {
        ...order,
        remainingActiveTableOrders: remainingCount,
        subtotal: parseFloat(order.subtotal),
        tax_amount: parseFloat(order.tax_amount),
        total: parseFloat(order.total)
      }
    });
  } catch (err) {
    console.error('Dismiss order error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// PUT /api/order/table/:tableId/settle-all – settle entire table in one click with combined bill
router.put('/table/:tableId/settle-all', async (req, res) => {
  const { tableId } = req.params;
  const schema = Joi.object({
    paymentMethod: Joi.string().valid('CASH', 'UPI', 'CARD', 'ONLINE'),
    payment_method: Joi.string().valid('CASH', 'UPI', 'CARD', 'ONLINE')
  });
  const { value } = schema.validate(req.body || {});
  const paymentMethod = (value && (value.paymentMethod || value.payment_method)) || 'CASH';

  try {
    const activeOrdersRes = await db.query(
      `SELECT o.id, o.session_token, o.session_label, o.subtotal, o.tax_amount, o.total, t.number AS table_number
       FROM orders o
       JOIN tables t ON o.table_id = t.id
       WHERE o.table_id = $1 AND o.status NOT IN ('PAID', 'CANCELLED')`,
      [tableId]
    );

    if (activeOrdersRes.rowCount === 0) {
      return res.status(400).json({ error: 'No active unsettled orders found for this table' });
    }

    const activeOrders = activeOrdersRes.rows;
    const orderIds = activeOrders.map(o => o.id);
    const tableNumber = activeOrders[0].table_number;

    let combinedSubtotal = 0;
    let combinedTax = 0;
    let combinedTotal = 0;

    for (const ord of activeOrders) {
      combinedSubtotal += parseFloat(ord.subtotal || 0);
      combinedTax += parseFloat(ord.tax_amount || 0);
      combinedTotal += parseFloat(ord.total || 0);
    }

    // Mark all orders as PAID
    await db.query(
      `UPDATE orders SET status = 'PAID', payment_method = $1, updated_at = now() WHERE id = ANY($2::uuid[])`,
      [paymentMethod, orderIds]
    );

    // Deactivate all customer sessions for this table
    await db.query(
      `UPDATE customer_sessions SET is_active = false, last_active = now() WHERE table_id = $1`,
      [tableId]
    );

    // Emit real-time events to all sessions and table
    try {
      const io = getIO();
      io.emit('table:settled_all', {
        tableId,
        tableNumber,
        paymentMethod,
        combinedTotal: Math.round(combinedTotal * 100) / 100,
        settledOrdersCount: orderIds.length,
        orderIds
      });

      for (const ord of activeOrders) {
        if (ord.session_token) {
          io.to(`session_${ord.session_token}`).emit('session:ended', {
            orderId: ord.id,
            message: `Entire Table ${tableNumber} bill settled together. Thank you!`
          });
        }
      }

      io.to(`table_${tableId}`).emit('table:all_sessions_cleared', { tableId });
    } catch (e) {
      console.warn('Socket.IO emit warning:', e.message);
    }

    res.json({
      message: `Table ${tableNumber} settled completely (${orderIds.length} customer sessions).`,
      tableId,
      tableNumber,
      paymentMethod,
      settledOrdersCount: orderIds.length,
      combinedSubtotal: Math.round(combinedSubtotal * 100) / 100,
      combinedTax: Math.round(combinedTax * 100) / 100,
      combinedTotal: Math.round(combinedTotal * 100) / 100,
      orderIds
    });
  } catch (err) {
    console.error('Settle all table orders error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// GET /api/order/upi-info – returns UPI ID and Payee Name for a table or restaurant
router.get('/upi-info', async (req, res) => {
  const { tableId, restaurantId } = req.query;
  try {
    let result;
    if (tableId) {
      result = await db.query(
        `SELECT r.id, r.name, r.upi_id, r.upi_name, t.number AS table_number
         FROM tables t
         JOIN restaurants r ON t.restaurant_id = r.id
         WHERE t.id = $1`,
        [tableId]
      );
    } else if (restaurantId) {
      result = await db.query(
        `SELECT id, name, upi_id, upi_name FROM restaurants WHERE id = $1`,
        [restaurantId]
      );
    } else {
      result = await db.query(
        `SELECT id, name, upi_id, upi_name FROM restaurants LIMIT 1`
      );
    }

    if (result.rowCount === 0) {
      return res.json({
        upiId: 'vallipriya1212-1@oksbi',
        upiName: 'Royal Spice Bistro',
        restaurantName: 'Royal Spice Bistro',
        tableNumber: null
      });
    }

    const row = result.rows[0];
    res.json({
      upiId: row.upi_id || 'vallipriya1212-1@oksbi',
      upiName: row.upi_name || 'Royal Spice Bistro',
      restaurantName: row.name || 'Royal Spice Bistro',
      tableNumber: row.table_number || null,
      restaurantId: row.id
    });
  } catch (err) {
    console.error('Fetch UPI info error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// POST /api/order/upi/notify – customer submits UPI payment notification with UTR
router.post('/upi/notify', async (req, res) => {
  const schema = Joi.object({
    tableId: Joi.string().uuid().required(),
    tableNumber: Joi.alternatives().try(Joi.number(), Joi.string()).optional(),
    orderId: Joi.string().uuid().optional().allow(null, ''),
    sessionToken: Joi.string().optional().allow(null, ''),
    customerName: Joi.string().optional().allow(null, ''),
    amount: Joi.number().precision(2).positive().required(),
    utr: Joi.string().max(64).optional().allow(null, ''),
    upiId: Joi.string().optional().allow(null, '')
  });

  const { error, value } = schema.validate(req.body);
  if (error) return res.status(400).json({ error: error.details[0].message });

  const { tableId, tableNumber, orderId, sessionToken, customerName, amount, utr, upiId } = value;

  try {
    if (orderId) {
      await db.query(
        `UPDATE orders SET payment_method = 'UPI', updated_at = now() WHERE id = $1`,
        [orderId]
      );
    }

    let resolvedTableNumber = tableNumber;
    if (!resolvedTableNumber) {
      const tblRes = await db.query(`SELECT number FROM tables WHERE id = $1`, [tableId]);
      if (tblRes.rowCount > 0) {
        resolvedTableNumber = tblRes.rows[0].number;
      }
    }

    const notificationPayload = {
      id: crypto.randomUUID(),
      tableId,
      tableNumber: resolvedTableNumber || 1,
      orderId: orderId || null,
      sessionToken: sessionToken || null,
      customerName: customerName || 'Diner',
      amount: parseFloat(amount),
      utr: utr ? String(utr).trim() : null,
      upiId: upiId || 'vallipriya1212-1@oksbi',
      timestamp: new Date().toISOString()
    };

    try {
      const io = getIO();
      io.emit('upi:payment_submitted', notificationPayload);
      io.to(`table_${tableId}`).emit('table:upi_payment_submitted', notificationPayload);
    } catch (e) {
      console.warn('Socket emit warning on UPI submit:', e.message);
    }

    res.json({
      success: true,
      message: 'UPI payment submitted. Cashier has received the alert.',
      payment: notificationPayload
    });
  } catch (err) {
    console.error('UPI payment submit error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// PUT /api/order/:id/status – update order status (kitchen uses this)
router.put('/:id/status', async (req, res) => {
  const schema = Joi.object({
    status: Joi.string().valid('PENDING', 'PREPARING', 'READY', 'SERVED', 'PAID', 'CANCELLED').required(),
  });
  const { error, value } = schema.validate(req.body);
  if (error) return res.status(400).json({ error: error.details[0].message });
  const { status } = value;
  const { id } = req.params;

  try {
    const result = await db.query('UPDATE orders SET status = $1, updated_at = now() WHERE id = $2 RETURNING table_id, total', [status, id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Order not found' });
    const { table_id: tableId, total } = result.rows[0];
    try {
      const io = getIO();
      io.emit('order:status', { orderId: id, status, total });
      io.to(`table_${tableId}`).emit('order:update', { orderId: id, status, total });
    } catch (e) {
      console.warn('Socket.IO emit warning:', e.message);
    }
    res.json({ orderId: id, status, total: parseFloat(total) });
  } catch (err) {
    console.error('Update status error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// GET /api/order/:id – fetch order details (including items)
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    return res.status(404).json({ error: 'Order not found' });
  }
  try {
    const orderRes = await db.query('SELECT * FROM orders WHERE id = $1', [id]);
    if (orderRes.rowCount === 0) return res.status(404).json({ error: 'Order not found' });
    const order = orderRes.rows[0];
    const itemsRes = await db.query(
      `SELECT oi.id, oi.menu_item_id, oi.quantity, oi.price_at_order, oi.status, mi.name, mi.category, mi.description
       FROM order_items oi
       JOIN menu_items mi ON oi.menu_item_id = mi.id
       WHERE oi.order_id = $1`,
      [id]
    );
    order.items = itemsRes.rows.map(it => ({
      ...it,
      price_at_order: parseFloat(it.price_at_order),
      line_total: parseFloat(it.price_at_order) * it.quantity
    }));
    order.subtotal = parseFloat(order.subtotal || order.total);
    order.tax_amount = parseFloat(order.tax_amount || 0);
    order.total = parseFloat(order.total);
    res.json(order);
  } catch (err) {
    console.error('Get order error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// POST /api/order/:id/feedback – customer submits 1-5 star review after meal
router.post('/:id/feedback', async (req, res) => {
  const { id: orderId } = req.params;
  const schema = Joi.object({
    rating: Joi.number().integer().min(1).max(5).required(),
    comments: Joi.string().allow('', null).optional(),
    tags: Joi.array().items(Joi.string()).optional(),
    orderId: Joi.string().optional().allow(null, ''),
    tableId: Joi.string().optional().allow(null, ''),
    restaurantId: Joi.string().optional().allow(null, ''),
  }).unknown(true);

  const { error, value } = schema.validate(req.body);
  if (error) return res.status(400).json({ error: error.details[0].message });

  const { rating, comments, tags } = value;

  try {
    const orderRes = await db.query('SELECT id, restaurant_id, table_id, customer_id, total FROM orders WHERE id = $1', [orderId]);
    let effectiveOrderId = orderId;
    let restaurantId = value.restaurantId || 'db4ed920-3d20-420a-9f54-99d3c0b48a08';
    let tableId = value.tableId || null;

    if (orderRes.rowCount > 0) {
      const order = orderRes.rows[0];
      restaurantId = order.restaurant_id;
      tableId = order.table_id;
    } else {
      effectiveOrderId = null; // Order was settled or deleted; still save review safely without FK error
    }

    let fullComments = (comments || '').trim();
    if (tags && tags.length > 0) {
      const tagPrefix = `[${rating >= 4 ? 'Praises' : 'Notices'}: ${tags.join(', ')}] `;
      fullComments = tagPrefix + fullComments;
    }

    // Insert feedback
    const feedbackRes = await db.query(
      `INSERT INTO order_feedback (order_id, restaurant_id, rating, comments)
       VALUES ($1, $2, $3, $4)
       RETURNING id, rating, comments, created_at`,
      [effectiveOrderId, restaurantId, rating, fullComments || null]
    );

    const feedback = feedbackRes.rows[0];

    // Emit real-time feedback alert to admin dashboard
    try {
      const io = getIO();
      io.emit('feedback:new', {
        orderId: effectiveOrderId,
        tableId,
        rating,
        comments: fullComments,
        tags: tags || [],
        isCritical: rating <= 3,
        isGood: rating >= 4
      });
    } catch (e) {
      console.warn('Socket emit warning:', e.message);
    }

    res.status(201).json({
      message: 'Thank you for your valuable feedback!',
      feedback
    });
  } catch (err) {
    console.error('Submit feedback error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Resilient fallback: customer submits feedback even if orderId was settled/cleared
router.post('/feedback/submit', async (req, res) => {
  const schema = Joi.object({
    orderId: Joi.string().uuid().optional().allow(null, ''),
    tableId: Joi.string().uuid().optional().allow(null, ''),
    restaurantId: Joi.string().uuid().optional().allow(null, ''),
    rating: Joi.number().integer().min(1).max(5).required(),
    comments: Joi.string().allow('', null).optional(),
    tags: Joi.array().items(Joi.string()).optional(),
  });

  const { error, value } = schema.validate(req.body);
  if (error) return res.status(400).json({ error: error.details[0].message });

  let { orderId, tableId, restaurantId, rating, comments, tags } = value;

  try {
    let effectiveRestaurantId = restaurantId;
    let effectiveOrderId = orderId;

    if (effectiveOrderId) {
      const oRes = await db.query('SELECT restaurant_id, table_id FROM orders WHERE id = $1', [effectiveOrderId]);
      if (oRes.rowCount > 0) {
        effectiveRestaurantId = oRes.rows[0].restaurant_id;
        if (!tableId) tableId = oRes.rows[0].table_id;
      } else {
        effectiveOrderId = null; // Stale or invalid orderId - fallback safely to null so FK doesn't fail
      }
    } else if (tableId) {
      const latestOrderRes = await db.query(
        'SELECT id, restaurant_id FROM orders WHERE table_id = $1 ORDER BY created_at DESC LIMIT 1',
        [tableId]
      );
      if (latestOrderRes.rowCount > 0) {
        effectiveOrderId = latestOrderRes.rows[0].id;
        effectiveRestaurantId = latestOrderRes.rows[0].restaurant_id;
      }
    }

    if (!effectiveRestaurantId) {
      effectiveRestaurantId = 'db4ed920-3d20-420a-9f54-99d3c0b48a08';
    }

    let fullComments = (comments || '').trim();
    if (tags && tags.length > 0) {
      const tagPrefix = `[${rating >= 4 ? 'Praises' : 'Notices'}: ${tags.join(', ')}] `;
      fullComments = tagPrefix + fullComments;
    }

    const feedbackRes = await db.query(
      `INSERT INTO order_feedback (order_id, restaurant_id, rating, comments)
       VALUES ($1, $2, $3, $4)
       RETURNING id, rating, comments, created_at`,
      [effectiveOrderId || null, effectiveRestaurantId, rating, fullComments || null]
    );

    const feedback = feedbackRes.rows[0];

    try {
      const io = getIO();
      io.emit('feedback:new', {
        orderId: effectiveOrderId,
        tableId,
        rating,
        comments: fullComments,
        tags: tags || [],
        isCritical: rating <= 3,
        isGood: rating >= 4
      });
    } catch (e) {}

    res.status(201).json({
      message: 'Thank you for your valuable feedback!',
      feedback
    });
  } catch (err) {
    console.error('Submit fallback feedback error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// POST /api/order/table/:tableId/call-waiter – customer calls waiter / requests assistance
router.post('/table/:tableId/call-waiter', async (req, res) => {
  const { tableId } = req.params;
  const schema = Joi.object({
    requestType: Joi.string()
      .valid('CALL_WAITER', 'WATER', 'BILL', 'CUTLERY', 'CLEAN_TABLE', 'CUSTOM')
      .optional(),
    request_type: Joi.string()
      .valid('CALL_WAITER', 'WATER', 'BILL', 'CUTLERY', 'CLEAN_TABLE', 'CUSTOM')
      .optional(),
    note: Joi.string().allow('', null).optional(),
    sessionToken: Joi.string().allow('', null).optional(),
    sessionLabel: Joi.string().allow('', null).optional(),
    customerName: Joi.string().allow('', null).optional()
  });

  const { error, value } = schema.validate(req.body || {});
  if (error) return res.status(400).json({ error: error.details[0].message });

  const requestType = value.requestType || value.request_type || 'CALL_WAITER';
  const note = value.note || '';
  const sessionToken = value.sessionToken || req.headers['x-session-token'] || null;
  let sessionLabel = value.sessionLabel || null;
  let customerName = value.customerName || null;

  try {
    const tableRes = await db.query('SELECT id, number, restaurant_id FROM tables WHERE id = $1', [tableId]);
    if (tableRes.rowCount === 0) return res.status(404).json({ error: 'Table not found' });

    const table = tableRes.rows[0];

    // If sessionToken is supplied but no label, lookup session details
    if (sessionToken && !sessionLabel) {
      const sessRes = await db.query(
        `SELECT cs.session_label, c.name AS customer_name
         FROM customer_sessions cs
         LEFT JOIN customers c ON cs.customer_id = c.id
         WHERE cs.session_token = $1`,
        [sessionToken]
      );
      if (sessRes.rowCount > 0) {
        sessionLabel = sessRes.rows[0].session_label;
        if (!customerName && sessRes.rows[0].customer_name) {
          customerName = sessRes.rows[0].customer_name;
        }
      }
    }

    const insertRes = await db.query(
      `INSERT INTO service_requests (restaurant_id, table_id, session_token, session_label, customer_name, request_type, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'PENDING')
       RETURNING id, session_token, session_label, customer_name, request_type, status, created_at`,
      [table.restaurant_id, table.id, sessionToken, sessionLabel, customerName, note ? `${requestType}: ${note}` : requestType]
    );

    const serviceRequest = insertRes.rows[0];

    // Emit real-time notification to waiter / captain / cashier
    try {
      const io = getIO();
      const payload = {
        requestId: serviceRequest.id,
        id: serviceRequest.id,
        tableId: table.id,
        table_id: table.id,
        tableNumber: table.number,
        table_number: table.number,
        sessionToken,
        session_token: sessionToken,
        sessionLabel: sessionLabel || 'Customer',
        session_label: sessionLabel || 'Customer',
        customerName: customerName || null,
        customer_name: customerName || null,
        requestType: serviceRequest.request_type,
        request_type: serviceRequest.request_type,
        note,
        status: 'PENDING',
        createdAt: serviceRequest.created_at,
        created_at: serviceRequest.created_at,
        playChime: true
      };
      io.emit('waiter:call', payload);
      io.emit('service:requested', payload);
    } catch (e) {
      console.warn('Socket emit warning:', e.message);
    }

    res.status(201).json({
      message: `Waiter notified for Table ${table.number} (${sessionLabel || 'Customer'}). Someone will assist you shortly!`,
      request: {
        ...serviceRequest,
        tableNumber: table.number,
        sessionLabel: sessionLabel || 'Customer',
        customerName
      }
    });
  } catch (err) {
    console.error('Call waiter error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// POST /api/order/:id/apply-coupon – apply promo discount code to order
router.post('/:id/apply-coupon', async (req, res) => {
  const { id: orderId } = req.params;
  const schema = Joi.object({
    code: Joi.string().trim().uppercase().required()
  });

  const { error, value } = schema.validate(req.body);
  if (error) return res.status(400).json({ error: error.details[0].message });

  const { code } = value;

  try {
    const orderRes = await db.query('SELECT id, restaurant_id, status, subtotal FROM orders WHERE id = $1', [orderId]);
    if (orderRes.rowCount === 0) return res.status(404).json({ error: 'Order not found' });

    const order = orderRes.rows[0];
    if (['PAID', 'CANCELLED'].includes(order.status)) {
      return res.status(400).json({ error: `Cannot apply coupon to an order with status: ${order.status}` });
    }

    // Verify coupon in database
    const couponRes = await db.query(
      `SELECT * FROM coupons 
       WHERE restaurant_id = $1 AND code = $2 AND is_active = true 
       AND (valid_until IS NULL OR valid_until >= now())`,
      [order.restaurant_id, code]
    );

    if (couponRes.rowCount === 0) {
      return res.status(400).json({ error: 'Invalid or expired coupon code' });
    }

    const coupon = couponRes.rows[0];
    const subtotal = parseFloat(order.subtotal);
    const minOrder = parseFloat(coupon.min_order_amount || 0);

    if (subtotal < minOrder) {
      return res.status(400).json({
        error: `Minimum order amount of ${minOrder} required to apply coupon '${code}'`
      });
    }

    // Attach coupon code and recalculate
    await db.query('UPDATE orders SET coupon_code = $1 WHERE id = $2', [code, orderId]);
    const totals = await recalculateOrderTotals(orderId, order.restaurant_id);

    res.json({
      message: `Coupon '${code}' applied successfully!`,
      coupon: {
        code: coupon.code,
        discountType: coupon.discount_type,
        discountValue: parseFloat(coupon.discount_value)
      },
      bill: totals
    });
  } catch (err) {
    console.error('Apply coupon error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// DELETE /api/order/:id/remove-coupon – remove promo coupon from order
router.delete('/:id/remove-coupon', async (req, res) => {
  const { id: orderId } = req.params;

  try {
    const orderRes = await db.query('SELECT id, restaurant_id, status FROM orders WHERE id = $1', [orderId]);
    if (orderRes.rowCount === 0) return res.status(404).json({ error: 'Order not found' });

    const order = orderRes.rows[0];
    await db.query('UPDATE orders SET coupon_code = NULL, discount_amount = 0 WHERE id = $1', [orderId]);
    const totals = await recalculateOrderTotals(orderId, order.restaurant_id);

    res.json({
      message: 'Coupon removed successfully',
      bill: totals
    });
  } catch (err) {
    console.error('Remove coupon error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// GET /api/order/:id/split – calculate equal bill split for table diners
router.get('/:id/split', async (req, res) => {
  const { id: orderId } = req.params;
  const ways = parseInt(req.query.ways, 10) || 2;

  if (ways < 2 || ways > 20) {
    return res.status(400).json({ error: 'Bill can be split between 2 and 20 ways' });
  }

  try {
    const orderRes = await db.query(
      `SELECT o.id, o.table_id, o.subtotal, o.discount_amount, o.coupon_code, o.tax_percentage, o.tax_amount, o.total,
              r.currency, t.number AS table_number
       FROM orders o
       JOIN restaurants r ON o.restaurant_id = r.id
       LEFT JOIN tables t ON o.table_id = t.id
       WHERE o.id = $1`,
      [orderId]
    );

    if (orderRes.rowCount === 0) return res.status(404).json({ error: 'Order not found' });

    const order = orderRes.rows[0];
    const totalAmount = parseFloat(order.total);
    const currency = order.currency || '₹';

    // Split total equally in cents/paise to guarantee sum == total
    const totalCents = Math.round(totalAmount * 100);
    const baseShareCents = Math.floor(totalCents / ways);
    const remainderCents = totalCents % ways;

    const shares = [];
    for (let i = 0; i < ways; i++) {
      const shareCents = baseShareCents + (i < remainderCents ? 1 : 0);
      shares.push({
        person: i + 1,
        amount: parseFloat((shareCents / 100).toFixed(2))
      });
    }

    res.json({
      orderId,
      tableNumber: order.table_number,
      currency,
      totalAmount,
      subtotal: parseFloat(order.subtotal),
      discountAmount: parseFloat(order.discount_amount),
      taxAmount: parseFloat(order.tax_amount),
      splitWays: ways,
      perPersonAmount: shares[0].amount,
      shares
    });
  } catch (err) {
    console.error('Split bill error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
