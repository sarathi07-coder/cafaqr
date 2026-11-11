/**
 * Parse backend timestamps reliably as UTC when no timezone offset is present.
 * SQLite/D1 stores datetime('now') as "YYYY-MM-DD HH:MM:SS" in UTC without "Z".
 */
export function parseUtcTimestamp(value) {
  if (!value) return new Date();
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? new Date() : value;
  if (typeof value === 'string') {
    const s = value.trim();
    if (!s) return new Date();
    if (s.includes('T')) {
      const iso = s.endsWith('Z') || /[+-]\d{2}:?\d{2}$/.test(s) ? s : `${s}Z`;
      const parsed = new Date(iso);
      return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
    }
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/.test(s)) {
      const parsed = new Date(`${s.replace(' ', 'T')}Z`);
      return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
    }
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}
