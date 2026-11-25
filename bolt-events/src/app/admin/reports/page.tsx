import Link from 'next/link';
import { AutoSelect } from '@/components/client-bits';
import { Empty, Head, HBars, qs, RangeFilter, TrendChart } from '@/components/ui';
import { db, requireRole } from '@/lib/auth';
import { label, parseRange } from '@/lib/format';
import { attendanceReport, eventOptions, eventReport, marketingReport, staffReport, trend, type SP } from '@/lib/queries';
import type { Row } from '@/lib/db';
export const metadata = { title: 'Reports' };
const TABS = [['events', 'Events'], ['marketing', 'Marketing'], ['staff', 'Staff'], ['attendance', 'Attendance']];
const COLS: Record<string, [string, string][]> = { events: [['name', 'Event'], ['total', 'Reservations'], ['confirmed', 'Confirmed'], ['rescheduled', 'Rescheduled'], ['cancelled', 'Cancelled'], ['attended', 'Attended or checked in'], ['no_show', 'No show']], marketing: [['event_name', 'Event'], ['source', 'Source'], ['medium', 'Medium'], ['campaign', 'Campaign'], ['campaign_id', 'Campaign ID'], ['adset_id', 'Ad set ID'], ['ad_id', 'Ad ID'], ['total', 'Reservations'], ['cancelled', 'Cancelled'], ['attended', 'Attended']], staff: [['name', 'Staff'], ['assigned', 'Assigned'], ['attended', 'Attended or checked in'], ['no_show', 'No show'], ['upcoming', 'Upcoming']], attendance: [['status', 'Attendance'], ['n', 'Reservations']] };
export default async function P({ searchParams }: { searchParams: Promise<SP> }) {
  await requireRole('admin'); const sp = await searchParams, r = parseRange(sp), tab = TABS.some(([k]) => k === sp.tab) ? sp.tab! : 'events';
  const d = await db(async (q) => ({ rows: (tab === 'events' ? await eventReport(q, r.from, r.to) : tab === 'marketing' ? await marketingReport(q, r.from, r.to, sp.event) : tab === 'staff' ? await staffReport(q, r.from, r.to) : (await attendanceReport(q, r.from, r.to)).map((x) => ({ ...x, status: label(x.status) }))) as Row[], trend: tab === 'events' ? await trend(q, r.from, r.to) : [], events: tab === 'marketing' ? await eventOptions(q) : [] }));
  const cols = COLS[tab], ex = (f: string) => `/api/export/${tab}${qs({ range: r.key, from: r.from, to: r.to, event: sp.event }, { format: f })}`;
  const bySource = new Map<string, number>(); if (tab === 'marketing') for (const x of d.rows) bySource.set(x.source, (bySource.get(x.source) ?? 0) + x.total);
  return <><Head title="Reports" sub={['staff', 'attendance'].includes(tab) ? 'By appointment date' : 'By booking date'}><a className="btn ghost" href={ex('csv')}>CSV</a><a className="btn ghost" href={ex('xlsx')}>Excel</a></Head>
    <nav className="tabs" aria-label="Reports">{TABS.map(([k, t]) => <Link key={k} className={k === tab ? 'on' : ''} href={qs({ range: sp.range, from: sp.from, to: sp.to }, { tab: k })}>{t}</Link>)}</nav><RangeFilter sp={{ ...sp, tab }} r={r} />
    {tab === 'marketing' && <form className="filters"><input type="hidden" name="tab" value="marketing" /><input type="hidden" name="range" value={r.key} /><input type="hidden" name="from" value={r.from} /><input type="hidden" name="to" value={r.to} /><label className="f q">Event<AutoSelect name="event" defaultValue={sp.event ?? ''}><option value="">All events</option>{d.events.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</AutoSelect></label></form>}
    {tab === 'events' && <div className="card"><h2>Booking trend</h2><TrendChart data={d.trend as any} /></div>}{tab === 'marketing' && bySource.size > 0 && <div className="card"><h2>Reservations by source</h2><HBars data={[...bySource].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([l, n]) => ({ label: l, n }))} /></div>}
    {d.rows.length ? <div className="card flush"><div className="tw"><table><thead><tr>{cols.map(([k, t]) => <th key={k} className={typeof d.rows[0][k] === 'number' ? 'right' : ''}>{t}</th>)}</tr></thead><tbody>{d.rows.map((x, i) => <tr key={i}>{cols.map(([k]) => <td key={k} className={typeof x[k] === 'number' ? 'right num' : ''}>{x[k] ?? '–'}</td>)}</tr>)}</tbody></table></div></div> : <div className="card"><Empty>No data for this period.</Empty></div>}</>;
}
