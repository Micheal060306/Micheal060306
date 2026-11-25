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
  return <div className="stack" style={{ gap: 32 }}><section className="hero"><div className="stack-s"><span className="eyebrow">Bolt Academy events</span><h1>Book an appointment</h1><p className="lead">Choose an event, pick a time that suits you, and reserve your place. You get a booking ID and a private link to reschedule or cancel.</p></div>
      <form className="hero-search" role="search"><input name="q" type="search" placeholder="Search events by name" aria-label="Search events" defaultValue={q} /><button className="btn">Search</button></form>
      <div className="hero-stats"><div><b>{all.length}</b><span>{all.length === 1 ? 'open event' : 'open events'}</span></div><div><b>{all.reduce((a, e) => a + Math.max(0, Number(e.available) || 0), 0)}</b><span>places available</span></div><div><b>IST</b><span>all times</span></div></div></section>
    <div className="row between"><h2>{q ? `Results for “${q}”` : 'Upcoming events'}</h2><span className="small muted">{ev.length} {ev.length === 1 ? 'event' : 'events'}</span></div>
    {ev.length ? <div className="evcards">{ev.map((e) => <Link className="evcard" key={e.id} href={`/events/${e.slug}`}>
      {e.banner_version > 0 ? <img className="ban" src={`/api/banners/${e.id}?v=${e.banner_version}`} alt="" /> : <div className="ban"><CalendarDays size={40} /></div>}
      <div className="bd"><div className="row between" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}><h2>{e.name}</h2><span className={`badge ${e.event_type === 'online' ? 'blue' : 'orange'}`}>{e.event_type === 'online' ? 'Online' : 'In person'}</span></div><div className="meta"><CalendarDays size={16} />{fmtSpan(e.start_date, e.end_date)}</div><div className="meta">{e.event_type === 'online' ? <Video size={16} /> : <MapPin size={16} />}{e.event_type === 'online' ? 'Online' : e.location || 'Location to be announced'}</div>{e.description && <p className="small muted">{e.description.length > 120 ? `${e.description.slice(0, 120)}…` : e.description}</p>}
        <div className="go row between"><span>{e.closed ? 'Registration closed' : e.available > 0 ? 'See available times' : 'Fully booked'}</span><ArrowRight size={16} /></div></div></Link>)}</div>
      : <div className="card"><Empty>{q ? 'No events match your search.' : 'There are no open events right now. Please check back soon.'}</Empty></div>}</div>;
}
