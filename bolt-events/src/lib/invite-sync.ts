import 'server-only';
import { appUrl } from './auth';
import { anon } from './db';
import { buildEvent, type CalBooking } from './gcal';
import { buildIcs, inviteSequence, inviteUid, parseEmails } from './ics';
import { getIntegration } from './integrations';
import { fromAddress, fromName, mailer } from './mail';

/** Emails a calendar invite (new, updated or cancelled) for each queued booking to the academy's own addresses. */
export async function syncInvites(limit = 25): Promise<{ sent: number; failed: number; error?: string } | null> {
  const jobs = (await anon("select calendar_claim($1, 'ics') j", [limit])).map((r) => r.j as CalBooking & { changed: string; idem: string });
  if (!jobs.length) return null;
  const [ics, mail] = await Promise.all([getIntegration('ics'), getIntegration('email')]);
  const to = parseEmails(ics.values.recipients ?? '') ?? [], reminderMinutes = Math.max(0, Math.min(1440, Number(ics.values.reminder_minutes ?? 30) || 0));
  const out = { sent: 0, failed: 0, error: undefined as string | undefined };
  const t = mail.enabled && mail.complete ? mailer(mail.values) : null;
  for (const b of jobs) {
    let err: string | null = null;
    if (!t) err = 'Calendar invites need the Email (SMTP) integration enabled.';
    else if (!to.length) err = 'Add at least one address to send calendar invites to.';
    else try {
      const ev = buildEvent(b, { reminderMinutes, adminUrl: `${appUrl()}/admin/reservations/${b.id}` }), cancel = b.status === 'cancelled';
      const content = buildIcs({ uid: inviteUid(b.idem), sequence: inviteSequence(), method: cancel ? 'CANCEL' : 'REQUEST', start: b.starts_at, end: b.ends_at, summary: ev.summary, description: ev.description, location: ev.location,
        organizer: { name: fromName(mail.values.from) || 'Bolt Events', email: fromAddress(mail.values.from) }, attendees: to.map((email) => ({ email })), reminderMinutes });
      const i = await t.sendMail({ from: mail.values.from, to, subject: `${cancel ? 'Cancelled' : 'Booking'}: ${b.participant_name}, ${b.event_name} (${b.reference})`, text: ev.description,
        icalEvent: { method: cancel ? 'cancel' : 'request', filename: 'invite.ics', content } });
      if (!i.accepted?.length) err = 'The mail server did not accept the invite.';
    } catch (e: any) { err = `Could not send the calendar invite: ${e?.message ?? 'unknown error'}`; }
    await anon("select calendar_finish($1,$2,$3,'ics')", [b.id, b.changed, err]);
    if (err) { out.failed++; out.error ??= err; } else out.sent++;
  }
  return out;
}
