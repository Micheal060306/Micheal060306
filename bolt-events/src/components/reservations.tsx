import Link from 'next/link';
import { fmtDate, fmtDateTime, fmtRange } from '@/lib/format';
import { ATT, Badge, Empty, Field, Opts, Pager, STATUS } from './ui';
import type { SP } from '@/lib/queries';
export function ReservationFilters({ sp, events, staff }: { sp: SP; events: any[]; staff?: any[] }) {
  return <form className="filters"><label className="f q">Search<input type="search" name="q" defaultValue={sp.q} placeholder="Name, mobile, email or booking ID" /></label>
    <Field l="Event"><select name="event" defaultValue={sp.event}><Opts any="All events" o={events.map((e) => [e.id, e.name])} /></select></Field><Field l="Appointment date"><input type="date" name="date" defaultValue={sp.date} /></Field>
    {staff && <Field l="Staff"><select name="staff" defaultValue={sp.staff}><Opts any="All staff" o={[['none', 'Unassigned'], ...staff.map((s) => [s.id, s.name] as const)]} /></select></Field>}
    <Field l="Booking status"><select name="status" defaultValue={sp.status}><Opts any="All" o={STATUS} /></select></Field><Field l="Attendance"><select name="attendance" defaultValue={sp.attendance}><Opts any="All" o={ATT} /></select></Field><button className="btn">Filter</button><Link className="btn ghost" href="?">Clear</Link></form>;
}
export function ReservationTable({ rows, total, sp, base }: { rows: any[]; total: number; sp: SP; base: string }) {
  if (!rows.length) return <div className="card"><Empty>No reservations match.</Empty></div>;
  return <div className="card flush"><div className="tw"><table className="cards"><thead><tr>{['Booking ID', 'Participant', 'Event', 'Appointment', 'Staff', 'Booking', 'Attendance', 'Booked on'].map((h) => <th key={h}>{h}</th>)}</tr></thead>
    <tbody>{rows.map((r) => <tr key={r.id}><td data-l="Booking ID" className="b nowrap"><Link href={`${base}/${r.id}`}>{r.reference}</Link></td>
      <td data-l="Participant"><div className="cell2"><span className="b">{r.participant_name}</span><span className="small muted nowrap">{r.mobile}{r.email && <> · {r.email}</>}</span></div></td>
      <td data-l="Event">{r.event_name}</td>
      <td data-l="Appointment" className="nowrap"><div className="cell2"><span>{fmtDate(r.starts_at)}</span><span className="small muted">{fmtRange(r.starts_at, r.ends_at)}</span></div></td>
      <td data-l="Staff">{r.staff_name ?? <span className="muted">Unassigned</span>}</td><td data-l="Booking"><Badge v={r.status} /></td><td data-l="Attendance"><Badge v={r.attendance} /></td><td data-l="Booked on" className="nowrap small muted">{fmtDateTime(r.created_at)}</td></tr>)}</tbody></table></div><Pager sp={sp} total={total} /></div>;
}
