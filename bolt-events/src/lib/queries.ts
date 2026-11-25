import 'server-only';
import type { Tx } from './db';
import { istDate } from './format';
import type { Table } from './export';
import { fmtDate, fmtDateTime, fmtRange, label } from './format';

export type SP = Record<string, string | undefined>;
export const PAGE = 20;
export const page = (sp: SP) => Math.max(1, Math.min(100000, Number.parseInt(sp.page ?? '1') || 1));
export const isUuid = (s?: string): s is string => !!s && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(s);
const isDay = (s?: string): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
const like = (s: string) => `%${s.trim().slice(0, 100).replace(/[\\%_]/g, '\\$&')}%`;
const IST = `at time zone 'Asia/Kolkata'`;

const RES_FROM = `from reservations r join events e on e.id = r.event_id join availability_slots s on s.id = r.slot_id
  join attendance a on a.reservation_id = r.id left join staff_assignments sa on sa.reservation_id = r.id
  left join staff st on st.id = sa.staff_id left join profiles sp on sp.id = st.profile_id`;
const RES_COLS = `r.*, e.name event_name, s.starts_at, s.ends_at, a.status attendance, a.checked_in_at, st.id staff_id, sp.full_name staff_name`
  .replace('r.*', 'r.id, r.reference, r.event_id, r.slot_id, r.participant_name, r.mobile, r.email, r.message, r.status, r.cancel_reason, r.created_at, r.utm_source, r.utm_medium, r.utm_campaign, r.utm_content, r.utm_term, r.fbclid, r.campaign_id, r.adset_id, r.ad_id, r.landing_page');

function resWhere(sp: SP) {
  const w: string[] = [], p: unknown[] = [];
  const add = (sql: string, v: unknown) => { p.push(v); w.push(sql.replaceAll('?', `$${p.length}`)); };
  if (sp.q?.trim()) {
    const digits = sp.q.replace(/\D/g, '');
    add(`(r.participant_name ilike ? or r.reference ilike ? or r.email ilike ?`, like(sp.q));
    if (digits.length >= 3) { p.push(`%${digits}%`); w[w.length - 1] += ` or r.mobile like $${p.length}`; }
    w[w.length - 1] += ')';
  }
  if (isUuid(sp.event)) add('r.event_id = ?', sp.event);
  if (isDay(sp.date)) add(`(s.starts_at ${IST})::date = ?::date`, sp.date);
  if (sp.staff === 'none') w.push('sa.id is null'); else if (isUuid(sp.staff)) add('sa.staff_id = ?', sp.staff);
  if (['confirmed', 'rescheduled', 'cancelled'].includes(sp.status ?? '')) add('r.status = ?', sp.status);
  if (['not_checked_in', 'checked_in', 'attended', 'no_show'].includes(sp.attendance ?? '')) add('a.status = ?', sp.attendance);
  return { where: w.length ? `where ${w.join(' and ')}` : '', p };
}
export async function listReservations(q: Tx, sp: SP, order = 'r.created_at desc, r.id') {
  const { where, p } = resWhere(sp);
  const [{ n }] = await q(`select count(*)::int n ${RES_FROM} ${where}`, p);
  const rows = await q(`select ${RES_COLS} ${RES_FROM} ${where} order by ${order} limit ${PAGE} offset ${(page(sp) - 1) * PAGE}`, p);
  return { rows, total: n as number };
}
export async function reservationsBetween(q: Tx, from: string, to: string) {
  return q(`select ${RES_COLS}, (s.starts_at ${IST})::date::text as day ${RES_FROM} where (s.starts_at ${IST})::date between $1 and $2 and r.status <> 'cancelled' order by s.starts_at, r.participant_name`, [from, to]);
}
export async function getReservation(q: Tx, id: string) {
  if (!isUuid(id)) return null;
  const [r] = await q(`select ${RES_COLS} ${RES_FROM} where r.id = $1`, [id]);
  if (!r) return null;
  const history = await q(`select h.*, p.full_name actor_name from booking_history h left join profiles p on p.id = h.actor_id where reservation_id = $1 order by h.id desc`, [id]);
  const slots = await q(`select s.id, s.starts_at, s.ends_at, s.capacity - s.booked_count remaining from availability_slots s join event_dates d on d.id = s.event_date_id
    where s.event_id = $1 and s.status = 'active' and s.starts_at > now() and s.booked_count < s.capacity and not d.is_blocked and d.booking_enabled and s.id <> $2 order by s.starts_at`, [r.event_id, r.slot_id]);
  return { r, history, slots };
}
export async function reservationTable(q: Tx, sp: SP): Promise<Table> {
  const { where, p } = resWhere(sp);
  const rows = await q(`select ${RES_COLS} ${RES_FROM} ${where} order by r.created_at desc limit 50000`, p);
  return {
    name: 'Reservations',
    columns: ['Booking ID', 'Participant Name', 'Mobile Number', 'Email', 'Event Name', 'Event Date', 'Appointment Time', 'Assigned Staff', 'Booking Status', 'Attendance Status', 'Booking Date', 'Message', 'UTM Source', 'UTM Medium', 'UTM Campaign', 'UTM Content', 'UTM Term', 'fbclid', 'Campaign ID', 'Ad Set ID', 'Ad ID', 'Landing Page'],
    rows: rows.map((r) => [r.reference, r.participant_name, r.mobile, r.email, r.event_name, fmtDate(r.starts_at), fmtRange(r.starts_at, r.ends_at), r.staff_name, label(r.status), label(r.attendance), fmtDateTime(r.created_at), r.message, r.utm_source, r.utm_medium, r.utm_campaign, r.utm_content, r.utm_term, r.fbclid, r.campaign_id, r.adset_id, r.ad_id, r.landing_page]),
  };
}

export async function listEvents(q: Tx, sp: SP) {
  const w: string[] = [], p: unknown[] = [];
  if (sp.q?.trim()) { p.push(like(sp.q)); w.push(`e.name ilike $${p.length}`); }
  for (const [k, vals] of [['status', ['draft', 'published', 'completed', 'cancelled']], ['visibility', ['public', 'unlisted']], ['event_type', ['offline', 'online']]] as const)
    if ((vals as readonly string[]).includes(sp[k] ?? '')) { p.push(sp[k]); w.push(`e.${k} = $${p.length}`); }
  const where = w.length ? `where ${w.join(' and ')}` : '';
  const [{ n }] = await q(`select count(*)::int n from events e ${where}`, p);
  const rows = await q(`select e.*, x.slots, x.capacity, x.booked from events e left join lateral (
      select count(*)::int slots, coalesce(sum(capacity),0)::int capacity, coalesce(sum(booked_count),0)::int booked from availability_slots where event_id = e.id) x on true
    ${where} order by e.created_at desc limit ${PAGE} offset ${(page(sp) - 1) * PAGE}`, p);
  return { rows, total: n as number };
}

// Appointment-date filters use the slot date; booking-date filters use created_at. Both in IST.
const BOOKED = `(r.created_at ${IST})::date between $1 and $2`;
const APPT = `(s.starts_at ${IST})::date between $1 and $2`;

export async function dashboard(q: Tx, from: string, to: string) {
  const today = istDate();
  const [c] = await q(`select
    (select count(*)::int from events) total_events,
    (select count(*)::int from events where status = 'published' and end_date >= $3::date) active_events,
    (select count(*)::int from reservations r where ${BOOKED}) total_reservations,
    (select count(*)::int from reservations r where status = 'cancelled' and (r.cancelled_at ${IST})::date between $1 and $2) cancelled,
    (select count(*)::int from reservations r join availability_slots s on s.id = r.slot_id where r.status <> 'cancelled' and (s.starts_at ${IST})::date = $3::date) today_reservations,
    (select count(*)::int from reservations r join availability_slots s on s.id = r.slot_id where r.status <> 'cancelled' and s.starts_at > now()) upcoming,
    (select count(*)::int from reservations r join availability_slots s on s.id = r.slot_id join attendance a on a.reservation_id = r.id where r.status <> 'cancelled' and a.status in ('checked_in','attended') and ${APPT}) checked_in,
    (select count(*)::int from reservations r join availability_slots s on s.id = r.slot_id join attendance a on a.reservation_id = r.id where r.status <> 'cancelled' and a.status = 'no_show' and ${APPT}) no_show`, [from, to, today]);
  const [sl] = await q(`select count(*) filter (where s.booked_count < s.capacity)::int available, count(*) filter (where s.booked_count >= s.capacity)::int full,
      coalesce(sum(s.capacity),0)::int capacity, coalesce(sum(s.booked_count),0)::int booked
    from availability_slots s join events e on e.id = s.event_id and e.status = 'published' join event_dates d on d.id = s.event_date_id and not d.is_blocked and d.booking_enabled
    where s.status = 'active' and s.starts_at > now()`);
  const availability = await q(`select e.id, e.name, sum(s.capacity)::int capacity, sum(s.booked_count)::int booked
    from availability_slots s join events e on e.id = s.event_id and e.status = 'published' join event_dates d on d.id = s.event_date_id and not d.is_blocked and d.booking_enabled
    where s.status = 'active' and s.starts_at > now() group by e.id order by min(s.starts_at) limit 8`);
  const schedule = await reservationsBetween(q, today, today);
  const recent = (await listReservations(q, {})).rows.slice(0, 6);
  const upcomingEvents = await q(`select e.id, e.name, e.start_date, e.end_date, e.event_type, e.location from events e where status = 'published' and end_date >= $1::date order by greatest(start_date, $1::date), name limit 5`, [today]);
  return { c, sl, availability, schedule, recent, upcomingEvents };
}
export const trend = (q: Tx, from: string, to: string) => q(`select g::date::text as day, count(r.id)::int n from generate_series($1::timestamp, $2::timestamp, interval '1 day') g
  left join reservations r on (r.created_at ${IST})::date = g::date group by g order by g`, [from, to]);
export const eventReport = (q: Tx, from: string, to: string) => q(`select e.id, e.name, count(r.id)::int total, count(r.id) filter (where r.status = 'confirmed')::int confirmed, count(r.id) filter (where r.status = 'rescheduled')::int rescheduled,
    count(r.id) filter (where r.status = 'cancelled')::int cancelled, count(r.id) filter (where a.status in ('checked_in','attended') and r.status <> 'cancelled')::int attended, count(r.id) filter (where a.status = 'no_show' and r.status <> 'cancelled')::int no_show
  from events e join reservations r on r.event_id = e.id join attendance a on a.reservation_id = r.id where ${BOOKED} group by e.id order by total desc, e.name`, [from, to]);
export const attendanceReport = (q: Tx, from: string, to: string) => q(`select a.status, count(*)::int n from reservations r join availability_slots s on s.id = r.slot_id join attendance a on a.reservation_id = r.id
  where r.status <> 'cancelled' and ${APPT} group by a.status`, [from, to]);
export const staffReport = (q: Tx, from: string, to: string) => q(`select st.id, p.full_name name, p.is_active, count(x.id)::int assigned, count(x.id) filter (where x.att in ('checked_in','attended'))::int attended,
    count(x.id) filter (where x.att = 'no_show')::int no_show, count(x.id) filter (where x.starts_at > now())::int upcoming
  from staff st join profiles p on p.id = st.profile_id left join (
    select r.id, sa.staff_id, a.status att, s.starts_at from staff_assignments sa join reservations r on r.id = sa.reservation_id and r.status <> 'cancelled' join availability_slots s on s.id = r.slot_id join attendance a on a.reservation_id = r.id where ${APPT}) x on x.staff_id = st.id
  group by st.id, p.id order by assigned desc, name`, [from, to]);
export const marketingReport = (q: Tx, from: string, to: string, event?: string) => q(`select e.name event_name, coalesce(nullif(r.utm_source,''), case when r.fbclid is not null then 'facebook (fbclid)' else 'direct' end) source, r.utm_medium medium, r.utm_campaign campaign, r.campaign_id, r.adset_id, r.ad_id,
    count(*)::int total, count(*) filter (where r.status = 'cancelled')::int cancelled, count(*) filter (where a.status in ('checked_in','attended') and r.status <> 'cancelled')::int attended
  from reservations r join events e on e.id = r.event_id join attendance a on a.reservation_id = r.id where ${BOOKED} and ($3::uuid is null or e.id = $3) group by e.id, 2, 3, 4, 5, 6, 7 order by total desc limit 1000`, [from, to, isUuid(event) ? event : null]);

export const eventOptions = (q: Tx) => q('select id, name from events order by name');
export const staffOptions = (q: Tx) => q('select st.id, p.full_name name, p.is_active from staff st join profiles p on p.id = st.profile_id order by p.full_name');
