// Google Calendar client: one event per reservation, written with a fixed event ID so it can be retried safely.
import { GoogleError, SCOPES, googleCall, type ServiceAccount } from './google.ts';

const api = () => process.env.GOOGLE_CALENDAR_URL ?? 'https://www.googleapis.com';
export type CalBooking = { id: string; reference: string; participant_name: string; mobile: string; email?: string | null; message?: string | null; status: string;
  event_name: string; event_type: string; location?: string | null; meeting_link?: string | null; starts_at: string; ends_at: string; staff_name?: string | null };

/** Accepts a calendar ID (as shown under "Integrate calendar") or a Google Calendar link that carries one. */
export function parseCalendarId(s: string): string | null {
  let v = s.trim();
  try { const u = new URL(v); v = u.searchParams.get('src') ?? (u.searchParams.get('cid') ? Buffer.from(u.searchParams.get('cid')!, 'base64').toString() : ''); } catch { /* not a link */ }
  v = decodeURIComponent(v).trim();
  return /^[^\s@/]{1,200}@[^\s@/]{1,200}\.[a-z]{2,}$/i.test(v) ? v : null;
}
/** Google event IDs allow 0-9 and a-v; a reservation's UUID in hex fits. */
export const eventId = (reservationId: string) => `bolt${reservationId.replace(/-/g, '').toLowerCase()}`;

export function buildEvent(b: CalBooking, o: { reminderMinutes: number; adminUrl?: string }) {
  const online = b.event_type === 'online', lines = [
    `Booking ID: ${b.reference}`, `Participant: ${b.participant_name}`, `Mobile: ${b.mobile}`, b.email ? `Email: ${b.email}` : '',
    `Staff: ${b.staff_name ?? 'Unassigned'}`, online && b.meeting_link ? `Joining link: ${b.meeting_link}` : '', b.message ? `\nMessage:\n${b.message}` : '',
    o.adminUrl ? `\nOpen in Bolt Events: ${o.adminUrl}` : '',
  ].filter(Boolean);
  return {
    summary: `${b.status === 'cancelled' ? 'Cancelled: ' : ''}${b.participant_name}, ${b.event_name}${b.staff_name ? ` (${b.staff_name})` : ''}`,
    description: lines.join('\n'),
    location: online ? (b.meeting_link ?? 'Online') : (b.location ?? ''),
    start: { dateTime: new Date(b.starts_at).toISOString(), timeZone: 'Asia/Kolkata' },
    end: { dateTime: new Date(b.ends_at).toISOString(), timeZone: 'Asia/Kolkata' },
    status: b.status === 'cancelled' ? 'cancelled' : 'confirmed',
    reminders: { useDefault: false, overrides: o.reminderMinutes > 0 ? [{ method: 'popup', minutes: o.reminderMinutes }] : [] },
    extendedProperties: { private: { bolt_reference: b.reference } },
  };
}

/** Creates, updates or cancels the booking's event. Returns what happened. */
export async function upsertEvent(sa: ServiceAccount, calendarId: string, b: CalBooking, o: { reminderMinutes: number; adminUrl?: string }): Promise<'updated' | 'created' | 'absent'> {
  const base = `${api()}/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`, id = eventId(b.id), body = buildEvent(b, o);
  const refused = (e: GoogleError) => new GoogleError(`Google Calendar refused access (${e.message}). Share the calendar with ${sa.client_email} and allow "Make changes to events", then check the calendar ID.`, true, e.status);
  try { await googleCall(sa, SCOPES.calendar, `${base}/${id}?sendUpdates=none`, 'PUT', body); return 'updated'; } catch (e) {
    if (!(e instanceof GoogleError) || !e.status) throw e;
    if (e.status === 403) throw refused(e);
    if (e.status !== 404) throw new GoogleError(`Google Calendar error: ${e.message}`, e.permanent, e.status);
  }
  if (body.status === 'cancelled') return 'absent'; // never created, nothing to cancel
  try { await googleCall(sa, SCOPES.calendar, `${base}?sendUpdates=none`, 'POST', { ...body, id }); return 'created'; } catch (e) {
    if (!(e instanceof GoogleError) || !e.status) throw e;
    if (e.status === 403 || e.status === 404) throw refused(e);
    throw new GoogleError(`Google Calendar error: ${e.message}`, e.permanent, e.status);
  }
}
