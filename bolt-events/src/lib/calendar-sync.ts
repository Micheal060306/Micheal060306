import 'server-only';
import { appUrl } from './auth';
import { anon } from './db';
import { upsertEvent, type CalBooking } from './gcal';
import { GoogleError } from './google';
import { getIntegration } from './integrations';

/** Writes queued bookings to the academy's Google Calendar. Returns counts, or null when the integration is off or idle. */
export async function syncCalendar(limit = 25): Promise<{ synced: number; failed: number; error?: string } | null> {
  const jobs = (await anon('select calendar_claim($1) j', [limit])).map((r) => r.j as CalBooking & { changed: string });
  if (!jobs.length) return null;
  const cfg = await getIntegration('gcal'), v = cfg.values, out = { synced: 0, failed: 0, error: undefined as string | undefined };
  const sa = { client_email: v.client_email, private_key: v.private_key }, reminderMinutes = Math.max(0, Math.min(1440, Number(v.reminder_minutes ?? 30) || 0));
  for (const b of jobs) { // in order, so one Google error (bad key, no access) is reported once rather than per booking in parallel
    let err: string | null = null;
    if (!cfg.complete) err = 'Google Calendar is not fully configured.';
    else try { await upsertEvent(sa, v.calendar_id, b, { reminderMinutes, adminUrl: `${appUrl()}/admin/reservations/${b.id}` }); } catch (e: any) { err = e instanceof GoogleError ? e.message : `Calendar sync failed: ${e?.message ?? 'unknown error'}`; }
    await anon('select calendar_finish($1,$2,$3)', [b.id, b.changed, err]);
    if (err) { out.failed++; out.error ??= err; } else out.synced++;
  }
  return out;
}
