import React, { useMemo } from 'react';
import { Printer, X, CheckCircle2 } from 'lucide-react';

/**
 * Generates deterministic high-contrast monochrome barcode bar widths from a seed string
 * so each thermal receipt has a crisp scannable-style barcode SVG matching printed POS bills.
 */
function buildBarcodeBars(seedText = '000000000000') {
  const digits = String(seedText).replace(/[^A-Za-z0-9]/g, '') || '123456789012';
  const bars = [];
  let x = 2;

  // Start guard bars
  bars.push({ x, w: 2 }); x += 3;
  bars.push({ x, w: 1 }); x += 2;
  bars.push({ x, w: 2 }); x += 4;

  for (let i = 0; i < digits.length; i += 1) {
    const code = digits.charCodeAt(i);
    const pattern = [
      (code % 3) + 1,
      ((code >> 1) % 2) + 1,
      ((code >> 2) % 3) + 1,
      ((code >> 3) % 2) + 1,
    ];
    for (let j = 0; j < pattern.length; j += 1) {
      const width = pattern[j];
      if (j % 2 === 0) {
        bars.push({ x, w: width });
      }
      x += width + 1;
    }
  }

  // Stop guard bars
  bars.push({ x, w: 2 }); x += 3;
  bars.push({ x, w: 1 }); x += 2;
  bars.push({ x, w: 2 }); x += 2;

  return { bars, totalWidth: Math.max(x + 2, 160) };
}

function formatReceiptDateTime(isoOrDate) {
  const d = isoOrDate ? new Date(isoOrDate) : new Date();
  const valid = Number.isNaN(d.getTime()) ? new Date() : d;
  const dd = String(valid.getDate()).padStart(2, '0');
  const mm = String(valid.getMonth() + 1).padStart(2, '0');
  const yyyy = valid.getFullYear();
  const hh = String(valid.getHours()).padStart(2, '0');
  const min = String(valid.getMinutes()).padStart(2, '0');
  return {
    fullDateTime: `${dd}/${mm}/${yyyy} ${hh}:${min}`,
    timeOnly: `${hh}:${min}`,
    compactDate: `${dd}${mm}${yyyy}`,
  };
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Thermal POS Receipt preview & direct printer modal.
 * Prints an isolated 80mm monochrome thermal receipt through a hidden iframe so connected
 * USB/Bluetooth/system printers receive clean receipt formatting without dashboard chrome.
 */
export default function ThermalReceiptModal({ receipt, onClose }) {
  const normalized = useMemo(() => {
    if (!receipt) return null;

    const rawItems = Array.isArray(receipt.items) ? receipt.items : [];
    const items = rawItems.map((it) => {
      const qty = Number(it.quantity || 1);
      const unitPrice = Number(it.price ?? it.price_at_order ?? it.unit_price ?? 0);
      const lineTotal = it.line_total != null ? Number(it.line_total) : unitPrice * qty;
      return {
        name: String(it.name || it.item_name || 'Item').toUpperCase(),
        qty,
        lineTotal: Number.isFinite(lineTotal) ? lineTotal : 0,
      };
    });

    const computedItemsSum = items.reduce((acc, it) => acc + it.lineTotal, 0);
    const total = Number(receipt.total ?? receipt.combinedBill ?? computedItemsSum ?? 0);
    const taxAmount = receipt.taxAmount != null
      ? Number(receipt.taxAmount)
      : Math.max(0, total - (receipt.subtotal != null ? Number(receipt.subtotal) : computedItemsSum));
    const subtotal = receipt.subtotal != null && Number(receipt.subtotal) > 0
      ? Number(receipt.subtotal)
      : Math.max(0, total - taxAmount);
    const discountAmount = Number(receipt.discountAmount || 0);

    const refDigits = String(
      receipt.refNumber ||
      receipt.receiptNumber ||
      receipt.orderId ||
      Date.now()
    )
      .replace(/[^0-9]/g, '')
      .slice(-8)
      .padStart(8, '4');

    const { fullDateTime, timeOnly, compactDate } = formatReceiptDateTime(receipt.paidAt);
    const shortReceiptNo = `#KR-${String(receipt.receiptNumber || receipt.orderId || refDigits).slice(0, 6).toUpperCase()}`;
    const barcodeValue = `${refDigits.slice(0, 6)}${compactDate.slice(0, 6)}`;
    const totalQty = items.reduce((sum, it) => sum + it.qty, 0);

    return {
      restaurantName: (receipt.restaurantName || 'KRISH CAFE AND RESTAURANT').toUpperCase(),
      addressLine1: (receipt.addressLine1 || 'NEAR RATHINAM CLG, EACHANARI').toUpperCase(),
      addressLine2: (receipt.addressLine2 || 'COIMBATORE - 641021').toUpperCase(),
      phone: receipt.phone || '8760633322',
      fullDateTime,
      timeOnly,
      shortReceiptNo,
      tableDisplay: String(receipt.tableNumber || '1').padStart(2, '0'),
      guestName: String(receipt.customerName || 'WALK-IN GUEST').toUpperCase(),
      guestsCount: receipt.guestsCount || 1,
      totalQty,
      items,
      subtotal,
      discountAmount,
      taxAmount,
      total,
      paymentMethod: String(receipt.paymentMethod || 'CASH').toUpperCase(),
      refCode: `REF: ${refDigits}`,
      statusText: receipt.statusText || 'PAID',
      barcodeValue,
    };
  }, [receipt]);

  const barcode = useMemo(() => {
    return buildBarcodeBars(normalized?.barcodeValue || '254720250930');
  }, [normalized?.barcodeValue]);

  if (!normalized) return null;

  const handlePrint = () => {
    const itemRowsHtml = normalized.items
      .map(
        (it) => `
          <div class="row item-row">
            <span class="left">${it.qty > 1 ? `${it.qty}X ` : '1X '}${escapeHtml(it.name)}</span>
            <span class="right">₹${it.lineTotal.toFixed(2)}</span>
          </div>`
      )
      .join('');

    const barcodeRectsHtml = barcode.bars
      .map(
        (b) => `<rect x="${b.x}" y="0" width="${b.w}" height="42" fill="#000000" />`
      )
      .join('');

    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Receipt ${escapeHtml(normalized.shortReceiptNo)}</title>
  <style>
    @page { size: 80mm auto; margin: 4mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 8px 10px;
      background: #ffffff;
      color: #111111;
      font-family: "Courier New", Courier, monospace;
      font-size: 12px;
      line-height: 1.45;
      width: 72mm;
    }
    .center { text-align: center; }
    .brand {
      font-size: 17px;
      font-weight: 700;
      letter-spacing: 0.6px;
      line-height: 1.2;
      margin: 6px 0 4px;
    }
    .meta {
      font-size: 10.5px;
      line-height: 1.4;
      color: #222222;
    }
    .divider {
      border-top: 1.5px solid #111111;
      margin: 10px 0;
    }
    .row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 8px;
      margin: 2px 0;
    }
    .left { flex: 1; word-break: break-word; }
    .right { white-space: nowrap; text-align: right; }
    .bold { font-weight: 700; }
    .total-row {
      font-size: 14px;
      font-weight: 700;
      margin-top: 4px;
    }
    .footer-note {
      text-align: center;
      font-size: 11px;
      margin-top: 10px;
    }
    .barcode-wrap {
      text-align: center;
      margin-top: 8px;
    }
    .barcode-num {
      font-size: 11px;
      letter-spacing: 1px;
      margin-top: 3px;
    }
  </style>
</head>
<body>
  <div class="center">
    <svg width="34" height="36" viewBox="0 0 36 36" fill="none" stroke="#111111" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M10 4v9a3 3 0 0 0 3 3v16" />
      <path d="M14 4v9a3 3 0 0 1-3 3" />
      <path d="M12 4v12" />
      <path d="M25 4v28" />
      <path d="M25 4c3 0 4 4 4 10h-4" />
    </svg>
    <div class="brand">${escapeHtml(normalized.restaurantName)}</div>
    <div class="meta">
      <div>${escapeHtml(normalized.addressLine1)}</div>
      <div>${escapeHtml(normalized.addressLine2)}</div>
      <div>PHONE: ${escapeHtml(normalized.phone)}</div>
    </div>
  </div>

  <div class="divider"></div>

  <div class="center" style="margin-bottom:4px;">${escapeHtml(normalized.fullDateTime)}</div>
  <div class="row">
    <span class="left">RECEIPT: ${escapeHtml(normalized.shortReceiptNo)}</span>
    <span class="right">TABLE: ${escapeHtml(normalized.tableDisplay)}</span>
  </div>
  <div class="row">
    <span class="left">GUEST: ${escapeHtml(normalized.guestName)}</span>
    <span class="right">GUESTS: ${escapeHtml(normalized.guestsCount)}</span>
  </div>

  <div class="divider"></div>

  ${itemRowsHtml}

  <div style="margin-top:10px;">
    <div class="row">
      <span class="left">SUBTOTAL:</span>
      <span class="right">₹${normalized.subtotal.toFixed(2)}</span>
    </div>
    ${normalized.discountAmount > 0 ? `
    <div class="row">
      <span class="left">DISCOUNT:</span>
      <span class="right">-₹${normalized.discountAmount.toFixed(2)}</span>
    </div>` : ''}
    <div class="row">
      <span class="left">TAX (5% GST):</span>
      <span class="right">₹${normalized.taxAmount.toFixed(2)}</span>
    </div>
    <div class="row total-row">
      <span class="left">TOTAL:</span>
      <span class="right">₹${normalized.total.toFixed(2)}</span>
    </div>
  </div>

  <div class="divider"></div>

  <div class="row">
    <span class="left">PAYMENT:</span>
    <span class="right">${escapeHtml(normalized.paymentMethod)}</span>
  </div>
  <div class="row">
    <span class="left">TIME:</span>
    <span class="right">${escapeHtml(normalized.timeOnly)}</span>
  </div>
  <div class="row">
    <span class="left">REF:</span>
    <span class="right">${escapeHtml(normalized.refCode)}</span>
  </div>
  <div class="row">
    <span class="left">STATUS:</span>
    <span class="right bold">${escapeHtml(normalized.statusText)}</span>
  </div>

  <div class="footer-note">
    <div>THANK YOU FOR DINING WITH US!</div>
    <div>PLEASE COME AGAIN!</div>
  </div>

  <div class="barcode-wrap">
    <svg width="190" height="44" viewBox="0 0 ${barcode.totalWidth} 44" xmlns="http://www.w3.org/2000/svg">
      ${barcodeRectsHtml}
    </svg>
    <div class="barcode-num">${escapeHtml(normalized.barcodeValue)}</div>
  </div>
</body>
</html>`;

    try {
      const existingFrame = document.getElementById('krish-thermal-print-frame');
      if (existingFrame) existingFrame.remove();

      const iframe = document.createElement('iframe');
      iframe.id = 'krish-thermal-print-frame';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow?.document || iframe.contentDocument;
      if (!doc) {
        window.print();
        return;
      }

      doc.open();
      doc.write(html);
      doc.close();

      setTimeout(() => {
        try {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
        } catch {
          window.print();
        }
      }, 200);
    } catch {
      window.print();
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-stone-950/75 backdrop-blur-xs animate-fade-in overflow-y-auto">
      <div className="w-full max-w-sm bg-stone-900 rounded-3xl border border-stone-700 shadow-2xl overflow-hidden my-6">
        {/* Top Modal Controls */}
        <div className="px-5 py-3.5 bg-stone-950 border-b border-stone-800 flex items-center justify-between text-white">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">
              Session Ended &bull; Thermal Bill
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-white hover:bg-stone-800 rounded-full transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Thermal Paper Preview Sheet */}
        <div className="p-5 bg-stone-200 max-h-[68vh] overflow-y-auto flex justify-center">
          <div
            className="w-full max-w-[300px] bg-[#FAF9F6] text-stone-950 px-5 py-6 shadow-lg border border-stone-300"
            style={{ fontFamily: '"Courier New", Courier, monospace' }}
          >
            {/* Cutlery Icon + Header */}
            <div className="text-center">
              <div className="flex justify-center mb-1.5">
                <svg
                  width="32"
                  height="34"
                  viewBox="0 0 36 36"
                  fill="none"
                  stroke="#111111"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M10 4v9a3 3 0 0 0 3 3v16" />
                  <path d="M14 4v9a3 3 0 0 1-3 3" />
                  <path d="M12 4v12" />
                  <path d="M25 4v28" />
                  <path d="M25 4c3 0 4 4 4 10h-4" />
                </svg>
              </div>
              <h2 className="text-[17px] font-bold tracking-wide leading-tight uppercase">
                {normalized.restaurantName}
              </h2>
              <div className="text-[10px] text-stone-700 leading-snug mt-1.5">
                <p>{normalized.addressLine1}</p>
                <p>{normalized.addressLine2}</p>
                <p>PHONE: {normalized.phone}</p>
              </div>
            </div>

            <div className="border-t-[1.5px] border-stone-900 my-3" />

            {/* Receipt Meta */}
            <div className="text-[11px] space-y-1">
              <p className="text-center font-medium">{normalized.fullDateTime}</p>
              <div className="flex justify-between gap-2">
                <span>RECEIPT: {normalized.shortReceiptNo}</span>
                <span>TABLE: {normalized.tableDisplay}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="truncate">GUEST: {normalized.guestName}</span>
                <span className="shrink-0">GUESTS: {normalized.guestsCount}</span>
              </div>
            </div>

            <div className="border-t-[1.5px] border-stone-900 my-3" />

            {/* Itemized Dishes */}
            <div className="text-[11.5px] space-y-1">
              {normalized.items.map((it, idx) => (
                <div key={idx} className="flex justify-between items-start gap-2">
                  <span className="break-words">
                    {it.qty}X {it.name}
                  </span>
                  <span className="shrink-0 font-medium">₹{it.lineTotal.toFixed(2)}</span>
                </div>
              ))}
            </div>

            {/* Totals Block */}
            <div className="text-[11.5px] space-y-0.5 mt-3.5">
              <div className="flex justify-between">
                <span>SUBTOTAL:</span>
                <span>₹{normalized.subtotal.toFixed(2)}</span>
              </div>
              {normalized.discountAmount > 0 && (
                <div className="flex justify-between">
                  <span>DISCOUNT:</span>
                  <span>-₹{normalized.discountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>TAX (5% GST):</span>
                <span>₹{normalized.taxAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[13.5px] font-bold pt-1">
                <span>TOTAL:</span>
                <span>₹{normalized.total.toFixed(2)}</span>
              </div>
            </div>

            <div className="border-t-[1.5px] border-stone-900 my-3" />

            {/* Payment Footer Block */}
            <div className="text-[11px] space-y-0.5">
              <div className="flex justify-between">
                <span>PAYMENT:</span>
                <span>{normalized.paymentMethod}</span>
              </div>
              <div className="flex justify-between">
                <span>TIME:</span>
                <span>{normalized.timeOnly}</span>
              </div>
              <div className="flex justify-between">
                <span>REF:</span>
                <span>{normalized.refCode}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span>STATUS:</span>
                <span>{normalized.statusText}</span>
              </div>
            </div>

            {/* Thank You + Barcode */}
            <div className="text-center text-[10.5px] mt-4 space-y-0.5">
              <p className="font-bold">THANK YOU FOR DINING WITH US!</p>
              <p>PLEASE COME AGAIN!</p>
            </div>

            <div className="mt-3 flex flex-col items-center">
              <svg
                width="195"
                height="44"
                viewBox={`0 0 ${barcode.totalWidth} 44`}
                xmlns="http://www.w3.org/2000/svg"
              >
                {barcode.bars.map((b, idx) => (
                  <rect key={idx} x={b.x} y={0} width={b.w} height={42} fill="#111111" />
                ))}
              </svg>
              <span className="text-[11px] tracking-widest mt-1">{normalized.barcodeValue}</span>
            </div>
          </div>
        </div>

        {/* Action Footer */}
        <div className="p-4 bg-stone-950 border-t border-stone-800 flex items-center gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-xs font-bold text-stone-300 bg-stone-800 hover:bg-stone-700 rounded-xl transition cursor-pointer"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="flex-1 py-2.5 px-4 bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer active:scale-98"
          >
            <Printer className="w-4 h-4" />
            <span>Print Thermal Bill</span>
          </button>
        </div>
      </div>
    </div>
  );
}
