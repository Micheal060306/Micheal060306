import Link from 'next/link';
export function Brand({ href = '/events' }: { href?: string }) {
  return <Link className="brand" href={href}><i><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M13.5 1 4 14h6.5L9.5 23 19 10h-6.5z" /></svg></i><span>Bolt <em>Events</em></span></Link>;
}
