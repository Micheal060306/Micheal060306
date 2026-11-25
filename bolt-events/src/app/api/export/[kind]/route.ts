import type { NextRequest } from 'next/server';
import { error } from '@/lib/api';
import { db, getUser } from '@/lib/auth';
import { toCsv, toXlsx, type Table } from '@/lib/export';
import { istDate, parseRange } from '@/lib/format';
import { attendanceReport, eventReport, marketingReport, reservationTable, staffReport, type SP } from '@/lib/queries';
const pick = (name: string, rows: any[], cols: [string, string][]): Table => ({ name, columns: cols.map((c) => c[1]), rows: rows.map((r) => cols.map((c) => r[c[0]])) });
export async function GET(req: NextRequest, { params }: { params: Promise<{ kind: string }> }) {
  const u = await getUser(); if (u?.role !== 'admin') return error('Not authorised.', u ? 403 : 401);
  const sp = Object.fromEntries(req.nextUrl.searchParams) as SP, { kind } = await params, r = parseRange(sp);
  const t = await db(async (q): Promise<Table | null> => {
    switch (kind) {
      case 'reservations': return reservationTable(q, sp);
      case 'events': return pick('Events', await eventReport(q, r.from, r.to), [['name', 'Event'], ['total', 'Reservations'], ['confirmed', 'Confirmed'], ['rescheduled', 'Rescheduled'], ['cancelled', 'Cancelled'], ['attended', 'Attended or checked in'], ['no_show', 'No show']]);
      case 'marketing': return pick('Marketing', await marketingReport(q, r.from, r.to, sp.event), [['event_name', 'Event'], ['source', 'Source'], ['medium', 'Medium'], ['campaign', 'Campaign'], ['campaign_id', 'Campaign ID'], ['adset_id', 'Ad set ID'], ['ad_id', 'Ad ID'], ['total', 'Reservations'], ['cancelled', 'Cancelled'], ['attended', 'Attended or checked in']]);
      case 'staff': return pick('Staff', await staffReport(q, r.from, r.to), [['name', 'Staff'], ['assigned', 'Assigned'], ['attended', 'Attended or checked in'], ['no_show', 'No show'], ['upcoming', 'Upcoming']]);
      case 'attendance': return pick('Attendance', await attendanceReport(q, r.from, r.to), [['status', 'Status'], ['n', 'Reservations']]);
      default: return null;
    }
  });
  if (!t) return error('Not found.', 404);
  const xlsx = sp.format === 'xlsx', name = `bolt-${kind}-${istDate()}.${xlsx ? 'xlsx' : 'csv'}`;
  return new Response(xlsx ? new Uint8Array(toXlsx(t)) : toCsv(t), { headers: { 'content-type': xlsx ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="${name}"`, 'cache-control': 'no-store' } });
}
