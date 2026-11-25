import Link from 'next/link';
import { Badge, Empty, Head } from '@/components/ui';
import { db, requireRole } from '@/lib/auth';
import { fmtSpan } from '@/lib/format';
export const metadata = { title: 'My events' };
export default async function P() {
  await requireRole('staff'); const rows = await db((q) => q(`select e.*, (select count(*)::int from reservations r where r.event_id = e.id and r.status <> 'cancelled') mine from events e order by e.start_date desc`));
  return <><Head title="My events" sub="Events you are assigned to." />{rows.length ? <div className="evcards">{rows.map((e) => <div className="card stack-s" key={e.id}><div className="row between"><h2 className="grow">{e.name}</h2><Badge v={e.status} /></div><p className="muted">{fmtSpan(e.start_date, e.end_date)}</p><p className="muted">{e.event_type === 'online' ? 'Online' : e.location || 'Location not set'}</p>{e.meeting_link && <a href={e.meeting_link} target="_blank" rel="noreferrer noopener">Open meeting link</a>}<p>{e.mine} {e.mine === 1 ? 'booking' : 'bookings'} you can see</p><div><Link className="btn ghost sm" href={`/staff/reservations?event=${e.id}`}>View reservations</Link></div></div>)}</div> : <div className="card"><Empty>You have not been assigned to any events yet.</Empty></div>}</>;
}
