import Link from 'next/link';
import { MoreHorizontal, Plus } from 'lucide-react';
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
    {rows.length ? <div className="card flush pop"><div className="tw"><table className="cards"><thead><tr><th>Event</th><th>Type</th>{['Slots', 'Capacity', 'Booked', 'Available'].map((h) => <th key={h} className="right">{h}</th>)}{['Status', 'Created'].map((h) => <th key={h}>{h}</th>)}<th className="right">Actions</th></tr></thead><tbody>{rows.map((e) => <tr key={e.id}>
      <td data-l="Event"><div className="cell2"><Link className="b" href={`/admin/events/${e.id}`}>{e.name}</Link><span className="small muted nowrap">{fmtSpan(e.start_date, e.end_date)}</span></div></td><td data-l="Type"><Badge v={e.event_type} /></td><td data-l="Total slots" className="right num">{e.slots}</td><td data-l="Total capacity" className="right num">{e.capacity}</td><td data-l="Booked" className="right num">{e.booked}</td><td data-l="Available" className="right num">{e.capacity - e.booked}</td>
      <td data-l="Status"><div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}><Badge v={e.status} /><Badge v={e.visibility} /></div></td><td data-l="Created" className="nowrap small muted">{fmtDate(e.created_at)}</td>
      <td data-l=""><div className="row actions"><Link className="btn ghost sm" href={`/admin/events/${e.id}/edit`}>Edit</Link><CopyButton text={`${appUrl()}/events/${e.slug}`} /><details className="menu"><summary className="btn ghost sm" aria-label={`More actions for ${e.name}`} title="More actions"><MoreHorizontal size={16} /></summary><div className="menu-pop"><Link className="btn ghost sm" href={`/admin/events/${e.id}`}>View details</Link><EventCommands e={e} compact /></div></details></div></td></tr>)}</tbody></table></div><Pager sp={sp} total={total} /></div>
      : <div className="card"><Empty>{Object.values(sp).some(Boolean) ? 'No events match these filters.' : <>You have not created any events yet.<br /><Link className="btn" href="/admin/events/create">Create your first event</Link></>}</Empty></div>}</>;
}
