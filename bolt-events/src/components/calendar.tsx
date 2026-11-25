import Link from 'next/link';
import { addDays, fmtDayLong, fmtMonth, fmtRange, istDate } from '@/lib/format';
import { Badge, Empty, Head } from './ui';
import type { SP } from '@/lib/queries';
export function monthOf(sp: SP) {
  const today = istDate(), d = /^\d{4}-\d{2}-\d{2}$/.test(sp.day ?? '') && !Number.isNaN(Date.parse(sp.day!)) ? sp.day! : today, first = `${d.slice(0, 7)}-01`;
  const dow = (new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7, start = addDays(first, -dow), next = addDays(`${d.slice(0, 7)}-28`, 4).slice(0, 7) + '-01', last = addDays(next, -1);
  const weeks = Math.ceil((dow + Number(last.slice(8))) / 7);
  return { day: d, first, start, end: addDays(start, weeks * 7 - 1), next, prev: addDays(first, -1).slice(0, 7) + '-01', today };
}
export function Calendar({ m, rows, base }: { m: ReturnType<typeof monthOf>; rows: any[]; base: string }) {
  const days: string[] = []; for (let d = m.start; d <= m.end; d = addDays(d, 1)) days.push(d);
  const count = new Map<string, number>(); for (const r of rows) count.set(r.day, (count.get(r.day) ?? 0) + 1);
  const list = rows.filter((r) => r.day === m.day);
  return <><Head title="Calendar" sub={fmtMonth(m.first)}><Link className="btn ghost sm" href={`?day=${m.prev}`}>Previous</Link><Link className="btn ghost sm" href={`?day=${m.today}`}>Today</Link><Link className="btn ghost sm" href={`?day=${m.next}`}>Next</Link></Head>
    <div className="cal">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div className="h" key={d}>{d}</div>)}{days.map((d) => { const n = count.get(d) ?? 0; return <Link key={d} href={`?day=${d}`} scroll={false} className={`${d.slice(0, 7) !== m.first.slice(0, 7) ? 'out ' : ''}${d === m.day ? 'on ' : ''}${d === m.today ? 'today' : ''}`} aria-label={`${fmtDayLong(d)}, ${n} ${n === 1 ? 'appointment' : 'appointments'}`}><b>{Number(d.slice(8))}</b>{n > 0 && <em>{n} <span>{n === 1 ? 'appointment' : 'appointments'}</span></em>}</Link>; })}</div>
    <div className="card"><h2>{fmtDayLong(m.day)}</h2><Schedule rows={list} base={base} empty="No appointments on this day." /></div></>;
}
export function Schedule({ rows, base, empty }: { rows: any[]; base: string; empty: string }) {
  if (!rows.length) return <Empty>{empty}</Empty>;
  return <div className="list">{rows.map((r) => <div key={r.id} className="sched-row"><div className="grow"><Link className="b" href={`${base}/reservations/${r.id}`}>{r.participant_name}</Link><div className="small muted">{r.event_name}{r.staff_name ? `, ${r.staff_name}` : ''}</div></div><div className="sched-meta"><span className="small nowrap num">{fmtRange(r.starts_at, r.ends_at)}</span><Badge v={r.attendance} /></div></div>)}</div>;
}
