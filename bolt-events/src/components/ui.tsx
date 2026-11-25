import Link from 'next/link';
import type { ReactNode } from 'react';
import { PAGE, page, type SP } from '@/lib/queries';
import { RANGES, fmtDay, fmtDayShort, label } from '@/lib/format';

export { Badge } from './badge';
export const Head = ({ title, sub, children }: { title: string; sub?: ReactNode; children?: ReactNode }) => <div className="row between"><div><h1>{title}</h1>{sub && <p className="muted">{sub}</p>}</div>{children && <div className="row">{children}</div>}</div>;
export const Empty = ({ children }: { children: ReactNode }) => <div className="empty">{children}</div>;
export const qs = (sp: SP, over: SP) => { const u = new URLSearchParams(); for (const [k, v] of Object.entries({ ...sp, ...over })) if (v) u.set(k, v); const s = u.toString(); return s ? `?${s}` : '?'; };
export function Pager({ sp, total }: { sp: SP; total: number }) {
  const p = page(sp), last = Math.max(1, Math.ceil(total / PAGE));
  return <div className="pager small muted"><span>{total} {total === 1 ? 'record' : 'records'}, page {Math.min(p, last)} of {last}</span><span className="row">
    {p > 1 && <Link className="btn ghost sm" href={qs(sp, { page: String(p - 1) })}>Previous</Link>}{p < last && <Link className="btn ghost sm" href={qs(sp, { page: String(p + 1) })}>Next</Link>}</span></div>;
}
export const Field = ({ l, req, hint, children }: { l: string; req?: boolean; hint?: string; children: ReactNode }) => <label className="f"><span className={req ? 'req' : ''}>{l}</span>{children}{hint && <small>{hint}</small>}</label>;
export const Opts = ({ o, any }: { o: readonly (readonly [string, string])[]; any?: string }) => <>{any && <option value="">{any}</option>}{o.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</>;
export const STATUS = (['confirmed', 'rescheduled', 'cancelled'] as const).map((x) => [x, label(x)] as const);
export const ATT = (['not_checked_in', 'checked_in', 'attended', 'no_show'] as const).map((x) => [x, label(x)] as const);

export function RangeFilter({ sp, r }: { sp: SP; r: { key: string; from: string; to: string } }) {
  const keep = { tab: sp.tab, event: sp.event };
  return <div className="stack-s"><div className="chips">{RANGES.filter(([k]) => k !== 'custom').map(([k, t]) => <Link key={k} className={`chip${r.key === k ? ' on' : ''}`} href={qs(keep, { range: k })}>{t}</Link>)}</div>
    <form className="filters"><input type="hidden" name="range" value="custom" />{sp.tab && <input type="hidden" name="tab" value={sp.tab} />}{sp.event && <input type="hidden" name="event" value={sp.event} />}
      <label className="f"><span className="sr">From</span><input type="date" name="from" defaultValue={r.from} key={r.from} required /></label><label className="f"><span className="sr">To</span><input type="date" name="to" defaultValue={r.to} key={r.to} required /></label><button className="btn ghost">Apply dates</button></form></div>;
}
export function TrendChart({ data }: { data: { day: string; n: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.n)), total = data.reduce((a, d) => a + d.n, 0);
  return <div><div className="bars" style={{ marginTop: 24 }} role="img" aria-label={`Bookings per day, ${total} in total, highest ${total ? max : 0}`}>{data.map((d) => <div key={d.day} tabIndex={data.length <= 31 ? 0 : undefined}><i style={{ height: d.n ? `${Math.max(3, (d.n / max) * 88)}%` : 0 }} /><span className="tip"><b>{d.n}</b> {d.n === 1 ? 'booking' : 'bookings'}, {fmtDayShort(d.day)}</span></div>)}</div>
    <div className="axis"><span>{data[0] && fmtDayShort(data[0].day)}</span><span>Highest day: {total ? max : 0}</span><span>{data.length > 1 && fmtDayShort(data[data.length - 1].day)}</span></div>
    <details><summary>View as table</summary><div className="tw" style={{ maxHeight: 220 }}><table><thead><tr><th>Date</th><th className="right">Bookings</th></tr></thead><tbody>{data.map((d) => <tr key={d.day}><td>{fmtDay(d.day)}</td><td className="right num">{d.n}</td></tr>)}</tbody></table></div></details></div>;
}
export function HBars({ data, of }: { data: { label: string; n: number; max?: number }[]; of?: boolean }) {
  const max = Math.max(1, ...data.map((d) => d.n));
  return <div className="stack-s" style={{ gap: 14 }}>{data.map((d, i) => <div className="hbar" key={i} title={`${d.label}: ${d.n}${of ? ` of ${d.max}` : ''}`}><div className="row between small" style={{ flexWrap: 'nowrap' }}><span className="grow">{d.label}</span><span className="num b nowrap">{d.n}{of && <span className="muted"> / {d.max}</span>}</span></div><div className="t"><i style={{ width: `${(d.n / (of ? d.max || 1 : max)) * 100}%` }} /></div></div>)}</div>;
}
