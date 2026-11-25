import Link from 'next/link';
export default function NotFound() {
  return <div className="auth"><div className="card stack"><h1>Page not found</h1><p className="muted">The link may be incorrect, or the event is no longer available.</p><Link className="btn" href="/events">See events</Link></div></div>;
}
