// Date helpers for the public map (English).
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// "2023-06-16" → "16 Jun 2023", "2023-06" → "Jun 2023"
export function fmtDate(d) {
  if (!d) return 'undated';
  const [y, m, day] = d.split('-');
  return [day && String(+day), m && MONTHS[m - 1], y].filter(Boolean).join(' ');
}

export function fmtRange(a, b) {
  if (!b || b === a) return fmtDate(a);
  if (a?.length === 10 && a.slice(0, 7) === b.slice(0, 7)) return `${+a.slice(8)}–${fmtDate(b)}`;
  return `${fmtDate(a)} → ${b ? fmtDate(b) : 'today'}`;
}
