// Staff Waiter POS & Instant Billing Router for Cloudflare Workers & D1
import { Hono } from 'hono';

const pos = new Hono();

function generateUUID() {
  return crypto.randomUUID();
}

// Helper: Guarantee a collision-free unique bill number in bills_archive
async function ensureUniqueBillNumber(db, baseNumber) {
  const existing = await db.prepare('SELECT id FROM bills_archive WHERE bill_number = ?').bind(baseNumber).first();
  if (!existing) return baseNumber;
  for (let round = 2; round <= 50; round++) {
    const candidate = `${baseNumber}-R${round}`;
    const check = await db.prepare('SELECT id FROM bills_archive WHERE bill_number = ?').bind(candidate).first();
    if (!check) return candidate;
  }
  return `${baseNumber}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function toUtcIso(dateStr) {
  if (!dateStr) return new Date().toISOString();
  if (dateStr.includes('T')) return dateStr.endsWith('Z') ? dateStr : `${dateStr}Z`;
  return `${dateStr.replace(' ', 'T')}Z`;
}

// Format IST Date & Time
function formatIstDateTime(dateInput) {
  const dt = dateInput ? new Date(toUtcIso(dateInput)) : new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istTime = new Date(dt.getTime() + istOffset);
  const dateStr = istTime.toISOString().split('T')[0];
  const timeStr = istTime.toTimeString().split(' ')[0].slice(0, 5);
  return { dateStr, timeStr, full: `${dateStr} ${timeStr}` };
}

// Helper: Recalculate order totals (subtotal, 0% tax, grand total)
async function recalculateOrderTotals(db, orderId, restaurantId) {
  const sumRes = await db.prepare(
    `SELECT COALESCE(SUM(price_at_order * quantity), 0) AS subtotal
     FROM order_items
     WHERE order_id = ? AND status != 'CANCELLED'`
  ).bind(orderId).first();

  const rawSubtotal = Number(sumRes?.subtotal || 0);
  const taxAmount = 0; // Strictly zero GST
  const finalTotal = Math.round(rawSubtotal * 100) / 100;

  await db.prepare(
    `UPDATE orders
     SET subtotal = ?, discount_amount = 0, tax_percentage = 0, tax_amount = 0, total = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).bind(rawSubtotal, finalTotal, orderId).run();

  return {
    subtotal: rawSubtotal,
    taxAmount,
    total: finalTotal
  };
}

// GET /api/pos/tables/status (Live Table Grid Status: Tables 1-15 + Parcel 0)
pos.get('/tables/status', async (c) => {
  const restaurantId = c.req.query('restaurantId') || 'db4ed920-3d20-420a-9f54-99d3c0b48a08';
  try {
    const [tablesRes, activeOrdersRes, activeItemsRes] = await Promise.all([
      c.env.DB.prepare(
        'SELECT id, number FROM tables WHERE restaurant_id = ? ORDER BY number ASC'
      ).bind(restaurantId).all(),
      c.env.DB.prepare(
        `SELECT o.id, o.table_id, o.status, o.subtotal, o.total, o.server_name, o.guest_count, o.notes, o.created_at,
                COUNT(oi.id) AS item_count,
                t.number AS table_number
         FROM orders o
         JOIN tables t ON o.table_id = t.id
         LEFT JOIN order_items oi ON o.id = oi.order_id AND oi.status != 'CANCELLED'
         WHERE o.restaurant_id = ? AND o.status NOT IN ('PAID', 'CANCELLED')
         GROUP BY o.id`
      ).bind(restaurantId).all(),
      c.env.DB.prepare(
        `SELECT oi.id, oi.order_id, oi.menu_item_id, oi.quantity, oi.price_at_order, oi.status,
                oi.customer_seat, oi.customer_label, oi.is_paid, oi.paid_at, oi.payment_method, oi.individual_bill_number,
                mi.name, mi.category
         FROM order_items oi
         JOIN menu_items mi ON oi.menu_item_id = mi.id
         JOIN orders o ON oi.order_id = o.id
         WHERE o.restaurant_id = ? AND o.status NOT IN ('PAID', 'CANCELLED') AND oi.status != 'CANCELLED'
         ORDER BY oi.customer_seat ASC, oi.created_at ASC`
      ).bind(restaurantId).all()
    ]);

    const activeOrdersByTable = {};
    for (const ord of (activeOrdersRes.results || [])) {
      activeOrdersByTable[ord.table_id] = ord;
    }

    const itemsByOrder = {};
    for (const it of (activeItemsRes.results || [])) {
      if (!itemsByOrder[it.order_id]) itemsByOrder[it.order_id] = [];
      itemsByOrder[it.order_id].push(it);
    }

    const now = Date.now();
    const tables = (tablesRes.results || []).map((t) => {
      const activeOrd = activeOrdersByTable[t.id];
      const isParcel = Number(t.number) === 0;
      const tableLabel = isParcel ? 'PARCEL / TAKEAWAY' : `Table #${t.number}`;

      let status = 'VACANT';
      let activeOrderData = null;

      if (activeOrd) {
        status = activeOrd.status === 'READY' ? 'BILLING' : 'OCCUPIED';
        const createdMs = new Date(toUtcIso(activeOrd.created_at)).getTime();
        const elapsedMinutes = Math.max(0, Math.floor((now - createdMs) / 60000));
        const orderItems = itemsByOrder[activeOrd.id] || [];

        // Build 1 to 4 customer seats breakdown
        const seatsBreakdownMap = {
          1: { seatNumber: 1, label: 'Customer 1', items: [], subtotal: 0, unpaidSubtotal: 0, isPaid: false },
          2: { seatNumber: 2, label: 'Customer 2', items: [], subtotal: 0, unpaidSubtotal: 0, isPaid: false },
          3: { seatNumber: 3, label: 'Customer 3', items: [], subtotal: 0, unpaidSubtotal: 0, isPaid: false },
          4: { seatNumber: 4, label: 'Customer 4', items: [], subtotal: 0, unpaidSubtotal: 0, isPaid: false },
          0: { seatNumber: 0, label: 'Table Shared', items: [], subtotal: 0, unpaidSubtotal: 0, isPaid: false }
        };

        for (const it of orderItems) {
          const sNum = it.customer_seat !== undefined && it.customer_seat !== null ? Number(it.customer_seat) : 1;
          const target = seatsBreakdownMap[sNum] || seatsBreakdownMap[1];
          const lineTotal = Number(it.price_at_order) * Number(it.quantity);
          const isItemPaid = Number(it.is_paid) === 1;

          target.items.push({
            id: it.id,
            menuItemId: it.menu_item_id,
            name: it.name,
            category: it.category,
            price: Number(it.price_at_order),
            quantity: Number(it.quantity),
            lineTotal,
            isPaid: isItemPaid,
            paidAt: it.paid_at,
            paymentMethod: it.payment_method,
            individualBillNumber: it.individual_bill_number
          });
          target.subtotal += lineTotal;
          if (!isItemPaid) {
            target.unpaidSubtotal += lineTotal;
          }
        }

        const seatsBreakdown = Object.values(seatsBreakdownMap)
          .filter((s) => s.items.length > 0)
          .map((s) => ({
            ...s,
            isPaid: s.items.length > 0 && s.items.every((it) => it.isPaid),
            individualBillNumber: s.items[0]?.individualBillNumber || null,
            paymentMethod: s.items[0]?.paymentMethod || null
          }));

        activeOrderData = {
          orderId: activeOrd.id,
          serverName: activeOrd.server_name || 'Captain',
          guestCount: Number(activeOrd.guest_count || 1),
          subtotal: Number(activeOrd.subtotal || 0),
          total: Number(activeOrd.total || 0),
          itemCount: Number(activeOrd.item_count || 0),
          notes: activeOrd.notes || '',
          status: activeOrd.status,
          createdAt: activeOrd.created_at,
          elapsedMinutes,
          seatsBreakdown
        };
      }

      return {
        tableId: t.id,
        tableNumber: Number(t.number),
        tableLabel,
        isParcel,
        status,
        activeOrder: activeOrderData
      };
    });

    return c.json({
      restaurantId,
      totalTables: tables.length,
      vacantCount: tables.filter((t) => t.status === 'VACANT').length,
      occupiedCount: tables.filter((t) => t.status !== 'VACANT').length,
      tables
    });
  } catch (err) {
    console.error('POS Tables Status Error:', err);
    return c.json({ error: 'Database error: ' + err.message }, 500);
  }
});

// POST /api/pos/order (Server takes order: selects table, seat 1-4, dishes)
pos.post('/order', async (c) => {
  try {
    const body = await c.req.json();
    const restaurantId = body.restaurantId || 'db4ed920-3d20-420a-9f54-99d3c0b48a08';
    const serverName = (body.serverName || 'Captain').trim();
    const guestCount = Math.min(4, Math.max(1, Number(body.guestCount || 1)));
    const notes = body.notes ? String(body.notes).trim() : null;
    const items = Array.isArray(body.items) ? body.items : [];

    if (items.length === 0) {
      return c.json({ error: 'Order must contain at least one item' }, 400);
    }

    // Resolve table
    let table = null;
    if (body.tableId) {
      table = await c.env.DB.prepare('SELECT id, number FROM tables WHERE id = ?').bind(body.tableId).first();
    } else if (body.tableNumber !== undefined && body.tableNumber !== null) {
      table = await c.env.DB.prepare('SELECT id, number FROM tables WHERE restaurant_id = ? AND number = ?')
        .bind(restaurantId, Number(body.tableNumber)).first();
    }

    if (!table) {
      return c.json({ error: 'Invalid table specified' }, 400);
    }

    const tableId = table.id;
    const tableNumber = Number(table.number);

    // Look for active open order on this table
    const existingOrder = await c.env.DB.prepare(
      `SELECT id, status, server_name, guest_count, notes
       FROM orders
       WHERE restaurant_id = ? AND table_id = ? AND status NOT IN ('PAID', 'CANCELLED')
       ORDER BY created_at DESC LIMIT 1`
    ).bind(restaurantId, tableId).first();

    let orderId = existingOrder ? existingOrder.id : generateUUID();
    const isNewOrder = !existingOrder;

    if (isNewOrder) {
      await c.env.DB.prepare(
        `INSERT INTO orders (id, restaurant_id, table_id, server_name, guest_count, status, notes, subtotal, tax_percentage, tax_amount, total)
         VALUES (?, ?, ?, ?, ?, 'PENDING', ?, 0, 0, 0, 0)`
      ).bind(orderId, restaurantId, tableId, serverName, guestCount, notes).run();
    } else {
      if (notes) {
        await c.env.DB.prepare(
          "UPDATE orders SET notes = COALESCE(notes || '; ', '') || ?, updated_at = datetime('now') WHERE id = ?"
        ).bind(notes, orderId).run();
      }
    }

    // Insert items with customer seat attribution (1 to 4 or 0 for shared)
    let addedCount = 0;
    for (const it of items) {
      const mId = it.menuItemId || it.menu_item_id || it.id;
      const mItem = await c.env.DB.prepare('SELECT id, name, price FROM menu_items WHERE id = ?').bind(mId).first();
      if (mItem) {
        const price = Number(mItem.price);
        const qty = Math.max(1, Number(it.quantity || 1));
        const seatNum = Number(it.customerSeat ?? it.seat ?? 1);
        const seatLabel = it.customerLabel || (seatNum === 0 ? 'Table Shared' : `Customer ${seatNum}`);
        const instructions = it.specialInstructions || it.special_instructions || null;

        await c.env.DB.prepare(
          `INSERT INTO order_items (id, order_id, menu_item_id, quantity, price_at_order, status, customer_seat, customer_label, special_instructions)
           VALUES (?, ?, ?, ?, ?, 'PENDING', ?, ?, ?)`
        ).bind(generateUUID(), orderId, mItem.id, qty, price, seatNum, seatLabel, instructions).run();

        addedCount += qty;
      }
    }

    // Recalculate order totals
    const totals = await recalculateOrderTotals(c.env.DB, orderId, restaurantId);

    return c.json({
      success: true,
      isNewOrder,
      orderId,
      tableNumber,
      tableLabel: tableNumber === 0 ? 'PARCEL / TAKEAWAY' : `Table #${tableNumber}`,
      serverName,
      guestCount,
      addedItemsCount: addedCount,
      subtotal: totals.subtotal,
      taxAmount: 0,
      total: totals.total,
      message: isNewOrder ? 'New table order sent to kitchen & billing!' : 'Dishes added to table tab & dispatched!'
    });
  } catch (err) {
    console.error('POS Order Error:', err);
    return c.json({ error: 'Failed to place POS order: ' + err.message }, 500);
  }
});

// GET /api/pos/table/:number/active (Retrieve running order with Customer 1-4 breakdown)
pos.get('/table/:number/active', async (c) => {
  const restaurantId = c.req.query('restaurantId') || 'db4ed920-3d20-420a-9f54-99d3c0b48a08';
  const tableNum = Number(c.req.param('number'));

  try {
    const table = await c.env.DB.prepare('SELECT id, number FROM tables WHERE restaurant_id = ? AND number = ?')
      .bind(restaurantId, tableNum).first();

    if (!table) return c.json({ error: 'Table not found' }, 404);

    const ord = await c.env.DB.prepare(
      `SELECT id, status, subtotal, total, server_name, guest_count, notes, created_at, updated_at
       FROM orders
       WHERE restaurant_id = ? AND table_id = ? AND status NOT IN ('PAID', 'CANCELLED')
       ORDER BY created_at DESC LIMIT 1`
    ).bind(restaurantId, table.id).first();

    if (!ord) {
      return c.json({
        tableNumber: tableNum,
        tableLabel: tableNum === 0 ? 'PARCEL / TAKEAWAY' : `Table #${tableNum}`,
        hasActiveOrder: false,
        status: 'VACANT'
      });
    }

    const itemsRes = await c.env.DB.prepare(
      `SELECT oi.id, oi.menu_item_id, oi.quantity, oi.price_at_order, oi.status, oi.customer_seat, oi.customer_label,
              oi.is_paid, oi.paid_at, oi.payment_method, oi.individual_bill_number, oi.special_instructions,
              mi.name, mi.category, mi.photo_url, mi.is_veg
       FROM order_items oi
       JOIN menu_items mi ON oi.menu_item_id = mi.id
       WHERE oi.order_id = ? AND oi.status != 'CANCELLED'
       ORDER BY oi.customer_seat ASC, oi.created_at ASC`
    ).bind(ord.id).all();

    const items = itemsRes.results || [];

    // Group items by Customer Seat (Customer 1 to 4, plus Shared)
    const seatsBreakdownMap = {
      1: { seatNumber: 1, label: 'Customer 1', items: [], subtotal: 0, unpaidSubtotal: 0, isPaid: false },
      2: { seatNumber: 2, label: 'Customer 2', items: [], subtotal: 0, unpaidSubtotal: 0, isPaid: false },
      3: { seatNumber: 3, label: 'Customer 3', items: [], subtotal: 0, unpaidSubtotal: 0, isPaid: false },
      4: { seatNumber: 4, label: 'Customer 4', items: [], subtotal: 0, unpaidSubtotal: 0, isPaid: false },
      0: { seatNumber: 0, label: 'Table Shared', items: [], subtotal: 0, unpaidSubtotal: 0, isPaid: false },
    };

    for (const it of items) {
      const sNum = it.customer_seat !== undefined && it.customer_seat !== null ? Number(it.customer_seat) : 1;
      const target = seatsBreakdownMap[sNum] || seatsBreakdownMap[1];
      const lineTotal = Number(it.price_at_order) * Number(it.quantity);
      const isItemPaid = Number(it.is_paid) === 1;

      target.items.push({
        id: it.id,
        menuItemId: it.menu_item_id,
        name: it.name,
        category: it.category,
        price: Number(it.price_at_order),
        quantity: Number(it.quantity),
        lineTotal,
        status: it.status,
        isPaid: isItemPaid,
        paidAt: it.paid_at,
        paymentMethod: it.payment_method,
        individualBillNumber: it.individual_bill_number,
        specialInstructions: it.special_instructions
      });
      target.subtotal += lineTotal;
      if (!isItemPaid) {
        target.unpaidSubtotal += lineTotal;
      }
    }

    const seatsBreakdown = Object.values(seatsBreakdownMap)
      .filter((s) => s.items.length > 0)
      .map((s) => ({
        ...s,
        isPaid: s.items.length > 0 && s.items.every((it) => it.isPaid),
        individualBillNumber: s.items[0]?.individualBillNumber || null,
        paymentMethod: s.items[0]?.paymentMethod || null
      }));

    return c.json({
      hasActiveOrder: true,
      tableNumber: tableNum,
      tableLabel: tableNum === 0 ? 'PARCEL / TAKEAWAY' : `Table #${tableNum}`,
      orderId: ord.id,
      serverName: ord.server_name || 'Captain',
      guestCount: Number(ord.guest_count || 1),
      status: ord.status,
      notes: ord.notes || '',
      subtotal: Number(ord.subtotal || 0),
      taxAmount: 0,
      total: Number(ord.total || 0),
      createdAt: ord.created_at,
      items,
      seatsBreakdown
    });
  } catch (err) {
    console.error('POS Table Active Order Error:', err);
    return c.json({ error: 'Database error: ' + err.message }, 500);
  }
});

// POST /api/pos/order/:id/settle (Cashier settles bill, prints, & commits to permanent bills_archive)
// Supports settling an individual seat (body.seat) OR the entire table (body.seat omitted)
pos.post('/order/:id/settle', async (c) => {
  const orderId = c.req.param('id');
  try {
    const body = await c.req.json().catch(() => ({}));
    const paymentMethod = (body.paymentMethod || 'CASH').toUpperCase();
    const cashierName = (body.cashierName || 'Cashier').trim();
    const targetSeat = (body.seat !== undefined && body.seat !== null && body.seat !== '') ? Number(body.seat) : null;

    const ord = await c.env.DB.prepare(
      `SELECT o.id, o.restaurant_id, o.table_id, o.server_name, o.guest_count, o.subtotal, o.total, o.notes, o.created_at,
              t.number AS table_number, r.name AS restaurant_name, r.address, r.phone
       FROM orders o
       JOIN tables t ON o.table_id = t.id
       JOIN restaurants r ON o.restaurant_id = r.id
       WHERE o.id = ?`
    ).bind(orderId).first();

    if (!ord) return c.json({ error: 'Order not found' }, 404);

    const itemsRes = await c.env.DB.prepare(
      `SELECT oi.id, oi.menu_item_id, oi.quantity, oi.price_at_order, oi.customer_seat, oi.customer_label,
              oi.is_paid, oi.paid_at, oi.payment_method, oi.individual_bill_number, oi.special_instructions,
              mi.name, mi.category
       FROM order_items oi
       JOIN menu_items mi ON oi.menu_item_id = mi.id
       WHERE oi.order_id = ? AND oi.status != 'CANCELLED'
       ORDER BY oi.customer_seat ASC, oi.created_at ASC`
    ).bind(orderId).all();

    const allItems = (itemsRes.results || []).map((it) => ({
      id: it.id,
      name: it.name,
      category: it.category,
      quantity: Number(it.quantity),
      price: Number(it.price_at_order),
      amount: Number(it.quantity) * Number(it.price_at_order),
      seat: Number(it.customer_seat || 1),
      seatLabel: it.customer_label || (Number(it.customer_seat) === 0 ? 'Table Shared' : `Customer ${it.customer_seat || 1}`),
      isPaid: Number(it.is_paid) === 1,
      paidAt: it.paid_at,
      paymentMethod: it.payment_method,
      individualBillNumber: it.individual_bill_number,
      specialInstructions: it.special_instructions
    }));

    const istNow = formatIstDateTime();
    const shortCode = orderId.replace(/[^a-zA-Z0-9]/g, '').slice(-4).toUpperCase();
    const billBaseNumber = `KB-${istNow.dateStr.replace(/-/g, '').slice(2)}-${shortCode}`;
    const tableLabel = Number(ord.table_number) === 0 ? 'PARCEL / TAKEAWAY' : `Table #${ord.table_number}`;

    const fullOrderTotal = Math.round(allItems.reduce((sum, it) => sum + it.amount, 0) * 100) / 100;

    // ─────────────────────────────────────────────────────────────
    // CASE A: SETTLE INDIVIDUAL CUSTOMER SEAT (Customer 1, 2, 3, 4, 0)
    // ─────────────────────────────────────────────────────────────
    if (targetSeat !== null) {
      const seatItems = allItems.filter((it) => it.seat === targetSeat);
      if (seatItems.length === 0) {
        return c.json({ error: `No items found for Customer ${targetSeat}` }, 400);
      }

      const unpaidSeatItems = seatItems.filter((it) => !it.isPaid);
      const seatLabel = seatItems[0].seatLabel;

      // If this customer seat is already 100% paid, return their existing bill cleanly without duplicate insert
      if (unpaidSeatItems.length === 0) {
        const existingBillNum = seatItems[0].individualBillNumber || `${billBaseNumber}-${targetSeat === 0 ? 'SHR' : 'C' + targetSeat}`;
        const existingArchive = await c.env.DB.prepare(
          'SELECT * FROM bills_archive WHERE bill_number = ? ORDER BY paid_at DESC LIMIT 1'
        ).bind(existingBillNum).first();

        const seatSubtotal = seatItems.reduce((sum, it) => sum + it.amount, 0);
        const seatBreakdownObj = {
          seat: targetSeat,
          seatLabel,
          individualBillNumber: existingBillNum,
          items: seatItems,
          subtotal: seatSubtotal,
          taxAmount: 0,
          total: seatSubtotal
        };

        return c.json({
          success: true,
          alreadyPaid: true,
          isIndividualSeat: true,
          settledSeat: targetSeat,
          seatLabel,
          billId: existingArchive?.id || generateUUID(),
          billNumber: existingBillNum,
          orderId,
          tableNumber: Number(ord.table_number),
          tableLabel: `${tableLabel} (${seatLabel})`,
          serverName: ord.server_name || 'Captain',
          guestCount: 1,
          paymentMethod: seatItems[0].paymentMethod || paymentMethod,
          subtotal: seatSubtotal,
          taxAmount: 0,
          total: seatSubtotal,
          items: seatItems,
          customerBreakdown: [seatBreakdownObj],
          paidAt: existingArchive?.paid_at || istNow.full
        });
      }

      const itemsToSettle = unpaidSeatItems;
      const seatSubtotal = Math.round(itemsToSettle.reduce((sum, it) => sum + it.amount, 0) * 100) / 100;
      const indBillNumber = await ensureUniqueBillNumber(
        c.env.DB,
        `${billBaseNumber}-${targetSeat === 0 ? 'SHR' : 'C' + targetSeat}`
      );
      let billArchiveId = generateUUID();

      // Individual thermal slip text
      const indLines = [
        '================================================',
        '          KRISH CAFE AND RESTAURANT             ',
        '         Rathinam College Front Gate            ',
        '            Eachanari, Coimbatore               ',
        '               PH: 8760633322                   ',
        '================================================',
        `BILL NO: ${indBillNumber.padEnd(16)} TABLE: ${tableLabel}`,
        `DINER:   ${seatLabel.padEnd(16)} SERVER: ${ord.server_name || 'Captain'}`,
        `DATE:    ${istNow.full.padEnd(16)} PAYMENT: ${paymentMethod}`,
        '------------------------------------------------',
        'ITEM                           QTY  PRICE AMOUNT',
        '------------------------------------------------',
        ...itemsToSettle.map((it) => {
          const nameCol = it.name.slice(0, 27).padEnd(28);
          const qtyCol = String(it.quantity).padStart(3);
          const priceCol = it.price.toFixed(0).padStart(6);
          const amtCol = it.amount.toFixed(0).padStart(7);
          return `${nameCol}${qtyCol}${priceCol}${amtCol}`;
        }),
        '------------------------------------------------',
        `CUSTOMER SUBTOTAL:                     ₹${seatSubtotal.toFixed(2)}`,
        `TAX (0% GST):                            ₹0.00`,
        `TOTAL PAYABLE:                         ₹${seatSubtotal.toFixed(2)}`,
        '------------------------------------------------',
        `PAID VIA ${paymentMethod}`,
        '           THANK YOU! VISIT AGAIN!              ',
        '================================================'
      ];
      const thermalText = indLines.join('\n');

      const seatBreakdownObj = {
        seat: targetSeat,
        seatLabel,
        individualBillNumber: indBillNumber,
        items: itemsToSettle,
        subtotal: seatSubtotal,
        taxAmount: 0,
        total: seatSubtotal,
        thermalText
      };

      // Commit individual customer bill to permanent archive (guaranteed collision-free with auto-retry)
      let finalIndBillNumber = indBillNumber;
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          await c.env.DB.prepare(
            `INSERT INTO bills_archive (
               id, bill_number, order_id, restaurant_id, table_number, table_label, server_name, guest_count,
               subtotal, discount_amount, tax_amount, total, payment_method, customer_breakdown, items_json, created_at, paid_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, 0, 0, ?, ?, ?, ?, ?, datetime('now'))`
          ).bind(
            billArchiveId,
            finalIndBillNumber,
            orderId,
            ord.restaurant_id,
            Number(ord.table_number),
            `${tableLabel} (${seatLabel})`,
            ord.server_name || 'Captain',
            seatSubtotal,
            seatSubtotal,
            paymentMethod,
            JSON.stringify([seatBreakdownObj]),
            JSON.stringify(itemsToSettle),
            ord.created_at
          ).run();
          break;
        } catch (insertErr) {
          if (insertErr.message && (insertErr.message.includes('UNIQUE constraint failed') || insertErr.message.includes('SQLITE_CONSTRAINT_UNIQUE'))) {
            finalIndBillNumber = `${billBaseNumber}-${targetSeat === 0 ? 'SHR' : 'C' + targetSeat}-R${attempt + 2}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
            billArchiveId = generateUUID();
            seatBreakdownObj.individualBillNumber = finalIndBillNumber;
          } else {
            throw insertErr;
          }
        }
      }

      // Mark this seat's items as paid
      await c.env.DB.prepare(
        `UPDATE order_items
         SET is_paid = 1, paid_at = datetime('now'), payment_method = ?, individual_bill_number = ?
         WHERE order_id = ? AND customer_seat = ? AND (is_paid = 0 OR is_paid IS NULL)`
      ).bind(paymentMethod, finalIndBillNumber, orderId, targetSeat).run();

      // Check remaining unpaid items on table
      const remainingRes = await c.env.DB.prepare(
        `SELECT COUNT(*) AS unpaid_count, COALESCE(SUM(price_at_order * quantity), 0) AS unpaid_total
         FROM order_items
         WHERE order_id = ? AND status != 'CANCELLED' AND (is_paid = 0 OR is_paid IS NULL)`
      ).bind(orderId).first();

      const remainingUnpaidCount = Number(remainingRes?.unpaid_count || 0);
      const remainingTotal = Number(remainingRes?.unpaid_total || 0);
      const tableFullySettled = remainingUnpaidCount === 0;

      if (tableFullySettled) {
        await c.env.DB.prepare(
          "UPDATE orders SET status = 'PAID', payment_method = ?, subtotal = ?, total = ?, updated_at = datetime('now') WHERE id = ?"
        ).bind(paymentMethod, fullOrderTotal, fullOrderTotal, orderId).run();
      } else {
        await c.env.DB.prepare(
          "UPDATE orders SET subtotal = ?, total = ?, updated_at = datetime('now') WHERE id = ?"
        ).bind(fullOrderTotal, fullOrderTotal, orderId).run();
      }

      return c.json({
        success: true,
        isIndividualSeat: true,
        settledSeat: targetSeat,
        seatLabel,
        billId: billArchiveId,
        billNumber: finalIndBillNumber,
        orderId,
        tableNumber: Number(ord.table_number),
        tableLabel: `${tableLabel} (${seatLabel})`,
        serverName: ord.server_name || 'Captain',
        guestCount: 1,
        paymentMethod,
        subtotal: seatSubtotal,
        taxAmount: 0,
        total: seatSubtotal,
        items: itemsToSettle,
        customerBreakdown: [seatBreakdownObj],
        paidAt: istNow.full,
        thermalText,
        tableFullySettled,
        isFullOrderComplete: tableFullySettled,
        remainingUnpaidCount,
        remainingTotal
      });
    }

    // ─────────────────────────────────────────────────────────────
    // CASE B: SETTLE ENTIRE TABLE (All Unpaid Customer Seats at once)
    // ─────────────────────────────────────────────────────────────
    const unpaidItems = allItems.filter((it) => !it.isPaid);
    const itemsToSettle = unpaidItems.length > 0 ? unpaidItems : allItems;
    const subtotal = Math.round(itemsToSettle.reduce((sum, it) => sum + it.amount, 0) * 100) / 100;
    const taxAmount = 0; // 0% GST
    const total = subtotal;
    let billNumber = await ensureUniqueBillNumber(c.env.DB, billBaseNumber);
    let billArchiveId = generateUUID();

    // Build customer 1 to 4 seat breakdown
    const customerBreakdownMap = {};
    for (const it of itemsToSettle) {
      const sKey = it.seat === 0 ? 'Shared' : `Customer ${it.seat}`;
      if (!customerBreakdownMap[sKey]) {
        const indBillNo = `${billNumber}-${it.seat === 0 ? 'SHR' : 'C' + it.seat}`;
        customerBreakdownMap[sKey] = {
          seat: it.seat,
          seatLabel: sKey,
          individualBillNumber: indBillNo,
          items: [],
          subtotal: 0,
          taxAmount: 0,
          total: 0
        };
      }
      customerBreakdownMap[sKey].items.push(it);
      customerBreakdownMap[sKey].subtotal += it.amount;
      customerBreakdownMap[sKey].total += it.amount;
    }

    const customerBreakdown = Object.values(customerBreakdownMap).sort((a, b) => {
      const sA = a.seat === 0 ? 99 : a.seat;
      const sB = b.seat === 0 ? 99 : b.seat;
      return sA - sB;
    });

    for (const seatObj of customerBreakdown) {
      const indLines = [
        '================================================',
        '          KRISH CAFE AND RESTAURANT             ',
        '         Rathinam College Front Gate            ',
        '            Eachanari, Coimbatore               ',
        '               PH: 8760633322                   ',
        '================================================',
        `BILL NO: ${seatObj.individualBillNumber.padEnd(16)} TABLE: ${tableLabel}`,
        `DINER:   ${seatObj.seatLabel.padEnd(16)} SERVER: ${ord.server_name || 'Captain'}`,
        `DATE:    ${istNow.full.padEnd(16)} PAYMENT: ${paymentMethod}`,
        '------------------------------------------------',
        'ITEM                           QTY  PRICE AMOUNT',
        '------------------------------------------------',
        ...seatObj.items.map((it) => {
          const nameCol = it.name.slice(0, 27).padEnd(28);
          const qtyCol = String(it.quantity).padStart(3);
          const priceCol = it.price.toFixed(0).padStart(6);
          const amtCol = it.amount.toFixed(0).padStart(7);
          return `${nameCol}${qtyCol}${priceCol}${amtCol}`;
        }),
        '------------------------------------------------',
        `INDIVIDUAL SUBTOTAL:                   ₹${seatObj.subtotal.toFixed(2)}`,
        `TAX (0% GST):                            ₹0.00`,
        `TOTAL PAYABLE:                         ₹${seatObj.total.toFixed(2)}`,
        '------------------------------------------------',
        '           THANK YOU! VISIT AGAIN!              ',
        '================================================'
      ];
      seatObj.thermalText = indLines.join('\n');
    }

    // Commit to permanent bills_archive (guaranteed collision-free with auto-retry)
    let finalBillNumber = billNumber;
    let finalBillArchiveId = billArchiveId;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        await c.env.DB.prepare(
          `INSERT INTO bills_archive (
             id, bill_number, order_id, restaurant_id, table_number, table_label, server_name, guest_count,
             subtotal, discount_amount, tax_amount, total, payment_method, customer_breakdown, items_json, created_at, paid_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, datetime('now'))`
        ).bind(
          finalBillArchiveId,
          finalBillNumber,
          orderId,
          ord.restaurant_id,
          Number(ord.table_number),
          tableLabel,
          ord.server_name || 'Captain',
          Number(ord.guest_count || 1),
          subtotal,
          taxAmount,
          total,
          paymentMethod,
          JSON.stringify(customerBreakdown),
          JSON.stringify(itemsToSettle),
          ord.created_at
        ).run();
        break;
      } catch (insertErr) {
        if (insertErr.message && (insertErr.message.includes('UNIQUE constraint failed') || insertErr.message.includes('SQLITE_CONSTRAINT_UNIQUE'))) {
          finalBillNumber = `${billBaseNumber}-R${attempt + 2}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
          finalBillArchiveId = generateUUID();
        } else {
          throw insertErr;
        }
      }
    }
    billNumber = finalBillNumber;
    billArchiveId = finalBillArchiveId;

    // Mark order and all items as PAID (preserving full order revenue for analytics)
    await Promise.all([
      c.env.DB.prepare(
        "UPDATE orders SET status = 'PAID', payment_method = ?, subtotal = ?, total = ?, updated_at = datetime('now') WHERE id = ?"
      ).bind(paymentMethod, fullOrderTotal, fullOrderTotal, orderId).run(),
      c.env.DB.prepare(
        "UPDATE order_items SET is_paid = 1, paid_at = datetime('now'), payment_method = ? WHERE order_id = ? AND (is_paid = 0 OR is_paid IS NULL)"
      ).bind(paymentMethod, orderId).run()
    ]);

    // Format 80mm master thermal text receipt with clear individual customer sections
    const thermalMasterLines = [
      '================================================',
      '          KRISH CAFE AND RESTAURANT             ',
      '         Rathinam College Front Gate            ',
      '            Eachanari, Coimbatore               ',
      '               PH: 8760633322                   ',
      '================================================',
      `BILL NO: ${billNumber.padEnd(16)} TABLE: ${tableLabel}`,
      `DATE: ${istNow.full.padEnd(19)} SERVER: ${ord.server_name || 'Captain'}`,
      `PAYMENT: ${paymentMethod.padEnd(16)} CASHIER: ${cashierName}`,
      '================================================',
      '       INDIVIDUAL CUSTOMER BILLS BREAKDOWN      ',
      '================================================'
    ];

    for (const seatObj of customerBreakdown) {
      thermalMasterLines.push(`>>> ${seatObj.seatLabel.toUpperCase()} BILL <<<`);
      thermalMasterLines.push('ITEM                           QTY  PRICE AMOUNT');
      thermalMasterLines.push('------------------------------------------------');
      for (const it of seatObj.items) {
        const nameCol = it.name.slice(0, 27).padEnd(28);
        const qtyCol = String(it.quantity).padStart(3);
        const priceCol = it.price.toFixed(0).padStart(6);
        const amtCol = it.amount.toFixed(0).padStart(7);
        thermalMasterLines.push(`${nameCol}${qtyCol}${priceCol}${amtCol}`);
      }
      thermalMasterLines.push(`    >> ${seatObj.seatLabel} Subtotal: ₹${seatObj.subtotal.toFixed(2)}`);
      thermalMasterLines.push('------------------------------------------------');
    }

    thermalMasterLines.push(
      `TABLE SUBTOTAL:                        ₹${subtotal.toFixed(2)}`,
      `TAX (0% GST):                            ₹0.00`,
      `TABLE GRAND TOTAL:                     ₹${total.toFixed(2)}`,
      '================================================',
      '           THANK YOU! VISIT AGAIN!              ',
      '================================================'
    );

    const thermalText = thermalMasterLines.join('\n');

    return c.json({
      success: true,
      isIndividualSeat: false,
      billId: billArchiveId,
      billNumber,
      orderId,
      tableNumber: Number(ord.table_number),
      tableLabel,
      serverName: ord.server_name || 'Captain',
      guestCount: Number(ord.guest_count || 1),
      paymentMethod,
      subtotal,
      taxAmount: 0,
      total,
      items: itemsToSettle,
      customerBreakdown,
      paidAt: istNow.full,
      thermalText,
      tableFullySettled: true
    });
  } catch (err) {
    console.error('POS Settle Bill Error:', err);
    return c.json({ error: 'Failed to settle bill: ' + err.message }, 500);
  }
});

// GET /api/pos/bills (Searchable Bills Archive with date, table, & text filters)
pos.get('/bills', async (c) => {
  const restaurantId = c.req.query('restaurantId') || 'db4ed920-3d20-420a-9f54-99d3c0b48a08';
  const filterDate = c.req.query('date'); // YYYY-MM-DD or 'today' or 'yesterday'
  const filterTable = c.req.query('table');
  const search = (c.req.query('search') || '').trim();
  const limit = Math.min(100, Math.max(1, Number(c.req.query('limit') || 50)));

  try {
    let query = `
      SELECT id, bill_number, order_id, table_number, table_label, server_name, guest_count,
             subtotal, tax_amount, total, payment_method, customer_breakdown, items_json, created_at, paid_at
      FROM bills_archive
      WHERE restaurant_id = ?
    `;
    const params = [restaurantId];

    if (filterDate === 'today') {
      query += ` AND DATE(paid_at, '+5 hours', '+30 minutes') = DATE('now', '+5 hours', '+30 minutes')`;
    } else if (filterDate === 'yesterday') {
      query += ` AND DATE(paid_at, '+5 hours', '+30 minutes') = DATE('now', '-1 day', '+5 hours', '+30 minutes')`;
    } else if (filterDate && /^\d{4}-\d{2}-\d{2}$/.test(filterDate)) {
      query += ` AND DATE(paid_at, '+5 hours', '+30 minutes') = ?`;
      params.push(filterDate);
    }

    if (filterTable !== undefined && filterTable !== null && filterTable !== '') {
      query += ` AND table_number = ?`;
      params.push(Number(filterTable));
    }

    if (search) {
      query += ` AND (bill_number LIKE ? OR server_name LIKE ? OR items_json LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += ` ORDER BY paid_at DESC LIMIT ?`;
    params.push(limit);

    const res = await c.env.DB.prepare(query).bind(...params).all();
    const bills = (res.results || []).map((b) => {
      let items = [];
      let breakdown = [];
      try { items = JSON.parse(b.items_json || '[]'); } catch (_) {}
      try { breakdown = JSON.parse(b.customer_breakdown || '[]'); } catch (_) {}

      return {
        id: b.id,
        billNumber: b.bill_number,
        orderId: b.order_id,
        tableNumber: b.table_number,
        tableLabel: b.table_label,
        serverName: b.server_name,
        guestCount: b.guest_count,
        subtotal: Number(b.subtotal || 0),
        taxAmount: 0,
        total: Number(b.total || 0),
        paymentMethod: b.payment_method,
        itemCount: items.reduce((sum, it) => sum + (it.quantity || 1), 0),
        items,
        customerBreakdown: breakdown,
        paidAt: toUtcIso(b.paid_at)
      };
    });

    return c.json({
      totalCount: bills.length,
      totalRevenue: bills.reduce((sum, b) => sum + b.total, 0),
      bills
    });
  } catch (err) {
    console.error('POS Bills Archive Error:', err);
    return c.json({ error: 'Database error: ' + err.message }, 500);
  }
});

// GET /api/pos/bills/:id (Retrieve single archived bill for reprinting)
pos.get('/bills/:id', async (c) => {
  const idOrNumber = c.req.param('id');
  try {
    const b = await c.env.DB.prepare(
      `SELECT id, bill_number, order_id, restaurant_id, table_number, table_label, server_name, guest_count,
              subtotal, tax_amount, total, payment_method, customer_breakdown, items_json, created_at, paid_at
       FROM bills_archive
       WHERE id = ? OR bill_number = ?`
    ).bind(idOrNumber, idOrNumber).first();

    if (!b) return c.json({ error: 'Archived bill not found' }, 404);

    let items = [];
    let customerBreakdown = [];
    try { items = JSON.parse(b.items_json || '[]'); } catch (_) {}
    try { customerBreakdown = JSON.parse(b.customer_breakdown || '[]'); } catch (_) {}

    const istPaid = formatIstDateTime(b.paid_at);

    return c.json({
      id: b.id,
      billNumber: b.bill_number,
      orderId: b.order_id,
      tableNumber: b.table_number,
      tableLabel: b.table_label,
      serverName: b.server_name,
      guestCount: b.guest_count,
      subtotal: Number(b.subtotal),
      taxAmount: 0,
      total: Number(b.total),
      paymentMethod: b.payment_method,
      items,
      customerBreakdown,
      paidAt: istPaid.full,
      createdAt: b.created_at
    });
  } catch (err) {
    console.error('POS Get Bill Error:', err);
    return c.json({ error: 'Database error: ' + err.message }, 500);
  }
});

// GET /api/pos/bills/export/csv (Accounting & Bill History CSV export)
pos.get('/bills-export/csv', async (c) => {
  const restaurantId = c.req.query('restaurantId') || 'db4ed920-3d20-420a-9f54-99d3c0b48a08';
  try {
    const res = await c.env.DB.prepare(
      `SELECT bill_number, table_label, server_name, guest_count, subtotal, total, payment_method, items_json, paid_at
       FROM bills_archive
       WHERE restaurant_id = ?
       ORDER BY paid_at DESC`
    ).bind(restaurantId).all();

    const rows = res.results || [];
    const headers = ['Bill Number', 'Date', 'Time', 'Table', 'Server', 'Guests', 'Payment Method', 'Subtotal', 'Tax', 'Total', 'Dishes Summary'];
    const lines = [headers.join(',')];

    for (const r of rows) {
      const ist = formatIstDateTime(r.paid_at);
      let items = [];
      try { items = JSON.parse(r.items_json || '[]'); } catch (_) {}
      const dishSummary = items.map((it) => `${it.quantity}x ${it.name} (Seat ${it.seat || 1})`).join('; ');

      lines.push([
        `"${r.bill_number}"`,
        `"${ist.dateStr}"`,
        `"${ist.timeStr}"`,
        `"${r.table_label}"`,
        `"${r.server_name}"`,
        r.guest_count || 1,
        `"${r.payment_method}"`,
        Number(r.subtotal || 0).toFixed(2),
        '0.00',
        Number(r.total || 0).toFixed(2),
        `"${dishSummary.replace(/"/g, '""')}"`
      ].join(','));
    }

    return new Response(lines.join('\r\n'), {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="krish-bills-history-${new Date().toISOString().split('T')[0]}.csv"`,
      }
    });
  } catch (err) {
    console.error('CSV Export Error:', err);
    return c.text('Failed to export CSV: ' + err.message, 500);
  }
});

export default pos;
