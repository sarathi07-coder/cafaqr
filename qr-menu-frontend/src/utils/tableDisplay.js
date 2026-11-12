/**
 * Shared Table & Parcel / Takeaway formatting + standee QR download helpers.
 */

export function isParcelTable(tableNumber, orderType) {
  if (String(orderType || '').trim().toUpperCase() === 'PARCEL') return true;
  if (tableNumber === undefined || tableNumber === null || tableNumber === '') return false;
  if (String(tableNumber).trim().toUpperCase() === 'PARCEL') return true;
  const parsed = Number(tableNumber);
  return Number.isFinite(parsed) && parsed === 0;
}

export function getOrdinalTableLabel(tableNumber) {
  if (isParcelTable(tableNumber)) return 'Parcel / Takeaway';
  const n = parseInt(tableNumber, 10);
  if (!Number.isFinite(n) || n <= 0) return '1st Table';
  const mod100 = n % 100;
  let suffix = 'th';
  if (mod100 < 11 || mod100 > 13) {
    if (n % 10 === 1) suffix = 'st';
    else if (n % 10 === 2) suffix = 'nd';
    else if (n % 10 === 3) suffix = 'rd';
  }
  return `${n}${suffix} Table`;
}

export function formatTableLabel(tableNumber, orderType) {
  if (isParcelTable(tableNumber, orderType)) return 'Parcel / Takeaway';
  const n = tableNumber !== undefined && tableNumber !== null && tableNumber !== '' ? tableNumber : '1';
  return `Table #${n}`;
}

export function formatTableShort(tableNumber, orderType) {
  if (isParcelTable(tableNumber, orderType)) return 'PARCEL';
  const n = tableNumber !== undefined && tableNumber !== null && tableNumber !== '' ? tableNumber : '1';
  return `T${String(n).padStart(2, '0')}`;
}

function getQrSvgWithSize(rawSvg, qrDataUrl) {
  if (rawSvg && typeof rawSvg === 'string') {
    if (rawSvg.includes('width=')) return rawSvg;
    return rawSvg.replace('<svg', '<svg width="560" height="560"');
  }
  if (qrDataUrl && qrDataUrl.startsWith('data:image/svg+xml')) {
    const encoded = qrDataUrl.split(',')[1] || '';
    const decoded = decodeURIComponent(encoded);
    return decoded.includes('width=') ? decoded : decoded.replace('<svg', '<svg width="560" height="560"');
  }
  return '';
}

function triggerFileDownload(url, filename) {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Generates and downloads a print-ready high-resolution PNG standee card
 * containing ONLY the restaurant name, QR code, and table/parcel label.
 */
export async function downloadStandeeQrPng({
  restaurantName = 'KRISH Cafe & Restaurant',
  tableNumber,
  isParcel = false,
  qrCodeSvg,
  qrCodeDataUrl,
}) {
  const parcelMode = Boolean(isParcel) || isParcelTable(tableNumber);
  const svgString = getQrSvgWithSize(qrCodeSvg, qrCodeDataUrl);
  const svgBlobUrl = svgString
    ? URL.createObjectURL(new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' }))
    : qrCodeDataUrl;

  if (!svgBlobUrl) {
    throw new Error('QR graphic is not loaded yet.');
  }

  try {
    const qrImg = await new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to render QR image for download'));
      img.src = svgBlobUrl;
    });

    const width = 900;
    const height = 1140;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // Clean white card background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // Subtle dark outer frame + warm gold inner trim
    ctx.strokeStyle = '#1c1917';
    ctx.lineWidth = 14;
    ctx.strokeRect(24, 24, width - 48, height - 48);

    ctx.strokeStyle = parcelMode ? '#059669' : '#d97706';
    ctx.lineWidth = 4;
    ctx.strokeRect(42, 42, width - 84, height - 84);

    // Dark top band for Restaurant Name ONLY
    ctx.fillStyle = '#141210';
    ctx.fillRect(44, 44, width - 88, 170);

    ctx.fillStyle = '#fbbf24';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '900 42px Georgia, "Times New Roman", serif';
    ctx.fillText(String(restaurantName || 'KRISH Cafe & Restaurant').toUpperCase(), width / 2, 129);

    // Scannable QR Code center block
    const qrSize = 590;
    const qrX = (width - qrSize) / 2;
    const qrY = 260;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(qrX - 18, qrY - 18, qrSize + 36, qrSize + 36);
    ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

    // Divider line
    ctx.strokeStyle = '#e7e5e4';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(120, 895);
    ctx.lineTo(width - 120, 895);
    ctx.stroke();

    // Primary Table / Parcel label ONLY
    const mainTitle = parcelMode ? 'PARCEL / TAKEAWAY' : `TABLE ${tableNumber}`;
    const subTitle = parcelMode ? 'Takeaway Counter' : getOrdinalTableLabel(tableNumber);

    ctx.fillStyle = parcelMode ? '#065f46' : '#1c1917';
    ctx.font = parcelMode ? '900 54px system-ui, -apple-system, sans-serif' : '900 72px system-ui, -apple-system, sans-serif';
    ctx.fillText(mainTitle, width / 2, 962);

    ctx.fillStyle = parcelMode ? '#047857' : '#b45309';
    ctx.font = '700 34px system-ui, -apple-system, sans-serif';
    ctx.fillText(subTitle, width / 2, 1028);

    const pngUrl = canvas.toDataURL('image/png');
    const filename = parcelMode ? 'krish_parcel_takeaway_qr.png' : `krish_table_${tableNumber}_qr.png`;
    triggerFileDownload(pngUrl, filename);
  } finally {
    if (svgString && svgBlobUrl.startsWith('blob:')) {
      URL.revokeObjectURL(svgBlobUrl);
    }
  }
}

/**
 * Downloads the raw crisp vector SVG QR code locally without broken relative links.
 */
export function downloadStandeeQrSvg({ tableNumber, isParcel = false, qrCodeSvg, qrCodeDataUrl }) {
  const parcelMode = Boolean(isParcel) || isParcelTable(tableNumber);
  const svgString = getQrSvgWithSize(qrCodeSvg, qrCodeDataUrl);
  if (!svgString) return;
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const blobUrl = URL.createObjectURL(blob);
  const filename = parcelMode ? 'krish_parcel_takeaway_qr.svg' : `krish_table_${tableNumber}_qr.svg`;
  triggerFileDownload(blobUrl, filename);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
}

