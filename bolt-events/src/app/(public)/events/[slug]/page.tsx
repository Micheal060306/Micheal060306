import { notFound } from 'next/navigation';
import { cache } from 'react';
import { CalendarDays, Clock, MapPin, Video } from 'lucide-react';
import { BookingFlow } from '@/components/booking-flow';
import { anon } from '@/lib/db';
import { fmtDateTime, fmtSpan } from '@/lib/format';
type P = { params: Promise<{ slug: string }> };
const load = cache(async (slug: string) => (await anon('select public_event($1) j', [slug]))[0]?.j as any);
export async function generateMetadata({ params }: P) {
  const e = await load((await params).slug); if (!e) return {};
  return { title: e.name, description: e.description.slice(0, 160), robots: e.visibility === 'unlisted' ? { index: false, follow: false } : undefined };
}
export default async function Event({ params }: P) {
  const e = await load((await params).slug); if (!e) notFound();
  return <div className="book"><div className="stack">
    {e.banner_version > 0 ? <img className="ban hero" src={`/api/banners/${e.id}?v=${e.banner_version}`} alt="" /> : <div className="ban hero"><CalendarDays size={56} /></div>}
    <h1>{e.name}</h1>
    <div className="stack-s"><div className="meta"><CalendarDays size={17} />{fmtSpan(e.start_date, e.end_date)}</div>
      <div className="meta">{e.event_type === 'online' ? <Video size={17} /> : <MapPin size={17} />}<span>{e.event_type === 'online' ? 'Online. You receive the joining link after booking.' : `Offline${e.location ? `, ${e.location}` : ''}`}</span></div>
      {e.registration_deadline && <div className="meta"><Clock size={17} />Register by {fmtDateTime(e.registration_deadline)} IST</div>}</div>
    {e.description && <p className="pre">{e.description}</p>}</div>
    <BookingFlow event={{ slug: e.slug, closed: e.closed, status: e.status, deadline: e.registration_deadline }} initial={e.slots} /></div>;
}
