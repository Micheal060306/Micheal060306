import Link from 'next/link';
import { createStaff } from '@/app/admin/actions';
import { ActionForm } from '@/components/action-form';
import { Badge, Empty, Field, Head } from '@/components/ui';
import { db, requireRole } from '@/lib/auth';
import { fmtHM } from '@/lib/format';
export const metadata = { title: 'Staff' };
export default async function P() {
  await requireRole('admin');
  const rows = await db((q) => q(`with t as (select (now() at time zone 'Asia/Kolkata')::date d)
    select st.*, p.full_name, p.email, p.is_active, p.last_login_at, (select count(*)::int from staff_assignments a where a.staff_id = st.id and a.event_id is not null) events,
      (select count(*)::int from staff_assignments a join reservations r on r.id = a.reservation_id and r.status <> 'cancelled' join availability_slots s on s.id = r.slot_id where a.staff_id = st.id and (s.starts_at at time zone 'Asia/Kolkata')::date = t.d) today,
      (extract(isodow from t.d)::int = any(st.working_days) and not t.d = any(st.unavailable_dates)) working
    from t, staff st join profiles p on p.id = st.profile_id order by p.full_name`));
  return <><Head title="Staff" sub="Accounts, availability and assignments." />
    {rows.length ? <div className="card flush"><div className="tw"><table className="cards"><thead><tr><th>Name</th><th>Email</th><th>Designation</th><th>Account</th><th>Today</th><th>Hours</th><th className="right">Events</th><th className="right">Appointments today</th></tr></thead><tbody>{rows.map((s) => <tr key={s.id}><td data-l="Name" className="b"><Link href={`/admin/staff/${s.id}`}>{s.full_name}</Link></td><td data-l="Email">{s.email}</td><td data-l="Designation">{s.designation ?? '–'}</td><td data-l="Account">{s.is_active ? <Badge v="active" /> : <Badge v="inactive" />}</td><td data-l="Today">{!s.is_active ? '–' : !s.working ? <Badge v="no_show" text="Off today" /> : s.today >= s.max_daily_reservations ? <Badge v="full" text="At daily limit" /> : <Badge v="active" text="Available" />}</td><td data-l="Hours" className="nowrap">{fmtHM(s.work_start)} – {fmtHM(s.work_end)}</td><td data-l="Events" className="right num">{s.events}</td><td data-l="Appointments today" className="right num">{s.today} / {s.max_daily_reservations}</td></tr>)}</tbody></table></div></div> : <div className="card"><Empty>No staff accounts yet.</Empty></div>}
    <div className="card"><h2>Add a staff member</h2><ActionForm action={createStaff} className="stack" resetOnOk><div className="grid g2"><Field l="Full name" req><input name="name" required maxLength={100} /></Field><Field l="Email" req><input name="email" type="email" required autoComplete="off" /></Field><Field l="Mobile number"><input name="phone" type="tel" /></Field><Field l="Designation"><input name="designation" maxLength={100} /></Field><Field l="Sign-in"><select name="how"><option value="invite">Invite by email link</option><option value="password">Set a password now</option></select></Field><Field l="Password" hint="Only needed if you set one now. At least 10 characters."><input name="password" type="password" autoComplete="new-password" /></Field></div><div><button className="btn">Add staff member</button></div></ActionForm></div></>;
}
