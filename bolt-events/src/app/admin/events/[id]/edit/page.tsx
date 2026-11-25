import Link from 'next/link';
import { notFound } from 'next/navigation';
import { EventForm } from '@/components/event-form';
import { Head } from '@/components/ui';
import { db, requireRole } from '@/lib/auth';
import { isUuid } from '@/lib/queries';
export const metadata = { title: 'Edit event' };
export default async function P({ params }: { params: Promise<{ id: string }> }) {
  await requireRole('admin'); const { id } = await params; if (!isUuid(id)) notFound();
  const { e, days } = await db(async (q) => ({ e: (await q('select * from events where id = $1', [id]))[0], days: (await q('select distinct extract(isodow from date)::int d from event_dates where event_id = $1 order by 1', [id])).map((r) => r.d) }));
  if (!e) notFound();
  return <><Head title="Edit event" sub={e.name}><Link className="btn ghost" href={`/admin/slots?event=${id}`}>Manage slots</Link></Head><EventForm e={e} days={days.length ? days : undefined} /></>;
}
