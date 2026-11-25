import Link from 'next/link';
import { notFound } from 'next/navigation';
import { setEventStaff } from '@/app/admin/actions';
import { ActionForm } from '@/components/action-form';
import { CopyButton } from '@/components/client-bits';
import { EventCommands } from '@/components/event-commands';
import { Badge, Empty, Head, HBars } from '@/components/ui';
import { appUrl, db, requireRole } from '@/lib/auth';
import { fmtDateTime, fmtDay, fmtDayShort, fmtHM, fmtSpan, fmtWeekday } from '@/lib/format';
import { isUuid, staffOptions } from '@/lib/queries';
export const metadata = { title: 'Event' };
export default async function P({ params }: { params: Promise<{ id: string }> }) {
  await requireRole('admin'); const { id } = await params; if (!isUuid(id)) notFound();
  const d = await db(async (q) => ({ e: (await q('select * from events where id = $1', [id]))[0], staff: await staffOptions(q), mine: (await q('select staff_id from staff_assignments where event_id = $1', [id])).map((r) => r.staff_id),
    dates: await q(`select d.*, count(s.id)::int slots, coalesce(sum(s.capacity),0)::int cap, coalesce(sum(s.booked_count),0)::int booked from event_dates d left join availability_slots s on s.event_date_id = d.id where d.event_id = $1 group by d.id order by d.date`, [id]) }));
  const { e } = d; if (!e) notFound(); const url = `${appUrl()}/events/${e.slug}`;
  return <><Head title={e.name} sub={fmtSpan(e.start_date, e.end_date)}><Link className="btn ghost sm" href={`/admin/events/${id}/edit`}>Edit</Link><Link className="btn ghost sm" href={`/admin/slots?event=${id}`}>Slots</Link><Link className="btn ghost sm" href={`/admin/reservations?event=${id}`}>Reservations</Link><EventCommands e={e} /></Head>
    <div className="grid g21"><div className="stack"><div className="card"><h2>Booking link</h2><div className="row"><input readOnly value={url} aria-label="Booking link" className="grow" style={{ minWidth: 200 }} /><CopyButton text={url} />{e.status !== 'draft' && <Link className="btn ghost sm" href={`/events/${e.slug}`} target="_blank">Open page</Link>}</div>{e.status === 'draft' && <p className="hint" style={{ marginTop: 8 }}>The link starts working when you publish the event.</p>}</div>
      <div className="card"><h2>Details</h2><dl className="kv"><dt>Status</dt><dd><Badge v={e.status} /></dd><dt>Visibility</dt><dd><Badge v={e.visibility} /></dd><dt>Type</dt><dd><Badge v={e.event_type} /></dd><dt>Location</dt><dd>{e.location || 'Not set'}</dd>{e.meeting_link && <><dt>Meeting link</dt><dd>{e.meeting_link}</dd></>}<dt>Default hours</dt><dd>{fmtHM(e.daily_start_time)} – {fmtHM(e.daily_end_time)}</dd><dt>Default slot</dt><dd>{e.slot_duration_min} minutes, {e.buffer_min} minute buffer, {e.capacity_per_slot} per slot</dd><dt>Deadline</dt><dd>{e.registration_deadline ? fmtDateTime(e.registration_deadline) : 'None'}</dd><dt>Auto assign</dt><dd>{e.auto_assign_staff ? 'On' : 'Off'}</dd><dt>Description</dt><dd className="pre">{e.description || 'None'}</dd></dl></div>
      <div className="card flush"><div className="tw"><table><thead><tr><th>Date</th><th>Hours</th><th className="right">Slots</th><th className="right">Booked</th><th className="right">Available</th><th>State</th></tr></thead><tbody>{d.dates.map((x) => <tr key={x.id}><td className="nowrap"><Link href={`/admin/slots?event=${id}&date=${x.id}`}>{fmtWeekday(x.date)}, {fmtDay(x.date)}</Link></td><td className="nowrap">{fmtHM(x.start_time)} – {fmtHM(x.end_time)}</td><td className="right num">{x.slots}</td><td className="right num">{x.booked}</td><td className="right num">{x.cap - x.booked}</td><td>{x.is_blocked ? <Badge v="blocked" /> : x.booking_enabled ? <Badge v="active" text="Open" /> : <Badge v="inactive" text="Booking off" />}</td></tr>)}</tbody></table></div></div></div>
      <div className="stack"><div className="card"><h2>Assigned staff</h2>{d.staff.length ? <ActionForm action={setEventStaff} hidden={{ id }} className="stack-s">{d.staff.map((s) => <label className="check" key={s.id}><input type="checkbox" name="staff" value={s.id} defaultChecked={d.mine.includes(s.id)} />{s.name}{!s.is_active && <Badge v="inactive" />}</label>)}<button className="btn sm">Save staff</button></ActionForm> : <Empty>No staff yet. <Link href="/admin/staff">Add staff</Link></Empty>}</div>
        <div className="card"><h2>Bookings by date</h2>{d.dates.length ? <HBars of data={d.dates.slice(0, 14).map((x) => ({ label: fmtDayShort(x.date), n: x.booked, max: x.cap }))} /> : <p className="muted">No dates.</p>}</div></div></div></>;
}
