import { changePassword, saveOwnProfile } from '@/app/account-actions';
import { ActionForm } from '@/components/action-form';
import { WEEK } from '@/components/event-form';
import { Field, Head } from '@/components/ui';
import { db, requireRole } from '@/lib/auth';
import { fmtHM } from '@/lib/format';
export const metadata = { title: 'Profile' };
export default async function P() {
  const u = await requireRole('staff'), [s] = await db((q) => q('select * from staff where id = $1', [u.staff_id]));
  return <><Head title="Profile" sub={u.email} /><div className="grid g2"><div className="stack"><div className="card"><h2>Your details</h2><ActionForm action={saveOwnProfile} className="stack"><Field l="Full name"><input name="name" required maxLength={100} defaultValue={u.full_name} /></Field><Field l="Mobile number"><input name="phone" type="tel" defaultValue={s?.phone ?? ''} /></Field><div><button className="btn">Save</button></div></ActionForm></div><div className="card"><h2>Availability</h2><dl className="kv"><dt>Working days</dt><dd>{s?.working_days.map((d: number) => WEEK[d - 1]).join(', ')}</dd><dt>Hours</dt><dd>{s && `${fmtHM(s.work_start)} – ${fmtHM(s.work_end)}`}</dd><dt>Daily limit</dt><dd>{s?.max_daily_reservations} appointments</dd><dt>Rescheduling</dt><dd>{u.can_reschedule ? 'Allowed' : 'Not allowed'}</dd></dl><p className="hint" style={{ marginTop: 10 }}>Ask an administrator to change these.</p></div></div>
    <div className="card"><h2>Change password</h2><ActionForm action={changePassword} className="stack" resetOnOk><Field l="Current password"><input type="password" name="current" autoComplete="current-password" required /></Field><Field l="New password"><input type="password" name="password" autoComplete="new-password" minLength={10} required /></Field><Field l="Confirm new password"><input type="password" name="confirm" autoComplete="new-password" minLength={10} required /></Field><div><button className="btn">Change password</button></div></ActionForm></div></div></>;
}
