'use server';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { after } from 'next/server';
import { act, appUrl, db, fail, rateLimit, type ActionState } from '@/lib/auth';
import { encrypt, hashPassword, newToken, verifyPassword } from '@/lib/crypto';
import { INTEGRATIONS, getIntegration, webhookUrlOk } from '@/lib/integrations';
import { dispatch, sendInvite } from '@/lib/notify';
import { parseServiceAccount, parseSpreadsheetId, validSheetName } from '@/lib/gsheet';
import { syncSheet } from '@/lib/sheet-sync';
import { parseCalendarId } from '@/lib/gcal';
import { syncCalendar } from '@/lib/calendar-sync';
import { istDate } from '@/lib/format';
import type { Tx } from '@/lib/db';
import { bool, clean, date, email, int, mobile, optional, password, slugify, text, time, uuid } from '@/lib/validate';

type S = ActionState;
const kick = () => after(() => dispatch().catch((e) => console.error('dispatch', e.message)));
const uniqueSlug = (name: string) => `${slugify(name)}-${randomBytes(4).toString('hex').slice(0, 6)}`;

function sniff(b: Buffer) {
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10]))) return 'image/png';
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
  return null;
}
async function saveBanner(q: Tx, id: string, f: unknown) {
  if (!(f instanceof File) || !f.size) return;
  if (f.size > 2 * 1024 * 1024) fail('The banner image must be 2 MB or smaller.');
  const data = Buffer.from(await f.arrayBuffer()), mime = sniff(data);
  if (!mime) fail('The banner must be a PNG, JPEG or WebP image.');
  // not an upsert: the app role may not read the image column that "excluded" would need
  await q('delete from event_banners where event_id = $1', [id]);
  await q('insert into event_banners (event_id, mime, data) values ($1,$2,$3)', [id, mime, data]);
  await q('update events set banner_version = banner_version + 1 where id = $1', [id]);
}

const eventSchema = z.object({
  id: optional(uuid), name: text(2, 150, 'Event name'), description: text(0, 5000, 'Description', true), location: text(0, 300, 'Location'),
  event_type: z.enum(['offline', 'online']), meeting_link: optional(z.url({ protocol: /^https?$/, message: 'The meeting link must start with http:// or https://.' }).max(500)),
  start_date: date, end_date: date, daily_start_time: time, daily_end_time: time,
  slot_duration_min: int(5, 720, 'Slot duration'), buffer_min: int(0, 240, 'Buffer time'), capacity_per_slot: int(1, 1000, 'Maximum participants per slot'),
  registration_deadline: optional(z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/, 'Enter a valid registration deadline.')),
  visibility: z.enum(['public', 'unlisted']), status: z.enum(['draft', 'published', 'completed', 'cancelled']), auto_assign_staff: bool, apply_defaults: bool, remove_banner: bool, banner: z.any(),
  d1: bool, d2: bool, d3: bool, d4: bool, d5: bool, d6: bool, d7: bool, days_before: optional(z.string().max(20)),
}).superRefine((v, c) => {
  if (v.end_date < v.start_date) c.addIssue({ code: 'custom', message: 'The end date must be on or after the start date.' });
  if (v.daily_end_time <= v.daily_start_time) c.addIssue({ code: 'custom', message: 'The daily end time must be after the start time.' });
  if ((Date.parse(v.end_date) - Date.parse(v.start_date)) / 864e5 > 366) c.addIssue({ code: 'custom', message: 'An event can span at most one year.' });
});
export async function saveEvent(_: S, fd: FormData): Promise<S> {
  return act('admin', eventSchema, fd, async (q, v, u) => {
    const days = [1, 2, 3, 4, 5, 6, 7].filter((d) => (v as any)[`d${d}`]);
    if (!days.length) fail('Choose at least one day of the week.');
    const p = [v.name, v.description, v.location, v.event_type, v.meeting_link ?? null, v.start_date, v.end_date, v.daily_start_time, v.daily_end_time, v.slot_duration_min, v.buffer_min, v.capacity_per_slot, v.registration_deadline ?? null, v.visibility, v.auto_assign_staff];
    let id = v.id, sync = true;
    if (id) {
      const [old] = await q('select start_date, end_date from events where id = $1', [id]);
      if (!old) fail('Event not found.');
      sync = v.apply_defaults || old.start_date !== v.start_date || old.end_date !== v.end_date || days.join('') !== v.days_before;
      await q(`update events set name=$1, description=$2, location=$3, event_type=$4, meeting_link=$5, start_date=$6, end_date=$7, daily_start_time=$8, daily_end_time=$9, slot_duration_min=$10, buffer_min=$11, capacity_per_slot=$12,
        registration_deadline = ($13::timestamp at time zone 'Asia/Kolkata'), visibility=$14, auto_assign_staff=$15 where id=$16`, [...p, id]);
    } else {
      [{ id }] = await q(`insert into events (name, description, location, event_type, meeting_link, start_date, end_date, daily_start_time, daily_end_time, slot_duration_min, buffer_min, capacity_per_slot, registration_deadline, visibility, auto_assign_staff, slug, created_by)
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,($13::timestamp at time zone 'Asia/Kolkata'),$14,$15,$16,$17) returning id`, [...p, uniqueSlug(v.name), u.id]) as [{ id: string }];
    }
    if (v.remove_banner) { await q('delete from event_banners where event_id = $1', [id]); await q('update events set banner_version = 0 where id = $1', [id]); }
    await saveBanner(q, id!, v.banner);
    if (sync) await q('select sync_event_dates($1,$2,$3)', [id, days, v.apply_defaults]);
    await q('select set_event_status($1,$2)', [id, v.status]);
    if (v.status === 'cancelled') kick();
    return { ok: true, message: 'Event saved.', redirect: `/admin/events/${id}` };
  });
}
export async function eventCommand(_: S, fd: FormData): Promise<S> {
  return act('admin', z.object({ id: uuid, cmd: z.enum(['publish', 'unpublish', 'complete', 'cancel', 'delete', 'duplicate']) }), fd, async (q, { id, cmd }) => {
    if (cmd === 'duplicate') {
      const [e] = await q('select name from events where id = $1', [id]); if (!e) fail('Event not found.');
      const [{ d }] = await q('select duplicate_event($1,$2) d', [id, uniqueSlug(e.name)]);
      return { ok: true, redirect: `/admin/events/${d}/edit` };
    }
    if (cmd === 'delete') {
      const [{ n }] = await q('select count(*)::int n from reservations where event_id = $1', [id]);
      if (n) fail(`This event has ${n} reservation ${n === 1 ? 'record' : 'records'}, so it cannot be deleted. Cancel it instead.`);
      if (!(await q('delete from events where id = $1 returning id', [id])).length) fail('Event not found.');
      return { ok: true, message: 'Event deleted.', redirect: '/admin/events' };
    }
    await q('select set_event_status($1,$2)', [id, { publish: 'published', unpublish: 'draft', complete: 'completed', cancel: 'cancelled' }[cmd]]);
    if (cmd === 'cancel') kick();
    return { publish: 'Published.', unpublish: 'Unpublished.', complete: 'Marked as completed.', cancel: 'Event cancelled. Upcoming bookings were cancelled.' }[cmd];
  });
}
export async function setEventStaff(_: S, fd: FormData): Promise<S> {
  return act('admin', z.object({ id: uuid }), fd, async (q, { id }, u) => {
    const ids = fd.getAll('staff').map(String).filter((x) => uuid.safeParse(x).success);
    await q('delete from staff_assignments where event_id = $1 and not (staff_id = any($2::uuid[]))', [id, ids]);
    await q('insert into staff_assignments (staff_id, event_id, assigned_by) select x, $1, $3 from unnest($2::uuid[]) x on conflict (staff_id, event_id) do nothing', [id, ids, u.id]);
    return 'Staff updated.';
  });
}

// Dates and slots --------------------------------------------------------------
const sched = { start_time: time, end_time: time, slot_duration_min: int(5, 720, 'Slot duration'), buffer_min: int(0, 240, 'Buffer time'), capacity: int(1, 1000, 'Capacity') };
export async function addDate(_: S, fd: FormData): Promise<S> {
  return act('admin', z.object({ event: uuid, date, ...sched }), fd, async (q, v) => {
    if (v.end_time <= v.start_time) fail('The end time must be after the start time.');
    if (v.date < istDate()) fail('Choose today or a future date.');
    await q('update events set start_date = least(start_date, $2::date), end_date = greatest(end_date, $2::date) where id = $1', [v.event, v.date]);
    const [d] = await q('insert into event_dates (event_id, date, start_time, end_time, slot_duration_min, buffer_min, capacity) values ($1,$2,$3,$4,$5,$6,$7) on conflict (event_id, date) do nothing returning id', [v.event, v.date, v.start_time, v.end_time, v.slot_duration_min, v.buffer_min, v.capacity]);
    if (!d) fail('This event already has that date.');
    const [{ n }] = await q('select generate_slots($1, false) n', [d.id]);
    return { ok: true, message: `Date added with ${n} slots.`, redirect: `/admin/slots?event=${v.event}&date=${d.id}` };
  });
}
export async function saveDate(_: S, fd: FormData): Promise<S> {
  return act('admin', z.object({ id: uuid, ...sched }), fd, async (q, v) => {
    if (v.end_time <= v.start_time) fail('The end time must be after the start time.');
    const r = await q('update event_dates set start_time=$2, end_time=$3, slot_duration_min=$4, buffer_min=$5, capacity=$6 where id=$1 returning id', [v.id, v.start_time, v.end_time, v.slot_duration_min, v.buffer_min, v.capacity]);
    if (!r.length) fail('Event date not found.');
    const [{ n }] = await q('select generate_slots($1, true) n', [v.id]);
    return `Schedule saved. ${n} slots generated; booked, blocked and custom slots were kept.`;
  });
}
export async function dateCommand(_: S, fd: FormData): Promise<S> {
  return act('admin', z.object({ id: uuid, cmd: z.enum(['block', 'unblock', 'enable', 'disable', 'delete']) }), fd, async (q, { id, cmd }) => {
    if (cmd === 'delete') {
      const [d] = await q('delete from event_dates where id = $1 returning event_id', [id]); if (!d) fail('Event date not found.');
      return { ok: true, redirect: `/admin/slots?event=${d.event_id}` };
    }
    const r = await q({ block: 'update event_dates set is_blocked = true', unblock: 'update event_dates set is_blocked = false', enable: 'update event_dates set booking_enabled = true', disable: 'update event_dates set booking_enabled = false' }[cmd] + ' where id = $1 returning id', [id]);
    if (!r.length) fail('Event date not found.');
    return { block: 'Date blocked.', unblock: 'Date unblocked.', enable: 'Booking enabled.', disable: 'Booking disabled.' }[cmd];
  });
}
export async function addSlot(_: S, fd: FormData): Promise<S> {
  return act('admin', z.object({ date: uuid, start: time, end: time, capacity: int(1, 1000, 'Capacity') }), fd, async (q, v) => {
    if (v.end <= v.start) fail('The end time must be after the start time.');
    const r = await q(`insert into availability_slots (event_id, event_date_id, starts_at, ends_at, capacity, is_custom)
      select event_id, id, (date + $2::time) at time zone 'Asia/Kolkata', (date + $3::time) at time zone 'Asia/Kolkata', $4, true from event_dates where id = $1 returning id`, [v.date, v.start, v.end, v.capacity]);
    if (!r.length) fail('Event date not found.');
    return 'Custom slot added.';
  });
}
export async function saveSlot(_: S, fd: FormData): Promise<S> {
  return act('admin', z.object({ id: uuid, start: time, end: time, capacity: int(1, 1000, 'Capacity') }), fd, async (q, v) => {
    if (v.end <= v.start) fail('The end time must be after the start time.');
    const r = await q(`update availability_slots s set starts_at = (d.date + $2::time) at time zone 'Asia/Kolkata', ends_at = (d.date + $3::time) at time zone 'Asia/Kolkata', capacity = $4
      from event_dates d where d.id = s.event_date_id and s.id = $1 returning s.id`, [v.id, v.start, v.end, v.capacity]);
    if (!r.length) fail('Slot not found.');
    return 'Slot saved.';
  });
}
export async function slotCommand(_: S, fd: FormData): Promise<S> {
  return act('admin', z.object({ id: uuid, cmd: z.enum(['block', 'unblock', 'inc', 'dec', 'delete']) }), fd, async (q, { id, cmd }) => {
    if (cmd === 'delete') { if (!(await q('delete from availability_slots where id = $1 returning id', [id])).length) fail('Slot not found.'); return 'Slot deleted.'; }
    if (cmd === 'dec') { const [s] = await q('select capacity, booked_count from availability_slots where id = $1 for update', [id]); if (s && s.capacity <= Math.max(1, s.booked_count)) fail('Capacity cannot be lower than the number of bookings, or less than 1.'); }
    const r = await q(`update availability_slots set ${{ block: `status = 'blocked'`, unblock: `status = 'active'`, inc: 'capacity = capacity + 1', dec: 'capacity = capacity - 1' }[cmd]} where id = $1 returning id`, [id]);
    if (!r.length) fail('Slot not found.');
    return 'Slot updated.';
  });
}

// Staff -------------------------------------------------------------------------
const DAYS = [1, 2, 3, 4, 5, 6, 7];
export async function createStaff(_: S, fd: FormData): Promise<S> {
  return act('admin', z.object({ name: text(2, 100, 'Full name'), email, phone: optional(mobile), designation: text(0, 100, 'Designation'), how: z.enum(['invite', 'password']), password: optional(password) }), fd, async (q, v) => {
    if (v.how === 'password' && !v.password) fail('Enter a password of at least 10 characters.');
    const [s] = await q('select * from admin_create_staff($1,$2,$3)', [v.email, v.name, v.how === 'password' ? await hashPassword(v.password!) : null]);
    await q('update staff set phone = $2, designation = $3 where id = $1', [s.staff_id, v.phone ?? null, v.designation || null]);
    if (v.how === 'password') return { ok: true, message: 'Staff account created.' };
    const t = newToken(); await q('select admin_create_auth_token($1,$2)', [s.profile_id, t]);
    const link = `${appUrl()}/invite?t=${t}`, sent = await sendInvite(v.email, v.name, link);
    return { ok: true, message: sent ? 'Invitation accepted by your mail server. You can also share this link:' : 'Account created. No invitation email was sent because email is not configured or was not accepted. Share this link with the staff member (valid 72 hours):', link };
  });
}
export async function inviteLink(_: S, fd: FormData): Promise<S> {
  return act('admin', z.object({ profile: uuid }), fd, async (q, v) => {
    const [p] = await q('select email, full_name from profiles where id = $1', [v.profile]); if (!p) fail('Account not found.');
    const t = newToken(); await q('select admin_create_auth_token($1,$2)', [v.profile, t]);
    const link = `${appUrl()}/invite?t=${t}`, sent = await sendInvite(p.email, p.full_name, link);
    return { ok: true, message: sent ? 'Link accepted by your mail server. You can also share it directly:' : 'No email was sent. Share this link with the staff member (valid 72 hours):', link };
  });
}
export async function saveStaff(_: S, fd: FormData): Promise<S> {
  return act('admin', z.object({ id: uuid, name: text(2, 100, 'Full name'), email, phone: optional(mobile), designation: text(0, 100, 'Designation'), is_active: bool, can_reschedule: bool, auto_assign: bool, max: int(1, 1000, 'Daily limit'), work_start: time, work_end: time, off: z.string().max(4000) }), fd, async (q, v) => {
    if (v.work_end <= v.work_start) fail('Working hours must end after they start.');
    const off = v.off.split(/[\s,]+/).filter(Boolean); if (off.some((d) => !date.safeParse(d).success)) fail('Enter unavailable dates as YYYY-MM-DD, one per line.');
    await q('select admin_update_staff_account($1,$2,$3,$4)', [v.id, v.email, v.name, v.is_active]);
    await q('update staff set phone=$2, designation=$3, can_reschedule=$4, auto_assign=$5, max_daily_reservations=$6, working_days=$7, work_start=$8, work_end=$9, unavailable_dates=$10::date[] where id=$1',
      [v.id, v.phone ?? null, v.designation || null, v.can_reschedule, v.auto_assign, v.max, DAYS.filter((d) => fd.get(`d${d}`) === 'on'), v.work_start, v.work_end, off]);
    return 'Staff profile saved.';
  });
}
export async function setStaffEvents(_: S, fd: FormData): Promise<S> {
  return act('admin', z.object({ id: uuid }), fd, async (q, { id }, u) => {
    const ids = fd.getAll('event').map(String).filter((x) => uuid.safeParse(x).success);
    await q('delete from staff_assignments where staff_id = $1 and event_id is not null and not (event_id = any($2::uuid[]))', [id, ids]);
    await q('insert into staff_assignments (staff_id, event_id, assigned_by) select $1, x, $3 from unnest($2::uuid[]) x on conflict (staff_id, event_id) do nothing', [id, ids, u.id]);
    return 'Event assignments saved.';
  });
}

// Settings ------------------------------------------------------------------------
export async function saveGeneral(_: S, fd: FormData): Promise<S> {
  return act('admin', z.object({ organisation: text(2, 100, 'Organisation'), support_contact: text(0, 200, 'Support contact'), appointment_reminder_hours: int(1, 72, 'Appointment reminder'), event_reminder_hours: int(1, 336, 'Event reminder') }), fd, async (q, v) => {
    await q(`update integration_settings set config = $1 where key = 'app'`, [v]); return 'Settings saved. New reminder times apply to new and rescheduled bookings.';
  });
}
export async function saveIntegration(_: S, fd: FormData): Promise<S> {
  return act('admin', z.object({ key: z.enum(['email', 'whatsapp', 'aisensy', 'pabbly', 'gsheet', 'gcal', 'meta']), enabled: bool }), fd, async (q, { key, enabled }) => {
    const def = INTEGRATIONS[key], cur = (await getIntegration(key)).values, config: Record<string, string> = {}, secrets: Record<string, string> = {};
    if (key === 'gcal') {
      const raw = String(fd.get('calendar_id') ?? '').trim(), keyFile = String(fd.get('service_account') ?? '').trim(), rem = String(fd.get('reminder_minutes') ?? '').trim() || '30';
      const cal = raw ? parseCalendarId(raw) : null;
      if (raw && !cal) fail('Paste the calendar ID from Google Calendar: Settings, your calendar, Integrate calendar. It looks like abc123@group.calendar.google.com.');
      if (!/^\d{1,4}$/.test(rem) || Number(rem) > 1440) fail('The reminder must be between 0 and 1440 minutes.');
      const reuse = fd.get('reuse_sheet_key') === 'on' ? await getIntegration('gsheet') : null;
      if (reuse && !reuse.values.private_key) fail('Google Sheets has no saved key to reuse. Paste the key file instead.');
      const sa = keyFile ? parseServiceAccount(keyFile) : null;
      if (keyFile && !sa) fail('That is not a service account key file. In Google Cloud, create a JSON key for the service account and paste the whole file.');
      const email = sa?.client_email ?? reuse?.values.client_email ?? cur.client_email, pk = sa?.private_key ?? reuse?.values.private_key ?? cur.private_key;
      if (enabled && (!cal || !email || !pk)) fail('To enable Google Calendar, fill in the calendar ID and a service account key.');
      await q('update integration_settings set enabled = $2, config = $3, secrets_encrypted = $4 where key = $1', [key, enabled, { ...(cal ? { calendar_id: cal } : {}), reminder_minutes: rem, ...(email ? { client_email: email } : {}) }, pk ? encrypt(JSON.stringify({ private_key: pk })) : null]);
      return enabled ? `Saved. Share the calendar with ${email} (Make changes to events), then use Sync upcoming bookings.` : 'Integration saved.';
    }
    if (key === 'gsheet') {
      const raw = String(fd.get('spreadsheet_id') ?? '').trim(), keyFile = String(fd.get('service_account') ?? '').trim(), tab = clean(String(fd.get('sheet_name') ?? '')).trim() || 'Reservations';
      const sid = raw ? parseSpreadsheetId(raw) : null;
      if (raw && !sid) fail('Paste the spreadsheet link from your browser, or its ID.');
      if (!validSheetName(tab)) fail('The tab name cannot contain [ ] * ? : / \\ or quotes.');
      const sa = keyFile ? parseServiceAccount(keyFile) : null;
      if (keyFile && !sa) fail('That is not a service account key file. In Google Cloud, create a JSON key for the service account and paste the whole file.');
      const email = sa?.client_email ?? cur.client_email, pk = sa?.private_key ?? cur.private_key;
      if (enabled && (!sid || !email || !pk)) fail('To enable Google Sheets, fill in the spreadsheet link and the service account key.');
      await q('update integration_settings set enabled = $2, config = $3, secrets_encrypted = $4 where key = $1', [key, enabled, { ...(sid ? { spreadsheet_id: sid } : {}), sheet_name: tab, ...(email ? { client_email: email } : {}) }, pk ? encrypt(JSON.stringify({ private_key: pk })) : null]);
      await q('select sheet_sync_request()');
      return enabled ? `Saved. Share the spreadsheet with ${email} as Editor, then use Sync now.` : 'Integration saved.';
    }
    for (const f of def.fields) {
      const v = clean(String(fd.get(f.name) ?? '')).slice(0, 2000);
      if (f.secret) { if (v || cur[f.name]) secrets[f.name] = v || cur[f.name]; } else if (v) config[f.name] = v;
    }
    if (config.webhook_url && !webhookUrlOk(config.webhook_url)) fail('The webhook URL must be a public https address.');
    if (config.port && !/^\d{1,5}$/.test(config.port)) fail('Enter a valid port.');
    const missing = def.required.filter((f) => !config[f] && !secrets[f]);
    if (enabled && missing.length) fail(`To enable ${def.title}, fill in: ${def.fields.filter((f) => missing.includes(f.name)).map((f) => f.label).join(', ')}.`);
    await q('update integration_settings set enabled = $2, config = $3, secrets_encrypted = $4 where key = $1', [key, enabled, config, Object.keys(secrets).length ? encrypt(JSON.stringify(secrets)) : null]);
    return 'Integration saved.';
  });
}
export async function syncSheetNow(_: S, fd: FormData): Promise<S> {
  // request in its own transaction first, so the sync (on another connection) sees it
  const r = await act('admin', z.object({}), fd, async (q) => {
    if (!(await getIntegration('gsheet')).enabled) fail('Enable Google Sheets first.');
    await q('select sheet_sync_request()'); return 'ok';
  });
  if (!r?.ok) return r;
  const out = await syncSheet();
  if (!out) return { ok: false, message: 'A sync is already running. Try again in a minute.', at: Date.now() };
  return 'error' in out ? { ok: false, message: out.error, at: Date.now() } : { ok: true, message: `Google Sheet updated with ${out.synced} reservations.`, at: Date.now() };
}
export async function syncCalendarNow(_: S, fd: FormData): Promise<S> {
  const r = await act('admin', z.object({}), fd, async (q) => {
    if (!(await getIntegration('gcal')).enabled) fail('Enable Google Calendar first.');
    const [{ n }] = await q('select calendar_sync_all() n'); return String(n);
  });
  if (!r?.ok) return r;
  let synced = 0, failed = 0, error: string | undefined;
  for (let i = 0; i < 20; i++) { const o = await syncCalendar(50); if (!o) break; synced += o.synced; failed += o.failed; error ??= o.error; if (o.failed && !o.synced) break; }
  return failed ? { ok: false, message: `${synced} bookings written, ${failed} failed: ${error}`, at: Date.now() } : { ok: true, message: synced ? `Google Calendar updated: ${synced} upcoming bookings.` : 'No upcoming bookings to add.', at: Date.now() };
}
export async function saveTemplate(_: S, fd: FormData): Promise<S> {
  return act('admin', z.object({ id: uuid, subject: text(0, 200, 'Subject'), body: text(1, 4000, 'Message', true), provider_template: text(0, 200, 'Template name'), is_active: bool }), fd, async (q, v) => {
    await q('update notification_templates set subject=$2, body=$3, provider_template=$4, is_active=$5 where id=$1', [v.id, v.subject, v.body, v.provider_template || null, v.is_active]); return 'Template saved.';
  });
}
export async function retryNotification(_: S, fd: FormData): Promise<S> {
  const r = await act('admin', z.object({ id: uuid }), fd, async (q, { id }) => { await q('select admin_retry_notification($1)', [id]); return 'Queued again.'; });
  if (r?.ok) kick();
  return r;
}
export async function runNotifications(_: S, fd: FormData): Promise<S> {
  return act('admin', z.object({}), fd, async () => { const r = await dispatch(100); return `Processed: ${r.sent} accepted by providers, ${r.failed} failed, ${r.retry} to retry, ${r.not_configured} not configured.`; });
}
