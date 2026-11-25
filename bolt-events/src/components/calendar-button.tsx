import { CalendarPlus } from 'lucide-react';
import { addToCalendarUrl } from '@/lib/calendar-link';
/** Opens Google Calendar with this appointment filled in, so the participant gets Google's own reminders. */
export function CalendarButton({ b }: { b: any }) {
  if (!b?.starts_at || b.status === 'cancelled') return null;
  const where = b.event_type === 'online' ? b.meeting_link ?? 'Online' : b.location ?? '';
  const href = addToCalendarUrl({ title: `${b.event_name} (${b.reference})`, start: b.starts_at, end: b.ends_at, location: where, details: `Bolt Academy booking ${b.reference}.${b.event_type === 'online' && b.meeting_link ? `\nJoin: ${b.meeting_link}` : ''}` });
  return <a className="btn ghost" href={href} target="_blank" rel="noopener noreferrer"><CalendarPlus size={17} />Add to Google Calendar</a>;
}
