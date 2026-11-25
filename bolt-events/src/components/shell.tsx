'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { BarChart3, CalendarDays, CalendarRange, ChevronRight, ClipboardCheck, Clock, ExternalLink, LayoutDashboard, LogOut, Menu, PanelLeftClose, PanelLeftOpen, Settings, Ticket, UserRound, Users, X } from 'lucide-react';
import { Brand } from './brand';
import { logout } from '@/app/login/actions';

const ICON = { dashboard: LayoutDashboard, events: CalendarRange, reservations: Ticket, calendar: CalendarDays, slots: Clock, staff: Users, reports: BarChart3, settings: Settings, attendance: ClipboardCheck, profile: UserRound };
type Key = keyof typeof ICON;
const NAV: Record<'admin' | 'staff', { group: string; items: Key[] }[]> = {
  admin: [{ group: 'Overview', items: ['dashboard', 'calendar'] }, { group: 'Manage', items: ['events', 'reservations', 'slots', 'staff'] }, { group: 'Insights', items: ['reports'] }, { group: 'System', items: ['settings'] }],
  staff: [{ group: 'Overview', items: ['dashboard', 'calendar'] }, { group: 'Work', items: ['events', 'reservations', 'attendance'] }, { group: 'Account', items: ['profile'] }],
};
const title = (s: string) => s[0].toUpperCase() + s.slice(1);
const COOKIE = 'bolt_sidebar';
const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';

function Crumbs({ role, path }: { role: string; path: string }) {
  const parts = path.split('/').filter(Boolean).slice(1);
  const section = parts[0] as Key | undefined;
  const rest = parts.slice(1).map((p) => (/^[0-9a-f-]{36}$/.test(p) ? 'Details' : title(p)));
  return <nav className="crumbs" aria-label="Breadcrumb"><span>{role === 'admin' ? 'Admin' : 'Staff'}</span>
    {section && <><ChevronRight size={14} />{rest.length ? <Link href={`/${role}/${section}`}>{title(section)}</Link> : <b>{title(section)}</b>}</>}
    {rest.map((r, i) => <span key={i} className="row" style={{ gap: 6 }}><ChevronRight size={14} />{i === rest.length - 1 ? <b>{r}</b> : <span>{r}</span>}</span>)}</nav>;
}

export function Shell({ role, name, collapsed = false, children }: { role: 'admin' | 'staff'; name: string; collapsed?: boolean; children: ReactNode }) {
  const path = usePathname(); const [open, setOpen] = useState(false); const [mini, setMini] = useState(collapsed);
  useEffect(() => setOpen(false), [path]);
  useEffect(() => { // close row menus on outside click or Escape
    const close = (t: EventTarget | null) => document.querySelectorAll<HTMLDetailsElement>('details.menu[open]').forEach((d) => { if (!(t instanceof Node && d.contains(t))) d.open = false; });
    const click = (e: MouseEvent) => close(e.target), key = (e: KeyboardEvent) => { if (e.key === 'Escape') close(null); };
    document.addEventListener('click', click); document.addEventListener('keydown', key);
    return () => { document.removeEventListener('click', click); document.removeEventListener('keydown', key); };
  }, []);
  const toggle = () => { const next = !mini; setMini(next); document.cookie = `${COOKIE}=${next ? 'mini' : 'full'}; path=/; max-age=31536000; samesite=lax`; };
  const who = role === 'admin' ? 'Administrator' : 'Staff';
  return <div className={`shell${mini ? ' mini' : ''}`}>
    <div className="top"><Brand href={`/${role}/dashboard`} /><button className="btn ghost sm" onClick={() => setOpen(true)} aria-label="Open menu" aria-expanded={open}><Menu size={18} /></button></div>
    {open && <button className="scrim" aria-label="Close menu" onClick={() => setOpen(false)} />}
    <aside className={`side${open ? ' open' : ''}`}>
      <div className="row between side-head"><Brand href={`/${role}/dashboard`} />{open && <button className="btn ghost sm" aria-label="Close menu" onClick={() => setOpen(false)}><X size={16} /></button>}</div>
      <nav className="nav" aria-label="Main">{NAV[role].map((g) => <div key={g.group} className="nav-group"><div className="nav-label">{g.group}</div>
        {g.items.map((k) => { const I = ICON[k], on = path.startsWith(`/${role}/${k}`); return <Link key={k} href={`/${role}/${k}`} className={on ? 'on' : ''} aria-current={on ? 'page' : undefined} title={mini ? title(k) : undefined}><I size={18} /><span>{title(k)}</span></Link>; })}</div>)}</nav>
      <button className="collapse" onClick={toggle} aria-label={mini ? 'Expand sidebar' : 'Collapse sidebar'} title={mini ? 'Expand sidebar' : 'Collapse sidebar'}>{mini ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}<span>Collapse</span></button>
      <div className="who side-who stack-s"><div><div className="b">{name}</div><div className="small muted">{who}</div></div>
        <form action={logout}><button className="btn ghost sm block"><LogOut size={15} />Sign out</button></form></div>
    </aside>
    <div className="content">
      <header className="appbar"><Crumbs role={role} path={path} />
        <div className="row" style={{ gap: 14 }}>
          <a className="btn ghost sm" href="/events" target="_blank" rel="noopener"><ExternalLink size={15} />Booking site</a>
          <div className="user"><span className="avatar" aria-hidden>{initials(name)}</span><div className="user-name"><div className="b">{name}</div><div className="small muted">{who}</div></div></div>
          <form action={logout}><button className="btn ghost sm" aria-label="Sign out" title="Sign out"><LogOut size={15} /></button></form>
        </div></header>
      <main className="main"><div className="stack">{children}</div></main>
    </div>
  </div>;
}
