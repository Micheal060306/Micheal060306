import Link from 'next/link';
import { Schedule } from '@/components/calendar';
import { Head } from '@/components/ui';
import { db, requireRole } from '@/lib/auth';
import { addDays, fmtDayLong, istDate } from '@/lib/format';
import { reservationsBetween } from '@/lib/queries';
export const metadata = { title: 'Dashboard' };
export default async function P() {
  const u = await requireRole('staff'), t = istDate(), rows = await db((q) => reservationsBetween(q, t, addDays(t, 7)));
  const today = rows.filter((r) => r.day === t), next = rows.filter((r) => r.day > t), n = (f: (r: any) => boolean) => today.filter(f).length;
  const K: [string, number][] = [["Today's appointments", today.length], ['Waiting', n((r) => r.attendance === 'not_checked_in')], ['Checked in', n((r) => r.attendance === 'checked_in')], ['Attended', n((r) => r.attendance === 'attended')], ['Next 7 days', next.length]];
  return <><Head title={`Welcome, ${u.full_name.split(' ')[0]}`} sub={fmtDayLong(t)}><Link className="btn" href="/staff/attendance">Take attendance</Link></Head><div className="kpis">{K.map(([k, v]) => <div className="kpi" key={k}><span>{k}</span><b>{v}</b></div>)}</div>
    <div className="grid g2"><div className="card"><h2>Today</h2><Schedule rows={today} base="/staff" empty="No appointments today." /></div><div className="card"><h2>Next 7 days</h2><Schedule rows={next.slice(0, 12)} base="/staff" empty="No upcoming appointments." /></div></div></>;
}
