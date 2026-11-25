export const TZ = 'Asia/Kolkata';
type D = string | Date;
const f = (o: Intl.DateTimeFormatOptions) => { const x = new Intl.DateTimeFormat('en-IN', { timeZone: TZ, ...o }); return (d: D) => x.format(new Date(d)); };
export const fmtDate = f({ day: 'numeric', month: 'short', year: 'numeric' });
export const fmtLong = f({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const t = f({ hour: 'numeric', minute: '2-digit', hour12: true });
export const fmtTime = (d: D) => t(d).toUpperCase();
export const fmtRange = (a: D, b: D) => `${fmtTime(a)} – ${fmtTime(b)}`;
export const fmtDateTime = (d: D) => `${fmtDate(d)}, ${fmtTime(d)}`;
/** Formats a plain YYYY-MM-DD calendar date. */
const day = (o: Intl.DateTimeFormatOptions) => { const x = new Intl.DateTimeFormat('en-IN', { timeZone: 'UTC', ...o }); return (d: string) => x.format(new Date(`${d}T00:00:00Z`)); };
export const fmtDay = day({ day: 'numeric', month: 'short', year: 'numeric' });
export const fmtDayLong = day({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
export const fmtDayShort = day({ day: 'numeric', month: 'short' });
export const fmtWeekday = day({ weekday: 'short' });
export const fmtMonth = day({ month: 'long', year: 'numeric' });
export const fmtSpan = (a: string, b: string) => (a === b ? fmtDay(a) : `${fmtDay(a)} – ${fmtDay(b)}`);
export const fmtHM = (s: string) => fmtTime(`2000-01-01T${s.slice(0, 5)}:00+05:30`);
const iso = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
export const istDate = (d: D = new Date()) => iso.format(new Date(d));
export const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
/** Value for <input type="datetime-local"> in IST. */
export const toLocalInput = (d: D | null) => d ? `${istDate(d)}T${new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }).format(new Date(d))}` : '';
export const label = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export const RANGES = [['today', 'Today'], ['yesterday', 'Yesterday'], ['7d', 'Last 7 Days'], ['30d', 'Last 30 Days'], ['month', 'This Month'], ['custom', 'Custom Date Range']] as const;
const isDay = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
export function parseRange(sp: Record<string, any>, now: D = new Date()) {
  const t = istDate(now); let key: string = RANGES.some(([k]) => k === sp.range) ? sp.range : '30d';
  let from = addDays(t, -29), to = t;
  if (key === 'today') from = t;
  else if (key === 'yesterday') from = to = addDays(t, -1);
  else if (key === '7d') from = addDays(t, -6);
  else if (key === 'month') from = `${t.slice(0, 7)}-01`;
  else if (key === 'custom') {
    if (isDay(sp.from) && isDay(sp.to) && sp.from <= sp.to) { from = sp.from; to = sp.to; } else key = '30d';
  }
  return { key, from, to };
}
