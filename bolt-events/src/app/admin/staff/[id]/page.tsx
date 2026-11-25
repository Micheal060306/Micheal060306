import Link from 'next/link';
import { notFound } from 'next/navigation';
import { inviteLink, saveStaff, setStaffEvents } from '@/app/admin/actions';
import { ActionForm } from '@/components/action-form';
import { Schedule } from '@/components/calendar';
import { WEEK } from '@/components/event-form';
import { Badge, Field, Head, HBars } from '@/components/ui';
import { db, requireRole } from '@/lib/auth';
import { addDays, fmtDateTime, istDate } from '@/lib/format';
import { isUuid, reservationsBetween, staffReport } from '@/lib/queries';
export const metadata = { title: 'Staff member' };
export default async function P({ params }: { params: Promise<{ id: string }> }) {
  await requireRole('admin'); const { id } = await params; if (!isUuid(id)) notFound(); const t = istDate();
  const d = await db(async (q) => ({ s: (await q('select st.*, p.full_name, p.email, p.is_active, p.last_login_at from staff st join profiles p on p.id = st.profile_id where st.id = $1', [id]))[0],
    events: await q(`select e.id, e.name, e.status, a.id is not null mine from events e left join staff_assignments a on a.event_id = e.id and a.staff_id = $1 where e.status in ('draft','published') or a.id is not null order by e.name`, [id]),
    sched: (await reservationsBetween(q, t, addDays(t, 13))).filter((r) => r.staff_id === id), perf: (await staffReport(q, addDays(t, -29), t)).find((r) => r.id === id) }));
  const { s, perf } = d; if (!s) notFound();
  return <><Head title={s.full_name} sub={s.last_login_at ? `Last signed in ${fmtDateTime(s.last_login_at)}` : 'Has not signed in yet'}>{s.is_active ? <Badge v="active" /> : <Badge v="inactive" />}<Link className="btn ghost" href="/admin/staff">All staff</Link></Head>
    <div className="grid g21"><div className="stack"><div className="card"><h2>Profile and availability</h2><ActionForm action={saveStaff} hidden={{ id }} className="stack"><div className="grid g2"><Field l="Full name" req><input name="name" required defaultValue={s.full_name} /></Field><Field l="Email" req><input name="email" type="email" required defaultValue={s.email} /></Field><Field l="Mobile number"><input name="phone" type="tel" defaultValue={s.phone ?? ''} /></Field><Field l="Designation"><input name="designation" defaultValue={s.designation ?? ''} /></Field><Field l="Working hours start"><input name="work_start" type="time" required defaultValue={s.work_start.slice(0, 5)} /></Field><Field l="Working hours end"><input name="work_end" type="time" required defaultValue={s.work_end.slice(0, 5)} /></Field><Field l="Appointments per day, maximum"><input name="max" type="number" min={1} max={1000} required defaultValue={s.max_daily_reservations} /></Field><Field l="Unavailable dates" hint="YYYY-MM-DD, one per line."><textarea name="off" defaultValue={s.unavailable_dates.join('\n')} /></Field></div>
      <fieldset><legend>Working days</legend><div className="row" style={{ gap: 18 }}>{WEEK.map((w, i) => <label className="check" key={w}><input type="checkbox" name={`d${i + 1}`} defaultChecked={s.working_days.includes(i + 1)} />{w}</label>)}</div></fieldset>
      <div className="stack-s"><label className="check"><input type="checkbox" name="is_active" defaultChecked={s.is_active} />Account is active</label><label className="check"><input type="checkbox" name="can_reschedule" defaultChecked={s.can_reschedule} />May reschedule appointments</label><label className="check"><input type="checkbox" name="auto_assign" defaultChecked={s.auto_assign} />Include in automatic assignment</label></div><div><button className="btn">Save profile</button></div></ActionForm></div>
      <div className="card"><h2>Schedule, next 14 days</h2><Schedule rows={d.sched.map((r) => ({ ...r, staff_name: new Date(r.starts_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' }) }))} base="/admin" empty="No assigned appointments." /></div></div>
      <div className="stack"><div className="card"><h2>Performance, last 30 days</h2><HBars data={[{ label: 'Assigned', n: perf?.assigned ?? 0 }, { label: 'Attended or checked in', n: perf?.attended ?? 0 }, { label: 'No show', n: perf?.no_show ?? 0 }]} /></div>
        <div className="card"><h2>Assigned events</h2><ActionForm action={setStaffEvents} hidden={{ id }} className="stack-s">{d.events.map((e) => <label className="check" key={e.id}><input type="checkbox" name="event" value={e.id} defaultChecked={e.mine} />{e.name}</label>)}{d.events.length ? <button className="btn sm">Save events</button> : <p className="muted">No events yet.</p>}</ActionForm></div>
        <div className="card"><h2>Sign-in link</h2><p className="small muted" style={{ marginBottom: 10 }}>Creates a single-use link to set a new password. Any earlier link stops working.</p><ActionForm action={inviteLink} hidden={{ profile: s.profile_id }} className="stack-s"><button className="btn ghost sm">Create sign-in link</button></ActionForm></div></div></div></>;
}
