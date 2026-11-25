'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { BarChart3, CalendarDays, CalendarRange, ClipboardCheck, Clock, LayoutDashboard, LogOut, Menu, Settings, Ticket, UserRound, Users, X } from 'lucide-react';
import { Brand } from './brand';
import { logout } from '@/app/login/actions';

const ICON = { dashboard: LayoutDashboard, events: CalendarRange, reservations: Ticket, calendar: CalendarDays, slots: Clock, staff: Users, reports: BarChart3, settings: Settings, attendance: ClipboardCheck, profile: UserRound };
const NAV = { admin: ['dashboard', 'events', 'reservations', 'calendar', 'slots', 'staff', 'reports', 'settings'], staff: ['dashboard', 'events', 'reservations', 'calendar', 'attendance', 'profile'] } as const;

export function Shell({ role, name, children }: { role: 'admin' | 'staff'; name: string; children: ReactNode }) {
  const path = usePathname(); const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);
  return <div className="shell">
    <div className="top"><Brand href={`/${role}/dashboard`} /><button className="btn ghost sm" onClick={() => setOpen(true)} aria-label="Open menu" aria-expanded={open}><Menu size={18} /></button></div>
    {open && <button className="scrim" aria-label="Close menu" onClick={() => setOpen(false)} />}
    <aside className={`side${open ? ' open' : ''}`}>
      <div className="row between"><Brand href={`/${role}/dashboard`} />{open && <button className="btn ghost sm" aria-label="Close menu" onClick={() => setOpen(false)}><X size={16} /></button>}</div>
      <nav className="nav" aria-label="Main">{NAV[role].map((k) => { const I = ICON[k], on = path.startsWith(`/${role}/${k}`); return <Link key={k} href={`/${role}/${k}`} className={on ? 'on' : ''} aria-current={on ? 'page' : undefined}><I size={18} />{k[0].toUpperCase() + k.slice(1)}</Link>; })}</nav>
      <div className="who stack-s"><div><div className="b">{name}</div><div className="small muted">{role === 'admin' ? 'Administrator' : 'Staff'}</div></div>
        <form action={logout}><button className="btn ghost sm block"><LogOut size={15} />Sign out</button></form></div>
    </aside>
    <main className="main"><div className="stack">{children}</div></main>
  </div>;
}
