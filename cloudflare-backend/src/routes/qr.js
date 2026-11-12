// QR Code Generator Router for Cloudflare Workers & D1
import { Hono } from 'hono';
import QRCode from 'qrcode';

const qr = new Hono();

// Helper to safely render SVG QR string across worker runtime
async function renderSvgString(text, options = {}) {
  const qrEngine = QRCode.default || QRCode;
  return new Promise((resolve, reject) => {
    qrEngine.toString(
      text,
      {
        type: 'svg',
        margin: 2,
        width: 300,
        color: {
          dark: options.dark || '#000000',
          light: options.light || '#ffffff',
        },
        ...options,
      },
      (err, svg) => {
        if (err) return reject(err);
        resolve(svg);
      }
    );
  });
}

// GET /api/qr/generate (Dynamic text/data to SVG QR Code)
qr.get('/generate', async (c) => {
  const text = c.req.query('text') || c.req.query('data') || '';
  if (!text) return c.text('Missing text query parameter', 400);

  const dark = c.req.query('dark') || '#000000';
  const light = c.req.query('light') || '#ffffff';

  try {
    const svg = await renderSvgString(text, { dark, light });
    return new Response(svg, {
      status: 200,
      headers: {
        'Content-Type': 'image/svg+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (err) {
    return c.text('Failed to generate QR: ' + err.message, 500);
  }
});

// Bulk & Batch Table Stands / QR Generator Handler
const bulkQrHandler = async (c) => {
  const restaurantId = c.req.param('restaurantId') || c.req.query('restaurantId') || 'db4ed920-3d20-420a-9f54-99d3c0b48a08';
  const host = c.req.header('host') || 'cafaqr.p7404467.workers.dev';
  const proto = c.req.header('x-forwarded-proto') || 'https';

  let clientBaseUrl = 'https://cafaqr.p7404467.workers.dev';
  if (host.includes('localhost') || host.includes('127.0.0.1')) {
    clientBaseUrl = `${proto}://${host}`;
  }

  try {
    let rest = null;
    if (restaurantId && restaurantId !== 'default') {
      rest = await c.env.DB.prepare('SELECT id, name FROM restaurants WHERE id = ?')
        .bind(restaurantId)
        .first();
    }
    if (!rest) {
      rest = await c.env.DB.prepare('SELECT id, name FROM restaurants LIMIT 1').first();
    }
    if (!rest) {
      return c.json({ error: 'Restaurant not found' }, 404);
    }

    const tablesRes = await c.env.DB.prepare(
      'SELECT id, number, restaurant_id FROM tables WHERE restaurant_id = ? ORDER BY CASE WHEN number = 0 THEN 0 ELSE 1 END ASC, number ASC'
    )
      .bind(rest.id)
      .all();

    const tables = tablesRes.results || [];

    const bulkQrs = await Promise.all(
      tables.map(async (table) => {
        const isParcel = Number(table.number) === 0;
        const orderUrl = isParcel
          ? `${clientBaseUrl}/order?tableId=${table.id}&tableNumber=0&orderType=PARCEL`
          : `${clientBaseUrl}/order?tableId=${table.id}&tableNumber=${table.number}`;
        const svg = await renderSvgString(orderUrl);
        const qrDataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

        return {
          tableId: table.id,
          id: table.id,
          tableNumber: table.number,
          number: table.number,
          isParcel,
          label: isParcel ? 'Parcel / Takeaway' : `Table #${table.number}`,
          orderUrl,
          qrCodeDataUrl: qrDataUrl,
          qrCodeSvg: svg,
        };
      })
    );

    return c.json({
      restaurant: rest,
      totalTables: bulkQrs.length,
      tables: bulkQrs,
    });
  } catch (err) {
    console.error('Bulk QR generation error:', err);
    return c.json({ error: 'Failed to generate bulk QR codes: ' + err.message }, 500);
  }
};

qr.get('/restaurant/:restaurantId/bulk', bulkQrHandler);
qr.get('/batch/:restaurantId', bulkQrHandler);
qr.get('/batch', bulkQrHandler);
qr.get('/bulk', bulkQrHandler);

// GET /api/qr/:tableId (Individual Table QR Code Graphic)
qr.get('/:tableId', async (c) => {
  const tableId = c.req.param('tableId');
  const format = c.req.query('format') || 'svg';
  const download = c.req.query('download');
  const dark = c.req.query('dark') || '#000000';
  const light = c.req.query('light') || '#ffffff';

  const host = c.req.header('host') || 'cafaqr.p7404467.workers.dev';
  const proto = c.req.header('x-forwarded-proto') || 'https';
  let clientBaseUrl = 'https://cafaqr.p7404467.workers.dev';
  if (host.includes('localhost') || host.includes('127.0.0.1')) {
    clientBaseUrl = `${proto}://${host}`;
  }

  try {
    const table = await c.env.DB.prepare(
      'SELECT id, number, restaurant_id FROM tables WHERE id = ?'
    )
      .bind(tableId)
      .first();

    if (!table) {
      return c.json({ error: 'Table not found' }, 404);
    }

    const isParcel = Number(table.number) === 0;
    const orderUrl = isParcel
      ? `${clientBaseUrl}/order?tableId=${table.id}&tableNumber=0&orderType=PARCEL`
      : `${clientBaseUrl}/order?tableId=${table.id}&tableNumber=${table.number}`;
    const svg = await renderSvgString(orderUrl, { dark, light });

    const headers = {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
    };

    if (download || format === 'download') {
      const filename = isParcel ? 'krish_parcel_takeaway_qr.svg' : `krish_table_${table.number}_qr.svg`;
      headers['Content-Disposition'] = `attachment; filename="${filename}"`;
    }

    return new Response(svg, { status: 200, headers });
  } catch (err) {
    console.error('QR code fetch error:', err);
    return c.json({ error: 'Failed to render table QR code' }, 500);
  }
});

export default qr;

