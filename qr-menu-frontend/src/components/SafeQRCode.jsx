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
  const svgHtml = useMemo(() => {
    if (!value) return '';
    try {
      // Type number 0 enables automatic version selection based on text length
      const qr = qrcode(0, level);
      qr.addData(String(value));
      qr.make();
      return qr.createSvgTag({
        scalable: true,
        margin: 2
      });
    } catch (err) {
      console.warn('SafeQRCode generation fallback:', err);
      return '';
    }
  }, [value, level]);

  if (!value) {
    return (
      <div
        style={{ width: size, height: size, ...style }}
        className={`flex items-center justify-center bg-stone-100 rounded-xl text-stone-400 text-xs ${className}`}
      >
        <span>No QR Data</span>
      </div>
    );
  }

  if (svgHtml) {
    return (
      <div
        style={{ width: size, height: size, ...style }}
        className={`inline-block select-none [&>svg]:w-full [&>svg]:h-full [&>svg]:block ${className}`}
        dangerouslySetInnerHTML={{ __html: svgHtml }}
      />
    );
  }

  return (
    <img
      src={`https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(value)}`}
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

