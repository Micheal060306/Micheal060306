import { fmtLong, fmtRange } from '@/lib/format';
import { Badge } from './badge';
export function BookingCard({ b }: { b: any }) {
  return <dl className="kv"><dt>Status</dt><dd><Badge v={b.status} /></dd><dt>Name</dt><dd>{b.participant_name}</dd><dt>Event</dt><dd>{b.event_name}</dd><dt>Date</dt><dd>{fmtLong(b.starts_at)}</dd><dt>Time</dt><dd>{fmtRange(b.starts_at, b.ends_at)} IST</dd>
    {b.event_type === 'offline' ? b.location && <><dt>Location</dt><dd>{b.location}</dd></> : b.meeting_link && <><dt>Joining link</dt><dd><a href={b.meeting_link} rel="noreferrer noopener" target="_blank">{b.meeting_link}</a></dd></>}</dl>;
}
