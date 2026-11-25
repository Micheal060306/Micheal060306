// iCalendar (RFC 5545) invites for email. Pure, so notifications, the invite queue and tests share it.
import { createHash } from 'node:crypto';

export type Invite = {
  uid: string; sequence: number; method: 'REQUEST' | 'CANCEL'; start: Date | string; end: Date | string;
  summary: string; description?: string; location?: string; url?: string;
  organizer: { name?: string; email: string }; attendees: { name?: string; email: string }[]; reminderMinutes?: number;
};
/** Stable per booking, without exposing the booking's secret key. */
export const inviteUid = (idem: string) => `${createHash('sha256').update(`bolt-events:${idem}`).digest('hex').slice(0, 32)}@bolt-events`;
/** Higher for every later change, so calendars apply updates in order. Seconds since 2024, safe as a 32-bit integer until 2092. */
export const inviteSequence = (at = Date.now()) => Math.max(0, Math.floor((at - Date.UTC(2024, 0, 1)) / 1000));

const stamp = (d: Date | string) => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const text = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const param = (s: string) => `"${s.replace(/["\r\n]/g, '')}"`;
/** Lines longer than 75 octets continue on the next line after a space (RFC 5545 3.1), without splitting a UTF-8 character. */
function fold(line: string) {
  const out: string[] = []; let cur = '', bytes = 0;
  for (const ch of line) { const n = Buffer.byteLength(ch); if (bytes + n > (out.length ? 74 : 75)) { out.push(cur); cur = ''; bytes = 0; } cur += ch; bytes += n; }
  out.push(cur); return out.join('\r\n ');
}
export function buildIcs(i: Invite) {
  const who = (p: { name?: string; email: string }) => `${p.name ? `;CN=${param(p.name)}` : ''}:mailto:${p.email}`;
  const lines = [
    'BEGIN:VCALENDAR', 'PRODID:-//Bolt Academy//Bolt Events//EN', 'VERSION:2.0', 'CALSCALE:GREGORIAN', `METHOD:${i.method}`,
    'BEGIN:VEVENT', `UID:${i.uid}`, `SEQUENCE:${i.sequence}`, `DTSTAMP:${stamp(new Date())}`, `DTSTART:${stamp(i.start)}`, `DTEND:${stamp(i.end)}`,
    `SUMMARY:${text(i.summary)}`, ...(i.description ? [`DESCRIPTION:${text(i.description)}`] : []), ...(i.location ? [`LOCATION:${text(i.location)}`] : []),
    ...(i.url ? [`URL:${i.url}`] : []), `ORGANIZER${who(i.organizer)}`,
    ...i.attendees.map((a) => `ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=${i.method === 'CANCEL' ? 'DECLINED' : 'ACCEPTED'};RSVP=FALSE${who(a)}`),
    `STATUS:${i.method === 'CANCEL' ? 'CANCELLED' : 'CONFIRMED'}`, 'TRANSP:OPAQUE',
    ...(i.method === 'REQUEST' && i.reminderMinutes ? ['BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${text(i.summary)}`, `TRIGGER:-PT${i.reminderMinutes}M`, 'END:VALARM'] : []),
    'END:VEVENT', 'END:VCALENDAR',
  ];
  return lines.map(fold).join('\r\n') + '\r\n';
}
/** Accepts emails separated by commas, semicolons, spaces or new lines. Null when any is invalid. */
export function parseEmails(s: string, max = 10): string[] | null {
  const list = [...new Set(s.split(/[\s,;]+/).map((x) => x.trim().toLowerCase()).filter(Boolean))];
  return list.length <= max && list.every((x) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x) && x.length <= 254) ? list : null;
}
