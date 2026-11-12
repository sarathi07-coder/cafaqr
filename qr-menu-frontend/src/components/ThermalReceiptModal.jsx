import React, { useMemo } from 'react';
import { Printer, X, CheckCircle2, ExternalLink, QrCode } from 'lucide-react';
import qrcode from 'qrcode-generator';
import { encodeCode128B } from '../utils/barcode';
import SafeQRCode from './SafeQRCode';

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
  };
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function createQrSvgMarkup(url) {
  if (!url) return '';
  try {
    const qr = qrcode(0, 'M');
    qr.addData(String(url));
    qr.make();
    return qr.createSvgTag({ scalable: true, margin: 1 });
  } catch {
    return '';
  }
}

/**
 * Thermal POS Receipt preview & direct printer modal.
 * Encodes a genuine ISO/IEC 15417 Code-128B barcode plus a scannable digital bill QR
 * so barcode/camera scans display full itemized bill details on /bill/:code or in Admin.
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

    const rawId = String(receipt.orderId || receipt.receiptNumber || Date.now()).replace(/^#/, '');
    const idPrefix6 = rawId.replace(/^(KR|KT)[-_]?/i, '').slice(0, 6).toUpperCase();
    const barcodePrefix = receipt.isCombinedTable ? 'KT' : 'KR';
    const barcodeCode = receipt.barcodeCode || `${barcodePrefix}-${idPrefix6}`;

    const refDigits = String(
      receipt.refNumber ||
      receipt.orderId ||
      Date.now()
    )
      .replace(/[^0-9]/g, '')
      .slice(-8)
      .padStart(8, '4');

    const { fullDateTime, timeOnly } = formatReceiptDateTime(receipt.paidAt);
    const shortReceiptNo = `#${barcodeCode}`;

    const origin = typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://cafaqr.p7404467.workers.dev';
    const billUrl = `${origin}/bill/${encodeURIComponent(barcodeCode)}`;

    return {
      restaurantName: (receipt.restaurantName || 'KRISH CAFE AND RESTAURANT').toUpperCase(),
      addressLine1: (receipt.addressLine1 || 'RATHINAM COLLEGE FRONT GATE').toUpperCase(),
      addressLine2: (receipt.addressLine2 || 'EACHANARI, COIMBATORE - 641021').toUpperCase(),
      phone: receipt.phone || '8760633322',
      fullDateTime,
      timeOnly,
      shortReceiptNo,
      barcodeCode,
      billUrl,
      logoSrc: `${origin}/krish_logo.png`,
      mascotSrc: `${origin}/krish_chef_mascot.png`,
      tableDisplay: Number(receipt.tableNumber) === 0
        ? 'PARCEL'
        : String(receipt.tableNumber ?? '1').padStart(2, '0'),
      guestName: String(receipt.customerName || 'WALK-IN GUEST').toUpperCase(),
      guestsCount: receipt.guestsCount || 1,
      items,
      subtotal,
      discountAmount,
      taxAmount,
      total,
      paymentMethod: String(receipt.paymentMethod || 'CASH').toUpperCase(),
      refCode: `REF: ${refDigits}`,
      statusText: receipt.statusText || 'PAID',
    };
  }, [receipt]);

  const barcode = useMemo(() => {
    return encodeCode128B(normalized?.barcodeCode || 'KR-000000');
  }, [normalized?.barcodeCode]);

  const qrSvgMarkup = useMemo(() => {
    return createQrSvgMarkup(normalized?.billUrl);
  }, [normalized?.billUrl]);

  if (!normalized) return null;

  const handlePrint = () => {
    const itemRowsHtml = normalized.items
      .map(
        (it) => `
          <div class="row item-row">
            <span class="left">${it.qty}X ${escapeHtml(it.name)}</span>
            <span class="right">₹${it.lineTotal.toFixed(2)}</span>
          </div>`
      )
      .join('');

    const barcodeRectsHtml = barcode.bars
      .map(
        (b) => `<rect x="${b.x}" y="0" width="${b.w}" height="46" fill="#000000" />`
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
      padding: 8px 10px 14px;
      background: #ffffff;
      color: #111111;
      font-family: "Courier New", Courier, monospace;
      font-size: 12px;
      line-height: 1.45;
      width: 72mm;
    }
    .center { text-align: center; }
    .logo-row {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      margin-bottom: 4px;
    }
    .logo-mascot {
      height: 36px;
      width: auto;
      object-fit: contain;
    }
    .logo-wordmark {
      height: 44px;
      width: auto;
      object-fit: contain;
    }
    .brand {
      font-size: 15px;
      font-weight: 700;
      letter-spacing: 0.5px;
      line-height: 1.2;
      margin: 4px 0 3px;
    }
    .meta {
      font-size: 10.5px;
      line-height: 1.38;
      color: #222222;
    }
    .divider {
      border-top: 1.5px solid #111111;
      margin: 9px 0;
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
      font-size: 10.5px;
      margin-top: 10px;
    }
    .scan-box {
      text-align: center;
      margin-top: 10px;
      padding: 6px 4px;
      background: #ffffff;
    }
    .qr-box {
      width: 76px;
      height: 76px;
      margin: 4px auto 6px;
    }
    .qr-box svg {
      width: 100%;
      height: 100%;
      display: block;
    }
    .barcode-svg {
      display: block;
      width: 100%;
      max-width: 230px;
      height: 48px;
      margin: 4px auto 0;
    }
    .barcode-num {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 1.4px;
      margin-top: 3px;
    }
    .scan-caption {
      font-size: 9px;
      letter-spacing: 0.4px;
      margin-top: 2px;
      color: #333333;
    }
  </style>
</head>
<body>
  <div class="center">
    <div class="logo-row">
      <img class="logo-mascot" src="${escapeHtml(normalized.mascotSrc)}" alt="Chef" />
      <img class="logo-wordmark" src="${escapeHtml(normalized.logoSrc)}" alt="KRISH Cafe &amp; Restaurant" />
    </div>
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

  <div style="margin-top:9px;">
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
    <div><strong>THANK YOU FOR DINING WITH US!</strong></div>
    <div>PLEASE COME AGAIN!</div>
  </div>

  <div class="scan-box">
    ${qrSvgMarkup ? `<div class="qr-box">${qrSvgMarkup}</div>` : ''}
    <svg class="barcode-svg" viewBox="0 0 ${barcode.totalWidth} 46" preserveAspectRatio="none" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${barcode.totalWidth}" height="46" fill="#ffffff" />
      ${barcodeRectsHtml}
    </svg>
    <div class="barcode-num">${escapeHtml(normalized.barcodeCode)}</div>
    <div class="scan-caption">SCAN QR OR BARCODE TO VIEW BILL INFO</div>
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
      }, 300);
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

        {/* Thermal Paper Preview Sheet (items-start + h-fit ensures bottom barcode never overflows card) */}
        <div className="p-5 bg-stone-200 max-h-[68vh] overflow-y-auto flex justify-center items-start">
          <div
            className="w-full max-w-[300px] shrink-0 h-fit bg-[#FAF9F6] text-stone-950 px-5 pt-5 pb-7 shadow-lg border border-stone-300"
            style={{ fontFamily: '"Courier New", Courier, monospace' }}
          >
            {/* Brand Logo + Header */}
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-1.5">
                <img
                  src="/krish_chef_mascot.png"
                  alt="KRISH Chef"
                  className="h-11 w-auto object-contain"
                />
                <img
                  src="/krish_logo.png"
                  alt="KRISH Cafe & Restaurant"
                  className="h-12 w-auto object-contain"
                />
              </div>
              <h2 className="text-[15px] font-bold tracking-wide leading-tight uppercase">
                {normalized.restaurantName}
              </h2>
              <div className="text-[10px] text-stone-700 leading-snug mt-1">
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

            {/* Thank You + Scannable Bill QR + Genuine Code-128B Barcode */}
            <div className="text-center text-[10.5px] mt-4 space-y-0.5">
              <p className="font-bold">THANK YOU FOR DINING WITH US!</p>
              <p>PLEASE COME AGAIN!</p>
            </div>

            <div className="mt-3 pt-2.5 border-t border-dashed border-stone-300 flex flex-col items-center bg-white rounded-xl p-2.5">
              <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-stone-600 mb-1.5">
                <QrCode className="w-3 h-3" />
                <span>Scan to View Bill Details</span>
              </div>
              <SafeQRCode value={normalized.billUrl} size={84} level="M" className="mb-2" />

              <div className="w-full px-1 py-1 bg-white">
                <svg
                  className="w-full h-11 block"
                  viewBox={`0 0 ${barcode.totalWidth} 44`}
                  preserveAspectRatio="none"
                  shapeRendering="crispEdges"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <rect x="0" y="0" width={barcode.totalWidth} height="44" fill="#ffffff" />
                  {barcode.bars.map((b, idx) => (
                    <rect key={idx} x={b.x} y={0} width={b.w} height={44} fill="#111111" />
                  ))}
                </svg>
              </div>
              <span className="text-[11px] font-bold tracking-[0.18em] mt-1 text-stone-900">
                {normalized.barcodeCode}
              </span>

              <a
                href={normalized.billUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 hover:text-amber-800 underline"
              >
                <span>Open Digital Bill Link</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
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
