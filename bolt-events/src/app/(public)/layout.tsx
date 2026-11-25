import Link from 'next/link';
import type { ReactNode } from 'react';
import { CalendarCheck, LogIn } from 'lucide-react';
import { Brand } from '@/components/brand';
import { Attribution } from '@/components/attribution';
export default function L({ children }: { children: ReactNode }) {
  return <div className="pub"><Attribution />
    <header className="pubtop"><div className="wrap"><div className="row" style={{ gap: 36 }}><Brand /><nav className="pubnav" aria-label="Main"><Link href="/events">Events</Link><Link href="/booking/manage">Manage booking</Link></nav></div>
      <div className="row"><Link className="btn ghost sm hide-s" href="/login"><LogIn size={15} />Staff sign in</Link><Link className="btn sm" href="/booking/manage"><CalendarCheck size={15} />My booking</Link></div></div></header>
    <main className="pubmain"><div className="wrap">{children}</div></main>
    <footer className="foot"><div className="wrap foot-grid">
      <div className="stack-s"><Brand /><p className="small muted">Event appointments by Bolt Academy. Pick an event, choose a time and reserve your place in under a minute.</p></div>
      <div className="stack-s"><h3>Bookings</h3><Link href="/events">Browse events</Link><Link href="/booking/manage">Manage or cancel a booking</Link></div>
      <div className="stack-s"><h3>Team</h3><Link href="/login">Staff and admin sign in</Link></div>
      <div className="stack-s"><h3>Good to know</h3><span className="small muted">All times are in India Standard Time (IST).</span></div>
    </div><div className="wrap foot-bottom small muted"><span>© {new Date().getFullYear()} Bolt Academy</span><span>Bolt Events</span></div></footer></div>;
}
