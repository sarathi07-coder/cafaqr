import React, { useMemo } from 'react';
import qrcode from 'qrcode-generator';

/**
 * 100% Native, React 19-Safe QR Code Component
 * - Zero dependency on Canvas, Path2D, or React internals
 * - Renders pure SVG via standard <img> data-URI
 * - Completely immune to "Illegal constructor" or Web Component symbol mismatches
 */
export default function SafeQRCode({
  value = '',
  size = 190,
  level = 'M',
  className = '',
  style = {}
}) {
  const qrDataUrl = useMemo(() => {
    if (!value) return '';
    try {
      // Type number 0 enables automatic version selection based on text length
      const qr = qrcode(0, level);
      qr.addData(String(value));
      qr.make();
      const svgString = qr.createSvgTag({
        scalable: true,
        margin: 2
      });
      return `data:image/svg+xml;utf8,${encodeURIComponent(svgString)}`;
    } catch (err) {
      console.warn('SafeQRCode generation fallback:', err);
      // Secondary fallback to free public standard QR API
      return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(value)}`;
    }
  }, [value, level, size]);

  if (!qrDataUrl) {
    return (
      <div
        style={{ width: size, height: size, ...style }}
        className={`flex items-center justify-center bg-stone-100 rounded-xl text-stone-400 text-xs ${className}`}
      >
        <span>No QR Data</span>
      </div>
    );
  }

  return (
    <img
      src={qrDataUrl}
      width={size}
      height={size}
      alt="QR Code"
      className={`object-contain select-none ${className}`}
      style={{ width: size, height: size, ...style }}
      loading="eager"
    />
  );
}

// Named alias matching legacy QRCodeSVG import
export const QRCodeSVG = SafeQRCode;
export const QRCodeCanvas = SafeQRCode;
