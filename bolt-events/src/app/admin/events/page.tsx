import Link from 'next/link';
import { Plus } from 'lucide-react';
import { CopyButton } from '@/components/client-bits';
import { EventCommands } from '@/components/event-commands';
import { Badge, Empty, Field, Head, Opts, Pager } from '@/components/ui';
import { appUrl, db, requireRole } from '@/lib/auth';
import { fmtDate, fmtSpan } from '@/lib/format';
import { listEvents, type SP } from '@/lib/queries';
export const metadata = { title: 'Events' };
export default async function P({ searchParams }: { searchParams: Promise<SP> }) {
  await requireRole('admin'); const sp = await searchParams, { rows, total } = await db((q) => listEvents(q, sp));
  return <><Head title="Events" sub="Create events, publish them and share their booking links."><Link className="btn" href="/admin/events/create"><Plus size={17} />Create event</Link></Head>
    <form className="filters"><label className="f q">Search<input type="search" name="q" defaultValue={sp.q} placeholder="Event name" /></label><Field l="Status"><select name="status" defaultValue={sp.status}><Opts any="All" o={[['draft', 'Draft'], ['published', 'Published'], ['completed', 'Completed'], ['cancelled', 'Cancelled']]} /></select></Field><Field l="Visibility"><select name="visibility" defaultValue={sp.visibility}><Opts any="All" o={[['public', 'Public'], ['unlisted', 'Unlisted']]} /></select></Field><Field l="Type"><select name="event_type" defaultValue={sp.event_type}><Opts any="All" o={[['offline', 'Offline'], ['online', 'Online']]} /></select></Field><button className="btn">Filter</button><Link className="btn ghost" href="?">Clear</Link></form>
    {rows.length ? <div className="card flush"><div className="tw"><table className="cards"><thead><tr>{['Event name', 'Event date', 'Type'].map((h) => <th key={h}>{h}</th>)}{['Total slots', 'Total capacity', 'Booked', 'Available'].map((h) => <th key={h} className="right">{h}</th>)}{['Visibility', 'Status', 'Created', 'Actions'].map((h) => <th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((e) => <tr key={e.id}><td data-l="Event" className="b" style={{ minWidth: 170 }}><Link href={`/admin/events/${e.id}`}>{e.name}</Link></td><td data-l="Date" className="nowrap">{fmtSpan(e.start_date, e.end_date)}</td><td data-l="Type"><Badge v={e.event_type} /></td><td data-l="Total slots" className="right num">{e.slots}</td><td data-l="Total capacity" className="right num">{e.capacity}</td><td data-l="Booked" className="right num">{e.booked}</td><td data-l="Available" className="right num">{e.capacity - e.booked}</td><td data-l="Visibility"><Badge v={e.visibility} /></td><td data-l="Status"><Badge v={e.status} /></td><td data-l="Created" className="nowrap">{fmtDate(e.created_at)}</td>
      <td data-l=""><div className="row" style={{ gap: 6, flexWrap: 'wrap', minWidth: 300 }}><Link className="btn ghost sm" href={`/admin/events/${e.id}`}>View</Link><Link className="btn ghost sm" href={`/admin/events/${e.id}/edit`}>Edit</Link><CopyButton text={`${appUrl()}/events/${e.slug}`} /><EventCommands e={e} compact /></div></td></tr>)}</tbody></table></div><Pager sp={sp} total={total} /></div>
      : <div className="card"><Empty>{Object.values(sp).some(Boolean) ? 'No events match these filters.' : <>You have not created any events yet.<br /><Link className="btn" href="/admin/events/create">Create your first event</Link></>}</Empty></div>}</>;
}
