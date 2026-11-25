import Link from 'next/link';
import { addNote, assignStaff, cancelReservation, rescheduleReservation } from '@/app/booking-actions';
import { fmtDateTime, fmtLong, fmtRange, label } from '@/lib/format';
import { ActionForm } from './action-form';
import { AttendanceButtons } from './attendance-buttons';
import { Badge, Field, Head } from './ui';
const MK = [['utm_source', 'Source'], ['utm_medium', 'Medium'], ['utm_campaign', 'Campaign'], ['utm_content', 'Content'], ['utm_term', 'Term'], ['fbclid', 'fbclid'], ['campaign_id', 'Campaign ID'], ['adset_id', 'Ad set ID'], ['ad_id', 'Ad ID'], ['landing_page', 'Landing page']];
function describe(h: any, staff: Map<string, string>) {
  const d = h.details ?? {};
  if (h.action === 'rescheduled') return `Moved from ${fmtDateTime(d.from)} to ${fmtDateTime(d.to)}`;
  if (h.action === 'attendance') return `Attendance: ${label(d.from)} to ${label(d.to)}`;
  if (h.action === 'staff_assigned') return d.staff_id ? `Assigned to ${staff.get(d.staff_id) ?? 'staff'}${d.automatic ? ' automatically' : ''}` : 'Staff unassigned';
  return { booked: 'Booked', cancelled: 'Cancelled', note: 'Note' }[h.action as string] ?? label(h.action);
}
export function ReservationDetail({ data, role, canReschedule, staff }: { data: any; role: 'admin' | 'staff'; canReschedule: boolean; staff: any[] }) {
  const { r, history, slots } = data, names = new Map<string, string>(staff.map((s) => [s.id, s.name])), live = r.status !== 'cancelled';
  const fixed = ['checked_in', 'attended'].includes(r.attendance), days = [...new Set<string>(slots.map((s: any) => fmtLong(s.starts_at)))], mk = MK.filter(([k]) => r[k]);
  return <><Head title={r.participant_name} sub={<>{r.reference}, booked {fmtDateTime(r.created_at)}</>}><Link className="btn ghost" href={`/${role}/reservations`}>All reservations</Link></Head>
    <div className="grid g21"><div className="stack">
      <div className="card"><h2>Appointment</h2><dl className="kv"><dt>Event</dt><dd>{role === 'admin' ? <Link href={`/admin/events/${r.event_id}`}>{r.event_name}</Link> : r.event_name}</dd><dt>Date</dt><dd>{fmtLong(r.starts_at)}</dd><dt>Time</dt><dd>{fmtRange(r.starts_at, r.ends_at)}</dd><dt>Booking</dt><dd><Badge v={r.status} /></dd>{r.cancel_reason && <><dt>Reason</dt><dd>{r.cancel_reason}</dd></>}<dt>Attendance</dt><dd><Badge v={r.attendance} />{r.checked_in_at && <span className="small muted"> {fmtDateTime(r.checked_in_at)}</span>}</dd><dt>Staff</dt><dd>{r.staff_name ?? 'Unassigned'}</dd></dl></div>
      <div className="card"><h2>Participant</h2><dl className="kv"><dt>Mobile</dt><dd><a href={`tel:${r.mobile}`}>{r.mobile}</a></dd><dt>Email</dt><dd>{r.email ?? 'Not given'}</dd><dt>Message</dt><dd className="pre">{r.message ?? 'None'}</dd></dl></div>
      {live && <div className="card"><h2>Attendance</h2><AttendanceButtons id={r.id} current={r.attendance} /></div>}
      {role === 'admin' && mk.length > 0 && <div className="card"><h2>Marketing source</h2><dl className="kv">{mk.map(([k, t]) => <div key={k} style={{ display: 'contents' }}><dt>{t}</dt><dd>{r[k]}</dd></div>)}</dl></div>}
      <div className="card"><h2>History and notes</h2><ActionForm action={addNote} hidden={{ id: r.id }} className="stack-s" resetOnOk><Field l="Add an internal note"><textarea name="note" maxLength={2000} required /></Field><div><button className="btn sm">Add note</button></div></ActionForm>
        <div className="list" style={{ marginTop: 16 }}>{history.map((h: any) => <div key={h.id}><div className="row between"><span className="b">{describe(h, names)}</span><span className="small muted">{fmtDateTime(h.created_at)}</span></div>{h.note && <p className="pre">{h.note}</p>}<p className="small muted">{h.actor_name ?? label(h.actor_type)}</p></div>)}</div></div>
    </div><div className="stack">
      {role === 'admin' && <div className="card"><h2>Assigned staff</h2><ActionForm action={assignStaff} hidden={{ id: r.id }} className="stack-s" key={r.staff_id}><select name="staff" aria-label="Staff member" defaultValue={r.staff_id ?? ''}><option value="">Unassigned</option>{staff.filter((s) => s.is_active || s.id === r.staff_id).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select><button className="btn sm">Save assignment</button></ActionForm></div>}
      {live && canReschedule && !fixed && <div className="card"><h2>Reschedule</h2>{slots.length ? <ActionForm action={rescheduleReservation} hidden={{ id: r.id }} className="stack-s"><select name="slot" aria-label="New time" required defaultValue=""><option value="" disabled>Choose a new time</option>{days.map((d) => <optgroup key={d} label={d}>{slots.filter((s: any) => fmtLong(s.starts_at) === d).map((s: any) => <option key={s.id} value={s.id}>{fmtRange(s.starts_at, s.ends_at)} ({s.remaining} left)</option>)}</optgroup>)}</select><button className="btn sm">Reschedule</button></ActionForm> : <p className="muted small">No other open times.</p>}</div>}
      {live && !fixed && <div className="card"><h2>Cancel</h2><ActionForm action={cancelReservation} hidden={{ id: r.id }} className="stack-s" confirm="Cancel this reservation? Its place becomes available to others."><input name="reason" maxLength={500} placeholder="Reason (optional)" aria-label="Reason" /><button className="btn danger sm">Cancel reservation</button></ActionForm></div>}
    </div></div></>;
}
