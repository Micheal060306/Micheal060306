// "Add to Google Calendar" link for participants. Pure, so pages, notifications and tests can share it.
const stamp = (d: Date | string) => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
export function addToCalendarUrl(o: { title: string; start: Date | string; end: Date | string; details?: string; location?: string }) {
  const p = new URLSearchParams({ action: 'TEMPLATE', text: o.title, dates: `${stamp(o.start)}/${stamp(o.end)}`, ctz: 'Asia/Kolkata' });
  if (o.details) p.set('details', o.details);
  if (o.location) p.set('location', o.location);
  return `https://calendar.google.com/calendar/render?${p}`;
}
