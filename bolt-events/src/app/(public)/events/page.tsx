import Link from 'next/link';
import { ArrowRight, CalendarDays, MapPin, Video } from 'lucide-react';
import { Empty } from '@/components/ui';
import { anon } from '@/lib/db';
import { fmtSpan } from '@/lib/format';
export const metadata = { title: 'Events' };
export default async function Events({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = '' } = await searchParams;
  const all: any[] = (await anon('select public_events() j'))[0].j;
  const ev = all.filter((e) => e.name.toLowerCase().includes(q.trim().toLowerCase()));
  return <div className="stack" style={{ gap: 26 }}><div className="row between"><div><h1>Book an appointment</h1><p className="muted">Choose an event, pick a time that suits you, and reserve your place.</p></div>{all.length > 5 && <form className="filters"><input className="q" name="q" type="search" placeholder="Search events" aria-label="Search events" defaultValue={q} /><button className="btn ghost">Search</button></form>}</div>
    {ev.length ? <div className="evcards">{ev.map((e) => <Link className="evcard" key={e.id} href={`/events/${e.slug}`}>
      {e.banner_version > 0 ? <img className="ban" src={`/api/banners/${e.id}?v=${e.banner_version}`} alt="" /> : <div className="ban"><CalendarDays size={40} /></div>}
      <div className="bd"><h2>{e.name}</h2><div className="meta"><CalendarDays size={16} />{fmtSpan(e.start_date, e.end_date)}</div><div className="meta">{e.event_type === 'online' ? <Video size={16} /> : <MapPin size={16} />}{e.event_type === 'online' ? 'Online' : e.location || 'Location to be announced'}</div>{e.description && <p className="small muted">{e.description.length > 120 ? `${e.description.slice(0, 120)}…` : e.description}</p>}
        <div className="go row between"><span>{e.closed ? 'Registration closed' : e.available > 0 ? 'See available times' : 'Fully booked'}</span><ArrowRight size={16} /></div></div></Link>)}</div>
      : <div className="card"><Empty>{q ? 'No events match your search.' : 'There are no open events right now. Please check back soon.'}</Empty></div>}</div>;
}
