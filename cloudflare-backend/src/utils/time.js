/**
 * Convert SQLite/D1 UTC timestamps ("YYYY-MM-DD HH:MM:SS") or naive ISO strings
 * into explicit UTC ISO-8601 strings ending with "Z" so browser clients in
 * non-UTC timezones (e.g. IST UTC+05:30) do not misparse them as local time.
 */
export function toUtcIso(ts) {
  if (!ts) return null;
  if (ts instanceof Date) return Number.isNaN(ts.getTime()) ? null : ts.toISOString();
  if (typeof ts !== 'string') {
    const parsed = new Date(ts);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  const s = ts.trim();
  if (!s) return null;
  if (s.includes('T')) {
    if (s.endsWith('Z') || /[+-]\d{2}:?\d{2}$/.test(s)) return s;
    return `${s}Z`;
  }
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/.test(s)) {
    return `${s.replace(' ', 'T')}Z`;
  }
  const parsed = new Date(s);
  return Number.isNaN(parsed.getTime()) ? s : parsed.toISOString();
}
